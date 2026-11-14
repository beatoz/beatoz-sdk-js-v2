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
import { RpcRequestError, SocketClosedError } from '@beatoz/web3-errors';
import WebsocketProvider from '../../src';

// A local WebSocket server stands in for the node, so the tests can drop the
// connection when they need to. `onMessage` answers each request.
type Handler = (request: { id: string; method: string }, socket: WebSocket) => void;

const startServer = (onMessage: Handler, port = 0) =>
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

const stop = (server: WebSocket.Server) =>
    new Promise<void>((resolve) => {
        server.clients.forEach((c) => c.terminate());
        server.close(() => resolve());
    });

const request = (method = 'status') => ({
    jsonrpc: '2.0' as const,
    id: `${method}-${Math.random()}`,
    method,
    params: method === 'subscribe' ? { query: "tm.event='NewBlock'" } : {},
});
const errorFrom = (p: Promise<unknown>) =>
    p.then(
        () => undefined,
        (e: unknown) => e,
    );
const answer = (socket: WebSocket, id: string, result: unknown = {}) =>
    socket.send(JSON.stringify({ jsonrpc: '2.0', id, result }));

describe('WebsocketProvider when the connection closes', () => {
    let server: WebSocket.Server | undefined;
    let provider: WebsocketProvider | undefined;

    afterEach(async () => {
        provider?.disconnect();
        if (server) await stop(server);
        provider = undefined;
        server = undefined;
    });

    it('answers a request while connected', async () => {
        let port: number;
        ({ server, port } = await startServer((req, socket) => answer(socket, req.id, { ok: 1 })));
        provider = new WebsocketProvider(`ws://localhost:${port}`);

        await expect(provider.request(request())).resolves.toMatchObject({ result: { ok: 1 } });
    });

    it('fails a request in flight with SocketClosedError', async () => {
        let port: number;
        ({ server, port } = await startServer((_, socket) => socket.terminate()));
        provider = new WebsocketProvider(`ws://localhost:${port}`);

        const err = await errorFrom(provider.request(request()));
        expect(err).toBeInstanceOf(SocketClosedError);
        expect((err as SocketClosedError).url).toBe(`ws://localhost:${port}/websocket`);
    });

    it('fails a queued request when reconnecting fails, and never sends it', async () => {
        let port: number;
        let received: string[];
        ({ server, port } = await startServer((req, socket) => answer(socket, req.id)));
        provider = new WebsocketProvider(`ws://localhost:${port}`);
        await provider.connected();

        // The node goes away: the connection drops and reconnecting fails.
        await stop(server);
        server = undefined;
        const err = await errorFrom(provider.request(request()));
        expect(err).toBeInstanceOf(SocketClosedError);

        // It comes back; the failed request must not reach it.
        ({ server, received } = await startServer((req, socket) => answer(socket, req.id), port));
        await provider.connected();
        await expect(provider.request(request('health'))).resolves.toBeDefined();
        expect(received.map((r) => JSON.parse(r).method)).toEqual(['health']);
    });

    it('ends a subscription with SocketClosedError', async () => {
        let port: number;
        ({ server, port } = await startServer((req, socket) => {
            answer(socket, req.id);
            setTimeout(() => socket.terminate(), 10);
        }));
        provider = new WebsocketProvider(`ws://localhost:${port}`);

        const err = await new Promise((resolve) => {
            provider!.listen(request('subscribe')).subscribe({ error: resolve });
        });
        expect(err).toBeInstanceOf(SocketClosedError);
    });

    it('ends a subscription the node refuses with RpcRequestError', async () => {
        let port: number;
        ({ server, port } = await startServer((req, socket) =>
            socket.send(
                JSON.stringify({
                    jsonrpc: '2.0',
                    id: req.id,
                    error: { code: -32603, message: 'Internal error', data: 'max subscriptions' },
                }),
            ),
        ));
        provider = new WebsocketProvider(`ws://localhost:${port}`);

        const err = await new Promise((resolve) => {
            provider!.listen(request('subscribe')).subscribe({ error: resolve });
        });
        expect(err).toBeInstanceOf(RpcRequestError);
        expect(err).toMatchObject({ code: -32603, data: 'max subscriptions' });
    });

    it('fails a request after disconnect() with SocketClosedError', async () => {
        let port: number;
        ({ server, port } = await startServer((req, socket) => answer(socket, req.id)));
        provider = new WebsocketProvider(`ws://localhost:${port}`);
        await provider.connected();
        provider.disconnect();

        const err = await errorFrom(provider.request(request()));
        expect(err).toBeInstanceOf(SocketClosedError);
        provider = undefined;
    });
});
