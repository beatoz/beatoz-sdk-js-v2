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
import { InvalidInputError } from '@beatoz/web3-errors';
import * as fs from 'fs';
import * as path from 'path';
import { validator } from '../../../src';
import { cases, verdict } from './schema_cases';

// Whether is-my-json-valid 2.20.6 passed or refused each case, recorded before
// the validator stopped using it (#226).
const baseline: Array<{ label: string; verdict: string }> = fs
    .readFileSync(path.join(__dirname, '../../fixtures/validator_baseline.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

// The answers #229 changed on purpose.
// - `properties` apply to an object only: is-my-json-valid read them from any
//   value, so a number lacked "a", and null threw a TypeError.
const propertiesOfNonObject = (label: string) =>
    label.startsWith('validateJSONSchema({"properties":{"a":{"format":"uint","required":true}');
// - array elements are checked against their size, and every row of a nested
//   array is checked.
const nowRefused = new Set([
    'validate(["uint8[2]"], [[256,256]])',
    'validate(["uint8[2]"], [["0xabababababababababababababababababababab","0xabababababababababababababababababababab"]])',
    'validate(["bytes32[1]"], [["0xabababababababababababababababababababab"]])',
    'validate(["bytes32[1]"], [[[1]]])',
    'validate(["int8[2][]"], [[[1,2],[3]]])',
]);

describe('validator passes and refuses as is-my-json-valid did', () => {
    const all = cases();

    it('has the recorded cases', () => {
        expect(all.map((c) => c.label)).toEqual(baseline.map((b) => b.label));
        expect(all.length).toBeGreaterThan(2500);
    });

    it('gives the recorded answer, but where #229 changed it', () => {
        const unexpected: string[] = [];
        const refused: string[] = [];
        all.forEach((c, i) => {
            const was = baseline[i].verdict;
            const now = verdict(c.run());
            if (now === was) return;
            if (now === 'pass' && propertiesOfNonObject(c.label)) return;
            if (was === 'pass' && now === 'fail' && nowRefused.has(c.label)) {
                refused.push(c.label);
                return;
            }
            unexpected.push(`${c.label}: was ${was}, now ${now}`);
        });
        expect(unexpected).toEqual([]);
        expect(refused.sort()).toEqual([...nowRefused].sort());
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
