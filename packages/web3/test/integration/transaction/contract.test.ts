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
import { getTestProposalAccountPrivateKey, getTestWsServer, closeProvider } from '../e2e_utils';
import { privateKeyToAccount } from '@beatoz/web3-accounts';
import tokenJson from '../../fixtures/erc20-contract.json';

describe('contract test', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('deploys at the address the node gives the contract', async () => {
        const account = privateKeyToAccount(getTestProposalAccountPrivateKey());
        web3.beatoz.accounts.wallet.add(account.privateKey);

        const { address, contract, hash } = await new web3.beatoz.Contract(tokenJson.abi)
            .deploy({ bytecode: tokenJson.bytecode, args: ['TEST', 'TST'] })
            .send({ from: account.address, gas: 10_000_000 });

        // The token's constructor mints, so the node's evm event names the
        // contract that logged it: the new one.
        const tx = await web3.beatoz.waitForTx(hash);
        const fromEvents = tx.tx_result.events
            .filter((e) => e.type === 'evm')
            .flatMap((e) => e.attributes)
            .filter((a) => atob(a.key) === 'contractAddress')
            .map((a) => '0x' + atob(a.value).toLowerCase());
        expect(fromEvents).toContain(address.toLowerCase());

        expect(await contract.methods.symbol().call()).toBe('TST');
    });
});
