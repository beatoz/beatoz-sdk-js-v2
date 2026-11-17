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
import erc20Json from '../../fixtures/erc20-abi.json';
import tokenJson from '../../fixtures/erc20-contract.json';
import { NonceManager, TransactionFailedError } from '../../../src';
import { Web3 } from '../../../src';
import {
    closeProvider,
    DEPLOY_GAS,
    deployTestToken,
    netInfo,
    tokenBalance,
} from '../contract_fixtures';

const RECIPIENT = '0x0000000000000000000000000000000000000002';

describe('sending native transactions', () => {
    let web3: Web3;
    let from: string;

    beforeAll(() => {
        web3 = new Web3(netInfo.WS);
        from = web3.beatoz.accounts.wallet
            .add(netInfo.ACCTS[0].KEY)
            .get(netInfo.ACCTS[0].ADDR)!.address;
    });

    afterAll(() => closeProvider(web3));

    // Sync sends return before the block; wait for the last one so the next
    // test, or suite, reads the account's nonce after them.
    const settle = (hash: string) => web3.beatoz.waitForTx(hash);

    const balance = async (address: string) =>
        BigInt((await web3.beatoz.getAccount(address)).value.balance);

    it('commits a transfer with the nonce, gas and gas price filled in', async () => {
        const before = await balance(RECIPIENT);

        const res = await web3.beatoz.transfer({ from, to: RECIPIENT, amount: '10' });

        expect(res.deliver_tx?.code).toBe(0);
        expect(await balance(RECIPIENT)).toBe(before + 10n);
    });

    it('throws the node log for a refused transfer', async () => {
        const error = await web3.beatoz
            .transfer({ from, to: RECIPIENT, amount: '1' }, { nonce: 0 })
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(TransactionFailedError);
        expect((error as TransactionFailedError).log).toContain('invalid nonce');
    });

    it('without a nonce manager, a second sync send before the block reuses the nonce', async () => {
        const first = await web3.beatoz.transfer(
            { from, to: RECIPIENT, amount: '1' },
            { sendMode: 'sync' },
        );
        const second = await web3.beatoz
            .transfer({ from, to: RECIPIENT, amount: '1' }, { sendMode: 'sync' })
            .catch((e: unknown) => e);

        expect((second as TransactionFailedError).log).toContain('invalid nonce');
        await settle(first.hash);
    });

    it('with a nonce manager, sync sends before the block all go through', async () => {
        // Made before the manager is set: it reads web3.beatoz's at each send.
        const { address } = await deployTestToken(web3);
        const token = new web3.beatoz.Contract(erc20Json, address) as any;
        const before = await balance(RECIPIENT);
        const tokensBefore = await tokenBalance(token, RECIPIENT);

        web3.beatoz.nonceManager = new NonceManager();
        try {
            const hashes: string[] = [];
            for (let i = 0; i < 3; i++) {
                const res = await web3.beatoz.transfer(
                    { from, to: RECIPIENT, amount: '1' },
                    { sendMode: 'sync' },
                );
                hashes.push(res.hash);
            }
            const call = await token.methods
                .transfer(RECIPIENT, '5')
                .broadcast({ from, gas: 250000, sendMode: 'sync' });
            expect(call.code).toBe(0);
            hashes.push(call.hash);

            // The contract deploy() returns counts with the same manager.
            const { contract: deployed } = await new web3.beatoz.Contract(tokenJson.abi)
                .deploy({ bytecode: tokenJson.bytecode, args: ['BeatozToken', 'RGT'] })
                .send({ from, gas: DEPLOY_GAS });
            expect((deployed as any).nonceManager).toBe(web3.beatoz.nonceManager);

            for (const hash of hashes) await settle(hash);
            expect(await balance(RECIPIENT)).toBe(before + 3n);
            expect(await tokenBalance(token, RECIPIENT)).toBe(tokensBefore + 5n);
        } finally {
            web3.beatoz.nonceManager = undefined;
        }
    });
});
