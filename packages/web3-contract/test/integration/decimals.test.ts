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
import erc20Json from '../fixtures/erc20-abi.json';
import { closeProvider, deployTestToken, netInfo } from './e2e_utils';
import { Contract } from '../../src';
import WebsocketProvider from '@beatoz/web3-providers-ws';
import { Web3 } from '@beatoz/web3';

describe('decimals test', () => {
    let deployedContract: { address: string; deployer: string };
    beforeAll(async () => {
        const web3 = new Web3(netInfo.WS);
        web3.beatoz.accounts.wallet.add(netInfo.ACCTS[0].KEY);
        deployedContract = await deployTestToken(web3);
        closeProvider(web3);
    });

    const provider = new WebsocketProvider(netInfo.WS);
    afterAll(() => provider.disconnect());

    it('decimals function', async () => {
        const erc20Contract = new Contract(erc20Json, deployedContract.address) as any;
        erc20Contract.setProvider(provider);

        // uint8 fits a number, so it comes back as one, as in viem.
        expect(await erc20Contract.methods.decimals().call()).toBe(18);
    });
});
