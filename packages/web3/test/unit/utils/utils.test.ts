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

// These tests never connect. The endpoint only exists to construct a Web3 instance.
const PLACEHOLDER_ENDPOINT = 'http://127.0.0.1:26657';

describe('web3.beatoz.account check ', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(PLACEHOLDER_ENDPOINT);
    });

    it('should callWeb3.utils method working', async () => {
        const utilsTest = web3.utils.toWei('1', 'beatoz');
        expect(utilsTest).toEqual('1000000000000000000');
    });
});
