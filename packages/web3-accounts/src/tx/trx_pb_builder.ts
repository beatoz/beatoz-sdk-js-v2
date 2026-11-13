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

import * as trxPb from './trx_pb.js';
import Long from 'long';
import { BytesUint8Array } from '@beatoz/web3-types';
import BN from 'bn.js';
import { fromNanoSecond, getNanoSecond } from '@beatoz/web3-utils';
import { createHash } from 'crypto';
import { TrxProtoUtils } from './trx_pb.js';
import { HexString, TrxProto } from '@beatoz/web3-types';
import {
    DecodedTransaction,
    Transaction,
    TransactionPayloadContract,
    TransactionPayloadProposal,
    TransactionPayloadSetDoc,
    TransactionPayloadUnDelegating,
    TransactionPayloadVoting,
    TransactionPayloadWithdraw,
    TransactionWithoutAmount,
} from './tx_types.js';
import { Web3Account } from '../types.js';
import { RlpUtils } from './trx_rlp.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSet(value: any): boolean {
    return value !== undefined;
}

/**
 * Parses a decimal string as a uint256.
 *
 * Only digits are accepted. bn.js is more lenient than that, and not safely:
 * it reads '' as 0; it turns ' ' into a number with no value, which throws
 * `Cannot read properties of null` when converted to bytes and never returns
 * from toString(); and it reads '-1' as -1, whose bytes drop the sign - a
 * transaction then carries 1. Checking the form first turns each of those
 * into an error that names the field.
 */
function parseUint256(name: string, value: string): BN {
    if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) {
        throw Error(`${name} must be a decimal string of digits, got ${JSON.stringify(value)}`);
    }
    const n = new BN(value, 10);
    if (n.bitLength() > 256) {
        throw Error(`${name} does not fit in 256 bits: ${value}`);
    }
    return n;
}

/**
 * Checks a `gas` or `nonce` value, both int64 on the chain.
 *
 * Long.fromValue takes any number and changes the wrong ones instead of
 * failing: 1.5 becomes 1, NaN becomes 0, and -5 is signed as -5. Numbers past
 * 2^53 are already imprecise before they reach it. Only non-negative safe
 * integers pass, so each of those is an error that names the field.
 */
function parseInt64(name: string, value: number): Long {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw Error(`${name} must be a non-negative safe integer, got ${String(value)}`);
    }
    return Long.fromNumber(value);
}

/**
 * Checks an int32 payload field that is a count or an index, so never
 * negative: beatoz-go refuses a negative choice, and the proposal types it
 * defines are positive.
 */
function parseInt32(name: string, value: number): number {
    if (!Number.isInteger(value) || value < 0 || value > 0x7fffffff) {
        throw Error(`${name} must be a non-negative 32-bit integer, got ${String(value)}`);
    }
    return value;
}

/**
 * Encodes proposal options, given as text, as UTF-8. The chain reads a
 * governance parameter option as JSON.
 */
function parseOptions(options: string[]): Uint8Array[] {
    if (!Array.isArray(options) || !options.every((option) => typeof option === 'string')) {
        throw Error('options must be an array of strings');
    }
    const encoder = new TextEncoder();
    return options.map((option) => encoder.encode(option));
}

const ignoredFields: Record<string, string> = {
    type: 'each builder sets its own',
    hash: 'it is computed from the signed transaction',
    sig: 'sign with signTrxProto',
};

/**
 * Refuses `type`, `hash` or `sig` in a builder input. The input type leaves
 * them out, but a JavaScript caller or a cast can still pass them, and the
 * builders never read them: `type: 8` on a transfer still built a transfer.
 */
function refuseIgnoredFields(transaction: object): void {
    for (const [field, reason] of Object.entries(ignoredFields)) {
        if ((transaction as Record<string, unknown>)[field] !== undefined) {
            throw Error(`${field} is not a builder input; ${reason}`);
        }
    }
}

