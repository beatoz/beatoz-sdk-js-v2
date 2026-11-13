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
import { encodeParameters } from '@beatoz/web3-abi';
import { AbiFunctionFragment } from '@beatoz/web3-types';
import { decodeMethodReturn } from '../../src';

// A contract call returns ABI-encoded bytes; decodeMethodReturn reads them by
// the function's outputs, as viem's decodeFunctionResult does: nothing for no
// outputs, the value for one, an array for more. Values take the shape abitype
// types them as: integers of 48 bits or fewer are numbers, wider ones bigints;
// a tuple with named components is an object, otherwise an array.

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

    // Encodes values by the outputs, as the contract would return them.
    const returned = (outputs: AbiFunctionFragment['outputs'], values: unknown[]) =>
        decodeMethodReturn(fn(outputs), encodeParameters([...(outputs ?? [])], values));

    it.each(['uint8', 'uint16', 'uint32', 'uint48', 'int8', 'int48'])(
        'returns a %s as a number',
        (type) => {
            expect(returned([{ name: '', type }], [18])).toBe(18);
        },
    );

    it.each(['uint56', 'uint64', 'uint256', 'int256'])('returns a %s as a bigint', (type) => {
        expect(returned([{ name: '', type }], [18])).toBe(18n);
    });

    it('returns a tuple with named components as an object', () => {
        const outputs = [
            {
                name: 'p',
                type: 'tuple',
                components: [
                    { name: 'a', type: 'uint256' },
                    { name: 'b', type: 'bool' },
                    { name: 'c', type: 'uint8' },
                ],
            },
        ];
        expect(returned(outputs, [{ a: 1n, b: true, c: 7 }])).toEqual({ a: 1n, b: true, c: 7 });
    });

    it('returns a tuple with unnamed components as an array', () => {
        const outputs = [
            {
                name: 'p',
                type: 'tuple',
                components: [
                    { name: '', type: 'uint256' },
                    { name: '', type: 'bool' },
                ],
            },
        ];
        expect(returned(outputs, [[1n, true]])).toEqual([1n, true]);
    });

    it('shapes the elements of arrays', () => {
        expect(returned([{ name: '', type: 'uint8[]' }], [[1, 2]])).toEqual([1, 2]);
        expect(returned([{ name: '', type: 'uint256[2]' }], [[1, 2]])).toEqual([1n, 2n]);
        const outputs = [
            {
                name: '',
                type: 'tuple[]',
                components: [{ name: 'x', type: 'uint16' }],
            },
        ];
        expect(returned(outputs, [[{ x: 3 }, { x: 4 }]])).toEqual([{ x: 3 }, { x: 4 }]);
    });

    it('returns undefined for no outputs', () => {
        expect(decodeMethodReturn(fn([]), '')).toBeUndefined();
        expect(decodeMethodReturn(fn(undefined), '')).toBeUndefined();
    });
});
