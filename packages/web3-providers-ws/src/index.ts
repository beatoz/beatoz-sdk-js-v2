/*
    Copyright 2023 All BEATOZ Developers

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

import { ReconnectingSocket } from './socket/reconnecting_socket.js';

import { Listener, Producer, Stream, Subscription } from 'xstream';
import {
    JsonRpcId,
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcResponseWithError,
    JsonRpcResponseWithResult,
    Web3APIPayload,
    SubscriptionEvent,
} from '@beatoz/web3-types';
import { ConnectionStatus } from './socket/queueing_streaming_socket.js';
import { SocketWrapperMessageEvent } from './socket/socket_wrapper.js';
import { isNullish } from '@beatoz/web3-utils';
import {
    BaseError,
    InvalidInputError,
    InvalidResponseError,
    isRpcErrorObject,
    RpcRequestError,
    SocketClosedError,
} from '@beatoz/web3-errors';

class RpcEventProducer implements Producer<SubscriptionEvent> {
    private readonly request: JsonRpcRequest;
    private readonly socket: ReconnectingSocket;
    private readonly url: string;

    private running = false;
    private subscriptions: Subscription[] = [];

    public constructor(request: JsonRpcRequest, socket: ReconnectingSocket, url: string) {
        this.request = request;
        this.socket = socket;
        this.url = url;
    }

    /**
     * Implementation of Producer.start
     */
    public start(listener: Listener<SubscriptionEvent>): void {
        if (this.running) {
            throw new BaseError('Already started. Please stop first before restarting.');
        }
        this.running = true;

        this.connectToClient(listener);

        this.socket.queueRequest(JSON.stringify(this.request));
    }

    /**
     * Implementation of Producer.stop
     *
     * Called by the stream when the stream's last listener stopped listening
     * or when the producer completed.
     */
    public stop(): void {
        this.running = false;
        // A stopped producer listens to nothing more; otherwise a later drop
        // would still end the stream nobody listens to.
        this.closeSubscriptions();
        // Tell the server we are done in order to save resources. We cannot wait for the result.
        // This may fail when socket connection is not open, thus ignore errors in queueRequest
        const endRequest: JsonRpcRequest = { ...this.request, method: 'unsubscribe' };
        try {
            this.socket.queueRequest(JSON.stringify(endRequest));
        } catch (error) {
            // After disconnect() there is no server to tell.
            if (!(error instanceof SocketClosedError)) {
                throw error;
            }
        }
    }

    protected connectToClient(listener: Listener<SubscriptionEvent>): void {
        const responseStream = this.socket.events.map(toJsonRpcResponse);

        // this should unsubscribe itself, so doesn't need to be removed explicitly
        const idSubscription = responseStream
            .filter((response) => response.id === this.request.id)
            .subscribe({
                next: (response) => {
                    if (isJsonRpcErrorResponse(response)) {
                        this.closeSubscriptions();
                        listener.error(this.rpcError(response));
                    }
                    idSubscription.unsubscribe();
                },
            });

        // this will fire on a response (success or error)
        // Tendermint adds an "#event" suffix for events that follow a previous subscription
        // https://github.com/tendermint/tendermint/blob/v0.23.0/rpc/core/events.go#L107
        const idEventSubscription = responseStream
            .filter((response) => response.id === this.request.id)
            .subscribe({
                next: (response) => {
                    if (isJsonRpcErrorResponse(response)) {
                        this.closeSubscriptions();
                        listener.error(this.rpcError(response));
                    } else {
                        listener.next(response.result as unknown as SubscriptionEvent);
                    }
                },
            });

        // this will fire in case the websocket disconnects cleanly
        const nonResponseSubscription = responseStream.subscribe({
            error: (error) => {
                this.closeSubscriptions();
                listener.error(error);
            },
            complete: () => {
                this.closeSubscriptions();
                listener.complete();
            },
        });

        // The connection dropping ends the subscription: the node forgets it,
        // and nothing more arrives for it. The current status, which the
        // stream repeats to a new subscriber, is skipped.
        const closedSubscription = this.socket.connectionStatus.updates
            .drop(1)
            .filter((status) => status === ConnectionStatus.Disconnected)
            .subscribe({
                next: () => {
                    this.closeSubscriptions();
                    listener.error(new SocketClosedError({ url: this.url }));
                },
            });

        this.subscriptions.push(
            idSubscription,
            idEventSubscription,
            nonResponseSubscription,
            closedSubscription,
        );
    }

    private rpcError(response: JsonRpcResponseWithError): BaseError {
        return isRpcErrorObject(response.error)
            ? new RpcRequestError({ error: response.error, method: this.request.method })
            : new InvalidResponseError('The node answered with an error the SDK cannot read.', {
                  response,
              });
    }

    protected closeSubscriptions(): void {
        for (const subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
        // clear unused subscriptions
        this.subscriptions = [];
    }
}

