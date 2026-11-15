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
import { getLatestHeight, getSampleHeight } from '../chain_fixtures';
import { ValidatorsResponse } from '@beatoz/web3-types';

describe('validators check ', () => {
    let testWebsocketWeb3Instance: Web3;

    beforeAll(() => {
        testWebsocketWeb3Instance = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(testWebsocketWeb3Instance));

    it('should call web3 with testWebsocketWeb3Instance.validators method success return', async () => {
        const height = await getSampleHeight(testWebsocketWeb3Instance);
        const testValidatorsResponse: ValidatorsResponse =
            await testWebsocketWeb3Instance.beatoz.validators(height);
        expect(testValidatorsResponse.block_height).toEqual(height);
        expect(testValidatorsResponse.total).toBeDefined();
        expect(testValidatorsResponse.count).toBeDefined();
        expect(testValidatorsResponse.validators).toBeDefined();
    });

    it('answers for the latest height when called without one', async () => {
        // The node answers for its tip, or the block after it once in
        // consensus, so never below a height read before the call.
        const before = await getLatestHeight(testWebsocketWeb3Instance);
        const { block_height, validators } = await testWebsocketWeb3Instance.beatoz.validators();
        expect(block_height).toBeGreaterThanOrEqual(before);
        expect(validators.length).toBeGreaterThan(0);
    });
});
