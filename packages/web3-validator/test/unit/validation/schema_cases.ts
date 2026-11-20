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
import { validator } from '../../../src';

// Inputs for the validator, run once on is-my-json-valid to record
// fixtures/validator_baseline.json, which the validator must still give
// (#226). Deterministic: the same list in the same order every run.

const ADDRESS = '0x' + 'ab'.repeat(20);
const CHECKSUMMED = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const BAD_CHECKSUM = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD';

const VALUES: unknown[] = [
    0,
    1,
    -1,
    127,
    128,
    255,
    256,
    -128,
    -129,
    2 ** 53,
    1.5,
    NaN,
    BigInt(2) ** BigInt(255),
    BigInt(2) ** BigInt(256),
    -(BigInt(2) ** BigInt(255)),
    '0',
    '1',
    '-1',
    '256',
    '0x',
    '0x0',
    '0x1',
    '0xff',
    '0x100',
    '0xzz',
    'ff',
    '',
    'abc',
    '1.5',
    true,
    false,
    'true',
    null,
    undefined,
    ADDRESS,
    CHECKSUMMED,
    BAD_CHECKSUM,
    ADDRESS.slice(2),
    '0x' + 'ab'.repeat(19),
    '0x' + '11'.repeat(32),
    new Uint8Array([]),
    new Uint8Array([1]),
    new Uint8Array(20).fill(7),
    new Uint8Array(32).fill(9),
    new Uint8Array(33),
    [],
    [1, 2],
    [256],
    {},
    { a: 1 },
];

const SCALARS = [
    'uint',
    'uint8',
    'uint256',
    'int',
    'int8',
    'int256',
    'bytes',
    'bytes1',
    'bytes20',
    'bytes32',
    'address',
    'bool',
    'string',
    'hex',
    'number',
    'blockNumber',
];

const ARRAYS = [
    'uint[]',
    'uint8[2]',
    'address[]',
    'bytes32[1]',
    'bool[2][3]',
    'uint[][2]',
    'int8[2][]',
];

// Values for array cases: a few kinds, so the combinations stay small.
const FEW: unknown[] = [0, 256, -1, '0x1', 'abc', true, null, undefined, ADDRESS, [1]];

export type Case = { label: string; run: () => unknown };

const short = (schema: unknown, data: unknown[]): Case => ({
    label: `validate(${describe(schema)}, ${describe(data)})`,
    run: () => {
        const silent = validator.validate(schema as never, data, { silent: true });
        let thrown: unknown;
        try {
            validator.validate(schema as never, data);
        } catch (e) {
            thrown = e;
        }
        return { silent, thrown };
    },
});

const json = (schema: object, data: unknown): Case => ({
    label: `validateJSONSchema(${describe(schema)}, ${describe(data)})`,
    run: () => {
        try {
            return {
                silent: validator.validateJSONSchema(schema, data as object, { silent: true }),
            };
        } catch (e) {
            return { thrown: e };
        }
    },
});

function describe(v: unknown): string {
    return JSON.stringify(v, (_k, x: unknown) => {
        if (typeof x === 'bigint') return `${x}n`;
        if (x instanceof Uint8Array) return `Uint8Array(${x.length})`;
        if (x === undefined) return 'undefined';
        if (typeof x === 'number' && !Number.isFinite(x)) return String(x);
        return x;
    });
}

function arraysOf(len: number, from: unknown[]): unknown[][] {
    if (len === 0) return [[]];
    return from.map((v) => Array.from({ length: len }, () => v));
}

