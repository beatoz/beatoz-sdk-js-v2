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

import { formatValue, InvalidResponseError } from '@beatoz/web3-errors';

/**
 * A runtime checker that ensures a given value is set (i.e. not undefined or null)
 *
 * This is used when you want to verify that data at runtime matches the expected type.
 */
export function assertSet<T>(value: T): T {
    if ((value as unknown) === undefined) {
        throw new InvalidResponseError('a value in the response must be set, got undefined');
    }

    if ((value as unknown) === null) {
        throw new InvalidResponseError('a value in the response must be set, got null');
    }

    return value;
}

/**
 * A runtime checker that ensures a given value is a boolean
 *
 * This is used when you want to verify that data at runtime matches the expected type.
 * This implies assertSet.
 */
export function assertBoolean(value: boolean): boolean {
    assertSet(value);
    if (typeof (value as unknown) !== 'boolean') {
        throw new InvalidResponseError(
            `a value in the response must be a boolean, got ${formatValue(value)}`,
        );
    }
    return value;
}

/**
 * A runtime checker that ensures a given value is a string.
 *
 * This is used when you want to verify that data at runtime matches the expected type.
 * This implies assertSet.
 */
export function assertString(value: string): string {
    assertSet(value);
    if (typeof (value as unknown) !== 'string') {
        throw new InvalidResponseError(
            `a value in the response must be a string, got ${formatValue(value)}`,
        );
    }
    return value;
}

/**
 * A runtime checker that ensures a given value is a number
 *
 * This is used when you want to verify that data at runtime matches the expected type.
 * This implies assertSet.
 */
export function assertNumber(value: number): number {
    assertSet(value);
    if (typeof (value as unknown) !== 'number') {
        throw new InvalidResponseError(
            `a value in the response must be a number, got ${formatValue(value)}`,
        );
    }
    return value;
}

/**
 * A runtime checker that ensures a given value is an array
 *
 * This is used when you want to verify that data at runtime matches the expected type.
 * This implies assertSet.
 */
export function assertArray<T>(value: readonly T[]): readonly T[] {
    assertSet(value);
    if (!Array.isArray(value as unknown)) {
        throw new InvalidResponseError(
            `a value in the response must be an array, got ${formatValue(value)}`,
        );
    }
    return value;
}

/**
 * A runtime checker that ensures a given value is an object in the sense of JSON
 * (an unordered collection of key–value pairs where the keys are strings)
 *
 * This is used when you want to verify that data at runtime matches the expected type.
 * This implies assertSet.
 */
export function assertObject<T>(value: T): T {
    assertSet(value);
    if (typeof (value as unknown) !== 'object') {
        throw new InvalidResponseError(
            `a value in the response must be an object, got ${formatValue(value)}`,
        );
    }

    // Exclude special kind of objects like Array, Date or Uint8Array
    // Object.prototype.toString() returns a specified value:
    // http://www.ecma-international.org/ecma-262/7.0/index.html#sec-object.prototype.tostring
    if (Object.prototype.toString.call(value) !== '[object Object]') {
        throw new InvalidResponseError(
            `a value in the response must be a plain object, got ${formatValue(value)}`,
        );
    }

    return value;
}

interface Lengther {
    readonly length: number;
}

/**
 * Throws an error if value matches the empty value for the
 * given type (array/string of length 0, number of value 0, ...)
 *
 * Otherwise returns the value.
 *
 * This implies assertSet
 */
export function assertNotEmpty<T>(value: T): T {
    assertSet(value);

    if (typeof value === 'number' && value === 0) {
        throw new InvalidResponseError('a value in the response must not be 0, got 0');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if ((value as any as Lengther).length === 0) {
        throw new InvalidResponseError(
            `a value in the response must not be empty, got ${formatValue(value)}`,
        );
    }
    return value;
}

// may will run the transform if value is defined, otherwise returns undefined

export function may<T, U>(transform: (val: T) => U, value: T | null | undefined): U | undefined {
    return value === undefined || value === null ? undefined : transform(value);
}

export function dictionaryToStringMap(obj: Record<string, unknown>): Map<string, string> {
    const out = new Map<string, string>();
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (typeof value !== 'string') {
            throw new InvalidResponseError(
                `${key} in the response must be a string, got ${formatValue(value)}`,
            );
        }
        out.set(key, value);
    }
    return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const TextEncoder: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const TextDecoder: any;

export function toUtf8(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

/**
 * Takes UTF-8 data and decodes it to a string.
 *
 * In lossy mode, the replacement character � is used to substitude invalid
 * encodings. By default lossy mode is off and invalid data will lead to exceptions.
 */
export function fromUtf8(data: Uint8Array, lossy = false): string {
    const fatal = !lossy;
    return new TextDecoder('utf-8', { fatal }).decode(data);
}
