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
import {
    getTestChainId,
    getTestProposalAccountPrivateKey,
    getTestWsServer,
    closeProvider,
} from '../e2e_utils';
import { asNodeAddress, getValidatorAddress } from '../chain_fixtures';
import { privateKeyToAccount, Web3Account, TrxProtoBuilder } from '@beatoz/web3-accounts';
import { BroadcastTxCommitResponse } from '@beatoz/web3-types';

// One BEATOZ (10^18) is one unit of voting power, and a delegation must be a
// whole number of them, at least the chain's minDelegatorPower. The node
// refunds an undelegated stake only after lazyUnbondingBlocks (two weeks by
// default), so the test checks that the stake is gone, not the balance.

const AMOUNT_PER_POWER = 10n ** 18n;

describe('staking test', () => {
    let web3: Web3;
    let account: Web3Account;
    let validator: string;

    beforeAll(async () => {
        web3 = new Web3(getTestWsServer());
        account = privateKeyToAccount(getTestProposalAccountPrivateKey()) as Web3Account;
        validator = await getValidatorAddress(web3);
    });

    afterAll(() => closeProvider(web3));

    const gas = async () => {
        const { value: rule } = await web3.beatoz.rule();
        const { value: sender } = await web3.beatoz.getAccount(account.address);
        return {
            nonce: sender.nonce,
            gas: Number(rule.minTrxGas),
            gasPrice: rule.gasPrice,
            power: BigInt(rule.minDelegatorPower),
        };
    };

    const expectCommitted = (result: BroadcastTxCommitResponse) => {
        expect(result.check_tx.log).toEqual('');
        expect(result.check_tx.code).toEqual(0);
        expect(result.deliver_tx?.code).toEqual(0);
    };

    // The stakes the account holds with the validator, by the hash of the
    // transaction that made each one.
    const stakesWithValidator = async () => {
        const { value } = await web3.beatoz.stakes(account.address);
        return (value ?? []).filter((s) => asNodeAddress(s.to) === asNodeAddress(validator));
    };

    let stakeHash: string;

    it('delegates to a validator and the stake appears', async () => {
        const { power, ...fee } = await gas();
        const tx = TrxProtoBuilder.buildDelegateTrxProto({
            ...fee,
            from: account.address,
            to: validator,
            amount: (power * AMOUNT_PER_POWER).toString(),
        });
        TrxProtoBuilder.signTrxProto(tx, account, getTestChainId());
        const result = await web3.beatoz.broadcastTxCommit(tx);

        expectCommitted(result);
        stakeHash = result.hash;
        const stake = (await stakesWithValidator()).find(
            (s) => s.txhash.toLowerCase() === stakeHash.toLowerCase(),
        );
        expect(stake).toBeDefined();
        expect(String(stake?.power)).toEqual(power.toString());
    });

    it('undelegates that stake and it is gone', async () => {
        expect(stakeHash).toBeDefined();
        const { power: _power, ...fee } = await gas();
        const tx = TrxProtoBuilder.buildUnDelegateTrxProto({
            ...fee,
            from: account.address,
            to: validator,
            amount: '0',
            payload: { txHash: stakeHash },
        });
        TrxProtoBuilder.signTrxProto(tx, account, getTestChainId());
        const result = await web3.beatoz.broadcastTxCommit(tx);

        expectCommitted(result);
        const hashes = (await stakesWithValidator()).map((s) => s.txhash.toLowerCase());
        expect(hashes).not.toContain(stakeHash.toLowerCase());
    });
});
