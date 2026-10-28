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
import { BytesUint8Array } from '../../src';
import cryptojs from 'crypto-js';

describe('BytesUint8Array class tests', () => {
    test('fromHex', () => {
        const hex = '0x123abc';
        const bytes = BytesUint8Array.fromHex(hex);
        expect(bytes.toHex()).toBe(hex.substring(2));
    });

    test.each([
        ['', ''],
        ['0x', ''],
        ['00', '00'],
        ['0xABcd', 'abcd'],
        ['0x' + 'ff'.repeat(20), 'ff'.repeat(20)],
    ])('fromHex reads %j', (hex, bytes) => {
        expect(BytesUint8Array.fromHex(hex).toHex()).toBe(bytes);
    });

    // Each of these used to be read without an error: a non-hex digit as 0 and
    // an odd length with a leading zero, so 'zz' was 00 and '0xabc' was 0abc.
    test.each([['zz'], ['0x0g'], ['0X12'], [' 12'], ['12 '], ['0x-1'], ['0x0x12']])(
        'fromHex rejects %j',
        (hex) => {
            expect(() => BytesUint8Array.fromHex(hex)).toThrow(
                `invalid hex: ${JSON.stringify(hex)}`,
            );
        },
    );

    test.each([['0xabc'], ['1'], ['0x' + 'f'.repeat(39)]])(
        'fromHex rejects an odd number of digits, %j',
        (hex) => {
            expect(() => BytesUint8Array.fromHex(hex)).toThrow(
                `hex must have an even number of digits: ${JSON.stringify(hex)}`,
            );
        },
    );

    test('fromHex rejects a value that is not a string', () => {
        expect(() => BytesUint8Array.fromHex(12 as unknown as string)).toThrow(
            'hex must be a string, got number',
        );
    });

    test('parse - hex', () => {
        const hex = '123abc';
        const bytes = BytesUint8Array.parse(hex, 'hex');
        expect(bytes.toHex()).toBe(hex);
    });

    test('parse - words', () => {
        const wordArray = cryptojs.enc.Hex.parse('123abc');
        const bytes = BytesUint8Array.parse(wordArray, 'words');
        expect(bytes.toHex()).toBe(wordArray.toString());
    });

    test('toHex', () => {
        const hex = '123abc';
        const bytes = BytesUint8Array.fromHex(hex);
        expect(bytes.toHex()).toBe(hex);
    });

    test('toWords', () => {
        const wordArray = cryptojs.enc.Hex.parse('123abc');
        const bytes = BytesUint8Array.fromWords(wordArray);
        expect(bytes.toWords().toString()).toBe(wordArray.toString());
    });

    test('isEqual', () => {
        const hex = '123abc';
        const bytes1 = BytesUint8Array.fromHex(hex);
        const bytes2 = BytesUint8Array.fromHex(hex);
        const bytes3 = BytesUint8Array.fromHex('456def');
        expect(bytes1.isEqual(bytes2)).toBeTruthy();
        expect(bytes1.isEqual(bytes3)).toBeFalsy();
    });

    test('b64ToBytes', () => {
        const base64 = Buffer.from('123abc', 'hex').toString('base64');
        const bytes = BytesUint8Array.b64ToBytes(base64);
        expect(bytes.toHex()).toBe('123abc');
    });
});
