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
    closeProvider,
    getTestAccountAddress,
    getTestAccountPrivateKey,
    getTestChainId,
    getTestProposalAccountAddress,
    getTestProposalAccountPrivateKey,
    getTestWsServer,
} from '../e2e_utils';
import { TrxProtoBuilder, Web3Account } from '@beatoz/web3-accounts';
import { BroadcastTxCommitResponse, SignScheme } from '@beatoz/web3-types';

const RECIPIENT = '0x0000000000000000000000000000000000000004';

// What the node made of a transaction: '' when it was delivered, its log
// otherwise.
const outcome = (res: BroadcastTxCommitResponse) =>
    res.check_tx.code === 0 && res.deliver_tx?.code === 0
        ? ''
        : res.check_tx.log || res.deliver_tx?.log || 'refused';

describe('signing schemes v0 and v1', () => {
    let web3: Web3;
    let sender: Web3Account;
    let payer: Web3Account;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
        const wallet = web3.beatoz.accounts.wallet;
        sender = wallet.add(getTestAccountPrivateKey()).get(getTestAccountAddress())!;
        payer = wallet
            .add(getTestProposalAccountPrivateKey())
            .get(getTestProposalAccountAddress())!;
    });

    afterAll(() => closeProvider(web3));

    const transfer = async (
        chainId: string,
        senderScheme: SignScheme,
        payerScheme?: SignScheme,
    ) => {
        const { gasPrice, minTrxGas } = (await web3.beatoz.rule()).value;
        const tx = TrxProtoBuilder.buildTransferTrxProto({
            from: sender.address,
            to: RECIPIENT,
            nonce: Number((await web3.beatoz.getAccount(sender.address)).value.nonce),
            gas: Number(minTrxGas),
            gasPrice,
            amount: '1',
        });
        sender.signTransaction(tx, chainId, { scheme: senderScheme });
        if (payerScheme) payer.signTransactionAsPayer(tx, chainId, { scheme: payerScheme });
        return outcome(await web3.beatoz.broadcastTxCommit(tx));
    };

    // The node checks the sender's and the payer's signature each by its own
    // scheme (beatoz-go ctrlers/types/signer.go).
    it.each([
        ['v0', undefined],
        ['v1', undefined],
        ['v1', 'v1'],
        ['v1', 'v0'],
        ['v0', 'v1'],
    ] as Array<[SignScheme, SignScheme | undefined]>)(
        'delivers a transfer signed %s by the sender and %s by a payer',
        async (senderScheme, payerScheme) => {
            expect(await transfer(getTestChainId(), senderScheme, payerScheme)).toBe('');
        },
    );

    it('refuses a v1 signature over another chain id', async () => {
        expect(await transfer('0x9999', 'v1')).toContain('invalid signature');
    });

    it('sends with v1 through web3.beatoz.transfer', async () => {
        const res = await web3.beatoz.transfer(
            { from: sender.address, to: RECIPIENT, amount: '1' },
            { scheme: 'v1' },
        );
        expect(res.deliver_tx?.code).toBe(0);
    });
});