/**
 * Refuses a non-zero `amount` on a transaction type that moves no value.
 *
 * The input types leave `amount` out for these, but a JavaScript caller or a
 * cast can still pass one. beatoz-go would accept it and move nothing, so it
 * would be dropped without a word; zero is the only value that means what it
 * says.
 */
function refuseAmount(kind: string, amount: unknown): void {
    if (amount !== undefined && !parseUint256('amount', amount as string).isZero()) {
        throw Error(`${kind} moves no amount; leave amount out`);
    }
}

/**
 * Reads an address as hex and checks that it is 20 bytes.
 *
 * fromHex only checks the form, so an address with two digits dropped is read
 * as 19 bytes and signed; beatoz-go's Trx.Validate then rejects it as
 * ErrInvalidAddress. The node lets a contract transaction leave `to` empty to
 * create a contract, so `allowEmpty` does too.
 */
function parseAddress(name: string, hex: string, allowEmpty = false): BytesUint8Array {
    const bytes = BytesUint8Array.fromHex(hex);
    if (bytes.length !== 20 && !(allowEmpty && bytes.length === 0)) {
        throw Error(`${name} must be 20 bytes, got ${bytes.length}: ${JSON.stringify(hex)}`);
    }
    return bytes;
}

/**
 * Encodes a uint256 the way beatoz-go's uint256.Int.Bytes() does: minimal
 * big-endian, and no bytes at all for zero.
 *
 * The node verifies a signature by decoding the transaction and encoding it
 * again with Bytes(), so any other form of the same number - a leading zero
 * byte, or [0x00] for zero - changes the signed preimage and the node rejects
 * the transaction as `invalid signature`.
 */
function toUint256Bytes(n: BN): Uint8Array {
    return n.isZero() ? new Uint8Array() : new Uint8Array(n.toArrayLike(Buffer));
}

function decodeTransaction(d: BytesUint8Array): DecodedTransaction {
    const tx = trxPb.TrxProtoUtils.decode(d);

    const sha256 = createHash('sha256');
    const hash = sha256.update(d).digest();

    const fields = {
        hash: hash.toString('hex'),
        version: tx.version,
        time: fromNanoSecond(tx.time),
        nonce: tx.nonce.toNumber(),
        from: new BytesUint8Array(tx.from).toHex(),
        to: new BytesUint8Array(tx.to).toHex(),
        amount: new BN(tx.Amount).toString(10),
        gas: tx.gas.toNumber(),
        gasPrice: new BN(tx.GasPrice).toString(10),
    };
    // Kept after type and payload, where callers have always found it.
    const sig = new BytesUint8Array(tx.sig).toHex();

    switch (tx.type) {
        case 1: // transfer
        case 2: // staking
            return { ...fields, type: tx.type, payload: undefined, sig };
        case 3: {
            // unstaking
            const unstakingPayload: trxPb.TrxPayloadUnstakingProto =
                trxPb.TrxPayloadUnstakingProto.decode(tx.Payload);
            return {
                ...fields,
                type: tx.type,
                payload: {
                    txHash: new BytesUint8Array(unstakingPayload.txHash).toHex(),
                },
                sig,
            };
        }
        case 4: {
            // proposal
            const proposalPayload: trxPb.TrxPayloadProposalProto =
                trxPb.TrxPayloadProposalProto.decode(tx.Payload);
            return {
                ...fields,
                type: tx.type,
                payload: {
                    message: proposalPayload.message,
                    startVotingHeight: proposalPayload.startVotingHeight.toNumber(),
                    votingBlocks: proposalPayload.votingBlocks.toNumber(),
                    applyHeight: proposalPayload.applyingHeight.toNumber(),
                    optType: proposalPayload.optType,
                    options: proposalPayload.options,
                },
                sig,
            };
        }
        case 5: {
            // voting
            const votingPayload: trxPb.TrxPayloadVotingProto = trxPb.TrxPayloadVotingProto.decode(
                tx.Payload,
            );
            return {
                ...fields,
                type: tx.type,
                payload: {
                    txHash: new BytesUint8Array(votingPayload.txHash).toHex(),
                    choice: votingPayload.choice,
                },
                sig,
            };
        }
        case 6: {
            // contract
            const contractPayload: trxPb.TrxPayloadContractProto =
                trxPb.TrxPayloadContractProto.decode(tx.Payload);
            return {
                ...fields,
                type: tx.type,
                payload: {
                    Data: new BytesUint8Array(contractPayload.Data).toHex(),
                },
                sig,
            };
        }
        case 7: {
            // setDoc
            const setDocPayload: trxPb.TrxPayloadSetDocProto = trxPb.TrxPayloadSetDocProto.decode(
                tx.Payload,
            );
            return {
                ...fields,
                type: tx.type,
                payload: {
                    name: setDocPayload.name,
                    url: setDocPayload.url,
                },
                sig,
            };
        }
        case 8: {
            // withdraw
            const withdrawPayload: trxPb.TrxPayloadWithdrawProto =
                trxPb.TrxPayloadWithdrawProto.decode(tx.Payload);
            return {
                ...fields,
                type: tx.type,
                payload: {
                    ReqAmt: new BytesUint8Array(withdrawPayload.ReqAmt).toHex(),
                },
                sig,
            };
        }
        default:
            // beatoz-go defines types 1 to 8 and rejects any other as
            // ErrInvalidTrxPayloadType, so such bytes are not a transaction.
            throw Error(`unknown transaction type ${tx.type}; the chain accepts types 1 to 8`);
    }
}

