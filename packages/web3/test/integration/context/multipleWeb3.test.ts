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
import { getTestWsServer, closeProvider } from '../e2e_utils';

describe('multiple Web3 instances', () => {
    let web3_1: Web3;
    let web3_2: Web3;

    beforeAll(() => {
        web3_1 = new Web3(getTestWsServer());
        web3_2 = new Web3(getTestWsServer());
    });

    afterAll(() => {
        closeProvider(web3_1);
        closeProvider(web3_2);
    });

    it('each has its own connection and both reach the node', async () => {
        expect(web3_1.getProvider()).not.toBe(web3_2.getProvider());

        const [status1, status2] = await Promise.all([
            web3_1.beatoz.status(),
            web3_2.beatoz.status(),
        ]);

        expect(status1.node_info.id).toBeTruthy();
        expect(status2.node_info.id).toEqual(status1.node_info.id);
        expect(status2.node_info.network).toEqual(status1.node_info.network);
    });

    it('closing one leaves the other working', async () => {
        closeProvider(web3_1);

        const status = await web3_2.beatoz.status();
        expect(status.node_info.id).toBeTruthy();
    });
});
