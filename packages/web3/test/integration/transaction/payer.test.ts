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
import { privateKeyToAccount, TrxProtoBuilder } from '@beatoz/web3-accounts';
import { BroadcastTxCommitResponse } from '@beatoz/web3-types';

const expectDelivered = (res: BroadcastTxCommitResponse) => {
    if (res.check_tx.code !== 0 || res.deliver_tx?.code !== 0) {
        throw new Error(`not delivered: ${res.check_tx.log || res.deliver_tx?.log}`);
    }
};

describe('fee payer', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('charges the fee to the payer, not the sender', async () => {
        const chainId = getTestChainId();
        const payer = privateKeyToAccount(getTestProposalAccountPrivateKey());
        const sender = web3.beatoz.accounts.create();
        const { gasPrice, minTrxGas } = (await web3.beatoz.rule()).value;
        const gas = Number(minTrxGas);
        const amount = 1000n;
        const balance = async (address: string) =>
            BigInt((await web3.beatoz.getAccount(address)).value.balance);

        // Give the new account exactly what it will send, nothing for a fee.
        const fund = TrxProtoBuilder.buildTransferTrxProto({
            from: payer.address,
            to: sender.address,
            nonce: Number((await web3.beatoz.getAccount(payer.address)).value.nonce),
            gas,
            gasPrice,
            amount: amount.toString(),
        });
        payer.signTransaction(fund, chainId);
        expectDelivered(await web3.beatoz.broadcastTxCommit(fund));

        const payerBefore = await balance(payer.address);
        const tx = TrxProtoBuilder.buildTransferTrxProto({
            from: sender.address,
            to: payer.address,
            nonce: 0,
            gas,
            gasPrice,
            amount: amount.toString(),
        });
        sender.signTransaction(tx, chainId);
        payer.signTransactionAsPayer(tx, chainId);
        expectDelivered(await web3.beatoz.broadcastTxCommit(tx));

        // A transfer uses all its gas, and the payer got the amount back.
        expect(await balance(sender.address)).toBe(0n);
        expect(await balance(payer.address)).toBe(
            payerBefore + amount - BigInt(gas) * BigInt(gasPrice),
        );
    });
});
