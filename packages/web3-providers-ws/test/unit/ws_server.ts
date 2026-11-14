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
import WebSocket from 'ws';
import { AddressInfo } from 'net';

// A local WebSocket server stands in for the node, so the tests can drop the
// connection when they need to. `onMessage` answers each request.
export type Handler = (request: { id: string; method: string }, socket: WebSocket) => void;

export const startServer = (onMessage: Handler, port = 0) =>
    new Promise<{ server: WebSocket.Server; port: number; received: string[] }>((resolve) => {
        const received: string[] = [];
        const server = new WebSocket.Server({ port }, () =>
            resolve({ server, port: (server.address() as AddressInfo).port, received }),
        );
        server.on('connection', (socket) => {
            socket.on('message', (data) => {
                received.push(String(data));
                onMessage(JSON.parse(String(data)), socket);
            });
        });
    });

export const stop = (server: WebSocket.Server) =>
    new Promise<void>((resolve) => {
        server.clients.forEach((c) => c.terminate());
        server.close(() => resolve());
    });

export const request = (method = 'status') => ({
    jsonrpc: '2.0' as const,
    id: `${method}-${Math.random()}`,
    method,
    params: method === 'subscribe' ? { query: "tm.event='NewBlock'" } : {},
});
export const errorFrom = (p: Promise<unknown>) =>
    p.then(
        () => undefined,
        (e: unknown) => e,
    );
export const answer = (socket: WebSocket, id: string, result: unknown = {}) =>
    socket.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
