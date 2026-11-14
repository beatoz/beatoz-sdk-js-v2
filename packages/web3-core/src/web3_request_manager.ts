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

import HttpProvider from '@beatoz/web3-providers-http';
import WebsocketProvider from '@beatoz/web3-providers-ws';
import { isNullish, jsonRpc } from '@beatoz/web3-utils';
import {
    Web3APIRequest,
    JsonRpcPayload,
    JsonRpcResponse,
    JsonRpcResponseWithError,
    JsonRpcError,
    JsonRpcRequest,
    JsonRpcResponseWithResult,
    SubscriptionEvent,
} from '@beatoz/web3-types';
import { InvalidResponseError, ResponseError } from '@beatoz/web3-errors';
import { Stream } from 'xstream';
import { Web3EventEmitter } from './web3_event_emitter.js';

export enum Web3RequestManagerEvent {
    PROVIDER_CHANGED = 'PROVIDER_CHANGED',
    BEFORE_PROVIDER_CHANGE = 'BEFORE_PROVIDER_CHANGE',
}

const availableProviders = {
    HttpProvider: HttpProvider,
    WebsocketProvider: WebsocketProvider,
};

export class Web3RequestManager extends Web3EventEmitter<{
    [key in Web3RequestManagerEvent]: HttpProvider | WebsocketProvider | undefined;
}> {
    private _provider?: HttpProvider | WebsocketProvider;

    public constructor(provider?: string) {
        super();
        if (!isNullish(provider)) {
            this.setProvider(provider);
        }
    }

    public setProvider(provider?: HttpProvider | WebsocketProvider | string): void {
        // autodetect provider
        if (provider && typeof provider === 'string' && this.providers) {
            // HTTP
            if (/^http(s)?:\/\//i.test(provider)) {
                this._provider = new this.providers.HttpProvider(provider);
            }

            // WS
            if (/^ws(s)?:\/\//i.test(provider)) {
                this._provider = new this.providers.WebsocketProvider(provider);
            }
        } else {
            this._provider = provider as HttpProvider | WebsocketProvider;
        }
    }

    public static get providers() {
        return availableProviders;
    }

    /**
     * Will return all available providers
     */

    public get providers() {
        return availableProviders;
    }

    public get provider(): HttpProvider | WebsocketProvider {
        return this._provider!;
    }

    /**
     * Sends a request to the node and returns its result as the node sent it,
     * not yet decoded.
     */
    public async send(request: Web3APIRequest): Promise<JsonRpcResponseWithResult<unknown>> {
        const { provider } = this;

        const payload = jsonRpc.toPayload(request);

        const response = await provider.request(payload);

        if (jsonRpc.isResponseWithResult(response)) {
            return response;
        }

        throw new ResponseError(response);
    }

    private _processJsonRpcResponse<ResultType, ErrorType, RequestType>(
        payload: JsonRpcPayload<RequestType>,
        response: JsonRpcResponse<ResultType, ErrorType>,
        { legacy, error }: { legacy: boolean; error: boolean },
    ): JsonRpcResponse<ResultType> | never {
        if (isNullish(response)) {
            return this._buildResponse(
                payload,
                // Some providers uses "null" as valid empty response

                null as unknown as JsonRpcResponse<ResultType, ErrorType>,
                error,
            );
        }

        // This is the majority of the cases so check these first
        // A valid JSON-RPC response with error object
        if (jsonRpc.isResponseWithError<ErrorType>(response)) {
            if (!Web3RequestManager._isReverted(response)) {
                throw new InvalidResponseError<ErrorType, RequestType>(response, payload);
            }
        }

        if ((response as unknown) instanceof Error) {
            Web3RequestManager._isReverted(response);
            throw response;
        }

        if (legacy && error && jsonRpc.isBatchRequest(payload)) {
            // In case of error batch response we don't want to throw Invalid response
            throw response;
        }

        if (
            legacy &&
            !jsonRpc.isResponseWithError(response) &&
            !jsonRpc.isResponseWithResult(response)
        ) {
            return this._buildResponse(payload, response, error);
        }

        throw new ResponseError(response, 'Invalid response');
    }

    // Need to use same types as _processJsonRpcResponse so have to declare as instance method

    private _buildResponse<ResultType, ErrorType, RequestType>(
        payload: JsonRpcPayload<RequestType>,
        response: JsonRpcResponse<ResultType, ErrorType>,
        error: boolean,
    ): JsonRpcResponse<ResultType> {
        const res = {
            jsonrpc: '2.0',

            id: jsonRpc.isBatchRequest(payload)
                ? payload[0].id
                : 'id' in payload
                  ? payload.id
                  : // Have to use the null here explicitly

                    null,
        };

        if (error) {
            return {
                ...res,
                error: response as unknown,
            } as JsonRpcResponse<ResultType>;
        }

        return {
            ...res,
            result: response as unknown,
        } as JsonRpcResponse<ResultType>;
    }

    private static _isReverted<ResultType, ErrorType>(
        response: JsonRpcResponse<ResultType, ErrorType>,
    ): boolean {
        let error: JsonRpcError | undefined;

        if (jsonRpc.isResponseWithError<ErrorType>(response)) {
            error = (response as JsonRpcResponseWithError).error;
        } else if ((response as unknown) instanceof Error) {
            error = response as unknown as JsonRpcError;
        }

        // This message means that there was an error while executing the code of the smart contract
        // However, more processing will happen at a higher level to decode the error data,
        //	according to the Error ABI, if it was available as of EIP-838.
        if (error?.message.includes('revert')) return false;

        return false;
    }

    public subscribe(request: Web3APIRequest): Stream<SubscriptionEvent> {
        // Only Websocket Provider can subscribe.
        if (!(this.provider instanceof WebsocketProvider)) {
            throw new Error('only websocket provider can subscribe.');
        }

        const { provider } = this;

        const payload = jsonRpc.toPayload(request);
        return provider.listen(payload as JsonRpcRequest);
    }
}
