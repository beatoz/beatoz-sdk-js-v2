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
import { ResponsesDecoder, RuleResponse } from '../../src';

// `result` of the node's `rule` query, as the test node (the beatoz/beatoz-re
// image pinned in scripts/testnode.config.json) returned it on 2026-11-13.
// Newer nodes send txFeePoolAddress instead of deadAddress; neither is typed.
const live = {
    value: {
        blockGasLimit: '120000000',
        blockSizeLimit: '22020096',
        bondingBlocksWeightPermil: 500,
        deadAddress: '000000000000000000000000000000000000DEAD',
        emptyBlockIntervalSecs: 60,
        gasPrice: '48000000000',
        inflationCycleBlocks: '10080',
        inflationWeightPermil: 3,
        lazyApplyingBlocks: '1440',
        lazyUnbondingBlocks: '43200',
        maxDelegatorsOfValidator: 1000,
        maxIndividualPowerRate: 33,
        maxTotalSupply: '700000000000000000000000000',
        maxUpdatablePowerRate: 33,
        maxValidatorCnt: 21,
        maxValidatorsOfDelegator: 1,
        maxVotingPeriodBlocks: '10080',
        minBondingBlocks: '20160',
        minDelegatorPower: '100',
        minSelfPowerRate: 50,
        minSignedBlocks: '500',
        minTrxGas: '5000',
        minValidatorPower: '100000',
        minVotingPeriodBlocks: '1440',
        rewardPoolAddress: '0000000000000000000000000000000000000000',
        ripeningBlocks: '525600',
        slashRate: 50,
        txFeeRewardRate: 90,
        validatorRewardRate: 30,
        version: 4,
    },
    height: '2860',
};

const decode = (result: object) =>
    ResponsesDecoder.decodeRule({ jsonrpc: '2.0', id: 1, result } as never);

describe('ResponsesDecoder.decodeRule', () => {
    it('reads every typed parameter from a live response', () => {
        const rule = decode(live);
        const typed: RuleResponse['value'] = rule.value;

        expect(rule.height).toEqual('2860');
        expect(typed.gasPrice).toEqual('48000000000');
        expect(typed.minTrxGas).toEqual('5000');
        expect(typed.blockGasLimit).toEqual('120000000');
        expect(typed.inflationCycleBlocks).toEqual('10080');
        expect(typed.maxValidatorCnt).toEqual(21);
        expect(typed.slashRate).toEqual(50);
        expect(typed.maxTotalSupply).toEqual('700000000000000000000000000');
    });

    it('keeps the untyped parameters the node sends', () => {
        const rule = decode(live);
        expect((rule.value as Record<string, unknown>).deadAddress).toEqual(live.value.deadAddress);
    });

    it('puts back a zero parameter the node left out, in its JSON type', () => {
        const { slashRate, inflationCycleBlocks, ...rest } = live.value;
        void slashRate;
        void inflationCycleBlocks;

        const rule = decode({ ...live, value: rest });
        expect(rule.value.slashRate).toBe(0);
        expect(rule.value.inflationCycleBlocks).toBe('0');
        expect(rule.value.gasPrice).toEqual('48000000000');
    });
});
