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
import { Listener, Producer, Stream } from 'xstream';

import { BaseError, SocketClosedError } from '@beatoz/web3-errors';
import { ConnectionStatus, QueueingStreamingSocket } from './queueing_streaming_socket.js';
import { SocketWrapperMessageEvent } from './socket_wrapper.js';
import { ValueAndUpdates } from '../stream/valueandupdates.js';

/**
 * A wrapper around QueueingStreamingSocket that reconnects automatically.
 */
export class ReconnectingSocket {
    /** Starts with a 0.1 second timeout, then doubles every attempt with a maximum timeout of 5 seconds. */
    private static calculateTimeout(index: number): number {
        return Math.min(2 ** index * 100, 5_000);
    }

    public readonly connectionStatus: ValueAndUpdates<ConnectionStatus>;
    public readonly events: Stream<SocketWrapperMessageEvent>;

    private readonly url: string;
    private readonly socket: QueueingStreamingSocket;
    private eventProducerListener: Listener<SocketWrapperMessageEvent> | undefined;
    private unconnected = true;
    private disconnected = false;
    private timeoutIndex = 0;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    public constructor(url: string, timeout = 10_000, reconnectedHandler?: () => void) {
        const eventProducer: Producer<any> = {
            start: (listener) => (this.eventProducerListener = listener),
            stop: () => (this.eventProducerListener = undefined),
        };
        this.events = Stream.create(eventProducer);

        this.url = url;
        this.socket = new QueueingStreamingSocket(url, timeout, reconnectedHandler);
        this.socket.events.subscribe({
            next: (event) => {
                if (this.eventProducerListener) {
                    this.eventProducerListener.next(event);
                }
            },
            error: (error) => {
                if (this.eventProducerListener) {
                    this.eventProducerListener.error(error);
                }
            },
        });

        this.connectionStatus = this.socket.connectionStatus;
        this.connectionStatus.updates.subscribe({
            next: (status) => {
                if (status === ConnectionStatus.Connected) {
                    this.timeoutIndex = 0;
                }
                // A disconnect() also reports Disconnected. Reconnecting then
                // would undo it and keep the process alive with a socket
                // nobody uses.
                if (status === ConnectionStatus.Disconnected && !this.disconnected) {
                    if (this.reconnectTimeout) {
                        clearTimeout(this.reconnectTimeout);
                        this.reconnectTimeout = null;
                    }
                    this.reconnectTimeout = setTimeout(
                        () => this.socket.reconnect(),
                        ReconnectingSocket.calculateTimeout(this.timeoutIndex++),
                    );
                }
            },
        });
    }

    public connect(): void {
        if (!this.unconnected) {
            throw new BaseError('Cannot connect: socket has already connected');
        }
        this.socket.connect();
        this.unconnected = false;
    }

    public disconnect(): void {
        if (this.unconnected) {
            throw new BaseError('Cannot disconnect: socket has not yet connected');
        }
        // Set before the status update below, which reads it synchronously.
        this.disconnected = true;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.socket.disconnect();
        if (this.eventProducerListener) {
            this.eventProducerListener.complete();
        }
    }

    public queueRequest(request: string): void {
        if (this.disconnected) {
            throw new SocketClosedError({ url: this.url, reason: 'disconnect() was called' });
        }

        this.socket.queueRequest(request);
    }

    /** Drops the requests not sent yet. */
    public clearQueue(): void {
        this.socket.clearQueue();
    }
}
