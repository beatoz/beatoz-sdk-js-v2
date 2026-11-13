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
import { sendSampleTransfer, sendTransfers, waitUntil } from '../chain_fixtures';
import { TxSubscriptionEvent } from '@beatoz/web3-types';

describe('subscribeTx check', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('delivers every transaction until the subscription is cancelled', async () => {
        const received: string[] = [];
        let failure: Error | undefined;

        const subscription = web3.beatoz.subscribeTx().subscribe({
            error: (err: Error) => {
                failure = err;
            },
            complete: () => {
                failure = new Error('the subscription completed on its own');
            },
            next: (event: TxSubscriptionEvent) => {
                expect(event.events['tm.event']).toContain('Tx');
                received.push(event.events['tx.hash'][0]);
            },
        });

        // Transactions are not block-shaped: several can share a block, so
        // continuity here is not about heights. What the subscription promises
        // is that nothing sent goes unreported.
        const sent = await sendTransfers(web3, 3);
        await waitUntil(
            () => sent.every((hash) => received.includes(hash)),
            `only ${received.length} of ${sent.length} transactions were reported`,
        );

        expect(failure).toBeUndefined();
        expect(received).toEqual(expect.arrayContaining(sent));

        const seenBeforeCancel = received.length;
        subscription.unsubscribe();

        // Send another and give it time to arrive. Asserting straight away
        // would not separate "never arrives" from "has not arrived yet".
        await sendSampleTransfer(web3);
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(received.length).toEqual(seenBeforeCancel);
        expect(failure).toBeUndefined();
    });
});
