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

import { keccak256 } from 'ethereum-cryptography/keccak.js';
import { BytesUint8Array } from '@beatoz/web3-types';
import { createHash, randomBytes } from 'crypto';
import secp256k1 from 'secp256k1';

// The builder input. `type`, `hash` and `sig` are not in it: each builder
// sets its own type, and the hash and signature come from signing.
interface TransactionFields {
    version?: number;
    time?: Date;
    nonce?: number;
    from: string;
    to: string;
    amount: string;
    gas: number;
    gasPrice: string;
}

/**
 * The input to a transaction builder. `T` is the payload the builder's
 * transaction type carries; transfer and staking carry none, and leave it out.
 * A payload that admits `undefined` is optional; any other is required.
 */
export type Transaction<T = undefined> = TransactionFields & PayloadField<T>;

/**
 * The input to the setDoc builder. A setDoc moves no value: beatoz-go neither
 * rejects nor moves its Amount, it only counts it against the sender's
 * balance. So there is no `amount` to give, and the transaction always carries
 * an empty one.
 */
export type TransactionWithoutAmount<T> = Omit<TransactionFields, 'amount'> & {
    amount?: undefined;
} & PayloadField<T>;

type PayloadField<T> = undefined extends T ? { payload?: T } : { payload: T };

// Payload inputs take the values a caller already holds - numbers, hashes as
// the hex the node returns, text - and the builders convert them to the
// protobuf types, which stay out of the public inputs.

export interface TransactionPayloadUnDelegating {
    /** Hash of the staking transaction, as hex. */
    txHash: string;
}

export interface TransactionPayloadSetDoc {
    name: string;
    url: string;
}

export interface TransactionPayloadContract {
    /** Contract creation code or call data, as hex. */
    data: string;
}

export interface TransactionPayloadWithdraw {
    /**
     * How much of the account's accumulated reward to withdraw, in the
     * smallest unit, as a decimal string. `reward(addr).value.cumulated` is
     * the most the chain will accept.
     */
    reqAmt: string;
}

interface DecodedTransactionFields {
    /** SHA-256 of the encoded transaction, as hex. */
    hash: string;
    version: number;
    time: Date;
    nonce: number;
    from: string;
    to: string;
    /** Decimal string. */
    amount: string;
    gas: number;
    /** Decimal string. */
    gasPrice: string;
    sig: string;
    /** The account paying the fee, present only when one does. */
    payer?: string;
    payerSig?: string;
}

// The payloads decodeTransaction returns. Where a builder exists, the shape is
// its input, so a decoded payload builds the same transaction again. Proposal
// and voting have no builder (only validators send them, with the wallet);
// their bytes are hex, as everywhere else.

export interface DecodedPayloadUnstaking {
    /** Hash of the staking transaction, as hex. */
    txHash: string;
}

export interface DecodedPayloadProposal {
    message: string;
    startVotingHeight: number;
    votingBlocks: number;
    applyingHeight: number;
    optType: number;
    /** Each option as hex. A governance parameter option is UTF-8 JSON. */
    options: string[];
}

export interface DecodedPayloadVoting {
    /** Hash of the proposal transaction, as hex. */
    txHash: string;
    choice: number;
}

export interface DecodedPayloadContract {
    /** Contract creation code or call data, as hex. */
    data: string;
}

export interface DecodedPayloadSetDoc {
    name: string;
    url: string;
}

export interface DecodedPayloadWithdraw {
    /** Requested amount in the smallest unit, as a decimal string. */
    reqAmt: string;
}

/**
 * A transaction read back from its encoded bytes. `type` is one of the eight
 * types the chain defines, and checking it narrows `payload` to that type's
 * shape.
 */
export type DecodedTransaction = DecodedTransactionFields &
    (
        | { type: 1; payload?: undefined } // transfer
        | { type: 2; payload?: undefined } // staking
        | { type: 3; payload: DecodedPayloadUnstaking }
        | { type: 4; payload: DecodedPayloadProposal }
        | { type: 5; payload: DecodedPayloadVoting }
        | { type: 6; payload: DecodedPayloadContract }
        | { type: 7; payload: DecodedPayloadSetDoc }
        | { type: 8; payload: DecodedPayloadWithdraw }
    );

export class PubKey {
    compressed: BytesUint8Array;
    x: BytesUint8Array;
    y: BytesUint8Array;

    constructor(k: PrvKey) {
        const decompressed = secp256k1.publicKeyCreate(k.exportKey(), false);
        this.x = new BytesUint8Array(decompressed.subarray(1, 33));
        this.y = new BytesUint8Array(decompressed.subarray(33, 65));

        this.compressed = new BytesUint8Array(33);
        if ((this.y[this.y.length - 1] & 1) === 0) {
            this.compressed[0] = 0x02;
        } else {
            this.compressed[0] = 0x03;
        }
        this.compressed.set(this.x, 1);
    }

    toAddress(): BytesUint8Array {
        return this.ethAddress();
    }

    shaAddress(): BytesUint8Array {
        const sha256 = createHash('sha256');
        const decompressed = new BytesUint8Array([...this.x, ...this.y]);
        const hash = sha256.update(decompressed).digest();
        return new BytesUint8Array(hash.subarray(hash.length - 20));
    }

    btcAddress(): BytesUint8Array {
        const sha256 = createHash('sha256');
        const ripemd160 = createHash('ripemd160');
        const hash = sha256.update(this.compressed).digest();
        const addr = ripemd160.update(hash).digest();
        return new BytesUint8Array(addr);
    }

    ethAddress(): BytesUint8Array {
        const decompressed = new BytesUint8Array([...this.x, ...this.y]);
        const pubKeyHash = keccak256(decompressed);
        const addr = pubKeyHash.slice(-20);
        return new BytesUint8Array(addr);
    }

    verify(sig: Uint8Array, msg: Uint8Array): boolean {
        const sha256 = createHash('sha256');
        const hmsg = sha256.update(msg).digest();
        const _sig = sig.subarray(0, 64);

        return secp256k1.ecdsaVerify(_sig, hmsg, this.compressed);
    }

    toHex(): string {
        return this.compressed.toHex();
    }
}

export class PrvKey {
    private d: BytesUint8Array;

    constructor() {
        let rn;
        do {
            rn = randomBytes(32);
        } while (!secp256k1.privateKeyVerify(rn));

        this.d = new BytesUint8Array(rn);
    }

    sign(msg: Uint8Array): { signature: Uint8Array; recid: number } {
        const sha256 = createHash('sha256');
        const hmsg = sha256.update(msg).digest();
        return secp256k1.ecdsaSign(hmsg, this.d);
    }

    exportKey(): BytesUint8Array {
        return this.d;
    }

    static importKey(k: string | ArrayBufferLike | Uint8Array): PrvKey {
        const ret = new PrvKey();
        if (typeof k === 'string') {
            ret.d = BytesUint8Array.fromHex(k);
        } else {
            const bytes = k instanceof Uint8Array ? k : new Uint8Array(k);
            ret.d = new BytesUint8Array(bytes.length);
            ret.d.set(bytes);
        }
        return ret;
    }
}
