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
import { ResponseError } from '@beatoz/web3-errors';
import WebsocketProvider from '../../../src';
import { getTestServer, getTestWsServer } from '../e2e_utils';
import { uuidV4 } from '@beatoz/web3-utils';

// A hash the node has never seen. Tendermint answers its tx lookup with
// code -32603 and data `tx (<HASH>) not found`.
const request = () => ({
    jsonrpc: '2.0' as const,
    id: uuidV4(),
    method: 'tx',
    params: { hash: Buffer.alloc(32, 0xab).toString('base64') },
});

const errorFrom = (call: Promise<unknown>) =>
    call.then(
        () => undefined,
        (e: unknown) => e,
    );

describe('WebsocketProvider errors', () => {
    const provider = new WebsocketProvider(getTestWsServer());

    afterAll(() => provider.disconnect());

    it('throws a node error as a ResponseError that keeps its data', async () => {
        const err = await errorFrom(provider.request(request()));

        expect(err).toBeInstanceOf(ResponseError);
        expect((err as ResponseError).data).toEqual(`tx (${'AB'.repeat(32)}) not found`);
    });

    // The HTTP provider and the request manager build their ResponseError from
    // the same JSON-RPC error, so matching the node's raw answer matches them.
    it("carries the node's own answer", async () => {
        const raw = await (
            await fetch(getTestServer(), { method: 'POST', body: JSON.stringify(request()) })
        ).json();

        const err = await errorFrom(provider.request(request()));

        expect((err as ResponseError).message).toEqual(`Returned error: ${raw.error.message}`);
        expect((err as ResponseError).data).toEqual(raw.error.data);
    });
});
