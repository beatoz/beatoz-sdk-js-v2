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
import { Contract } from '../../src';
import erc20Json from '../fixtures/erc20-abi.json';
import { closeProvider, deployTestToken, netInfo } from './e2e_utils';
import WebsocketProvider from '@beatoz/web3-providers-ws';
import { Web3 } from '@beatoz/web3';

describe('abi test', () => {
    let address: string;
    beforeAll(async () => {
        const web3 = new Web3(netInfo.WS);
        web3.beatoz.accounts.wallet.add(netInfo.ACCTS[0].KEY);
        ({ address } = await deployTestToken(web3));
        closeProvider(web3);
    });

    const provider = new WebsocketProvider(netInfo.WS);
    afterAll(() => provider.disconnect());

    it('calls a deployed contract through an ABI imported from JSON', async () => {
        const erc20Contract = new Contract(erc20Json, address) as any;
        erc20Contract.setProvider(provider);

        const name = await erc20Contract.methods.name().call();
        const symbol = await erc20Contract.methods.symbol().call();

        // The values deployTestToken passes to the constructor.
        expect(name).toEqual('BeatozToken');
        expect(symbol).toEqual('RGT');
    });
});
