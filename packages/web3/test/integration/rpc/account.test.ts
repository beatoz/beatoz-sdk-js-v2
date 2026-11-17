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
import { getTestAccountAddress, getTestWsServer, closeProvider } from '../e2e_utils';
import { asNodeAddress } from '../chain_fixtures';
import { AccountResponse } from '@beatoz/web3-types';

describe('account check ', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('should call web3 with testWebsocketWeb3Instance.account method success return', async () => {
        const testAccountAddress = getTestAccountAddress();
        const testAccountResponse: AccountResponse =
            await web3.beatoz.getAccount(testAccountAddress);

        expect(asNodeAddress(testAccountResponse.key)).toEqual(asNodeAddress(testAccountAddress));
        expect(asNodeAddress(testAccountResponse.value.address)).toEqual(
            asNodeAddress(testAccountAddress),
        );
        expect(testAccountResponse.value.nonce).toBeDefined();
        expect(testAccountResponse.value.balance).toBeDefined();
    });

    // The first block holds the genesis state: no transaction has been sent
    // from the account yet (#47).
    it('reads the account as it was at an earlier height', async () => {
        const address = getTestAccountAddress();
        const then = await web3.beatoz.getAccount(address, 1);

        expect(then.height).toEqual('1');
        expect(then.value.nonce).toBe(0);
        expect(asNodeAddress(then.value.address)).toEqual(asNodeAddress(address));
    });
});