export default class WebsocketProvider {
    private readonly url: string;
    private readonly socket: ReconnectingSocket;

    /** Same events as in socket.events but in the format we need */
    private readonly jsonRpcResponseStream: Stream<JsonRpcResponse>;

    // Lazily create streams and use the same stream when listening to the same query twice.
    //
    // Creating streams is cheap since producer is not started as long as nobody listens to events. Thus this
    // map is never cleared and there is no need to do so. But unsubscribe all the subscriptions!
    private readonly subscriptionStreams = new Map<string, Stream<SubscriptionEvent>>();

    // Rejecters of the requests waiting for an answer.
    private readonly pending = new Set<(error: Error) => void>();

    public constructor(baseUrl: string) {
        // accept host.name:port and assume ws protocol
        // make sure we don't end up with ...//websocket
        let cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        cleanUrl = cleanUrl.endsWith('/websocket') ? cleanUrl : cleanUrl + '/websocket';
        this.url = hasProtocol(cleanUrl) ? cleanUrl : 'ws://' + cleanUrl;

        this.socket = new ReconnectingSocket(this.url);

        // A request sent before the connection dropped is never answered, and
        // one still queued would go out on the next connection, after its
        // caller gave up: a broadcast could then land twice. Both fail here.
        this.socket.connectionStatus.updates
            .filter((status) => status === ConnectionStatus.Disconnected)
            .subscribe({ next: () => this.failPending() });

        this.jsonRpcResponseStream = this.socket.events.map(toJsonRpcResponse);

        this.socket.connect();
    }

    public async request(payload: Web3APIPayload): Promise<JsonRpcResponseWithResult<unknown>> {
        return this.execute(payload as JsonRpcRequest);
    }

    public async execute(payload: Web3APIPayload): Promise<JsonRpcResponseWithResult<unknown>> {
        const answer = this.answerTo(payload.id);
        let reject: (error: Error) => void = () => {};
        const closed = new Promise<never>((_, r) => {
            reject = r;
        });
        this.pending.add(reject);
        let response: JsonRpcResponse;
        try {
            this.socket.queueRequest(JSON.stringify(payload));
            response = await Promise.race([answer.response, closed]);
        } finally {
            this.pending.delete(reject);
            answer.cancel();
        }
        if (isJsonRpcErrorResponse(response) && isRpcErrorObject(response.error)) {
            // What the HTTP provider and the request manager throw, so a node
            // error keeps its code and data whichever provider carried it.
            throw new RpcRequestError({ error: response.error, method: payload.method });
        }
        return response as JsonRpcResponseWithResult<unknown>;
    }

