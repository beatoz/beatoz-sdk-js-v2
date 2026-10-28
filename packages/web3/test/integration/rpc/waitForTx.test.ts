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
    getTestChainId,
    getTestProposalAccountPrivateKey,
    getTestServer,
    getTestWsServer,
} from '../e2e_utils';
import { asNodeAddress } from '../chain_fixtures';
import { privateKeyToAccount, TrxProtoBuilder } from '@beatoz/web3-accounts';
import { OperationTimeoutError } from '@beatoz/web3-errors';

describe.each([
    ['HTTP', getTestServer],
    ['WebSocket', getTestWsServer],
])('waitForTx over %s', (_, server) => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(server());
    });

    afterAll(() => closeProvider(web3));

    // broadcast_tx_sync answers once CheckTx has passed, before the block that
    // holds the transaction - the case waitForTx exists for.
    it('returns a transaction sent with broadcastTxSync once it is indexed', async () => {
        const account = privateKeyToAccount(getTestProposalAccountPrivateKey());
        const { value: rule } = await web3.beatoz.rule();
        const { value: sender } = await web3.beatoz.getAccount(account.address);
        const tx = TrxProtoBuilder.buildTransferTrxProto({
            nonce: sender.nonce,
            from: account.address,
            to: asNodeAddress(getTestAccountAddress()),
            amount: '1',
            gas: Number(rule.minTrxGas),
            gasPrice: String(rule.gasPrice),
        });
        TrxProtoBuilder.signTrxProto(tx, account, getTestChainId());
        const sent = await web3.beatoz.broadcastTxSync(tx);
        expect(sent.code).toEqual(0);

        const indexed = await web3.beatoz.waitForTx(sent.hash);

        expect(indexed.hash.toLowerCase()).toEqual(sent.hash.toLowerCase());
        expect(indexed.height).toBeGreaterThan(0);
        expect(indexed.tx_result.code).toEqual(0);
    });

    // Also checks that the node's real not-found answer is the one waitForTx
    // retries on: were it not recognised, this would throw the node's error at
    // once instead of timing out.
    it('times out on a hash the node never saw', async () => {
        const started = Date.now();

        const err = await web3.beatoz
            .waitForTx('ab'.repeat(32), { timeoutMs: 1500, intervalMs: 200 })
            .catch((e: unknown) => e);

        expect(err).toBeInstanceOf(OperationTimeoutError);
        expect(Date.now() - started).toBeGreaterThanOrEqual(1500);
        expect((err as OperationTimeoutError).innerError).toMatchObject({
            data: `tx (${'AB'.repeat(32)}) not found`,
        });
    });
});
