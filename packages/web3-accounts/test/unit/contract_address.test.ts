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
import { getContractAddress } from '../../src';

// Ethereum's CREATE address, which the node uses too. Nonces 0 to 2 are the
// widely published values for this sender; 127, 128 and 1000 cross the RLP
// boundaries of a one-byte and a two-byte nonce.
const FROM = '0x6ac7ea33f8831ea9dcc53393aaa88b25a785dbf0';

describe('getContractAddress', () => {
    it.each([
        [0, '0xcd234A471b72ba2F1Ccf0A70FCABA648a5eeCD8d'],
        [1, '0x343c43A37D37dfF08AE8C4A11544c718AbB4fCF8'],
        [2, '0xf778B86FA74E846c4f0a1fBd1335FE81c00a0C91'],
        [127, '0x06d9a77f5E4b311Bae8D559DB9CDB4dF94104aA0'],
        [128, '0x08e190dcB7b73F5fcDAbb43e102215c83659A76D'],
        [1000, '0xB9cDb7F5e62043c1e4EB7a6d76eF8Ee246D364Ec'],
    ])('nonce %d', (nonce, address) => {
        expect(getContractAddress(FROM, nonce)).toBe(address);
    });

    it('takes the sender with or without 0x, in any case', () => {
        expect(getContractAddress(FROM.slice(2).toUpperCase(), 0)).toBe(
            '0xcd234A471b72ba2F1Ccf0A70FCABA648a5eeCD8d',
        );
    });

    it.each(['0x1234', FROM + '00', 'zz'.repeat(20)])('refuses the sender %p', (from) => {
        expect(() => getContractAddress(from, 0)).toThrow('from must be 20 bytes');
    });

    it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN])('refuses the nonce %p', (nonce) => {
        expect(() => getContractAddress(FROM, nonce)).toThrow(
            'nonce must be a non-negative safe integer',
        );
    });
});
