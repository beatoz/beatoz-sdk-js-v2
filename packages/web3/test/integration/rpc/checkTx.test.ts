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
import {
    getTestAccountPrivateKey,
    getTestChainId,
    getTestWsServer,
    closeProvider,
} from '../e2e_utils';
import { privateKeyToAccount, Web3Account, TrxProtoBuilder } from '@beatoz/web3-accounts';

describe('checkTx check ', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    // Only a transaction the node refuses: one that passes check_tx advances
    // the sender's nonce in the node's check state until the next block, and
    // the next test's real send would fail with "invalid nonce" (#44).
    it('reports why the node would refuse a transaction', async () => {
        const account = privateKeyToAccount(getTestAccountPrivateKey()) as Web3Account;
        const { value: rule } = await web3.beatoz.rule();
        const { value: sender } = await web3.beatoz.getAccount(account.address);

        const tx = TrxProtoBuilder.buildTransferTrxProto({
            from: account.address,
            nonce: sender.nonce,
            to: account.address,
            amount: '1',
            gas: Number(rule.minTrxGas) - 1,
            gasPrice: String(rule.gasPrice),
        });
        TrxProtoBuilder.signTrxProto(tx, account, getTestChainId());

        const response = await web3.beatoz.checkTx(tx);

        // 3 is ErrCodeCheckTx (beatoz-go types/xerrors); the cause is in the log.
        expect(response.code).toBe(3);
        expect(response.log).toContain(`too small gas (min: ${rule.minTrxGas})`);
        expect(response.gas_wanted).toBe('0');
    });
});
