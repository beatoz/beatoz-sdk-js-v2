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
    getTestChainId,
    getTestProposalAccountPrivateKey,
    getTestWsServer,
    closeProvider,
} from '../e2e_utils';
import { privateKeyToAccount, Web3Account, TrxProtoBuilder } from '@beatoz/web3-accounts';

describe('setDoc test', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('commits a setDoc and the account shows the name and url', async () => {
        const account = privateKeyToAccount(getTestProposalAccountPrivateKey()) as Web3Account;
        const { value: rule } = await web3.beatoz.rule();
        const { value: sender } = await web3.beatoz.getAccount(account.address);
        // Unique per run, so a value left by an earlier run cannot pass it.
        const payload = {
            name: `TEST-BEATOZ-${Date.now()}`,
            url: `https://example.com/doc/${Date.now()}.json`,
        };

        const tx = TrxProtoBuilder.buildSetDocTrx({
            nonce: sender.nonce,
            from: account.address,
            to: '0000000000000000000000000000000000000000',
            gas: Number(rule.minTrxGas),
            gasPrice: rule.gasPrice,
            payload,
        });
        TrxProtoBuilder.signTrxProto(tx, account, getTestChainId());
        const result = await web3.beatoz.broadcastTxCommit(tx);

        expect(result.check_tx.log).toEqual('');
        expect(result.check_tx.code).toEqual(0);
        expect(result.deliver_tx?.code).toEqual(0);
        const { value: after } = await web3.beatoz.getAccount(account.address);
        expect(after.name).toEqual(payload.name);
        expect(after.docURL).toEqual(payload.url);
    });
});
