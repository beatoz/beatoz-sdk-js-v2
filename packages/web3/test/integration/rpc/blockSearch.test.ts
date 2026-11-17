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
import { getLatestHeight } from '../chain_fixtures';

describe('blockSearch check', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('finds the blocks a height range names, in order', async () => {
        const to = await getLatestHeight(web3);
        const from = to - 2;

        const result = await web3.beatoz.blockSearch(
            `block.height >= ${from} AND block.height <= ${to}`,
            1,
            10,
            'asc',
        );

        expect(result.total_count).toBe(3);
        expect(result.blocks.map((b) => b.block.header.height)).toEqual([from, from + 1, to]);
        for (const found of result.blocks) {
            const block = await web3.beatoz.block(found.block.header.height);
            expect(found.block_id.hash).toEqual(block.block_id.hash);
        }
    });
});
