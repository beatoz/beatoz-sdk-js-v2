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

import { formatValue, InvalidInputError } from '@beatoz/web3-errors';
import formats from './formats.js';
import { Json, RawValidationError, Schema } from './types.js';

/*
 * Checks a value against the JSON schemas the validator builds from ABI types,
 * in place of is-my-json-valid (#226). That package generated code with
 * `new Function`, which a page's Content-Security-Policy can forbid, and
 * required Node's `util`, which browser bundlers do not provide.
 *
 * It takes the keywords web3.js's validator also takes (`type`, `items`,
 * `minItems`, `maxItems`, `format`, `required`, `properties`, `oneOf`), and
 * gives the errors is-my-json-valid gave for them, field names and order
 * included: `Validator.convertErrors` turns those into the SDK's errors, and
 * test/fixtures/validator_baseline.jsonl holds what is-my-json-valid answered.
 */

const TYPES: Record<string, (value: unknown) => boolean> = {
    any: () => true,
    null: (v) => v === null,
    boolean: (v) => typeof v === 'boolean',
    array: (v) => Array.isArray(v),
    object: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
    number: (v) => typeof v === 'number' && Number.isFinite(v),
    integer: (v) =>
        typeof v === 'number' &&
        (Math.floor(v) === v || v > 9007199254740992 || v < -9007199254740992),
    string: (v) => typeof v === 'string',
};

const KEYWORDS = new Set([
    'type',
    'items',
    'minItems',
    'maxItems',
    'format',
    'required',
    'properties',
    'oneOf',
]);

// Annotations: they do not change what passes.
const hasOwn = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

const ANNOTATIONS = new Set([
    '$id',
    'id',
    '$schema',
    'title',
    'description',
    '$comment',
    'default',
    'examples',
    'readOnly',
    'writeOnly',
    'deprecated',
]);

function refuse(message: string): never {
    throw new InvalidInputError(`the validator cannot check this schema: ${message}`);
}

/** Throws for a keyword or type the checker does not take, whatever the data. */
function assertSupportedSchema(schema: unknown): void {
    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
        refuse(`a schema must be an object, got ${formatValue(schema)}`);
    }
    const node = schema as Schema;
    for (const key of Object.keys(node)) {
        if (!KEYWORDS.has(key) && !ANNOTATIONS.has(key)) {
            refuse(`the keyword "${key}" is not supported`);
        }
    }
    for (const type of ([] as unknown[]).concat(node.type ?? [])) {
        if (typeof type !== 'string' || !hasOwn(TYPES, type)) {
            refuse(`unknown type ${formatValue(type)}`);
        }
    }
    const { required } = node;
    if (
        required !== undefined &&
        typeof required !== 'boolean' &&
        !(Array.isArray(required) && required.every((r) => typeof r === 'string'))
    ) {
        refuse(`"required" must be a boolean or an array of names, got ${formatValue(required)}`);
    }
    if (Array.isArray(node.items)) node.items.forEach(assertSupportedSchema);
    else if (node.items !== undefined) assertSupportedSchema(node.items);
    if (node.properties !== undefined) {
        Object.values(node.properties).forEach(assertSupportedSchema);
    }
    if (node.oneOf !== undefined) {
        if (!Array.isArray(node.oneOf)) refuse('"oneOf" must be an array');
        node.oneOf.forEach(assertSupportedSchema);
    }
}

// is-my-json-valid names a field by the code it generated: `.name` for a
// property that is an identifier, `["name"]` otherwise (so `["0"]` for a tuple
// item), and `.<index>` for an element of an array. Identifiers are taken as
// ASCII here; it also took other Unicode letters.
const IDENTIFIER = /^[$A-Z_a-z][$\w]*$/;
const childField = (field: string, key: string) =>
    IDENTIFIER.test(key) ? `${field}.${key}` : `${field}[${JSON.stringify(key)}]`;

type Context = { errors: RawValidationError[]; count: number };

function visit(
    value: unknown,
    node: Schema,
    field: string,
    schemaPath: string[],
    report: boolean,
    ctx: Context,
): void {
    const tuple = Array.isArray(node.items);
    const type = tuple ? 'array' : node.type;
    const error = (message: string, errorField = field, errorValue: unknown = value) => {
        ctx.count += 1;
        if (report) {
            ctx.errors.push({
                field: errorField,
                message,
                value: errorValue,
                type: type as string,
                schemaPath,
            });
        }
    };

    if (value === undefined) {
        if (node.required === true) error('is required');
        return;
    }

    const types = ([] as Array<string | undefined>).concat(type);
    if (!types.some((t) => TYPES[t ?? 'any'](value))) {
        error('is the wrong type');
        return;
    }

    if (node.format && hasOwn(formats, node.format)) {
        if (!formats[node.format](value)) error(`must be ${node.format} format`);
    }

    if (Array.isArray(node.required) && TYPES.object(value)) {
        for (const name of node.required) {
            if ((value as Record<string, unknown>)[name] === undefined) {
                // is-my-json-valid gave the object as the value.
                error('is required', childField(field, name), value);
            }
        }
    }

    if (node.items && !tuple && Array.isArray(value)) {
        value.forEach((item, i) =>
            visit(
                item,
                node.items as Schema,
                `${field}.${i}`,
                [...schemaPath, 'items'],
                report,
                ctx,
            ),
        );
    }

    if (node.oneOf && node.oneOf.length > 0) {
        const before = ctx.count;
        let passes = 0;
        for (const option of node.oneOf) {
            visit(value, option, field, schemaPath, false, ctx);
            if (ctx.count === before) passes += 1;
            else ctx.count = before;
        }
        if (passes !== 1) error('no (or more than one) schemas match');
    }

    if (node.maxItems !== undefined && Array.isArray(value) && value.length > node.maxItems) {
        error('has more items than allowed');
    }
    if (node.minItems !== undefined && Array.isArray(value) && value.length < node.minItems) {
        error('has less items than allowed');
    }

    const properties: Record<string, Schema> | undefined = tuple
        ? Object.fromEntries((node.items as Schema[]).map((item, i) => [String(i), item]))
        : node.properties;
    if (properties) {
        const skipNull = Array.isArray(type) && type.includes('null') && value === null;
        for (const key of skipNull ? [] : Object.keys(properties)) {
            // is-my-json-valid threw a TypeError reading a property of null.
            const child = value === null ? undefined : (value as Record<string, unknown>)[key];
            visit(
                child,
                properties[key],
                childField(field, key),
                tuple ? [...schemaPath, key] : [...schemaPath, 'properties', key],
                report,
                ctx,
            );
        }
    }
}

/** The errors of `data` against `schema`, empty when it passes. */
export function checkSchema(schema: Schema, data: Json | undefined): RawValidationError[] {
    assertSupportedSchema(schema);
    const ctx: Context = { errors: [], count: 0 };
    // is-my-json-valid read undefined data as null, which JSON has.
    // eslint-disable-next-line unicorn/no-null
    visit(data === undefined ? null : data, schema, 'data', [], true, ctx);
    return ctx.errors;
}
