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
import { InvalidInputError, InvalidResponseError, RpcRequestError } from '@beatoz/web3-errors';
import HttpProvider from '@beatoz/web3-providers-http';
import WebsocketProvider from '@beatoz/web3-providers-ws';
import { Web3RequestManager } from '../../src/web3_request_manager';

// A provider that answers every request with `response`.
const managerAnswering = (response: unknown) => {
    const manager = new Web3RequestManager();
    manager.setProvider({ request: jest.fn().mockResolvedValue(response) } as never);
    return manager;
};

describe('Web3RequestManager.send', () => {
    it('returns a result', async () => {
        const response = { jsonrpc: '2.0', id: 1, result: { n: 1 } };
        await expect(managerAnswering(response).send({ method: 'status' })).resolves.toEqual(
            response,
        );
    });

    it('throws an error answer as an RpcRequestError', async () => {
        const err = await managerAnswering({
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32602, message: 'Invalid params', data: 'bad hash' },
        })
            .send({ method: 'tx' })
            .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(RpcRequestError);
        expect(err).toMatchObject({ code: -32602, data: 'bad hash' });
    });

    it('throws an answer with neither a result nor an error as an InvalidResponseError', async () => {
        const response = { jsonrpc: '2.0', id: 1 };
        const err = await managerAnswering(response)
            .send({ method: 'status' })
            .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(InvalidResponseError);
        expect((err as InvalidResponseError).response).toEqual(response);
    });
});

describe('Web3RequestManager.setProvider', () => {
    it.each(['http://127.0.0.1:26657', 'HTTPS://node.example'])(
        'makes an HttpProvider for %s',
        (url) => {
            const manager = new Web3RequestManager();
            manager.setProvider(url);
            expect(manager.provider).toBeInstanceOf(HttpProvider);
        },
    );

    it.each(['ws://127.0.0.1:1/websocket', 'wss://node.example/websocket'])(
        'makes a WebsocketProvider for %s',
        (url) => {
            const manager = new Web3RequestManager();
            manager.setProvider(url);
            const provider = manager.provider;
            expect(provider).toBeInstanceOf(WebsocketProvider);
            (provider as WebsocketProvider).disconnect();
        },
    );

    // Both used to pass silently: the first kept the previous provider, the
    // second stored the string as the provider.
    it.each(['localhost:26657', '', 'tcp://127.0.0.1:26657'])(
        'refuses %p and keeps the provider it had',
        (url) => {
            const manager = new Web3RequestManager('http://127.0.0.1:26657');
            const before = manager.provider;
            expect(() => manager.setProvider(url)).toThrow(InvalidInputError);
            expect(manager.provider).toBe(before);
        },
    );

    it('refuses a URL it cannot use at construction', () => {
        expect(() => new Web3RequestManager('')).toThrow(InvalidInputError);
    });

    it('clears the provider when given none', () => {
        const manager = new Web3RequestManager('http://127.0.0.1:26657');
        manager.setProvider(undefined);
        expect(manager.provider).toBeUndefined();
    });
});
