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

import { InvalidInputError } from '@beatoz/web3-errors';
import { Web3Account, SignTransactionResult } from './types.js';
import { PrvKey, PubKey } from './tx/tx_types.js';
import { HexString, TrxProto, BytesUint8Array } from '@beatoz/web3-types';
import { TrxProtoUtils } from './tx/trx_pb.js';
import { RlpUtils } from './tx/trx_rlp.js';
import { createHash } from 'crypto';

export const create = (): Web3Account => {
    const prvKey = new PrvKey();
    return prvKeyToAccount(prvKey);
};

export const privateKeyToAccount = (
    privateKey: HexString | ArrayBufferLike | Uint8Array,
): Web3Account => {
    const prvKey = PrvKey.importKey(privateKey);
    return prvKeyToAccount(prvKey);
};

export const privateKeyToPrvKey = (
    privateKey: HexString | ArrayBufferLike | Uint8Array,
): PrvKey => {
    return PrvKey.importKey(privateKey);
};

export const prvKeyToAccount = (prvKey: PrvKey): Web3Account => {
    const pubKey = new PubKey(prvKey);

    return {
        address: pubKey.toAddress().toHex(),
        prvKey: prvKey,
        pubKey: pubKey,
        privateKey: prvKey.exportKey().toHex(),
        sign: (msg: Uint8Array) => sign(msg, prvKey.exportKey().toHex()),
        signTransaction: (trxProto: TrxProto, chainId) =>
            signTransaction(trxProto, prvKey.exportKey().toHex(), chainId),
        signTransactionAsPayer: (trxProto: TrxProto, chainId: string) =>
            signTransactionAsPayer(trxProto, prvKey.exportKey().toHex(), chainId),
    };
};

export const sign = (
    msg: Uint8Array,
    privateKey: HexString | ArrayBufferLike | Uint8Array,
): BytesUint8Array => {
    const signObj = privateKeyToPrvKey(privateKey).sign(msg);
    return new BytesUint8Array([...signObj.signature, signObj.recid & 0xff]);
};

export const signTransaction = (
    trxProto: TrxProto,
    privateKey: HexString,
    chainId: string,
): SignTransactionResult => {
    // The node leaves the sender's own signature out of what it signs, so a
    // transaction signed before is signed again over the same bytes.
    trxProto.sig = new Uint8Array();
    trxProto.sig = sign(preimage(trxProto, chainId), privateKey);
    return signedResult(trxProto);
};

/**
 * Adds the fee payer's signature to a transaction its sender has signed:
 * sets `payer` to the payer's address and `payerSig`, and the chain charges
 * the fee to the payer instead of the sender. The sender's signature does
 * not cover the payer, so the payer can be added after the sender signs.
 *
 * The payer signs the sender's signature too (beatoz-go
 * `ctrlers/types/signer_v0.go` `getPreimage`), so signing the transaction
 * again as the sender afterwards invalidates this signature.
 */
export const signTransactionAsPayer = (
    trxProto: TrxProto,
    privateKey: HexString,
    chainId: string,
): SignTransactionResult => {
    if (trxProto.sig.length !== 65) {
        throw new InvalidInputError(
            'the transaction must be signed by its sender before its payer signs it',
        );
    }
    const payer = new PubKey(privateKeyToPrvKey(privateKey)).toAddress();
    if (Buffer.compare(payer, trxProto.from) === 0) {
        throw new InvalidInputError(
            'the payer must not be the sender; a sender pays its own fee without a payer',
        );
    }
    trxProto.payer = new Uint8Array(payer);
    trxProto.payerSig = sign(preimage(trxProto, chainId), privateKey);
    return signedResult(trxProto);
};

// The node's v0 preimage (beatoz-go ctrlers/types/signer_v0.go): a text
// prefix and the RLP of the transaction, which leaves out the payer fields.
// The sender signs with sig empty, the payer with the sender's sig in it.
function preimage(trxProto: TrxProto, chainId: string): BytesUint8Array {
    const encodedData = RlpUtils.encodeTrxProto(trxProto);
    const prefix = `\x19BEATOZ(${chainId}) Signed Message:\n${encodedData.length}`;
    return new BytesUint8Array(Buffer.concat([Buffer.from(prefix), encodedData]));
}

function signedResult(trxProto: TrxProto): SignTransactionResult {
    const rawTransaction = Buffer.from(TrxProtoUtils.encode(trxProto).finish());
    const transactionHash = createHash('sha256').update(rawTransaction).digest();
    return {
        rawTransaction: rawTransaction.toString('base64'),
        transactionHash: transactionHash.toString('hex'),
    };
}
