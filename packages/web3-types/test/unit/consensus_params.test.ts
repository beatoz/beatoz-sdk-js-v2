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
import { InvalidResponseError } from '@beatoz/web3-errors';
import { ResponsesDecoder } from '../../src';

// What the local test node answered to consensus_params: tmjson sends every
// 64-bit integer as a decimal string.
const fromNode = {
    block_height: '8140',
    consensus_params: {
        block: { max_bytes: '22020096', max_gas: '100000000', time_iota_ms: '1000' },
        evidence: {
            max_age_num_blocks: '100000',
            max_age_duration: '172800000000000',
            max_bytes: '1048576',
        },
        validator: { pub_key_types: ['secp256k1'] },
        version: { app_version: '1' },
    },
};

const decode = (result: unknown) =>
    ResponsesDecoder.decodeConsensusParams({ jsonrpc: '2.0', id: 1, result } as never);

describe('ResponsesDecoder.decodeConsensusParams', () => {
    it('returns the numbers its type declares', () => {
        expect(decode(fromNode)).toEqual({
            block_height: 8140,
            consensus_params: {
                block: { max_bytes: 22020096, max_gas: 100000000, time_iota_ms: 1000 },
                evidence: {
                    max_age_num_blocks: 100000,
                    max_age_duration: 172800000000000,
                    max_bytes: 1048576,
                },
                validator: { pub_key_types: ['secp256k1'] },
                version: { app_version: 1 },
            },
        });
    });

    it('refuses a value beyond a safe integer', () => {
        const tooBig = {
            ...fromNode,
            consensus_params: {
                ...fromNode.consensus_params,
                block: { ...fromNode.consensus_params.block, max_gas: '9007199254740993' },
            },
        };
        expect(() => decode(tooBig)).toThrow(InvalidResponseError);
    });
});
