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
import { privateKeyToAccount, TrxProtoBuilder } from '@beatoz/web3-accounts';
import { TrxProto } from '@beatoz/web3-types';

/**
 * Fixed test vector.
 *
 * This address is what the mainnet implementation (`crypto.Pub2Addr` in
 * `beatoz-go`) derives from the same private key. The SDK computes it
 * independently and must arrive at the same value.
 *
 * The expectation is hardcoded on purpose: deriving it with the SDK itself
 * would prove nothing.
 *
 * Pure computation, no node required, so this file is a unit test.
 */
const VECTOR = {
    privateKey: '2926cd769094b2755d84b74b9180811adf71d9a1bfacf86f81dbfcfd4b9da163',
    address: '334b4f940d938839c59094714a239a05db84fdbe',
};

// These tests never connect. The endpoint only exists to construct a Web3 instance.
const PLACEHOLDER_ENDPOINT = 'http://127.0.0.1:26657';

describe('check accounts methods', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(PLACEHOLDER_ENDPOINT);
    });

    it('test account creation and import private key', async () => {
        const web3Account = web3.beatoz.accounts.create();
        expect(web3Account.address.length > 0).toBeTruthy();

        const testAccount = web3.beatoz.accounts.privateKeyToAccount(VECTOR.privateKey);
        expect(testAccount.address.toLowerCase()).toEqual(VECTOR.address);
    });

    it('test sign transaction', async () => {
        const account = privateKeyToAccount(VECTOR.privateKey);
        const trxProto: TrxProto = TrxProtoBuilder.buildTransferTrxProto({
            from: account.address,
            nonce: 0,
            to: account.address,
            amount: '1',
            gas: 1000000,
            gasPrice: '250000000000',
        });
        // chainId is an input to the signing preimage. This test only checks that
        // signing and verification agree, so it need not be a real chain id.
        const chainId = 'testnet';
        account.signTransaction(trxProto, chainId);
        expect(TrxProtoBuilder.verifyTrxProto(trxProto, account, chainId)).toBeTruthy();
    });

    it('adds the same private key twice as one account, without a warning', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            web3.wallet.clear();
            web3.wallet.add(VECTOR.privateKey);
            web3.wallet.add(VECTOR.privateKey);

            expect(web3.wallet.length).toBe(1);
            expect(web3.wallet.get(VECTOR.address)?.address.toLowerCase()).toEqual(VECTOR.address);
            expect(warn).not.toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });
});
