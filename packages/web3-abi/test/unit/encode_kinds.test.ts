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
import { AbiError } from '@beatoz/web3-errors';
import { encodeParameter, encodeParameters, encodeFunctionCall } from '../../src';

// ethers' coder takes any value for a bool (`value ? 1 : 0`, so 'false'
// encoded true) and any value for a string, and refused a Uint8Array for
// bytes (#213). The kinds are now checked first, through arrays and tuples.

const refusal = (fn: () => unknown) => {
    try {
        fn();
    } catch (e) {
        expect(e).toBeInstanceOf(AbiError);
        return (e as AbiError).shortMessage;
    }
    throw new Error('not refused');
};

describe('encoding checks the kind of bool, string and bytes values', () => {
    it.each([['false'], ['true'], [1], [0], [null]])('refuses %p for a bool', (value) => {
        expect(refusal(() => encodeParameter('bool', value))).toMatch(
            /^argument 0 must be true or false/,
        );
    });

    it('tells a string "false" from false', () => {
        expect(refusal(() => encodeParameter('bool', 'false'))).toContain(
            "write false, not 'false'",
        );
        expect(encodeParameter('bool', false)).toBe('0x' + '0'.repeat(64));
        expect(encodeParameter('bool', true)).toBe('0x' + '0'.repeat(63) + '1');
    });

    it.each([[123], [123n], [{}]])('refuses %p for a string', (value) => {
        expect(refusal(() => encodeParameter('string', value))).toMatch(
            /^argument 0 must be a string/,
        );
    });

    it('names the parameter and the place inside arrays and tuples', () => {
        expect(
            refusal(() => encodeParameters([{ name: 'active', type: 'bool' }], ['false'])),
        ).toMatch(/^active must be/);
        expect(refusal(() => encodeParameter('bool[]', [true, 'false']))).toMatch(
            /^argument 0\[1\] must be/,
        );
        expect(
            refusal(() =>
                encodeParameter(
                    {
                        type: 'tuple',
                        components: [
                            { name: 'n', type: 'uint256' },
                            { name: 'on', type: 'bool' },
                        ],
                    },
                    { n: 1, on: 'false' },
                ),
            ),
        ).toMatch(/\.on must be/);
    });

    it('encodes a Uint8Array for bytes as it encodes the same hex', () => {
        const bytes = new Uint8Array([1, 2, 255]);
        expect(encodeParameter('bytes', bytes)).toBe(encodeParameter('bytes', '0x0102ff'));
        expect(encodeParameter('bytes32', bytes)).toBe(encodeParameter('bytes32', '0x0102ff'));
        expect(encodeParameter('bytes[]', [bytes])).toBe(encodeParameter('bytes[]', ['0x0102ff']));
    });

    it('takes numbers, addresses and hex as before', () => {
        expect(encodeParameter('uint256', '1000')).toBe(encodeParameter('uint256', 1000));
        expect(encodeParameter('uint256', '0x10')).toBe(encodeParameter('uint256', 16n));
        expect(encodeParameter('address', 'ab'.repeat(20))).toBe(
            encodeParameter('address', '0x' + 'AB'.repeat(20)),
        );
    });

    it('checks the arguments of a function call', () => {
        const abi = {
            type: 'function',
            name: 'setApprovalForAll',
            inputs: [
                { name: 'operator', type: 'address' },
                { name: 'approved', type: 'bool' },
            ],
        } as const;
        expect(() => encodeFunctionCall(abi, ['0x' + '11'.repeat(20), 'false'])).toThrow(
            /approved must be true or false/,
        );
    });
});