export function cases(): Case[] {
    const out: Case[] = [];

    for (const type of SCALARS) {
        for (const v of VALUES) out.push(short([type], [v]));
        out.push(short([type], []));
        out.push(short([type], [1, 2]));
    }

    for (const type of ARRAYS) {
        for (let len = 0; len <= 3; len++) {
            for (const arr of arraysOf(len, FEW)) out.push(short([type], [arr]));
        }
        for (const v of FEW) out.push(short([type], [v]));
        out.push(short([type], [[[1, 2], [3]]]));
        out.push(
            short(
                [type],
                [
                    [
                        [1, 2],
                        [3, 4],
                        [5, 6],
                    ],
                ],
            ),
        );
        out.push(
            short(
                [type],
                [
                    [
                        [1, 'x'],
                        ['0x1', -1],
                    ],
                ],
            ),
        );
    }

    const tuples: unknown[] = [
        [['uint', 'string']],
        [['uint', ['address', 'bytes']]],
        ['tuple[2]', ['uint', 'address']],
        ['tuple[]', ['bool']],
        [
            {
                name: 'p',
                type: 'tuple',
                components: [
                    { name: 'a', type: 'uint8' },
                    { name: 'b', type: 'address[]' },
                ],
            },
        ],
        [{ name: 'q', type: 'tuple[2]', components: [{ name: 'x', type: 'int8' }] }],
        ['uint', 'address'],
        ['uint8', 'bool', 'bytes32'],
        [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
    ];
    const tupleData: unknown[][] = [
        [],
        [[1, 'a']],
        [[1, 2]],
        [['x', 'a']],
        [[1]],
        [[1, 'a', 3]],
        [[1, [ADDRESS, '0x01']]],
        [[1, [ADDRESS, 'zz']]],
        [[1, ['bad', '0x01']]],
        [
            [
                [1, ADDRESS],
                [2, ADDRESS],
            ],
        ],
        [[[1, ADDRESS]]],
        [
            [
                [1, 'bad'],
                [-2, ADDRESS],
            ],
        ],
        [[true], [false], ['x']],
        [[[true], [false], ['x']]],
        [[[255, [ADDRESS]]]],
        [[[300, ['bad']]]],
        [[256, [ADDRESS, ADDRESS]]],
        [[[1], [2]]],
        [[[1], [200]]],
        [1, ADDRESS],
        ['x', 'y'],
        [1],
        [255, true, '0x' + '11'.repeat(32)],
        [256, 'no', '0x11'],
        [ADDRESS, '1000'],
        [null],
        [undefined, undefined],
        [{ a: 1 }],
    ];
    for (const schema of tuples) {
        for (const data of tupleData) out.push(short(schema, data));
    }

    const schemas: object[] = [
        { type: 'array', items: [{ format: 'uint8', required: true }], minItems: 1, maxItems: 1 },
        { type: 'array', items: { format: 'address' } },
        { items: { format: 'uint8' } },
        { type: 'array', items: { type: 'array', items: { format: 'bool' }, minItems: 2 } },
        { type: 'object', properties: { a: { format: 'uint' }, b: { type: 'string' } } },
        { type: 'object', properties: { a: { format: 'uint' } }, required: ['a'] },
        { properties: { a: { format: 'uint', required: true }, 'b-c': { type: 'number' } } },
        { type: 'object', properties: { inner: { type: 'array', items: [{ format: 'hex' }] } } },
        { oneOf: [{ format: 'uint8' }, { format: 'address' }] },
        { oneOf: [{ format: 'uint' }, { format: 'int' }] },
        { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'number' }] } },
        { type: 'string' },
        { type: 'number' },
        { type: 'integer' },
        { type: 'boolean' },
        { type: 'null' },
        { type: 'object' },
        { type: ['string', 'null'] },
        { format: 'unknownFormat' },
        { $id: 'x', title: 't', description: 'd', format: 'bytes4' },
        { required: true },
        {},
    ];
    const jsonData: unknown[] = [
        ...VALUES,
        [1],
        [300],
        [ADDRESS, 'x'],
        [[true, false], [true]],
        [[true, 1]],
        ['a', 1, null],
        { a: 1, b: 'x' },
        { a: -1, b: 2 },
        { b: 'x' },
        { a: 1, 'b-c': 2 },
        { a: 1, 'b-c': 'x' },
        { inner: ['0x1'] },
        { inner: ['zz'] },
        { inner: 'zz' },
    ];
    for (const schema of schemas) {
        for (const data of jsonData) out.push(json(schema, data));
    }

    return out;
}

// What a case gave, as JSON that keeps bigints, bytes, undefined and NaN apart
// and records a thrown error by class and message.
export function serialize(result: unknown): unknown {
    return JSON.parse(
        JSON.stringify(result, (_k, x: unknown) => {
            if (typeof x === 'bigint') return { $bigint: x.toString() };
            if (x instanceof Uint8Array) return { $bytes: Array.from(x) };
            if (x === undefined) return { $undefined: true };
            if (typeof x === 'number' && !Number.isFinite(x)) return { $number: String(x) };
            if (x instanceof Error) {
                // Its errors, if any, are the ones validate() returns with silent.
                return { $error: x.constructor.name, message: x.message };
            }
            return x;
        }),
    );
}
