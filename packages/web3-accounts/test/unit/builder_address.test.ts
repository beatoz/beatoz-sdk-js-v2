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
import Long from 'long';
import { TrxProtoBuilder } from '../../src';
import { TrxProto } from '@beatoz/web3-types';

// beatoz-go's Trx.Validate rejects a `from` or `to` that is not 20 bytes, except
// an empty `to` on a contract transaction, which creates a contract. A
// well-formed address with digits dropped used to be signed as it was; every
// builder now refuses it, naming the field.

const from = '03ba93fdc3e164cd4e57370a828f6e5b05d4817d';
const to = '15633e505d01691a71f40049e15ba1340c0eea29';
const base = { from, to, nonce: 1, gas: 100000, gasPrice: '48000000000' };

type Fields = { from?: string; to?: string };
const builders: Record<string, (f: Fields) => TrxProto> = {
    transfer: (f) => TrxProtoBuilder.buildTransferTrxProto({ ...base, amount: '1', ...f }),
    delegate: (f) => TrxProtoBuilder.buildDelegateTrxProto({ ...base, amount: '1', ...f }),
    undelegate: (f) =>
        TrxProtoBuilder.buildUnDelegateTrxProto({
            ...base,
            amount: '0',
            ...f,
            payload: { txhash: '11'.repeat(32) },
        }),
    proposal: (f) =>
        TrxProtoBuilder.buildProposalTrx({
            ...base,
            ...f,
            payload: {
                message: 'm',
                startVotingHeight: Long.fromNumber(10),
                votingBlocks: Long.fromNumber(10),
                applyingHeight: Long.fromNumber(30),
                optType: 1,
                options: [],
            },
        }),
    voting: (f) =>
        TrxProtoBuilder.buildVotingTrx({
            ...base,
            ...f,
            payload: { txHash: new Uint8Array(32), choice: 0 },
        }),
    contract: (f) =>
        TrxProtoBuilder.buildContractTrxProto({
            ...base,
            amount: '0',
            ...f,
            payload: { data: '00' },
        }),
    setdoc: (f) =>
        TrxProtoBuilder.buildSetDocTrx({ ...base, ...f, payload: { name: 'n', url: 'u' } }),
    withdraw: (f) =>
        TrxProtoBuilder.buildWithdrawTrx({
            ...base,
            amount: '0',
            ...f,
            payload: { reqAmt: '1' },
        }),
};

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

const wrongLength: [string, string, number][] = [
    ['two digits dropped', to.slice(2), 19],
    ['two digits added', `${to}00`, 21],
    ['32 bytes', '11'.repeat(32), 32],
];

describe.each(Object.keys(builders))('%s', (name) => {
    it('keeps 20-byte addresses, with or without 0x', () => {
        const tx = builders[name]({ from: `0x${from}`, to });
        expect(hex(tx.from)).toEqual(from);
        expect(hex(tx.to)).toEqual(to);
    });

    describe.each(['from', 'to'])('%s', (field) => {
        it.each(wrongLength)('rejects %s', (_, address, length) => {
            expect(() => builders[name]({ [field]: address })).toThrow(
                `${field} must be 20 bytes, got ${length}`,
            );
        });
    });

    it('rejects an empty from', () => {
        expect(() => builders[name]({ from: '' })).toThrow('from must be 20 bytes, got 0');
    });
});

describe.each(Object.keys(builders).filter((name) => name !== 'contract'))('%s', (name) => {
    it.each(['', '0x'])('rejects an empty to: %j', (empty) => {
        expect(() => builders[name]({ to: empty })).toThrow('to must be 20 bytes, got 0');
    });
});

describe('contract', () => {
    // An empty `to` creates a contract on beatoz-go, as does the zero address
    // the SDK's own deploy sends.
    it.each(['', '0x'])('accepts an empty to: %j', (empty) => {
        expect(builders.contract({ to: empty }).to).toHaveLength(0);
    });

    it('accepts the zero address', () => {
        expect(hex(builders.contract({ to: '00'.repeat(20) }).to)).toEqual('00'.repeat(20));
    });
});
