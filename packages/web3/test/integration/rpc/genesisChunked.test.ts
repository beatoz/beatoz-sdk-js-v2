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
import { Web3 } from '../../../src';
import { getTestServer, getTestWsServer, closeProvider } from '../e2e_utils';

describe('genesisChunked check ', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('returns the genesis document in base64 chunks', async () => {
        const response = await web3.beatoz.genesisChunked(0);

        const raw = await fetch(`${getTestServer()}/genesis`);
        const { result } = await raw.json();

        expect(response.chunk).toBe('0');
        // The test node's genesis fits one chunk (16 MB each), so chunk 0 is all of it.
        expect(response.total).toBe('1');
        expect(JSON.parse(Buffer.from(response.data, 'base64').toString())).toEqual(result.genesis);
    });
});
