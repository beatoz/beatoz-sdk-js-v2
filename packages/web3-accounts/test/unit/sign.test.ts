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
import { privateKeyToAccount, TrxProtoBuilder } from '../../src';
import { TrxProto } from '@beatoz/web3-types';

// beatoz-go defines transaction types 1 to 8 and rejects any other, so the SDK
// refuses to sign one; the builders always set a known type, and only a type
// changed by hand reaches this.

const account = privateKeyToAccount(
    '2926cd769094b2755d84b74b9180811adf71d9a1bfacf86f81dbfcfd4b9da163',
);
const chainId = 'localnet0';
const base = {
    from: account.address,
    to: '15633e505d01691a71f40049e15ba1340c0eea29',
    nonce: 1,
    gas: 100000,
    gasPrice: '48000000000',
};

const built: [number, () => TrxProto][] = [
    [1, () => TrxProtoBuilder.buildTransferTrxProto({ ...base, amount: '1' })],
    [2, () => TrxProtoBuilder.buildDelegateTrxProto({ ...base, amount: '1' })],
    [
        3,
        () =>
            TrxProtoBuilder.buildUnDelegateTrxProto({
                ...base,
                amount: '0',
                payload: { txHash: '11'.repeat(32) },
            }),
    ],
    [
        4,
        () =>
            TrxProtoBuilder.buildProposalTrx({
                ...base,
                payload: {
                    message: 'm',
                    startVotingHeight: 10,
                    votingBlocks: 10,
                    applyingHeight: 30,
                    optType: 1,
                    options: [],
                },
            }),
    ],
    [
        5,
        () =>
            TrxProtoBuilder.buildVotingTrx({
                ...base,
                payload: { txHash: '22'.repeat(32), choice: 0 },
            }),
    ],
    [
        6,
        () =>
            TrxProtoBuilder.buildContractTrxProto({
                ...base,
                amount: '0',
                payload: { data: '00' },
            }),
    ],
    [7, () => TrxProtoBuilder.buildSetDocTrx({ ...base, payload: { name: 'n', url: 'u' } })],
    [8, () => TrxProtoBuilder.buildWithdrawTrx({ ...base, amount: '0', payload: { reqAmt: '1' } })],
];

describe('signTrxProto', () => {
    it.each(built)('signs type %i', (type, build) => {
        const tx = build();
        expect(tx.type).toEqual(type);
        TrxProtoBuilder.signTrxProto(tx, account, chainId);
        expect(TrxProtoBuilder.verifyTrxProto(tx, account, chainId)).toBe(true);
    });

    it.each([0, 9, 100, -1])('refuses type %i', (type) => {
        const tx = { ...built[0][1](), type };
        expect(() => TrxProtoBuilder.signTrxProto(tx, account, chainId)).toThrow(
            `unknown transaction type ${type}; the chain accepts types 1 to 8`,
        );
        expect(tx.sig).toHaveLength(0);
    });

    it('refuses to verify an unknown type', () => {
        const tx = built[0][1]();
        TrxProtoBuilder.signTrxProto(tx, account, chainId);
        tx.type = 9;
        expect(() => TrxProtoBuilder.verifyTrxProto(tx, account, chainId)).toThrow(
            'unknown transaction type 9',
        );
    });
});
