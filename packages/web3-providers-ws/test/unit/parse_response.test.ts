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
import { InvalidResponseError } from '@beatoz/web3-errors';
import { parseJsonRpcResponse } from '../../src';

describe('parseJsonRpcResponse', () => {
    it('reads a result', () => {
        expect(parseJsonRpcResponse({ jsonrpc: '2.0', id: 1, result: { n: 1 } })).toEqual({
            jsonrpc: '2.0',
            id: 1,
            result: { n: 1 },
        });
    });

    it('reads an error', () => {
        const error = { code: -32603, message: 'Internal error', data: 'boom' };
        expect(parseJsonRpcResponse({ jsonrpc: '2.0', id: 'a', error })).toEqual({
            jsonrpc: '2.0',
            id: 'a',
            error,
        });
    });

    it('reads a null result as null', () => {
        expect(parseJsonRpcResponse({ jsonrpc: '2.0', id: 1, result: null })).toEqual({
            jsonrpc: '2.0',
            id: 1,
            result: null,
        });
    });

    // The node leaves the id out when it has none; it never sends null.
    it('refuses an error response whose id is null', () => {
        const error = { code: -32700, message: 'Parse error. Invalid JSON' };
        expect(() => parseJsonRpcResponse({ jsonrpc: '2.0', id: null, error })).toThrow(
            InvalidResponseError,
        );
    });

    it('refuses a response with neither a result nor an error', () => {
        expect(() => parseJsonRpcResponse({ jsonrpc: '2.0', id: 1 })).toThrow(InvalidResponseError);
    });

    // null used to escape as a TypeError rather than this.
    it.each([null, 1, 'text'])('refuses %p as an InvalidResponseError', (data) => {
        expect(() => parseJsonRpcResponse(data)).toThrow(InvalidResponseError);
    });
});
