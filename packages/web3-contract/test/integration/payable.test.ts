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
import vaultJson from '../fixtures/Vault.json';
import { assertCommitted, closeProvider, netInfo } from './e2e_utils';
import { Web3 } from '@beatoz/web3';
import { BroadcastTxCommitResponse } from '@beatoz/web3-types';

describe('broadcast options', () => {
    const web3 = new Web3(netInfo.WS);
    web3.beatoz.accounts.wallet.add(netInfo.ACCTS[0].KEY);
    const from = netInfo.ACCTS[0].ADDR;
    let vault: string;

    beforeAll(async () => {
        ({ address: vault } = await new web3.beatoz.Contract(vaultJson.abi)
            .deploy({ bytecode: vaultJson.bytecode })
            .send({ from }));
    });

    afterAll(() => closeProvider(web3));

    // broadcast() used to send an amount of zero whatever value was given.
    it('sends the value to a payable function', async () => {
        const contract = new web3.beatoz.Contract(vaultJson.abi, vault);
        const before = BigInt((await web3.beatoz.getAccount(vault)).value.balance);

        const res = await contract.methods.deposit().broadcast({ from, value: '1000' });

        assertCommitted(res as BroadcastTxCommitResponse);
        expect(await contract.methods.deposits(from).call()).toEqual(1000n);
        const after = BigInt((await web3.beatoz.getAccount(vault)).value.balance);
        expect(after).toEqual(before + 1000n);
    });

    // A gas price went through Number() before: 10^21 became '1e+21' and the
    // builder refused it. Now it reaches the node as given, which refuses it
    // for the fee the sender cannot pay.
    it('passes a large gas price through unchanged', async () => {
        const contract = new web3.beatoz.Contract(vaultJson.abi, vault);

        const res = (await contract.methods
            .deposit()
            .broadcast({ from, gasPrice: '1000000000000000000000' })) as BroadcastTxCommitResponse;

        expect(res.check_tx.code).not.toEqual(0);
    });
});
