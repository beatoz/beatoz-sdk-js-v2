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
import { Web3 } from '../../../src';
import { getTestServer, getTestWsServer, closeProvider } from '../e2e_utils';

describe('rule check ', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('returns the parameters the node reports', async () => {
        const response = await web3.beatoz.rule();

        const raw = await fetch(`${getTestServer()}/rule`);
        const { result } = await raw.json();

        // The decoder adds back the zero parameters the node leaves out, so
        // the node's answer is contained in the decoded one, not equal to it.
        expect(response.value).toEqual(expect.objectContaining(result.value));
        expect(BigInt(response.value.gasPrice)).toBeGreaterThan(0n);
    });
});
