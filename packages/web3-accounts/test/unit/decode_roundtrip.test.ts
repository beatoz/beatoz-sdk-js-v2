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
import { BytesUint8Array, TrxProto } from '@beatoz/web3-types';
import { DecodedTransaction, TrxProtoBuilder, TrxProtoUtils } from '../../src';
import { TrxPayloadProposalProto, TrxPayloadVotingProto } from '../../src/tx/trx_pb';

// decodeTransaction returns each payload in the shape its builder takes, so a
// decoded transaction builds the same bytes again. Proposal and voting have no
// builder; their bytes come back as hex.

const from = '03ba93fdc3e164cd4e57370a828f6e5b05d4817d';
const to = '15633e505d01691a71f40049e15ba1340c0eea29';
const time = new Date('2026-01-02T03:04:05.678Z');
const base = { from, to, nonce: 7, gas: 100000, gasPrice: '48000000000', time };

const encode = (tx: TrxProto) => new BytesUint8Array(TrxProtoUtils.encode(tx).finish());
const decode = (tx: TrxProto) => TrxProtoBuilder.decodeTransaction(encode(tx));
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

// The fields every builder takes, read back from a decoded transaction.
const common = (d: DecodedTransaction) => ({
    version: d.version,
    time: d.time,
    nonce: d.nonce,
    from: d.from,
    to: d.to,
    gas: d.gas,
    gasPrice: d.gasPrice,
});

// Builds a transaction again from what decodeTransaction returned.
const rebuild = (d: DecodedTransaction): TrxProto => {
    switch (d.type) {
        case 1:
            return TrxProtoBuilder.buildTransferTrxProto({ ...common(d), amount: d.amount });
        case 2:
            return TrxProtoBuilder.buildDelegateTrxProto({ ...common(d), amount: d.amount });
        case 3:
            return TrxProtoBuilder.buildUnDelegateTrxProto({
                ...common(d),
                amount: d.amount,
                payload: d.payload,
            });
        case 6:
            return TrxProtoBuilder.buildContractTrxProto({
                ...common(d),
                amount: d.amount,
                payload: d.payload,
            });
        case 7:
            return TrxProtoBuilder.buildSetDocTrx({ ...common(d), payload: d.payload });
        case 8:
            return TrxProtoBuilder.buildWithdrawTrx({
                ...common(d),
                amount: d.amount,
                payload: d.payload,
            });
        default:
            throw Error(`no builder for type ${d.type}`);
    }
};

const built: [string, () => TrxProto][] = [
    ['transfer', () => TrxProtoBuilder.buildTransferTrxProto({ ...base, amount: '1000' })],
    ['staking', () => TrxProtoBuilder.buildDelegateTrxProto({ ...base, amount: '1000' })],
    [
        'unstaking',
        () =>
            TrxProtoBuilder.buildUnDelegateTrxProto({
                ...base,
                amount: '0',
                payload: { txHash: 'ab'.repeat(32) },
            }),
    ],
    [
        'contract call',
        () =>
            TrxProtoBuilder.buildContractTrxProto({
                ...base,
                amount: '5',
                payload: { data: '0xa9059cbb' },
            }),
    ],
    [
        'contract creation',
        () =>
            TrxProtoBuilder.buildContractTrxProto({
                ...base,
                to: '',
                amount: '0',
                payload: { data: '6080604052' },
            }),
    ],
    ['setDoc', () => TrxProtoBuilder.buildSetDocTrx({ ...base, payload: { name: 'n', url: 'u' } })],
    [
        'withdraw',
        () =>
            TrxProtoBuilder.buildWithdrawTrx({
                ...base,
                amount: '0',
                payload: { reqAmt: '1000000000000000000' },
            }),
    ],
];

describe('decodeTransaction', () => {
    it.each(built)('returns a %s that builds the same bytes again', (_, build) => {
        const tx = build();
        expect(hex(encode(rebuild(decode(tx))))).toEqual(hex(encode(tx)));
    });

    it('returns the withdraw amount as the decimal the builder takes', () => {
        const d = decode(built[6][1]());
        expect(d.type === 8 && d.payload).toEqual({ reqAmt: '1000000000000000000' });
    });

    it('returns contract data under the builder name', () => {
        const d = decode(built[3][1]());
        expect(d.type === 6 && d.payload).toEqual({ data: 'a9059cbb' });
    });

    it('returns a proposal with the chain names and options as hex', () => {
        const option = '{"maxTrxGas":"100000"}';
        const tx = {
            ...built[0][1](),
            to: new Uint8Array(20),
            Amount: new Uint8Array(),
            type: 4,
            Payload: TrxPayloadProposalProto.encode({
                message: 'm',
                startVotingHeight: Long.fromNumber(1200),
                votingBlocks: Long.fromNumber(100),
                applyingHeight: Long.fromNumber(1400),
                optType: 0x0101,
                options: [Buffer.from(option), Uint8Array.from([0xff, 0x00])],
            }).finish(),
        };
        const d = decode(tx);
        expect(d.type === 4 && d.payload).toEqual({
            message: 'm',
            startVotingHeight: 1200,
            votingBlocks: 100,
            applyingHeight: 1400,
            optType: 0x0101,
            options: [Buffer.from(option).toString('hex'), 'ff00'],
        });
    });

    it('returns a vote with the proposal hash as hex', () => {
        const tx = {
            ...built[0][1](),
            type: 5,
            Payload: TrxPayloadVotingProto.encode({
                txHash: Buffer.from('cd'.repeat(32), 'hex'),
                choice: 1,
            }).finish(),
        };
        const d = decode(tx);
        expect(d.type === 5 && d.payload).toEqual({ txHash: 'cd'.repeat(32), choice: 1 });
    });
});
