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
import { Web3 } from '../../src';
import {
    closeProvider,
    getRewardChainId,
    getRewardPrivateKey,
    getRewardServer,
    getRewardWsServer,
} from '../integration/e2e_utils';
import { privateKeyToAccount, TrxProtoBuilder, Web3Account } from '@beatoz/web3-accounts';
import {
    BroadcastTxCommitResponse,
    RewardResponse,
    RuleResponse,
    TrxProto,
} from '@beatoz/web3-types';

// Withdraws a staking reward for real: delegate, wait for the chain to issue a
// reward, withdraw it, and check the balance and the reward ledger.
//
// This needs the reward node. The chain issues inflation rewards once per
// inflationCycleBlocks, a week of blocks on the regular node; the reward node
// is the same image with that one value lowered.

describe('withdraw on the reward node', () => {
    let web3: Web3;
    let account: Web3Account;
    let rule: RuleResponse['value'];
    let cycleBlocks: number;
    let validator: string;

    beforeAll(async () => {
        web3 = new Web3(getRewardWsServer());
        account = privateKeyToAccount(getRewardPrivateKey()) as Web3Account;
        ({ value: rule } = await web3.beatoz.rule());
        cycleBlocks = Number(rule.inflationCycleBlocks);
        if (!(cycleBlocks > 0 && cycleBlocks <= 100)) {
            throw new Error(
                `this node issues rewards every ${cycleBlocks} blocks; ` +
                    'run `yarn node:start:reward` and point BEATOZ_REWARD_* at it',
            );
        }
        const status = await web3.beatoz.status();
        const height = Number(status.sync_info.latest_block_height);
        validator = (await web3.beatoz.validators(height)).validators[0].address;
    });

    afterAll(() => closeProvider(web3));

    const fields = async () => ({
        from: account.address,
        nonce: (await web3.beatoz.getAccount(account.address)).value.nonce,
        gas: Number(rule.minTrxGas),
        gasPrice: String(rule.gasPrice),
    });

    const commit = async (tx: TrxProto): Promise<BroadcastTxCommitResponse> => {
        TrxProtoBuilder.signTrxProto(tx, account, getRewardChainId());
        const res = await web3.beatoz.broadcastTxCommit(tx);
        if (res.check_tx.code !== 0 || res.deliver_tx?.code !== 0) {
            throw new Error(`tx ${res.hash} failed: ${res.check_tx.log || res.deliver_tx?.log}`);
        }
        return res;
    };

    const ledger = async (): Promise<RewardResponse['value']> =>
        (await web3.beatoz.reward(account.address)).value;

    const balance = async (): Promise<bigint> =>
        BigInt((await web3.beatoz.getAccount(account.address)).value.balance);

    // On a fresh reward node this delegation is the account's only stake. On a
    // rerun, earlier runs' delegations are still earning, so the reward found
    // here may come from them; either way it is this account's reward to
    // withdraw, which is what the next two tests need.
    it('earns a withdrawable reward by delegating', async () => {
        await commit(
            TrxProtoBuilder.buildDelegateTrxProto({
                ...(await fields()),
                to: validator,
                amount: (10n ** 21n).toString(),
            }),
        );

        // Up to three cycles: the delegation may land just after a payout.
        const deadline = Date.now() + 3 * cycleBlocks * 1000 + 10000;
        while (BigInt((await ledger()).cumulated) === 0n) {
            if (Date.now() > deadline) throw new Error('no reward within three cycles');
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        expect(BigInt((await ledger()).cumulated)).toBeGreaterThan(0n);
    });

    it('refuses a withdraw above the accumulated reward', async () => {
        // Far above, not one above: another payout can land between reading
        // the ledger and the check. Withdrawing exactly what accumulated is
        // the next test.
        const tx = TrxProtoBuilder.buildWithdrawTrx({
            ...(await fields()),
            to: account.address,
            amount: '0',
            payload: { reqAmt: (BigInt((await ledger()).cumulated) + 10n ** 30n).toString() },
        });
        TrxProtoBuilder.signTrxProto(tx, account, getRewardChainId());

        const result = await web3.beatoz.checkTx(tx);

        expect(result.code).not.toEqual(0);
        expect(result.log).toContain('insufficient reward');
    });

    it('pays the reward into the balance, less the fee', async () => {
        const reward = BigInt((await ledger()).cumulated);
        const before = await balance();

        const res = await commit(
            TrxProtoBuilder.buildWithdrawTrx({
                ...(await fields()),
                to: account.address,
                amount: '0',
                payload: { reqAmt: reward.toString() },
            }),
        );

        // Rewards go to the ledger and fee rewards to the proposer, so the
        // withdraw is the only thing that moves this balance.
        const fee = BigInt(res.deliver_tx!.gas_used!) * BigInt(rule.gasPrice);
        expect((await balance()) - before).toEqual(reward - fee);

        // At the withdraw's height the ledger holds only what that block
        // issued: nothing, unless the withdraw landed on a payout block.
        const atWithdraw = await fetch(
            `${getRewardServer()}/reward?addr=0x${account.address.replace(/^0x/i, '')}&height=${res.height}`,
        ).then((r) => r.json());
        expect(atWithdraw.result.value.cumulated).toEqual(atWithdraw.result.value.issued);
    });
});