function buildTransferTrxProto(transaction: Transaction): TrxProto {
    refuseIgnoredFields(transaction);
    return {
        version: isSet(transaction.version) ? Number(transaction.version) : 1,
        time: isSet(transaction.time) ? getNanoSecond(transaction.time) : getNanoSecond(),
        nonce: parseInt64('nonce', transaction.nonce ?? 0),
        from: parseAddress('from', transaction.from),
        to: parseAddress('to', transaction.to),
        // proto3 default rule: If the field has default value, the filed should be omitted.
        Amount: toUint256Bytes(parseUint256('amount', transaction.amount)),
        gas: parseInt64('gas', transaction.gas),
        GasPrice: toUint256Bytes(parseUint256('gasPrice', transaction.gasPrice)),
        type: 1, // transfer type
        Payload: new Uint8Array(),
        sig: new Uint8Array(),
        // Fee delegation is not built by this SDK yet; the chain treats
        // empty payer fields as "sender pays", and proto3 omits them from
        // the wire, so the encoded bytes are unchanged.
        payer: new Uint8Array(),
        payerSig: new Uint8Array(),
    };
}

function buildDelegateTrxProto(transaction: Transaction): TrxProto {
    refuseIgnoredFields(transaction);
    return {
        version: isSet(transaction.version) ? Number(transaction.version) : 1,
        time: isSet(transaction.time) ? getNanoSecond(transaction.time) : getNanoSecond(),
        nonce: parseInt64('nonce', transaction.nonce ?? 0),
        from: parseAddress('from', transaction.from),
        to: parseAddress('to', transaction.to),
        Amount: toUint256Bytes(parseUint256('amount', transaction.amount)),
        gas: parseInt64('gas', transaction.gas),
        GasPrice: toUint256Bytes(parseUint256('gasPrice', transaction.gasPrice)),
        type: 2, // staking type
        Payload: new Uint8Array(),
        sig: new Uint8Array(),
        // Fee delegation is not built by this SDK yet; the chain treats
        // empty payer fields as "sender pays", and proto3 omits them from
        // the wire, so the encoded bytes are unchanged.
        payer: new Uint8Array(),
        payerSig: new Uint8Array(),
    };
}

