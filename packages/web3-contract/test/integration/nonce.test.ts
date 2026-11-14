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
import {
    assertCommitted,
    closeProvider,
    deployTestToken,
    netInfo,
    tokenBalance,
} from './e2e_utils';
import { TrxProtoBuilder } from '@beatoz/web3-accounts';
import { TrxProto } from '@beatoz/web3-types';
import { Web3 } from '@beatoz/web3';

const RECIPIENT = '0x0000000000000000000000000000000000000001';

describe('transfer token test', () => {
    const web3 = new Web3(netInfo.WS);
    for (const acct of netInfo.ACCTS) {
        web3.beatoz.accounts.wallet.add(acct.KEY);
    }

    let deployedContract: { address: string; deployer: string };
    beforeAll(async () => {
        deployedContract = await deployTestToken(web3);
    });
    afterAll(() => closeProvider(web3));

    it('transfer function', async () => {
        const fromAcct = web3.beatoz.accounts.wallet.get(netInfo.ACCTS[0].ADDR)!;
        const erc20Contract = new web3.beatoz.Contract(erc20Json, deployedContract.address) as any;
        const before = await tokenBalance(erc20Contract, RECIPIENT);

        const res = await erc20Contract.methods
            .transfer(RECIPIENT, '1000')
            .broadcast({ from: fromAcct.address, gas: 250000 });

        assertCommitted(res);
        expect(await tokenBalance(erc20Contract, RECIPIENT)).toEqual(before + 1000n);
    });

    it('transfer coin test (not evm)', async () => {
        const fromAcct = web3.beatoz.accounts.wallet.get(netInfo.ACCTS[0].ADDR)!;
        const acctInfo = await web3.beatoz.getAccount(fromAcct.address);
        const before = BigInt((await web3.beatoz.getAccount(RECIPIENT)).value.balance);

        // Gas comes from the chain's rule. A hardcoded price here was
        // rejected as `invalid gas price`, and nothing checked the result.
        const { value: rule } = await web3.beatoz.rule();
        const tx: TrxProto = TrxProtoBuilder.buildTransferTrxProto({
            from: acctInfo.value.address,
            nonce: acctInfo.value.nonce,
            to: RECIPIENT,
            amount: '100',
            gas: Number(rule.minTrxGas),
            gasPrice: String(rule.gasPrice),
        });
        const { rawTransaction } = fromAcct.signTransaction(tx, netInfo.CHAINID);

        assertCommitted(await web3.beatoz.broadcastRawTxCommit(rawTransaction));
        const after = BigInt((await web3.beatoz.getAccount(RECIPIENT)).value.balance);
        expect(after).toEqual(before + 100n);
    });
});
