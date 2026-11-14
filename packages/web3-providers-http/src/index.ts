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

import fetch from 'cross-fetch';

import { HttpProviderOptions } from './types.js';

export { HttpProviderOptions } from './types.js';

import { JsonRpcResponseWithResult, Web3APIPayload } from '@beatoz/web3-types';
import { HttpRequestError, isRpcErrorObject, RpcRequestError } from '@beatoz/web3-errors';

export default class HttpProvider {
    private readonly clientUrl: string;
    private readonly httpProviderOptions: HttpProviderOptions | undefined;
    public constructor(clientUrl: string, httpProviderOptions?: HttpProviderOptions) {
        this.clientUrl = clientUrl;
        this.httpProviderOptions = httpProviderOptions;
    }

    public async request(
        payload: Web3APIPayload,
        requestOptions?: RequestInit,
    ): Promise<JsonRpcResponseWithResult<unknown>> {
        const providerOptionsCombined = {
            ...this.httpProviderOptions?.providerOptions,
            ...requestOptions,
        };

        let response: Response;
        try {
            response = await fetch(this.clientUrl, {
                ...providerOptionsCombined,
                method: 'POST',
                headers: {
                    ...providerOptionsCombined.headers,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
        } catch (cause) {
            throw new HttpRequestError({ url: this.clientUrl, cause });
        }

        const text = await response.text();
        let body: unknown;
        try {
            body = JSON.parse(text);
        } catch {
            body = undefined;
        }
        // The node can answer a JSON-RPC error with a non-2xx status; the
        // JSON-RPC error says more than the status does.
        const error = (body as { error?: unknown } | undefined)?.error;
        if (isRpcErrorObject(error)) {
            throw new RpcRequestError({ error, method: payload.method });
        }
        if (!response.ok || body === undefined) {
            throw new HttpRequestError({
                status: response.status,
                url: this.clientUrl,
                body: text,
            });
        }
        return body as JsonRpcResponseWithResult<unknown>;
    }

    public getClientUrl(): string {
        return this.clientUrl;
    }
}

export { HttpProvider };
