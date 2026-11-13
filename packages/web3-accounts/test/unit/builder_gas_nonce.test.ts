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

// `gas` and `nonce` are int64 on the chain. Long.fromValue would take a wrong
// number and change it - 1.5 into 1, NaN into 0 - so every builder rejects
// anything but a non-negative safe integer instead.

const from = '03ba93fdc3e164cd4e57370a828f6e5b05d4817d';
const to = '15633e505d01691a71f40049e15ba1340c0eea29';
const base = { from, to, nonce: 1, gas: 100000, gasPrice: '48000000000', amount: '0' };

type Fields = { gas?: unknown; nonce?: unknown };
const builders: Record<string, (f: Fields) => TrxProto> = {
    transfer: (f) => TrxProtoBuilder.buildTransferTrxProto({ ...base, ...f } as never),
    delegate: (f) => TrxProtoBuilder.buildDelegateTrxProto({ ...base, ...f } as never),
    undelegate: (f) =>
        TrxProtoBuilder.buildUnDelegateTrxProto({
            ...base,
            ...f,
            payload: { txhash: '11'.repeat(32) },
        } as never),
    contract: (f) =>
        TrxProtoBuilder.buildContractTrxProto({ ...base, ...f, payload: { data: '00' } } as never),
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
        } as never),
    voting: (f) =>
        TrxProtoBuilder.buildVotingTrx({
            ...base,
            ...f,
            payload: { txHash: new Uint8Array(32), choice: 0 },
        } as never),
    setdoc: (f) =>
        TrxProtoBuilder.buildSetDocTrx({
            ...base,
            ...f,
            payload: { name: 'n', url: 'u' },
        } as never),
    withdraw: (f) =>
        TrxProtoBuilder.buildWithdrawTrx({ ...base, ...f, payload: { reqAmt: '1' } } as never),
};

const valid = [0, 1, 100000, Number.MAX_SAFE_INTEGER];

const invalid: unknown[] = [1.5, -1, -0.5, NaN, Infinity, -Infinity, 2 ** 53, '1', 1n];

describe.each(Object.keys(builders))('%s', (name) => {
    it.each(valid)('keeps gas %j', (gas) => {
        expect(builders[name]({ gas }).gas.toString()).toEqual(String(gas));
    });

    it.each(valid)('keeps nonce %j', (nonce) => {
        expect(builders[name]({ nonce }).nonce.toString()).toEqual(String(nonce));
    });

    it.each([undefined, null])('uses nonce 0 for %p', (nonce) => {
        expect(builders[name]({ nonce }).nonce.toString()).toEqual('0');
    });

    it.each([...invalid, null])('rejects gas %p', (gas) => {
        expect(() => builders[name]({ gas })).toThrow('gas must be a non-negative safe integer');
    });

    it.each(invalid)('rejects nonce %p', (nonce) => {
        expect(() => builders[name]({ nonce })).toThrow(
            'nonce must be a non-negative safe integer',
        );
    });

    it('rejects a missing gas', () => {
        expect(() => builders[name]({ gas: undefined })).toThrow(
            'gas must be a non-negative safe integer',
        );
    });
});
