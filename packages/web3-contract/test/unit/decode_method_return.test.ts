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
import { AbiFunctionFragment } from '@beatoz/web3-types';
import { decodeMethodReturn } from '../../src';

// A contract call returns ABI-encoded bytes; decodeMethodReturn reads them by
// the function's outputs, as viem's decodeFunctionResult does: nothing for no
// outputs, the value for one, an array for more.

const fn = (outputs: AbiFunctionFragment['outputs']): AbiFunctionFragment => ({
    type: 'function',
    name: 'f',
    inputs: [],
    outputs,
    stateMutability: 'view',
});

// 1000 as one 32-byte word, and true as another.
const word1000 = '00000000000000000000000000000000000000000000000000000000000003e8';
const wordTrue = '0000000000000000000000000000000000000000000000000000000000000001';
// The string 'MyToken': offset 32, length 7, then the bytes.
const myToken =
    '0000000000000000000000000000000000000000000000000000000000000020' +
    '0000000000000000000000000000000000000000000000000000000000000007' +
    '4d79546f6b656e00000000000000000000000000000000000000000000000000';

describe('decodeMethodReturn', () => {
    it('returns the value itself for one output', () => {
        expect(decodeMethodReturn(fn([{ name: '', type: 'uint256' }]), word1000)).toBe(1000n);
        expect(decodeMethodReturn(fn([{ name: '', type: 'string' }]), myToken)).toBe('MyToken');
    });

    it('accepts hex with or without 0x', () => {
        expect(decodeMethodReturn(fn([{ name: '', type: 'uint256' }]), `0x${word1000}`)).toBe(
            1000n,
        );
    });

    it('returns an array for more than one output', () => {
        const outputs = [
            { name: 'amount', type: 'uint256' },
            { name: 'ok', type: 'bool' },
        ];
        expect(decodeMethodReturn(fn(outputs), word1000 + wordTrue)).toEqual([1000n, true]);
    });

    it('returns undefined for no outputs', () => {
        expect(decodeMethodReturn(fn([]), '')).toBeUndefined();
        expect(decodeMethodReturn(fn(undefined), '')).toBeUndefined();
    });
});
