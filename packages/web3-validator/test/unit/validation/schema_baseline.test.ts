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
import * as fs from 'fs';
import * as path from 'path';
import { InvalidInputError } from '@beatoz/web3-errors';
import { validator } from '../../../src';
import { cases, serialize } from './schema_cases';

// What is-my-json-valid 2.20.6 answered for each case, recorded before the
// validator stopped using it (#226). The validator must answer the same.
const baseline: Array<{ label: string; result: unknown }> = fs
    .readFileSync(path.join(__dirname, '../../fixtures/validator_baseline.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

// Where is-my-json-valid threw a TypeError (reading a property of null), the
// validator now answers; these cases are checked below instead.
const crashed = (result: unknown) =>
    (result as { thrown?: { $error?: string } }).thrown?.$error === 'TypeError';

describe('validator answers as is-my-json-valid did', () => {
    const all = cases();

    it('has the recorded cases', () => {
        expect(all.map((c) => c.label)).toEqual(baseline.map((b) => b.label));
        expect(all.length).toBeGreaterThan(2500);
    });

    it('gives the recorded result for each case', () => {
        const mismatches: string[] = [];
        all.forEach((c, i) => {
            if (crashed(baseline[i].result)) return;
            const got = serialize(c.run());
            if (JSON.stringify(got) !== JSON.stringify(baseline[i].result)) {
                mismatches.push(
                    `${c.label}\n  was ${JSON.stringify(baseline[i].result)}\n  now ${JSON.stringify(got)}`,
                );
            }
        });
        expect(mismatches.slice(0, 5)).toEqual([]);
    });

    it('answers where is-my-json-valid threw a TypeError', () => {
        const fixed = all.filter((_, i) => crashed(baseline[i].result));
        expect(fixed).toHaveLength(2);
        for (const c of fixed) {
            expect(serialize(c.run())).toEqual({
                silent: [expect.objectContaining({ instancePath: '/a', message: 'is required' })],
            });
        }
    });
});

describe('schemas the validator cannot check', () => {
    it.each([
        [{ pattern: '^a' }, 'the keyword "pattern" is not supported'],
        [{ type: 'array', items: { minimum: 1 } }, 'the keyword "minimum" is not supported'],
        [{ properties: { a: { $ref: '#/x' } } }, 'the keyword "$ref" is not supported'],
        [{ oneOf: [{ enum: [1] }] }, 'the keyword "enum" is not supported'],
        [{ type: 'bigint' }, 'unknown type "bigint"'],
        [{ required: 'a' }, '"required" must be a boolean or an array of names'],
    ])('refuses %j, whatever the data', (schema, message) => {
        expect(() => validator.validateJSONSchema(schema, {})).toThrow(InvalidInputError);
        expect(() => validator.validateJSONSchema(schema, {})).toThrow(message);
    });
});
