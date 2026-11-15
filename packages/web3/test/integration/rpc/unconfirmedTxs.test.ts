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

describe('unconfirmedTxs check ', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('returns at most the requested number of mempool transactions', async () => {
        const response = await web3.beatoz.unconfirmedTxs(10);

        // The tests broadcast with commit and run one at a time, so the
        // mempool does not change between the two calls.
        const raw = await fetch(`${getTestServer()}/unconfirmed_txs?limit=10`);
        const { result } = await raw.json();

        expect(response).toEqual(result);
        expect(response.txs.length).toBe(Number(response.n_txs));
        expect(response.txs.length).toBeLessThanOrEqual(10);
    });
});
