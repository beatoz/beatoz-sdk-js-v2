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
import WebsocketProvider from '../../../src/index';
import { JsonRpcRequest } from '@beatoz/web3-types';
import { uuidV4 } from '@beatoz/web3-utils';
import { getTestWsServer } from '../e2e_utils';
function createJsonRpcRequest(
    method: string,
    params?: Record<string, unknown>,
): JsonRpcRequest<any> {
    const paramsCopy = params ? { ...params } : {};
    return {
        jsonrpc: '2.0',
        id: uuidV4(),
        method: method,
        params: paramsCopy,
    };
}

describe('WebsocketClient', () => {
    let provider: WebsocketProvider;

    beforeAll(() => {
        provider = new WebsocketProvider(getTestWsServer());
    });

    // In afterAll, so a failed assertion cannot leave the socket open (#88).
    afterAll(() => provider.disconnect());

    it('can make a simple call', async () => {
        const healthResponse = await provider.request(createJsonRpcRequest('status'));
        expect(healthResponse.result).toBeDefined();

        const healthResponse2 = await provider.execute(createJsonRpcRequest('health'));
        expect(healthResponse2.result).toEqual({});

        const statusResponse = await provider.execute(createJsonRpcRequest('status'));
        expect(statusResponse.result).toBeTruthy();
    });
});
