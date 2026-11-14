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
import fetch from 'cross-fetch';
import { HttpRequestError, RpcRequestError } from '@beatoz/web3-errors';
import HttpProvider from '../../src';

jest.mock('cross-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

const URL = 'http://node:26657';
const payload = { jsonrpc: '2.0' as const, id: 1, method: 'tx', params: {} };
const answer = (status: number, body: string) =>
    mockFetch.mockResolvedValueOnce(new Response(body, { status }));
const errorFrom = (p: Promise<unknown>) =>
    p.then(
        () => undefined,
        (e: unknown) => e,
    );

describe('HttpProvider errors', () => {
    const provider = new HttpProvider(URL);

    it('returns a result', async () => {
        answer(200, JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }));
        await expect(provider.request(payload)).resolves.toEqual({
            jsonrpc: '2.0',
            id: 1,
            result: { ok: true },
        });
    });

    // Tendermint answers some JSON-RPC errors with HTTP 500.
    it.each([200, 500])(
        'throws a JSON-RPC error answered with %d as an RpcRequestError',
        async (status) => {
            answer(
                status,
                JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    error: { code: -32603, message: 'Internal error', data: 'tx (AB) not found' },
                }),
            );
            const err = await errorFrom(provider.request(payload));
            expect(err).toBeInstanceOf(RpcRequestError);
            expect(err).toMatchObject({ code: -32603, data: 'tx (AB) not found' });
            expect((err as RpcRequestError).message).toContain('Method: tx');
        },
    );

    it('throws a failed status without a JSON-RPC answer as an HttpRequestError', async () => {
        answer(502, '<html>Bad Gateway</html>');
        const err = await errorFrom(provider.request(payload));
        expect(err).toBeInstanceOf(HttpRequestError);
        expect(err).toMatchObject({ status: 502, url: URL, details: '<html>Bad Gateway</html>' });
    });

    it('throws a 200 that is not JSON as an HttpRequestError', async () => {
        answer(200, 'not json');
        expect(await errorFrom(provider.request(payload))).toBeInstanceOf(HttpRequestError);
    });

    it('throws a request that never got an answer as an HttpRequestError with the cause', async () => {
        const refused = new TypeError('fetch failed');
        mockFetch.mockRejectedValueOnce(refused);
        const err = await errorFrom(provider.request(payload));
        expect(err).toBeInstanceOf(HttpRequestError);
        expect((err as HttpRequestError).status).toBeUndefined();
        expect((err as HttpRequestError).cause).toBe(refused);
    });
});
