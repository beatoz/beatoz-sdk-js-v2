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
import { privateKeyToAccount, signTransactionAsPayer, TrxProtoBuilder } from '../../src';
import { RlpUtils } from '../../src/tx/trx_rlp';
import { TrxProto } from '@beatoz/web3-types';

// beatoz-go ctrlers/types/signer_v0.go getPreimage: the payer signs the same
// prefixed RLP as the sender, but with the sender's signature in it. The RLP
// never holds the payer fields, so the sender's signature does not cover them.

const sender = privateKeyToAccount(
    '2926cd769094b2755d84b74b9180811adf71d9a1bfacf86f81dbfcfd4b9da163',
);
const payer = privateKeyToAccount(
    '7c6c7a54b23a1a5b28b6e7e0e47c3fdbd0fc4a4a1d6e9b0b51f1f2b0c8a3d951',
);
const chainId = '0xbea701';

const build = (): TrxProto =>
    TrxProtoBuilder.buildTransferTrxProto({
        from: sender.address,
        to: '15633e505d01691a71f40049e15ba1340c0eea29',
        nonce: 1,
        gas: 100000,
        gasPrice: '48000000000',
        amount: '1',
    });

const v0Preimage = (tx: TrxProto): Uint8Array => {
    const rlp = RlpUtils.encodeTrxProto(tx);
    const prefix = `\x19BEATOZ(${chainId}) Signed Message:\n${rlp.length}`;
    return new Uint8Array(Buffer.concat([Buffer.from(prefix), rlp]));
};

describe('signTransactionAsPayer', () => {
    it('signs the transaction with the sender signature in it', () => {
        const tx = build();
        sender.signTransaction(tx, chainId);
        payer.signTransactionAsPayer(tx, chainId);

        expect(Buffer.from(tx.payer)).toEqual(Buffer.from(payer.pubKey.toAddress()));
        expect(tx.payerSig).toHaveLength(65);
        expect(payer.pubKey.verify(tx.payerSig, v0Preimage(tx))).toBe(true);
        // Not over the transaction without the sender's signature.
        expect(payer.pubKey.verify(tx.payerSig, v0Preimage({ ...tx, sig: new Uint8Array() }))).toBe(
            false,
        );
    });

    it('leaves the sender signature valid', () => {
        const tx = build();
        sender.signTransaction(tx, chainId);
        const sig = Buffer.from(tx.sig);
        payer.signTransactionAsPayer(tx, chainId);

        expect(Buffer.from(tx.sig)).toEqual(sig);
        expect(TrxProtoBuilder.verifyTrxProto(tx, sender, chainId)).toBe(true);
    });

    it('returns the transaction with the payer fields encoded', () => {
        const tx = build();
        const signed = sender.signTransaction(tx, chainId);
        const paid = signTransactionAsPayer(tx, payer.privateKey, chainId);

        expect(paid.rawTransaction).not.toBe(signed.rawTransaction);
        expect(paid.transactionHash).not.toBe(signed.transactionHash);
        const decoded = TrxProtoBuilder.decodeTransaction(
            new Uint8Array(Buffer.from(paid.rawTransaction, 'base64')) as never,
        );
        expect(decoded.payer?.toLowerCase()).toContain(
            Buffer.from(payer.pubKey.toAddress()).toString('hex'),
        );
        expect(decoded.payerSig).toBeDefined();
    });

    it('refuses a transaction the sender has not signed', () => {
        expect(() => payer.signTransactionAsPayer(build(), chainId)).toThrow(
            'the transaction must be signed by its sender before its payer signs it',
        );
    });

    it('refuses the sender as its own payer', () => {
        const tx = build();
        sender.signTransaction(tx, chainId);
        expect(() => sender.signTransactionAsPayer(tx, chainId)).toThrow(
            'the payer must not be the sender',
        );
    });

    it('signs the sender over the same bytes when signed again', () => {
        const tx = build();
        sender.signTransaction(tx, chainId);
        const first = Buffer.from(tx.sig);
        sender.signTransaction(tx, chainId);
        expect(Buffer.from(tx.sig)).toEqual(first);
        expect(TrxProtoBuilder.verifyTrxProto(tx, sender, chainId)).toBe(true);
    });
});
