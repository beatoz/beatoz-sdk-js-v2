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
import { TrxProtoBuilder } from '../../src';
import { TrxProto } from '@beatoz/web3-types';

// The builder input used to carry `type`, `hash` and `sig`, which no builder
// read: `type: 8` on a transfer still built a transfer. The input type leaves
// them out now, and a value passed anyway (JavaScript, a cast) is refused.
// `time` is read by every builder; the transfer builder used to ignore it.

const from = '03ba93fdc3e164cd4e57370a828f6e5b05d4817d';
const to = '15633e505d01691a71f40049e15ba1340c0eea29';
const base = { from, to, nonce: 1, gas: 100000, gasPrice: '48000000000' };

type Fields = Record<string, unknown>;
const builders: Record<string, (f: Fields) => TrxProto> = {
    transfer: (f) => TrxProtoBuilder.buildTransferTrxProto({ ...base, amount: '1', ...f } as never),
    delegate: (f) => TrxProtoBuilder.buildDelegateTrxProto({ ...base, amount: '1', ...f } as never),
    undelegate: (f) =>
        TrxProtoBuilder.buildUnDelegateTrxProto({
            ...base,
            amount: '0',
            ...f,
            payload: { txHash: '11'.repeat(32) },
        } as never),
    proposal: (f) =>
        TrxProtoBuilder.buildProposalTrx({
            ...base,
            ...f,
            payload: {
                message: 'm',
                startVotingHeight: 10,
                votingBlocks: 10,
                applyingHeight: 30,
                optType: 1,
                options: [],
            },
        } as never),
    voting: (f) =>
        TrxProtoBuilder.buildVotingTrx({
            ...base,
            ...f,
            payload: { txHash: '22'.repeat(32), choice: 0 },
        } as never),
    contract: (f) =>
        TrxProtoBuilder.buildContractTrxProto({
            ...base,
            amount: '0',
            ...f,
            payload: { data: '00' },
        } as never),
    setdoc: (f) =>
        TrxProtoBuilder.buildSetDocTrx({
            ...base,
            ...f,
            payload: { name: 'n', url: 'u' },
        } as never),
    withdraw: (f) =>
        TrxProtoBuilder.buildWithdrawTrx({
            ...base,
            amount: '0',
            ...f,
            payload: { reqAmt: '1' },
        } as never),
};

describe.each(Object.keys(builders))('%s', (name) => {
    it.each([
        ['type', 8, 'each builder sets its own'],
        ['hash', 'ab'.repeat(32), 'it is computed from the signed transaction'],
        ['sig', 'cd'.repeat(65), 'sign with signTrxProto'],
    ])('refuses %s', (field, value, reason) => {
        expect(() => builders[name]({ [field]: value })).toThrow(
            `${field} is not a builder input; ${reason}`,
        );
    });

    it('uses the time it is given', () => {
        const time = new Date('2026-01-02T03:04:05.678Z');
        expect(builders[name]({ time }).time.toString()).toEqual('1767323045678000000');
    });

    it('uses the current time when none is given', () => {
        const before = BigInt(Date.now()) * 1000000n;
        const built = BigInt(builders[name]({}).time.toString());
        expect(built >= before).toBe(true);
    });
});
