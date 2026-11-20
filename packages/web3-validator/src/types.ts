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

import { AbiParameter } from '@beatoz/web3-types';

export type ValidInputTypes = Uint8Array | bigint | string | number | boolean;
export type BeatozBaseTypes = 'bool' | 'bytes' | 'string' | 'uint' | 'int' | 'address' | 'tuple';
export type BeatozBaseTypesWithMeta =
    | `string${string}`
    | `string${string}[${number}]`
    | `bytes${string}`
    | `bytes${string}[${number}]`
    | `address[${number}]`
    | `bool[${number}]`
    | `int${string}`
    | `int${string}[${number}]`
    | `uint${string}`
    | `uint${string}[${number}]`
    | `tuple[]`
    | `tuple[${number}]`;

export type BeatozExtendedTypes =
    'hex' | 'number' | 'blockNumber' | 'blockNumberOrTag' | 'filter' | 'bloom';

export type FullValidationSchema = ReadonlyArray<AbiParameter>;
export type ShortValidationSchema = ReadonlyArray<
    string | BeatozBaseTypes | BeatozExtendedTypes | BeatozBaseTypesWithMeta | ShortValidationSchema
>;
export type ValidationSchemaInput = ShortValidationSchema;

export type Web3ValidationOptions = {
    readonly silent: boolean;
};

export type Json = string | number | boolean | Array<Json> | { [id: string]: Json };

/**
 * A JSON schema as the validator checks it: the keywords the SDK builds from
 * ABI types, and the ones web3.js's validator also takes (#226). Any other
 * keyword makes the validator throw `InvalidInputError`.
 */
export type Schema = {
    /** `array`, `object`, `string`, `number`, `integer`, `boolean` or `null`, or a list of them. */
    type?: string | Array<string>;
    items?: Schema | Schema[];
    minItems?: number;
    maxItems?: number;
    /** A format of the package's own: `address`, `uint256`, `bytes32`, ... */
    format?: string;
    required?: Array<string> | boolean;
    properties?: { [id: string]: Schema };
    oneOf?: Array<Schema>;
    // Annotations, which do not change what passes.
    $id?: string;
    id?: string;
    $schema?: string;
    title?: string;
    description?: string;
    $comment?: string;
    default?: Json;
    examples?: Array<Json>;
    readOnly?: boolean;
    writeOnly?: boolean;
    deprecated?: boolean;
};

/**
 * An error as the schema check reports it, in the shape is-my-json-valid
 * gave, before the validator turns it into a `Web3ValidationErrorObject`.
 */
export type RawValidationError = {
    field: string;
    message: string;
    value: unknown;
    type: string;
    schemaPath: string[];
};

export type JsonSchema = Schema;