function buildUnDelegateTrxProto(
    transaction: Transaction<TransactionPayloadUnDelegating>,
): TrxProto {
    refuseIgnoredFields(transaction);
    const payload = transaction.payload;
    if (!isSet(payload) || !isSet(payload.txHash)) {
        throw Error('mandatory argument is missed');
    }

    const payloadBytes = trxPb.TrxPayloadUnstakingProto.encode({
        txHash: BytesUint8Array.fromHex(payload.txHash),
    }).finish();

    return {
        version: isSet(transaction.version) ? Number(transaction.version) : 1,
        time: isSet(transaction.time) ? getNanoSecond(transaction.time) : getNanoSecond(),
        nonce: parseInt64('nonce', transaction.nonce ?? 0),
        from: parseAddress('from', transaction.from),
        to: parseAddress('to', transaction.to),
        Amount: toUint256Bytes(parseUint256('amount', transaction.amount)),
        gas: parseInt64('gas', transaction.gas),
        GasPrice: toUint256Bytes(parseUint256('gasPrice', transaction.gasPrice)),
        type: 3, // unstaking type
        Payload: payloadBytes,
        sig: new Uint8Array(),
        // Fee delegation is not built by this SDK yet; the chain treats
        // empty payer fields as "sender pays", and proto3 omits them from
        // the wire, so the encoded bytes are unchanged.
        payer: new Uint8Array(),
        payerSig: new Uint8Array(),
    };
}

function buildProposalTrx(
    transaction: TransactionWithoutAmount<TransactionPayloadProposal>,
): TrxProto {
    refuseIgnoredFields(transaction);
    refuseAmount('a proposal', transaction.amount);
    const payload = transaction.payload;
    if (!isSet(payload)) {
        throw Error('mandatory argument is missed');
    }
    const payloadBytes = trxPb.TrxPayloadProposalProto.encode({
        message: payload.message,
        startVotingHeight: parseInt64('startVotingHeight', payload.startVotingHeight),
        votingBlocks: parseInt64('votingBlocks', payload.votingBlocks),
        applyingHeight: parseInt64('applyingHeight', payload.applyingHeight),
        optType: parseInt32('optType', payload.optType),
        options: parseOptions(payload.options),
    }).finish();

    return {
        version: isSet(transaction.version) ? Number(transaction.version) : 1,
        time: isSet(transaction.time) ? getNanoSecond(transaction.time) : getNanoSecond(),
        nonce: parseInt64('nonce', transaction.nonce ?? 0),
        from: parseAddress('from', transaction.from),
        to: parseAddress('to', transaction.to),
        Amount: new Uint8Array(),
        gas: parseInt64('gas', transaction.gas),
        GasPrice: toUint256Bytes(parseUint256('gasPrice', transaction.gasPrice)),
        type: 4, // proposal type
        Payload: payloadBytes,
        sig: new Uint8Array(),
        // Fee delegation is not built by this SDK yet; the chain treats
        // empty payer fields as "sender pays", and proto3 omits them from
        // the wire, so the encoded bytes are unchanged.
        payer: new Uint8Array(),
        payerSig: new Uint8Array(),
    };
}

function buildVotingTrx(transaction: TransactionWithoutAmount<TransactionPayloadVoting>): TrxProto {
    refuseIgnoredFields(transaction);
    refuseAmount('a vote', transaction.amount);
    const payload = transaction.payload;
    if (!isSet(payload)) {
        throw Error('mandatory argument is missed');
    }
    const payloadBytes = trxPb.TrxPayloadVotingProto.encode({
        txHash: BytesUint8Array.fromHex(payload.txHash),
        choice: parseInt32('choice', payload.choice),
    }).finish();

    return {
        version: isSet(transaction.version) ? Number(transaction.version) : 1,
        time: isSet(transaction.time) ? getNanoSecond(transaction.time) : getNanoSecond(),
        nonce: parseInt64('nonce', transaction.nonce ?? 0),
        from: parseAddress('from', transaction.from),
        to: parseAddress('to', transaction.to),
        Amount: new Uint8Array(),
        gas: parseInt64('gas', transaction.gas),
        GasPrice: toUint256Bytes(parseUint256('gasPrice', transaction.gasPrice)),
        type: 5, // voting type
        Payload: payloadBytes,
        sig: new Uint8Array(),
        // Fee delegation is not built by this SDK yet; the chain treats
        // empty payer fields as "sender pays", and proto3 omits them from
        // the wire, so the encoded bytes are unchanged.
        payer: new Uint8Array(),
        payerSig: new Uint8Array(),
    };
}