    public listen(request: JsonRpcRequest): Stream<SubscriptionEvent> {
        if (request.method !== 'subscribe') {
            throw new InvalidInputError(
                `request.method must be "subscribe" to listen, got ${JSON.stringify(request.method)}`,
            );
        }

        const query = (request.params as any).query;
        if (typeof query !== 'string') {
            throw new InvalidInputError(
                `request.params.query must be a string, got ${JSON.stringify(query)}`,
            );
        }
        if (!this.subscriptionStreams.has(query)) {
            const producer = new RpcEventProducer(request, this.socket, this.url);
            const stream = Stream.create(producer);
            this.subscriptionStreams.set(query, stream);
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.subscriptionStreams
            .get(query)!
            .filter((response) => response.query !== undefined);
    }

    /**
     * Resolves as soon as websocket is connected. execute() queues requests automatically,
     * so this should be required for testing purposes only.
     */
    public async connected(): Promise<void> {
        await this.socket.connectionStatus.waitFor(ConnectionStatus.Connected);
    }

    public disconnect(): void {
        this.socket.disconnect();
    }

    // The answer to request `id`, and a way to stop waiting for it.
    private answerTo(id: JsonRpcId): { response: Promise<JsonRpcResponse>; cancel: () => void } {
        let subscription: Subscription | undefined;
        const response = new Promise<JsonRpcResponse>((resolve, reject) => {
            subscription = this.jsonRpcResponseStream
                .filter((r) => r.id === id)
                .subscribe({ next: resolve, error: reject });
        });
        return { response, cancel: () => subscription?.unsubscribe() };
    }

    private failPending(): void {
        this.socket.clearQueue();
        const error = new SocketClosedError({ url: this.url });
        for (const reject of this.pending) {
            reject(error);
        }
        this.pending.clear();
    }

    public getClientUrl(): string {
        return this.url;
    }
}

export function hasProtocol(url: string): boolean {
    return url.search('://') !== -1;
}

function toJsonRpcResponse(message: SocketWrapperMessageEvent): JsonRpcResponse {
    // this should never happen, but I want an alert if it does
    if (message.type !== 'message') {
        throw new InvalidResponseError(
            `a WebSocket message must be of type "message", got ${JSON.stringify(message.type)}`,
        );
    }

    return parseJsonRpcResponse(JSON.parse(message.data));
}

/**
 * Returns a JsonRpcErrorResponse if input can be parsed as a JSON-RPC error. Otherwise parses
 * input as JsonRpcResponseWithResult. Throws if input is neither a valid error nor success response.
 */
export function parseJsonRpcResponse(data: any): JsonRpcResponse {
    let response: JsonRpcResponse;
    try {
        response = parseJsonRpcErrorResponse(data);
    } catch (_) {
        response = parseJsonRpcSuccessResponse(data);
    }
    return response;
}

/** Throws if data is not a JsonRpcErrorResponse */
export function parseJsonRpcErrorResponse(data: any): JsonRpcResponseWithError {
    const id = data.id;
    if (typeof id !== 'number' && typeof id !== 'string' && id !== null) {
        throw new InvalidResponseError('a JSON-RPC response must have an id', { response: data });
    }

    if (typeof data.error === 'undefined' || isNullish(data.error)) {
        throw new InvalidResponseError('a JSON-RPC error response must have an error', {
            response: data,
        });
    }

    return {
        jsonrpc: '2.0',
        id: id,
        error: data.error,
    };
}

export function parseJsonRpcSuccessResponse(data: any): JsonRpcResponseWithResult {
    const id = data.id;
    if (typeof id !== 'number' && typeof id !== 'string') {
        throw new InvalidResponseError('a JSON-RPC response must have an id', { response: data });
    }

    if (typeof data.result === 'undefined') {
        throw new InvalidResponseError('a JSON-RPC response must have a result or an error', {
            response: data,
        });
    }

    const result = data.result;

    return {
        jsonrpc: '2.0',
        id: id,
        result: result,
    };
}

export function isJsonRpcErrorResponse(
    response: JsonRpcResponse,
): response is JsonRpcResponseWithError {
    return typeof (response as JsonRpcResponseWithError).error === 'object';
}

export { WebsocketProvider };
