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
import { Web3ValidationErrorObject } from '@beatoz/web3-types';
import formats from './formats.js';
import { Json, Schema } from './types.js';

/*
 * Checks a value against the JSON schemas the validator builds from ABI types,
 * in place of is-my-json-valid (#226). That package generated code with
 * `new Function`, which a page's Content-Security-Policy can forbid, and
 * required Node's `util`, which browser bundlers do not provide.
 *
 * It takes the keywords web3.js's validator also takes (`type`, `items`,
 * `minItems`, `maxItems`, `format`, `required`, `properties`, `oneOf`), and
 * checks them in is-my-json-valid's order. Each error names its keyword, the
 * value's place in the data and the keyword's place in the schema, as JSON
 * pointers (#229).
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

// A JSON pointer (RFC 6901) from path segments.
const pointer = (segments: string[]) =>
    segments.map((s) => `/${s.replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');

type Context = { errors: Web3ValidationErrorObject[]; count: number };

function visit(
    value: unknown,
    node: Schema,
    dataPath: string[],
    schemaPath: string[],
    report: boolean,
    ctx: Context,
): void {
    const tuple = Array.isArray(node.items);
    const type = tuple ? 'array' : node.type;
    const error = (
        keyword: string,
        message: string,
        params: Record<string, unknown>,
        at: string[] = dataPath,
    ) => {
        ctx.count += 1;
        if (report) {
            ctx.errors.push({
                keyword,
                instancePath: pointer(at),
                schemaPath: `#${pointer([...schemaPath, keyword])}`,
                params,
                message,
            });
        }
    };

    if (value === undefined) {
        if (node.required === true) {
            error('required', 'is required', { missingProperty: dataPath[dataPath.length - 1] });
        }
        return;
    }

    const types = ([] as Array<string | undefined>).concat(type);
    if (!types.some((t) => TYPES[t ?? 'any'](value))) {
        error('type', `must be ${types.join(' or ')}`, { value, type });
        return;
    }

    if (node.format && hasOwn(formats, node.format)) {
        if (!formats[node.format](value)) {
            error('format', `must pass "${node.format}" validation`, {
                value,
                format: node.format,
            });
        }
    }

    if (Array.isArray(node.required) && TYPES.object(value)) {
        for (const name of node.required) {
            if ((value as Record<string, unknown>)[name] === undefined) {
                error('required', 'is required', { missingProperty: name }, [...dataPath, name]);
            }
        }
    }

    if (node.items && !tuple && Array.isArray(value)) {
        value.forEach((item, i) =>
            visit(
                item,
                node.items as Schema,
                [...dataPath, String(i)],
                [...schemaPath, 'items'],
                report,
                ctx,
            ),
        );
    }

    if (node.oneOf && node.oneOf.length > 0) {
        const before = ctx.count;
        let passes = 0;
        node.oneOf.forEach((option, i) => {
            visit(value, option, dataPath, [...schemaPath, 'oneOf', String(i)], false, ctx);
            if (ctx.count === before) passes += 1;
            else ctx.count = before;
        });
        if (passes !== 1) {
            error('oneOf', 'must match exactly one schema in oneOf', {
                value,
                passingSchemas: passes,
            });
        }
    }

    if (node.maxItems !== undefined && Array.isArray(value) && value.length > node.maxItems) {
        error('maxItems', `must NOT have more than ${node.maxItems} items`, {
            limit: node.maxItems,
        });
    }
    if (node.minItems !== undefined && Array.isArray(value) && value.length < node.minItems) {
        error('minItems', `must NOT have fewer than ${node.minItems} items`, {
            limit: node.minItems,
        });
    }

    if (tuple) {
        (node.items as Schema[]).forEach((item, i) =>
            visit(
                (value as unknown[])[i],
                item,
                [...dataPath, String(i)],
                [...schemaPath, 'items', String(i)],
                report,
                ctx,
            ),
        );
    }
    // Properties apply to an object only. is-my-json-valid read them from any
    // value, so a string's characters counted and null threw a TypeError.
    if (node.properties && TYPES.object(value)) {
        for (const key of Object.keys(node.properties)) {
            visit(
                (value as Record<string, unknown>)[key],
                node.properties[key],
                [...dataPath, key],
                [...schemaPath, 'properties', key],
                report,
                ctx,
            );
        }
    }
}

/** The errors of `data` against `schema`, empty when it passes. */
export function checkSchema(schema: Schema, data: Json | undefined): Web3ValidationErrorObject[] {
    assertSupportedSchema(schema);
    const ctx: Context = { errors: [], count: 0 };
    // Undefined data is read as null, which JSON has, as is-my-json-valid did.
    // eslint-disable-next-line unicorn/no-null
    visit(data === undefined ? null : data, schema, [], [], true, ctx);
    return ctx.errors;
}
