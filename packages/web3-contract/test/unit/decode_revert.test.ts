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
import { AbiErrorFragment } from '@beatoz/web3-types';
import { encodeErrorSignature, encodeParameters } from '@beatoz/web3-abi';
import { toChecksumAddress } from '@beatoz/web3-utils';
import { decodeRevert } from '../../src';

// What a contract reverts with: a 4-byte selector, then the ABI-encoded
// arguments. Solidity's require/revert with a message is Error(string), a
// failed assert or overflow is Panic(uint256), and a custom error is
// selected by its signature.

const revertData = (signature: string, types: string[], values: unknown[]) =>
    encodeErrorSignature(signature).slice(0, 10) + encodeParameters(types, values).slice(2);

const insufficientBalance: AbiErrorFragment = {
    type: 'error',
    name: 'ERC20InsufficientBalance',
    inputs: [
        { name: 'sender', type: 'address' },
        { name: 'balance', type: 'uint256' },
        { name: 'needed', type: 'uint256' },
    ],
};
const sender = '0x15633e505d01691a71f40049e15ba1340c0eea29';

describe('decodeRevert', () => {
    it('reads Error(string) as the reason', () => {
        const data = revertData(
            'Error(string)',
            ['string'],
            ['ERC20: transfer amount exceeds balance'],
        );
        expect(data.slice(0, 10)).toBe('0x08c379a0');
        expect(decodeRevert([], data)).toEqual({
            reason: 'ERC20: transfer amount exceeds balance',
            errorName: 'Error',
            args: ['ERC20: transfer amount exceeds balance'],
        });
    });

    it('reads Panic(uint256) as the reason for its code', () => {
        const data = revertData('Panic(uint256)', ['uint256'], [0x11]);
        expect(data.slice(0, 10)).toBe('0x4e487b71');
        expect(decodeRevert([], data)).toEqual({
            reason: 'Arithmetic operation resulted in underflow or overflow.',
            errorName: 'Panic',
            args: [17n],
        });
    });

    it('names a panic code it does not know', () => {
        const data = revertData('Panic(uint256)', ['uint256'], [0x99]);
        expect(decodeRevert([], data).reason).toBe('Panic with code 0x99.');
    });

    it("decodes an error from the contract's ABI", () => {
        const data = revertData(
            'ERC20InsufficientBalance(address,uint256,uint256)',
            ['address', 'uint256', 'uint256'],
            [sender, 0, 1000],
        );
        expect(decodeRevert([insufficientBalance], data)).toEqual({
            errorName: 'ERC20InsufficientBalance',
            args: [toChecksumAddress(sender), 0n, 1000n],
        });
    });

    it('keeps the selector of an error the ABI does not have', () => {
        const data = revertData('Unknown(uint256)', ['uint256'], [1]);
        expect(decodeRevert([insufficientBalance], data)).toEqual({ signature: data.slice(0, 10) });
    });

    it.each(['', '0x', '0x1234'])('decodes %p, shorter than a selector, to nothing', (data) => {
        expect(decodeRevert([insufficientBalance], data)).toEqual({});
    });

    it('throws on arguments that do not decode', () => {
        expect(() => decodeRevert([], '0x08c379a0ff')).toThrow();
    });
});
