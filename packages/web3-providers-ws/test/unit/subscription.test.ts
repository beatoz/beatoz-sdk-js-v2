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
import WebsocketProvider from '../../src';
import { answer, request, startServer, stop } from './ws_server';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const waitUntil = async (done: () => boolean) => {
    while (!done()) await sleep(10);
};

describe('WebsocketProvider subscriptions', () => {
    let server: WebSocket.Server | undefined;
    let provider: WebsocketProvider | undefined;
    let sockets: WebSocket[];
    let received: string[];
    const methods = () => received.map((r) => JSON.parse(r).method);

    // As the node does: it answers the subscribe request, then sends an event
    // under the same id.
    beforeEach(async () => {
        sockets = [];
        let port: number;
        ({ server, port, received } = await startServer((req, socket) => {
            answer(socket, req.id);
            if (req.method === 'subscribe') {
                setTimeout(() => answer(socket, req.id, { query: 'q', data: 1 }), 20);
            }
        }));
        server.on('connection', (socket) => sockets.push(socket));
        provider = new WebsocketProvider(`ws://localhost:${port}`);
        await provider.connected();
    });

    afterEach(async () => {
        provider?.disconnect();
        if (server) await stop(server);
        provider = undefined;
        server = undefined;
    });

    // The first event of a new listen, then the listener leaves.
    const nextEvent = (req: ReturnType<typeof request>) =>
        new Promise((resolve, reject) => {
            const sub = provider!.listen(req).subscribe({
                next: (event) => {
                    sub.unsubscribe();
                    resolve(event);
                },
                error: reject,
            });
        });

    it('gets events when the same query is listened to again', async () => {
        const req = request('subscribe');
        await expect(nextEvent(req)).resolves.toMatchObject({ data: 1 });
        await waitUntil(() => methods().includes('unsubscribe'));

        await expect(nextEvent(req)).resolves.toMatchObject({ data: 1 });
        expect(methods()).toEqual(['subscribe', 'unsubscribe', 'subscribe']);
    });

    it('gets events when listened to again after a reconnect', async () => {
        const req = request('subscribe');
        await expect(nextEvent(req)).resolves.toMatchObject({ data: 1 });
        await waitUntil(() => methods().includes('unsubscribe'));

        sockets.forEach((s) => s.terminate());
        await waitUntil(() => sockets.length === 2);
        await provider!.connected();

        await expect(nextEvent(req)).resolves.toMatchObject({ data: 1 });
    });
});
