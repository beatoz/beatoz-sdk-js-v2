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

describe('consensusState check ', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('reports the height being decided, the round and the step', async () => {
        const before = await getLatestHeight(web3);
        const { round_state } = await web3.beatoz.consensusState();
        const after = await getLatestHeight(web3);

        // "height/round/step". The height is the block after the last committed
        // one, or that block itself while it is still being committed.
        const [height, round, step] = round_state['height/round/step'].split('/').map(Number);
        expect(height).toBeGreaterThanOrEqual(before);
        expect(height).toBeLessThanOrEqual(after + 1);
        expect(round).toBeGreaterThanOrEqual(0);
        expect(step).toBeGreaterThanOrEqual(1);
    });
});
