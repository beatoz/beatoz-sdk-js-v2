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
import erc20Json from '../fixtures/erc20-abi.json';
import {
    assertCommitted,
    closeProvider,
    deployTestToken,
    netInfo,
    tokenBalance,
} from './e2e_utils';
import { BroadcastTxSyncResponse, SubscriptionEvent } from '@beatoz/web3-types';
import { Web3 } from '@beatoz/web3';

const RECIPIENT = '0x0000000000000000000000000000000000000001';

// One iteration per block when committing, so a hundred of them is a load test
// rather than an integration test. A handful shows the same thing; raise
// BEATOZ_TRANSFER_LOOP to put real volume through it.
const iterations = Number(process.env.BEATOZ_TRANSFER_LOOP ?? 5);

const web3 = new Web3(netInfo.WS);
for (const acct of netInfo.ACCTS) {
    web3.beatoz.accounts.wallet.add(acct.KEY);
}

let erc20Contract: any;
beforeAll(async () => {
    const { address } = await deployTestToken(web3);
    erc20Contract = new web3.beatoz.Contract(erc20Json, address);
});
afterAll(() => closeProvider(web3));

const fromAddress = (): string => web3.beatoz.accounts.wallet.get(netInfo.ACCTS[0].ADDR)!.address;

describe('transfer test', () => {
    it('transfer function', async () => {
        const before = await tokenBalance(erc20Contract, RECIPIENT);

        const res = await erc20Contract.methods
            .transfer(RECIPIENT, '1')
            .broadcast({ from: fromAddress(), gas: 250000 });

        assertCommitted(res);
        expect(await tokenBalance(erc20Contract, RECIPIENT)).toEqual(before + 1n);
    });
});

describe('transfer loop test', () => {
    it(
        'transfer loop function',
        async () => {
            const before = await tokenBalance(erc20Contract, RECIPIENT);

            for (let i = 0; i < iterations; i++) {
                const res = await erc20Contract.methods
                    .transfer(RECIPIENT, '1000')
                    .broadcast({ from: fromAddress(), gas: 300000, sendMode: 'commit' });
                assertCommitted(res);
            }

            expect(await tokenBalance(erc20Contract, RECIPIENT)).toEqual(
                before + BigInt(iterations) * 1000n,
            );
        },
        1000 * 60 * 5,
    );
});

describe('transfer sync test', () => {
    it(
        'delivers a tx event for every transfer sent with sync',
        async () => {
            const before = await tokenBalance(erc20Contract, RECIPIENT);

            // Events and broadcast replies race: an event can arrive before
            // the reply that names its hash. Keep the two apart and compare
            // once both are in, instead of marking one map from both sides.
            const seen = new Set<string>();
            let failure: unknown;
            const listener = new Web3(netInfo.WS);
            const subscription = listener.beatoz.subscribeTx().subscribe({
                next: (event: SubscriptionEvent) => seen.add(event.events['tx.hash'][0]),
                error: (err: unknown) => (failure = err),
            });

            try {
                // Sync returns once the node accepts a tx into the mempool, so
                // the nonces are set by hand rather than read per send.
                let nonce = (await web3.beatoz.getAccount(fromAddress())).value.nonce;
                const sent: string[] = [];
                for (let i = 0; i < iterations; i++) {
                    const resp: BroadcastTxSyncResponse = await erc20Contract.methods
                        .transfer(RECIPIENT, '1000')
                        .broadcast({
                            from: fromAddress(),
                            gas: 300000,
                            nonce: nonce++,
                            sendMode: 'sync',
                        });
                    expect(resp.code).toEqual(0);
                    sent.push(resp.hash);
                }

                const deadline = Date.now() + 60000;
                while (!sent.every((hash) => seen.has(hash))) {
                    if (failure !== undefined) throw failure;
                    if (Date.now() > deadline) {
                        const missing = sent.filter((hash) => !seen.has(hash));
                        throw new Error(`no tx event for ${missing.join(', ')}`);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            } finally {
                subscription.unsubscribe();
                closeProvider(listener);
            }

            expect(await tokenBalance(erc20Contract, RECIPIENT)).toEqual(
                before + BigInt(iterations) * 1000n,
            );
        },
        1000 * 60 * 5,
    );
});
