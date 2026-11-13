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
import { TrxProtoBuilder, TrxProtoUtils } from '../../src';
import { BytesUint8Array } from '@beatoz/web3-types';
import {
    TrxPayloadProposalProto,
    TrxPayloadUnstakingProto,
    TrxPayloadVotingProto,
} from '../../src/tx/trx_pb';

// The payload inputs take what a caller holds - numbers, the hex hash the node
// returns, option text - and the builders convert them to the protobuf fields
// beatoz-go decodes. Each test reads the encoded payload back to check that.

const from = '03ba93fdc3e164cd4e57370a828f6e5b05d4817d';
const zero = '00'.repeat(20);
const base = { from, to: zero, nonce: 1, gas: 100000, gasPrice: '48000000000' };
const hash = 'ab'.repeat(32);
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

const proposal = {
    message: 'raise the gas limit',
    startVotingHeight: 1200,
    votingBlocks: 100,
    applyingHeight: 1400,
    optType: 0x0101,
    options: ['{"maxTrxGas":"100000"}'],
};
const buildProposal = (payload: object) =>
    TrxProtoBuilder.buildProposalTrx({ ...base, payload: { ...proposal, ...payload } } as never);
const readProposal = (payload: object) =>
    TrxPayloadProposalProto.decode(buildProposal(payload).Payload);

describe('buildProposalTrx', () => {
    it('encodes numbers as int64 and int32, and options as UTF-8', () => {
        const read = readProposal({});
        expect(read.message).toEqual(proposal.message);
        expect(read.startVotingHeight.toNumber()).toEqual(1200);
        expect(read.votingBlocks.toNumber()).toEqual(100);
        expect(read.applyingHeight.toNumber()).toEqual(1400);
        expect(read.optType).toEqual(0x0101);
        expect(read.options.map((o) => Buffer.from(o).toString('utf8'))).toEqual(proposal.options);
    });

    it('encodes non-ASCII option text as UTF-8', () => {
        const read = readProposal({ options: ['찬성', '반대'] });
        expect(read.options.map(hex)).toEqual(['ecb0acec84b1', 'ebb098eb8c80']);
    });

    it.each(['startVotingHeight', 'votingBlocks', 'applyingHeight'])(
        'rejects a %s that is not a non-negative safe integer',
        (field) => {
            for (const value of [-1, 1.5, NaN, 2 ** 53, '1200']) {
                expect(() => buildProposal({ [field]: value })).toThrow(
                    `${field} must be a non-negative safe integer`,
                );
            }
        },
    );

    it.each([-1, 1.5, NaN, 2 ** 31, '257'])('rejects optType %p', (optType) => {
        expect(() => buildProposal({ optType })).toThrow(
            'optType must be a non-negative 32-bit integer',
        );
    });

    it.each([[[new Uint8Array(1)]], [['a', 1]], ['a'], [undefined]])(
        'rejects options %p',
        (options) => {
            expect(() => buildProposal({ options })).toThrow('options must be an array of strings');
        },
    );
});

const buildVoting = (payload: object) =>
    TrxProtoBuilder.buildVotingTrx({ ...base, payload } as never);

describe('buildVotingTrx', () => {
    it.each([hash, `0x${hash}`, hash.toUpperCase()])(
        'reads the proposal hash %s as hex',
        (txHash) => {
            const read = TrxPayloadVotingProto.decode(buildVoting({ txHash, choice: 1 }).Payload);
            expect(hex(read.txHash)).toEqual(hash);
            expect(read.choice).toEqual(1);
        },
    );

    it('rejects a hash that is not hex', () => {
        expect(() => buildVoting({ txHash: 'zz'.repeat(32), choice: 0 })).toThrow('invalid hex');
    });

    it.each([-1, 1.5, 2 ** 31, '0'])('rejects choice %p', (choice) => {
        expect(() => buildVoting({ txHash: hash, choice })).toThrow(
            'choice must be a non-negative 32-bit integer',
        );
    });
});

describe('buildUnDelegateTrxProto', () => {
    it('reads txHash as hex, and decodeTransaction returns it under the same name', () => {
        const tx = TrxProtoBuilder.buildUnDelegateTrxProto({
            ...base,
            to: from,
            amount: '0',
            payload: { txHash: hash },
        });
        expect(hex(TrxPayloadUnstakingProto.decode(tx.Payload).txHash)).toEqual(hash);

        const decoded = TrxProtoBuilder.decodeTransaction(
            new BytesUint8Array(TrxProtoUtils.encode(tx).finish()),
        );
        expect(decoded.type === 3 && decoded.payload.txHash).toEqual(hash);
    });
});
