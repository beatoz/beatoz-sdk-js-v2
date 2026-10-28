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

// Type-level tests. `yarn test:types` compiles this file and Jest never runs
// it. Each `@ts-expect-error` asserts that the next line does not compile; if
// the types stop rejecting it, the directive itself becomes the error.

import Long from 'long';
import { DecodedTransaction, Transaction, TrxProtoBuilder } from '../../src';

const base = {
    from: '0x01',
    to: '0x02',
    amount: '0',
    gas: 100000,
    gasPrice: '250000000000',
};

export function buildersTakeTheirOwnPayload() {
    TrxProtoBuilder.buildTransferTrxProto(base);
    TrxProtoBuilder.buildDelegateTrxProto(base);
    TrxProtoBuilder.buildUnDelegateTrxProto({ ...base, payload: { txhash: '0x03' } });
    TrxProtoBuilder.buildProposalTrx({
        ...base,
        payload: {
            message: 'm',
            startVotingHeight: Long.fromNumber(1),
            votingBlocks: Long.fromNumber(1),
            applyingHeight: Long.fromNumber(1),
            optType: 0,
            options: [],
        },
    });
    TrxProtoBuilder.buildVotingTrx({ ...base, payload: { txHash: new Uint8Array(), choice: 0 } });
    TrxProtoBuilder.buildContractTrxProto({ ...base, payload: { data: '0x6080' } });
    TrxProtoBuilder.buildSetDocTrx({ ...base, payload: { name: 'n', url: 'u' } });
    TrxProtoBuilder.buildWithdrawTrx({ ...base, payload: { reqAmt: '1' } });
}

export function transferAndStakingCarryNoPayload() {
    // @ts-expect-error a transfer has no payload
    TrxProtoBuilder.buildTransferTrxProto({ ...base, payload: { reqAmt: '1' } });
    // @ts-expect-error staking has no payload
    TrxProtoBuilder.buildDelegateTrxProto({ ...base, payload: { txhash: '0x03' } });
}

export function payloadIsRequiredWhereTheTypeCarriesOne() {
    // @ts-expect-error a withdraw needs payload.reqAmt
    TrxProtoBuilder.buildWithdrawTrx(base);
    // @ts-expect-error unstaking needs payload.txhash
    TrxProtoBuilder.buildUnDelegateTrxProto(base);
    // @ts-expect-error a contract transaction needs payload.data
    TrxProtoBuilder.buildContractTrxProto(base);
    // @ts-expect-error setDoc needs a payload
    TrxProtoBuilder.buildSetDocTrx(base);
}

export function anotherTypesPayloadIsRejected() {
    // @ts-expect-error the unstaking payload is not a withdraw payload
    TrxProtoBuilder.buildWithdrawTrx({ ...base, payload: { txhash: '0x03' } });
    // @ts-expect-error the withdraw payload is not an unstaking payload
    TrxProtoBuilder.buildUnDelegateTrxProto({ ...base, payload: { reqAmt: '1' } });
    // @ts-expect-error setDoc took Transaction<object> and accepted any object
    TrxProtoBuilder.buildSetDocTrx({ ...base, payload: { hello: 'world' } });
    // @ts-expect-error reqAmt is a decimal string, not a number
    TrxProtoBuilder.buildWithdrawTrx({ ...base, payload: { reqAmt: 1 } });
}

export function aWiderTransactionIsRejected(loose: Transaction<object>) {
    // @ts-expect-error `object` was assignable to every payload before
    TrxProtoBuilder.buildWithdrawTrx(loose);
}

export function decodedPayloadNarrowsOnType(tx: DecodedTransaction) {
    // @ts-expect-error the payload is unknown until the type is checked
    void tx.payload.ReqAmt;

    if (tx.type === 8) {
        const reqAmt: string = tx.payload.ReqAmt;
        void reqAmt;
    }

    // @ts-expect-error the chain defines no type 9, so this never matches
    if (tx.type === 9) {
        void tx;
    }

    switch (tx.type) {
        case 1:
        case 2: {
            const none: undefined = tx.payload;
            return none;
        }
        case 3:
            return tx.payload.txhash;
        case 4:
            return tx.payload.applyHeight;
        case 5:
            return tx.payload.choice;
        case 6:
            return tx.payload.Data;
        case 7:
            return tx.payload.url;
        case 8:
            return tx.payload.ReqAmt;
        default: {
            // Every type is handled: adding a ninth member makes this fail.
            const exhaustive: never = tx;
            return exhaustive;
        }
    }
}

// @ts-expect-error SignTransactionFunction was removed; it described a signer that does not exist
export type { SignTransactionFunction } from '../../src';