function buildContractTrxProto(transaction: Transaction<TransactionPayloadContract>): TrxProto {
    refuseIgnoredFields(transaction);
    const payload = transaction.payload;
    if (!isSet(payload) || !isSet(payload.data)) {
        throw Error('mandatory argument is missed');
    }
    const payloadBytes = trxPb.TrxPayloadContractProto.encode({
        Data: BytesUint8Array.fromHex(payload.data),
    }).finish();

    return {
        version: isSet(transaction.version) ? Number(transaction.version) : 1,
        time: isSet(transaction.time) ? getNanoSecond(transaction.time) : getNanoSecond(),
        nonce: parseInt64('nonce', transaction.nonce ?? 0),
        from: parseAddress('from', transaction.from),
        to: parseAddress('to', transaction.to, true),
        Amount: toUint256Bytes(parseUint256('amount', transaction.amount)),
        gas: parseInt64('gas', transaction.gas),
        GasPrice: toUint256Bytes(parseUint256('gasPrice', transaction.gasPrice)),
        type: 6, // contract type
        Payload: payloadBytes,
        sig: new Uint8Array(),
        // Fee delegation is not built by this SDK yet; the chain treats
        // empty payer fields as "sender pays", and proto3 omits them from
        // the wire, so the encoded bytes are unchanged.
        payer: new Uint8Array(),
        payerSig: new Uint8Array(),
    };
}

/**
 * Builds a transaction that moves part of the sender's accumulated staking
 * reward into its balance. The chain requires `amount` to be zero - the value
 * goes in `payload.reqAmt`, which must be above zero - and rejects a request
 * above the reward the sender has accumulated as `insufficient reward`.
 */
function buildWithdrawTrx(transaction: Transaction<TransactionPayloadWithdraw>): TrxProto {
    refuseIgnoredFields(transaction);
    const payload = transaction.payload;
    if (!isSet(payload) || !isSet(payload.reqAmt)) {
        throw Error('mandatory argument is missed');
    }
    const reqAmt = parseUint256('payload.reqAmt', payload.reqAmt);
    // The chain accepts a zero request, but it moves nothing and still costs
    // the fee - typically a ledger read as 0 and passed straight through.
    if (reqAmt.isZero()) {
        throw Error('payload.reqAmt must be greater than 0; withdrawing 0 only pays the fee');
    }
    if (!parseUint256('amount', transaction.amount).isZero()) {
        throw Error('a withdraw moves no amount; put the value in payload.reqAmt');
    }
    const payloadBytes = trxPb.TrxPayloadWithdrawProto.encode({
        ReqAmt: toUint256Bytes(reqAmt),
    }).finish();

    return {
        version: isSet(transaction.version) ? Number(transaction.version) : 1,
        time: isSet(transaction.time) ? getNanoSecond(transaction.time) : getNanoSecond(),
        nonce: parseInt64('nonce', transaction.nonce ?? 0),
        from: parseAddress('from', transaction.from),
        to: parseAddress('to', transaction.to),
        Amount: new Uint8Array(),
        gas: parseInt64('gas', transaction.gas),
        GasPrice: toUint256Bytes(parseUint256('gasPrice', transaction.gasPrice)),
        type: 8, // withdraw type
        Payload: payloadBytes,
        sig: new Uint8Array(),
        // Fee delegation is not built by this SDK yet; the chain treats
        // empty payer fields as "sender pays", and proto3 omits them from
        // the wire, so the encoded bytes are unchanged.
        payer: new Uint8Array(),
        payerSig: new Uint8Array(),
    };
}

