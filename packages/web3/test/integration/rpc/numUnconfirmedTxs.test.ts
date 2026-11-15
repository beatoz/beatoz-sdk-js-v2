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

describe('numUnconfirmedTxs check ', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('reads the mempool size as numbers', async () => {
        const response = await web3.beatoz.numUnconfirmedTxs();

        // The tests broadcast with commit and run one at a time, so the
        // mempool does not change between the two calls.
        const raw = await fetch(`${getTestServer()}/num_unconfirmed_txs`);
        const { result } = await raw.json();

        expect(response.n_txs).toBe(Number(result.n_txs));
        expect(response.total).toBe(Number(result.total));
        expect(response.total_bytes).toBe(Number(result.total_bytes));
        // Both come from the mempool size (tendermint rpc/core/mempool.go).
        expect(response.n_txs).toBe(response.total);
        expect(response.txs).toEqual([]);
    });
});
