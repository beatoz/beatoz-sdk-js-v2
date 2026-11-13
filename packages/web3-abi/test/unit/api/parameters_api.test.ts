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
import { AbiInput } from '@beatoz/web3-types';
import { decodeParameters, encodeParameters } from '../../../src/api/parameters_api';
import {
    inValidDecodeParametersData,
    inValidEncodeParametersData,
    validDecodeParametersData,
    validEncodeParametersData,
    validEncodeDecodeParametersData,
    validEncodeDoesNotMutateData,
} from '../../fixtures/data';

describe('parameters_api', () => {
    describe('encodeParameters', () => {
        describe('valid data', () => {
            it.each(validEncodeParametersData)(
                '%#: should pass for valid values: %j',
                ({ input: [abi, params], output }) => {
                    const expected = encodeParameters(abi, params);
                    expect(JSON.parse(JSON.stringify(expected))).toEqual(output);
                },
            );
        });

        describe('invalid data', () => {
            it.each(inValidEncodeParametersData)(
                '%#: should not pass for invalid values: %j',
                ({ input: [abi, params], output }) => {
                    expect(() => encodeParameters(abi, params)).toThrow(output);
                },
            );
        });
    });

    describe('encodeParametersDoesNotMutate', () => {
        describe('valid data', () => {
            it.each(validEncodeDoesNotMutateData)(
                '%#: should pass for valid values: %j',
                ({ input: [abi, params], output, expectedInput }) => {
                    const expected = encodeParameters(abi, params);
                    expect(JSON.parse(JSON.stringify(expected))).toEqual(output);
                    // check that params has not been mutated
                    expect(JSON.parse(JSON.stringify(params))).toEqual(
                        JSON.parse(JSON.stringify(expectedInput)),
                    );
                },
            );
        });
    });

    describe('decodeParameters', () => {
        describe('valid data', () => {
            it.each(validDecodeParametersData)(
                '%#: should pass for valid values: %j',
                ({ input: [abi, bytes], outputResult }) => {
                    // Output returns mix of array and object which can't be matched in
                    // jest, so have to use stringify+parse to match
                    // {
                    //   '0': [ '34', '255' ],
                    //   '1': [
                    //     '42',
                    //     '56',
                    //     [ '45', '78', propertyOne: '45', propertyTwo: '78' ],
                    //     propertyOne: '42',
                    //     propertyTwo: '56',
                    //     ChildStruct: [ '45', '78', propertyOne: '45', propertyTwo: '78' ]
                    //   ],
                    //   __length__: 2
                    // }
                    expect(JSON.parse(JSON.stringify(decodeParameters(abi, bytes)))).toEqual(
                        outputResult,
                    );
                },
            );
        });

        describe('invalid data', () => {
            it.each(inValidDecodeParametersData)(
                '%#: should not pass for invalid values: %j',
                ({ input: [abi, bytes], output }) => {
                    expect(() => decodeParameters(abi, bytes)).toThrow(output);
                },
            );
        });
    });

    // A parameter object may leave out `name`; it used to be taken for the
    // simplified struct form `{ StructName: { ... } }` and fail to decode.
    describe('parameters without a name', () => {
        const word1000 = '00000000000000000000000000000000000000000000000000000000000003e8';
        const wordTrue = '0000000000000000000000000000000000000000000000000000000000000001';

        it('decodes one', () => {
            expect(decodeParameters([{ type: 'uint256' }], word1000)[0]).toBe(1000n);
        });

        it('decodes several', () => {
            const decoded = decodeParameters(
                [{ type: 'uint256' }, { type: 'bool' }],
                word1000 + wordTrue,
            );
            expect([decoded[0], decoded[1], decoded.__length__]).toEqual([1000n, true, 2]);
        });

        it('encodes and decodes back', () => {
            const abi = [{ type: 'address' }, { type: 'string' }];
            const params = ['0x15633e505d01691a71f40049e15ba1340c0eea29', 'MyToken'];
            const decoded = decodeParameters(abi, encodeParameters(abi, params));
            expect([String(decoded[0]).toLowerCase(), decoded[1]]).toEqual(params);
        });
    });

    describe('encode and decode', () => {
        describe('input should be the same as returned value from encode and decode', () => {
            it.each(validEncodeDecodeParametersData)(
                '%#: should pass for valid values: %j',
                ({ input: [abi, params], output, outputResult }) => {
                    const rwAbi = abi as AbiInput[];
                    const encodedBytes = encodeParameters(abi, params);
                    expect(JSON.parse(JSON.stringify(encodedBytes))).toEqual(output);

                    const decodedParams = decodeParameters(rwAbi, encodedBytes);
                    expect(JSON.parse(JSON.stringify(decodedParams))).toEqual(outputResult);
                },
            );
        });
    });
});