function buildSetDocTrx(transaction: TransactionWithoutAmount<TransactionPayloadSetDoc>): TrxProto {
    refuseIgnoredFields(transaction);
    refuseAmount('a setDoc', transaction.amount);
    const payload = transaction.payload;
    if (!isSet(payload)) {
        throw Error('mandatory argument is missed');
    }
    const payloadBytes = trxPb.TrxPayloadSetDocProto.encode({
        name: payload.name,
        url: payload.url,
    }).finish();

    return {
        version: isSet(transaction.version) ? Number(transaction.version) : 1,
        time: isSet(transaction.time) ? getNanoSecond(transaction.time) : getNanoSecond(),
        nonce: parseInt64('nonce', transaction.nonce ?? 0),
        from: parseAddress('from', transaction.from),
        to: parseAddress('to', transaction.to),
        Amount: new Uint8Array(),
        gas: parseInt64('gas', transaction.gas),
        GasPrice: toUint256Bytes(parseUint256('gasPrice', transaction.gasPrice)),
        type: 7, // voting type
        Payload: payloadBytes,
        sig: new Uint8Array(),
        // Fee delegation is not built by this SDK yet; the chain treats
        // empty payer fields as "sender pays", and proto3 omits them from
        // the wire, so the encoded bytes are unchanged.
        payer: new Uint8Array(),
        payerSig: new Uint8Array(),
    };
}

function signTrxProto(
    trxProto: TrxProto,
    account: Web3Account,
    chainId: string,
): [BytesUint8Array, BytesUint8Array] {
    trxProto.sig = new Uint8Array();
    const encodedData = RlpUtils.encodeTrxProto(trxProto);
    const prefix = `\x19BEATOZ(${chainId}) Signed Message:\n${encodedData.length}`;
    const prefixedData = Buffer.concat([Buffer.from(prefix), encodedData]);
    trxProto.sig = account.sign(new Uint8Array(prefixedData));
    return [
        new BytesUint8Array(trxProto.sig),
        new BytesUint8Array(TrxProtoUtils.encode(trxProto).finish()),
    ];
}

function signedRawTrxProto(trxProto: TrxProto, account: Web3Account): HexString {
    const encodedData = RlpUtils.encodeTrxProto(trxProto);

    const chainId = 'localnet0';
    const prefix = `\x19BEATOZ(${chainId}) Signed Message:\n${encodedData.length}`;

    const prefixedData = Buffer.concat([Buffer.from(prefix), encodedData]);

    trxProto.sig = account.sign(new Uint8Array(prefixedData));

    const signedTxByte = new BytesUint8Array(TrxProtoUtils.encode(trxProto).finish());

    return Buffer.from(signedTxByte).toString('base64');
}

function verifyTrxProto(trxProto: TrxProto, account: Web3Account, chainId: string): boolean {
    const oriSig = trxProto.sig;
    trxProto.sig = new Uint8Array();

    const encodedData = RlpUtils.encodeTrxProto(trxProto);
    const prefix = `\x19BEATOZ(${chainId}) Signed Message:\n${encodedData.length}`;

    const prefixedData = Buffer.concat([Buffer.from(prefix), encodedData]);
    const ret = account.pubKey.verify(oriSig, prefixedData);
    trxProto.sig = oriSig;
    return ret;
}

export const TrxProtoBuilder = {
    decodeTransaction,
    buildTransferTrxProto,
    buildDelegateTrxProto,
    buildUnDelegateTrxProto,
    verifyTrxProto,
    signTrxProto,
    buildContractTrxProto,
    buildProposalTrx,
    buildVotingTrx,
    signedRawTrxProto,
    buildSetDocTrx,
    buildWithdrawTrx,
};
