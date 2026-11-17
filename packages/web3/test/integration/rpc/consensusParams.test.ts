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
import { asNodeHeight, getSampleHeight } from '../chain_fixtures';
import { ConsensusParamsResponse } from '@beatoz/web3-types';

describe('consensusParams check ', () => {
    let testWebsocketWeb3Instance: Web3;

    beforeAll(() => {
        testWebsocketWeb3Instance = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(testWebsocketWeb3Instance));

    it('should call web3 with testWebsocketWeb3Instance.consensusParams method success return', async () => {
        const testConsensusParamsResponse: ConsensusParamsResponse =
            await testWebsocketWeb3Instance.beatoz.consensusParams();
        // The node sends its 64-bit integers as strings; the SDK decodes
        // them to numbers, as the type says (#38).
        const { block_height, consensus_params } = testConsensusParamsResponse;
        expect(block_height).toEqual(expect.any(Number));
        const { block, evidence, validator, version } = consensus_params;
        for (const value of [
            block.max_bytes,
            block.max_gas,
            block.time_iota_ms,
            evidence.max_age_num_blocks,
            evidence.max_age_duration,
            evidence.max_bytes,
            version.app_version,
        ]) {
            expect(Number.isSafeInteger(value)).toBe(true);
        }
        expect(validator.pub_key_types).toEqual(expect.any(Array));
    });

    it('should call web3 with testWebsocketWeb3Instance.consensusParams(height) method success return', async () => {
        const height = await getSampleHeight(testWebsocketWeb3Instance);
        const testConsensusParamsResponse2: ConsensusParamsResponse =
            await testWebsocketWeb3Instance.beatoz.consensusParams(height);
        expect(asNodeHeight(testConsensusParamsResponse2.block_height)).toEqual(
            asNodeHeight(height),
        );
        expect(testConsensusParamsResponse2.consensus_params).toBeDefined();
    });
});
