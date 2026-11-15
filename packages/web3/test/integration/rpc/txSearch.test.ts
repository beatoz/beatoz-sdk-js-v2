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
import { getTestWsServer, closeProvider } from '../e2e_utils';
import { sendSampleTransfer } from '../chain_fixtures';

describe('txSearch check ', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('finds a transaction this test sent, by its hash', async () => {
        const hash = await sendSampleTransfer(web3);
        const indexed = await web3.beatoz.waitForTx(hash);

        const response = await web3.beatoz.txSearch(`tx.hash='${hash}'`);

        expect(response.total_count).toBe(1);
        expect(response.txs).toHaveLength(1);
        expect(response.txs[0].hash).toEqual(hash);
        expect(response.txs[0].height).toEqual(indexed.height);
        expect(response.txs[0].tx_result.code).toBe(0);
    });
});
