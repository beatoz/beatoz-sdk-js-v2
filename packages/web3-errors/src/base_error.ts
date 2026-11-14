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

export type BaseErrorParameters = {
    /** The error this one was thrown for. Its message becomes `details`. */
    cause?: unknown;
    /** More about what went wrong, when there is no cause to take it from. */
    details?: string;
    /** Lines of context printed between the short message and the details. */
    metaMessages?: string[];
};

/**
 * The base of every error the SDK throws, shaped like viem's `BaseError`.
 * `shortMessage` says what failed in one line, `details` why (the cause's
 * message), and `message` puts them together with any context lines. Tell
 * the kinds apart with `instanceof` or `name`; `walk()` follows `cause`.
 */
export class BaseError extends Error {
    public override name = 'BaseError';
    public readonly shortMessage: string;
    public readonly details?: string;
    public readonly metaMessages?: string[];
    // es2016 lib types Error without `cause`; Node sets and prints it.
    public readonly cause?: unknown;

    public constructor(shortMessage: string, args: BaseErrorParameters = {}) {
        const details =
            args.cause instanceof BaseError
                ? args.cause.details
                : args.cause instanceof Error
                  ? args.cause.message
                  : args.details;
        super(
            [
                shortMessage,
                ...(args.metaMessages?.length ? ['', ...args.metaMessages] : []),
                ...(details ? ['', `Details: ${details}`] : []),
            ].join('\n'),
        );
        this.shortMessage = shortMessage;
        this.details = details;
        this.metaMessages = args.metaMessages;
        if (args.cause !== undefined) this.cause = args.cause;
    }

    /** The innermost cause. */
    public walk(): unknown;
    /** The first error in the cause chain, this one included, that `fn` accepts, or undefined. */
    public walk(fn: (err: unknown) => boolean): unknown;
    public walk(fn?: (err: unknown) => boolean): unknown {
        return walk(this, fn);
    }
}

function walk(err: unknown, fn?: (err: unknown) => boolean): unknown {
    if (fn?.(err)) return err;
    if (typeof err === 'object' && err !== null && 'cause' in err && err.cause !== undefined) {
        return walk(err.cause, fn);
    }
    return fn ? undefined : err;
}

/**
 * A value as an error message shows it after "got": strings quoted, bigints
 * with `n`, byte arrays by length, objects as JSON.
 */
export const formatValue = (value: unknown): string => {
    if (typeof value === 'bigint') return `${value}n`;
    if (value instanceof Uint8Array) return `${value.constructor.name}(${value.length})`;
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
        return String(value);
    }
    try {
        return (
            JSON.stringify(value, (_, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v)) ??
            String(value)
        );
    } catch {
        return String(value);
    }
};
