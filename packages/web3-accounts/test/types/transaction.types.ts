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

import { DecodedTransaction, Transaction, TrxProtoBuilder } from '../../src';

const base = {
    from: '0x01',
    to: '0x02',
    amount: '0',
    gas: 100000,
    gasPrice: '250000000000',
};

// A setDoc moves no value and takes no amount.
const { amount: _amount, ...noAmount } = base;
void _amount;

export function buildersTakeTheirOwnPayload() {
    TrxProtoBuilder.buildTransferTrxProto(base);
    TrxProtoBuilder.buildDelegateTrxProto(base);
    TrxProtoBuilder.buildUnDelegateTrxProto({ ...base, payload: { txHash: '0x03' } });
    TrxProtoBuilder.buildContractTrxProto({ ...base, payload: { data: '0x6080' } });
    TrxProtoBuilder.buildSetDocTrx({ ...noAmount, payload: { name: 'n', url: 'u' } });
    TrxProtoBuilder.buildWithdrawTrx({ ...base, payload: { reqAmt: '1' } });
}

export function transferAndStakingCarryNoPayload() {
    // @ts-expect-error a transfer has no payload
    TrxProtoBuilder.buildTransferTrxProto({ ...base, payload: { reqAmt: '1' } });
    // @ts-expect-error staking has no payload
    TrxProtoBuilder.buildDelegateTrxProto({ ...base, payload: { txHash: '0x03' } });
}

export function payloadIsRequiredWhereTheTypeCarriesOne() {
    // @ts-expect-error a withdraw needs payload.reqAmt
    TrxProtoBuilder.buildWithdrawTrx(base);
    // @ts-expect-error unstaking needs payload.txHash
    TrxProtoBuilder.buildUnDelegateTrxProto(base);
    // @ts-expect-error a contract transaction needs payload.data
    TrxProtoBuilder.buildContractTrxProto(base);
    // @ts-expect-error setDoc needs a payload
    TrxProtoBuilder.buildSetDocTrx(noAmount);
}

export function anotherTypesPayloadIsRejected() {
    // @ts-expect-error the unstaking payload is not a withdraw payload
    TrxProtoBuilder.buildWithdrawTrx({ ...base, payload: { txHash: '0x03' } });
    // @ts-expect-error the withdraw payload is not an unstaking payload
    TrxProtoBuilder.buildUnDelegateTrxProto({ ...base, payload: { reqAmt: '1' } });
    // @ts-expect-error setDoc took Transaction<object> and accepted any object
    TrxProtoBuilder.buildSetDocTrx({ ...noAmount, payload: { hello: 'world' } });
    // @ts-expect-error reqAmt is a decimal string, not a number
    TrxProtoBuilder.buildWithdrawTrx({ ...base, payload: { reqAmt: 1 } });
}

export function typesThatMoveNoValueTakeNoAmount() {
    // @ts-expect-error a setDoc moves no amount
    TrxProtoBuilder.buildSetDocTrx({ ...base, payload: { name: 'n', url: 'u' } });
}

export function payloadsTakePlainValues() {
    TrxProtoBuilder.buildUnDelegateTrxProto({
        ...base,
        // @ts-expect-error unstaking takes txHash; txhash is gone
        payload: { txhash: '0x03' },
    });
}

export function proposalAndVotingAreNotBuilt() {
    // @ts-expect-error only validators propose, with the wallet; the SDK has no builder
    void TrxProtoBuilder.buildProposalTrx;
    // @ts-expect-error only validators vote, with the wallet; the SDK has no builder
    void TrxProtoBuilder.buildVotingTrx;
}

export function fieldsTheBuildersSetAreNotInputs() {
    // @ts-expect-error each builder sets its own type
    TrxProtoBuilder.buildTransferTrxProto({ ...base, type: 8 });
    // @ts-expect-error the hash comes from the signed transaction
    TrxProtoBuilder.buildTransferTrxProto({ ...base, hash: '0xab' });
    // @ts-expect-error signTrxProto signs
    TrxProtoBuilder.buildTransferTrxProto({ ...base, sig: '0xcd' });
    TrxProtoBuilder.buildTransferTrxProto({ ...base, time: new Date() });
}

export function aWiderTransactionIsRejected(loose: Transaction<object>) {
    // @ts-expect-error `object` was assignable to every payload before
    TrxProtoBuilder.buildWithdrawTrx(loose);
}

export function decodedPayloadsUseTheBuilderNames(tx: DecodedTransaction) {
    if (tx.type === 8) {
        // @ts-expect-error the decoded withdraw amount is reqAmt, as in the builder input
        void tx.payload.ReqAmt;
    }
    if (tx.type === 6) {
        // @ts-expect-error the decoded contract payload is data, as in the builder input
        void tx.payload.Data;
    }
    if (tx.type === 4) {
        // @ts-expect-error the decoded proposal uses the chain's name, applyingHeight
        void tx.payload.applyHeight;
        const options: string[] = tx.payload.options;
        void options;
    }
}

export function decodedPayloadNarrowsOnType(tx: DecodedTransaction) {
    // @ts-expect-error the payload is unknown until the type is checked
    void tx.payload.reqAmt;

    if (tx.type === 8) {
        const reqAmt: string = tx.payload.reqAmt;
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
            return tx.payload.txHash;
        case 4:
            return tx.payload.applyingHeight;
        case 5:
            return tx.payload.choice;
        case 6:
            return tx.payload.data;
        case 7:
            return tx.payload.url;
        case 8:
            return tx.payload.reqAmt;
        default: {
            // Every type is handled: adding a ninth member makes this fail.
            const exhaustive: never = tx;
            return exhaustive;
        }
    }
}

// @ts-expect-error SignTransactionFunction was removed; it described a signer that does not exist
export type { SignTransactionFunction } from '../../src';
