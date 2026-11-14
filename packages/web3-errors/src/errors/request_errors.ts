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

import { BaseError } from '../base_error.js';

/** The `error` member of a JSON-RPC error response. */
export type RpcErrorObject = {
    code: number;
    message: string;
    data?: unknown;
};

/** Whether `error` is the `error` member of a JSON-RPC error response. */
export const isRpcErrorObject = (error: unknown): error is RpcErrorObject =>
    typeof error === 'object' &&
    error !== null &&
    typeof (error as RpcErrorObject).code === 'number' &&
    typeof (error as RpcErrorObject).message === 'string';

/**
 * The node answered a request with a JSON-RPC error. `code` and `data` are
 * the node's, as it sent them: Tendermint uses -32602 for bad params and
 * -32603 for internal errors, with the reason in `data`.
 */
export class RpcRequestError extends BaseError {
    public override name = 'RpcRequestError';
    /** The JSON-RPC error code. */
    public readonly code: number;
    /** The JSON-RPC error data, often the node's reason as a string. */
    public readonly data?: unknown;

    public constructor({
        error,
        method,
        url,
    }: {
        error: RpcErrorObject;
        method?: string;
        url?: string;
    }) {
        super('RPC request failed.', {
            details: [error.message, typeof error.data === 'string' ? error.data : undefined]
                .filter(Boolean)
                .join(': '),
            metaMessages: [
                ...(method ? [`Method: ${method}`] : []),
                ...(url ? [`URL: ${url}`] : []),
            ],
        });
        this.code = error.code;
        this.data = error.data;
    }
}

/** An HTTP request to the node failed without a JSON-RPC answer. */
export class HttpRequestError extends BaseError {
    public override name = 'HttpRequestError';
    public readonly status?: number;
    public readonly url: string;

    public constructor({
        status,
        url,
        body,
        cause,
    }: {
        status?: number;
        url: string;
        body?: string;
        cause?: unknown;
    }) {
        super('HTTP request failed.', {
            cause,
            details: body,
            metaMessages: [...(status !== undefined ? [`Status: ${status}`] : []), `URL: ${url}`],
        });
        this.status = status;
        this.url = url;
    }
}

/** The node's answer is not a JSON-RPC response the SDK can read. */
export class InvalidResponseError extends BaseError {
    public override name = 'InvalidResponseError';
    /** What the node sent. */
    public readonly response: unknown;

    public constructor(shortMessage: string, { response }: { response: unknown }) {
        super(shortMessage, { details: JSON.stringify(response) });
        this.response = response;
    }
}
