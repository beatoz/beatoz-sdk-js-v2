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
import { WebsocketProvider } from '../../../src';
import { getTestWsServer } from '../e2e_utils';
import { assertUnbroken, produceBlock, produceBlocks, waitUntil } from '../block_fixtures';
import { createJsonRpcRequest } from './websocket_provider.test';
import { NewBlockHeaderSubscriptionEvent, SubscriptionEvent } from '@beatoz/web3-types';

describe('WebsocketClient', () => {
    it('delivers every block header until the subscription is cancelled', async () => {
        const client = new WebsocketProvider(getTestWsServer());
        const query = "tm.event='NewBlockHeader'";
        const heights: number[] = [];
        let failure: Error | undefined;

        const subscription = client.listen(createJsonRpcRequest('subscribe', { query })).subscribe({
            error: (err: Error) => {
                failure = err;
            },
            complete: () => {
                failure = new Error('the subscription completed on its own');
            },
            next: (event: SubscriptionEvent) => {
                expect(event.query).toEqual(query);
                // subscribe() does not know the event type; the query does.
                const { header } = (event as NewBlockHeaderSubscriptionEvent).data.value;
                heights.push(Number(header.height));
            },
        });

        // Empty blocks only come on a 60s timer here, so the chain has to be
        // given something to do.
        const reached = await produceBlocks(3);
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
        await produceBlock();
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(heights.length).toEqual(seenBeforeCancel);
        expect(failure).toBeUndefined();

        client.disconnect();
    });
});
