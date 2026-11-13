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
import { assertUnbroken, produceBlocks, sendSampleTransfer, waitUntil } from '../chain_fixtures';
import { NewBlockSubscriptionEvent } from '@beatoz/web3-types';

describe('subscribeNewBlock check', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('delivers every block until the subscription is cancelled', async () => {
        const heights: number[] = [];
        let failure: Error | undefined;

        const subscription = web3.beatoz.subscribeNewBlock().subscribe({
            error: (err: Error) => {
                failure = err;
            },
            complete: () => {
                failure = new Error('the subscription completed on its own');
            },
            next: (event: NewBlockSubscriptionEvent) => {
                expect(event.events['tm.event']).toContain('NewBlock');
                heights.push(Number(event.data.value.block.header.height));
            },
        });

        // Empty blocks only come on a 60s timer here, so the chain has to be
        // given something to do. How many blocks that makes is up to the chain,
        // which is why the height it reaches is read rather than assumed.
        const reached = await produceBlocks(web3, 3);
        await waitUntil(
            () => heights.length > 0 && heights[heights.length - 1] >= reached,
            `the subscription did not reach height ${reached}`,
        );

        expect(failure).toBeUndefined();
        assertUnbroken(heights);

        const seenBeforeCancel = heights.length;
        subscription.unsubscribe();

        // Produce another block and give it time to arrive. Asserting straight
        // away would not separate "never arrives" from "has not arrived yet".
        await sendSampleTransfer(web3);
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(heights.length).toEqual(seenBeforeCancel);
        expect(failure).toBeUndefined();
    });
});
