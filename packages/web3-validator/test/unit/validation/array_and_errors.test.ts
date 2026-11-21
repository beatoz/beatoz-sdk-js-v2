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

import { checkAddressCheckSum, isAddress } from '../../../src/validation/address';
import { validator, Web3ValidatorError } from '../../../src';

const ADDRESS = '0x' + 'ab'.repeat(20);
const errorsOf = (schema: unknown, data: unknown[]) =>
    validator.validate(schema as never, data, { silent: true });

// #229: array elements are checked against their size, every row of a nested
// array is checked, and each error says where.
describe('array elements', () => {
    it.each([
        [['uint8[2]'], [[1, 300]], '/0/1', 'uint8'],
        [['uint8[]'], [[300]], '/0/0', 'uint8'],
        [['int16[]'], [[40000]], '/0/0', 'int16'],
        [['bytes4[]'], [['0x0102030405']], '/0/0', 'bytes4'],
        [['address[2]'], [[ADDRESS, 'bad']], '/0/1', 'address'],
        [
            ['bool[2][3]'],
            [
                [
                    [true, true],
                    [true, true],
                    [true, 'x'],
                ],
            ],
            '/0/2/1',
            'bool',
        ],
        [
            [['tuple[]', ['bool', 'uint8']]],
            [
                [
                    [true, 1],
                    [false, 300],
                ],
            ],
            '/0/1/1',
            'uint8',
        ],
        [
            ['uint', 'bool[2][3]'],
            [
                1,
                [
                    [true, true],
                    [true, true],
                    ['x', true],
                ],
            ],
            '/1/2/0',
            'bool',
        ],
    ])('%j refuses %j at %s', (schema, data, at, format) => {
        expect(errorsOf(schema, data)).toEqual([
            expect.objectContaining({
                keyword: 'format',
                instancePath: at,
                message: `must pass "${format}" validation`,
            }),
        ]);
    });

    it.each([
        [['uint8[2]'], [[1, 2]]],
        [
            ['bool[2][3]'],
            [
                [
                    [true, false],
                    [false, true],
                    [true, true],
                ],
            ],
        ],
        [
            ['int8[2][]'],
            [
                [
                    [1, -1],
                    [127, -128],
                ],
            ],
        ],
        [
            [['tuple[2]', ['uint8', 'address[]']]],
            [
                [
                    [1, [ADDRESS]],
                    [255, []],
                ],
            ],
        ],
        [
            ['uint', 'bool[2][3]'],
            [
                1,
                [
                    [true, true],
                    [true, true],
                    [true, true],
                ],
            ],
        ],
    ])('%j takes %j', (schema, data) => {
        expect(errorsOf(schema, data)).toBeUndefined();
    });

    it('checks the length of each dimension', () => {
        expect(errorsOf(['bool[2][3]'], [[[true, true]]])).toEqual([
            expect.objectContaining({
                keyword: 'minItems',
                instancePath: '/0',
                params: { limit: 3 },
                message: 'must NOT have fewer than 3 items',
            }),
        ]);
        expect(errorsOf(['bool[2][3]'], [[[true], [true, true], [true, true]]])).toEqual([
            expect.objectContaining({
                keyword: 'minItems',
                instancePath: '/0/0',
                params: { limit: 2 },
            }),
        ]);
    });

    it('names the limit of the array that failed, not of the parameter list', () => {
        expect(errorsOf(['uint8[2]'], [[1, 2, 3]])).toEqual([
            {
                keyword: 'maxItems',
                instancePath: '/0',
                schemaPath: '#/items/0/maxItems',
                params: { limit: 2 },
                message: 'must NOT have more than 2 items',
            },
        ]);
    });
});

describe('sizes', () => {
    it.each([
        ['uint24', 2 ** 24 - 1, 2 ** 24],
        ['uint40', 2 ** 40 - 1, 2 ** 40],
        ['int24', -(2 ** 23), -(2 ** 23) - 1],
        ['uint248', BigInt(2) ** BigInt(248) - BigInt(1), BigInt(2) ** BigInt(248)],
    ])('%s takes %p and refuses %p', (type, fits, over) => {
        expect(errorsOf([type], [fits])).toBeUndefined();
        expect(errorsOf([type], [over])).toEqual([
            expect.objectContaining({
                keyword: 'format',
                message: `must pass "${type}" validation`,
            }),
        ]);
    });
});

describe('error objects', () => {
    it('for a value of a tuple inside a tuple', () => {
        expect(errorsOf([['uint', ['address', 'bytes']]], [[1, ['bad', '0x01']]])).toEqual([
            {
                keyword: 'format',
                instancePath: '/0/1/0',
                schemaPath: '#/items/0/items/1/items/0/format',
                params: { value: 'bad', format: 'address' },
                message: 'must pass "address" validation',
            },
        ]);
    });

    it('for a missing value', () => {
        expect(errorsOf(['uint', 'address'], [1])).toEqual([
            expect.objectContaining({
                keyword: 'minItems',
                instancePath: '',
                params: { limit: 2 },
            }),
            {
                keyword: 'required',
                instancePath: '/1',
                schemaPath: '#/items/1/required',
                params: { missingProperty: '1' },
                message: 'is required',
            },
        ]);
    });

    it('for a value of the wrong type', () => {
        expect(errorsOf(['uint8[2]'], [5])).toEqual([
            {
                keyword: 'type',
                instancePath: '/0',
                schemaPath: '#/items/0/type',
                params: { value: 5, type: 'array' },
                message: 'must be array',
            },
        ]);
    });

    it('in validateJSONSchema, for properties and oneOf', () => {
        expect(
            validator.validateJSONSchema(
                {
                    type: 'object',
                    properties: {
                        'a/b': { format: 'uint8' },
                        c: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                    },
                    required: ['d'],
                },
                { 'a/b': 300, c: true },
                { silent: true },
            ),
        ).toEqual([
            expect.objectContaining({
                keyword: 'required',
                instancePath: '/d',
                params: { missingProperty: 'd' },
            }),
            expect.objectContaining({
                keyword: 'format',
                instancePath: '/a~1b',
                schemaPath: '#/properties/a~1b/format',
            }),
            expect.objectContaining({
                keyword: 'oneOf',
                instancePath: '/c',
                message: 'must match exactly one schema in oneOf',
                params: { value: true, passingSchemas: 0 },
            }),
        ]);
    });

    it('in the thrown message', () => {
        expect(() => validator.validate(['uint8[2]'], [[1, 300]])).toThrow(Web3ValidatorError);
        expect(() => validator.validate(['uint8[2]'], [[1, 300]])).toThrow(
            'value "300" at "/0/1" must pass "uint8" validation',
        );
    });
});
