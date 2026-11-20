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
import { InvalidInputError, InvalidResponseError } from '@beatoz/web3-errors';
import { BlockIdFlag, BytesUint8Array, ResponsesDecoder } from '../../src';
import events from './fixtures/subscription_events.json';

// A response whose values are not the shapes the node sends is the node's
// fault, not the caller's: decoding it throws InvalidResponseError.
const response = (result: unknown) => ({ jsonrpc: '2.0' as const, id: 1, result });

describe('decoding errors', () => {
    it.each([
        ['a result that is not an object', () => ResponsesDecoder.decodeNetInfo(response('x'))],
        [
            'a height that is not an integer',
            () => ResponsesDecoder.decodeBlockResults(response({ height: 'x' })),
        ],
        [
            'a height past the safe integer range',
            () => ResponsesDecoder.decodeBlockResults(response({ height: '9007199254740993' })),
        ],
    ])('refuses %s as an InvalidResponseError', (_, decode) => {
        expect(decode).toThrow(InvalidResponseError);
    });

    it('names the value it could not read', () => {
        expect(() => ResponsesDecoder.decodeBlockResults(response({ height: 'x' }))).toThrow(
            'an integer in the response must be a safe integer, got "x"',
        );
    });

    it('refuses bad hex from the caller as an InvalidInputError', () => {
        expect(() => BytesUint8Array.fromHex('zz')).toThrow(InvalidInputError);
    });
});

// The commit the node sent for block 2905, with its signature's flag replaced.
const commitWithFlag = (flag: unknown) => {
    const block = events.newBlock.data.value.block;
    const commit = JSON.parse(JSON.stringify(block.last_commit));
    commit.signatures[0].block_id_flag = flag;
    return () =>
        ResponsesDecoder.decodeCommit(
            response({ canonical: true, signed_header: { header: block.header, commit } }),
        );
};

describe('block_id_flag (#223)', () => {
    it('reads each flag the node defines', () => {
        for (const flag of [0, 1, 2, 3, -1]) {
            expect(commitWithFlag(flag)().signed_header.commit.signatures[0].block_id_flag).toBe(
                flag as BlockIdFlag,
            );
        }
    });

    it.each([[4], ['Commit'], ['2'], [null]])('refuses %p as an InvalidResponseError', (flag) => {
        expect(commitWithFlag(flag)).toThrow(InvalidResponseError);
        expect(commitWithFlag(flag)).toThrow('a block_id_flag in the response must be one of');
    });
});
