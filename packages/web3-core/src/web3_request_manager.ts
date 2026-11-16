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

import HttpProvider from '@beatoz/web3-providers-http';
import WebsocketProvider from '@beatoz/web3-providers-ws';
import { isNullish, jsonRpc } from '@beatoz/web3-utils';
import { Web3APIRequest, JsonRpcResponseWithResult, SubscriptionEvent } from '@beatoz/web3-types';
import {
    InvalidInputError,
    InvalidResponseError,
    isRpcErrorObject,
    RpcRequestError,
} from '@beatoz/web3-errors';
import { Stream } from 'xstream';
import { Web3EventEmitter } from './web3_event_emitter.js';

export enum Web3RequestManagerEvent {
    PROVIDER_CHANGED = 'PROVIDER_CHANGED',
    BEFORE_PROVIDER_CHANGE = 'BEFORE_PROVIDER_CHANGE',
}

const availableProviders = {
    HttpProvider: HttpProvider,
    WebsocketProvider: WebsocketProvider,
};

export class Web3RequestManager extends Web3EventEmitter<{
    [key in Web3RequestManagerEvent]: HttpProvider | WebsocketProvider | undefined;
}> {
    private _provider?: HttpProvider | WebsocketProvider;

    public constructor(provider?: string) {
        super();
        if (!isNullish(provider)) {
            this.setProvider(provider);
        }
    }

    /**
     * Sends every request through `provider` from now on. The provider it
     * replaces is not closed: disconnect a WebSocket provider yourself, or its
     * socket keeps the process alive. See `Web3Context.setProvider`.
     *
     * @throws InvalidInputError for a string that is not an `http(s)://` or
     * `ws(s)://` URL.
     */
    public setProvider(provider?: HttpProvider | WebsocketProvider | string): void {
        if (typeof provider !== 'string') {
            this._provider = provider;
            return;
        }
        // A URL picks the provider by its scheme. Anything else used to leave
        // the previous provider in place, or store the string itself.
        if (/^https?:\/\//i.test(provider)) {
            this._provider = new this.providers.HttpProvider(provider);
        } else if (/^wss?:\/\//i.test(provider)) {
            this._provider = new this.providers.WebsocketProvider(provider);
        } else {
            throw new InvalidInputError(
                `provider must be an http(s):// or ws(s):// URL, got ${JSON.stringify(provider)}`,
            );
        }
    }

    public static get providers() {
        return availableProviders;
    }

    /**
     * Will return all available providers
     */

    public get providers() {
        return availableProviders;
    }

    public get provider(): HttpProvider | WebsocketProvider {
        return this._provider!;
    }

    /**
     * Sends a request to the node and returns its result as the node sent it,
     * not yet decoded.
     */
    public async send(request: Web3APIRequest): Promise<JsonRpcResponseWithResult<unknown>> {
        const { provider } = this;

        const payload = jsonRpc.toPayload(request);

        const response = await provider.request(payload);

        if (jsonRpc.isResponseWithResult(response)) {
            return response;
        }
        const error = (response as { error?: unknown }).error;
        if (isRpcErrorObject(error)) {
            throw new RpcRequestError({ error, method: request.method });
        }
        throw new InvalidResponseError('The node answered with neither a result nor an error.', {
            response,
        });
    }

    public subscribe(request: {
        readonly method: 'subscribe';
        readonly params: { readonly query: string };
    }): Stream<SubscriptionEvent> {
        // Only Websocket Provider can subscribe.
        if (!(this.provider instanceof WebsocketProvider)) {
            throw new InvalidInputError('subscribe needs a WebSocket provider');
        }

        const { provider } = this;

        const payload = jsonRpc.toPayload(request);
        return provider.listen({ ...payload, method: request.method, params: request.params });
    }
}
