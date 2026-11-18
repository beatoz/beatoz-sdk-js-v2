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
import { createHash } from 'crypto';
import * as secp256k1 from 'ethereum-cryptography/secp256k1-compat.js';
import { InvalidInputError } from '@beatoz/web3-errors';
import { privateKeyToAccount, TrxProtoBuilder, Web3Account } from '../../src';
import { RlpUtils } from '../../src/tx/trx_rlp';

// The node takes two signature schemes and picks one by the signature's last
// byte (beatoz-go ctrlers/types/signer.go): v0 signs a text prefix and the RLP
// (v = 0/1), v1 the RLP followed by the chain id's bytes (v = 27/28,
// signer_v1.go getPreimage). Both hash with sha256.

const sender = privateKeyToAccount('11'.repeat(32)) as Web3Account;
const payer = privateKeyToAccount('22'.repeat(32)) as Web3Account;
const chainId = '0x1234';

const build = () =>
    TrxProtoBuilder.buildTransferTrxProto({
        from: sender.address,
        to: payer.address,
        time: new Date('2026-11-18T00:00:00Z'),
        nonce: 3,
        gas: 5000,
        gasPrice: '1',
        amount: '10',
    });

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest();
const v1Preimage = (tx: ReturnType<typeof build>, chainIdBytes: string) =>
    Buffer.concat([RlpUtils.encodeTrxProto(tx), Buffer.from(chainIdBytes, 'hex')]);
const signedBy = (sig: Uint8Array, preimage: Uint8Array, account: Web3Account) => {
    const recovered = secp256k1.ecdsaRecover(
        sig.subarray(0, 64),
        sig[64] - 27,
        sha256(preimage),
        true,
    );
    return Buffer.from(recovered).equals(Buffer.from(account.pubKey.toHex(), 'hex'));
};

describe('signing schemes', () => {
    it('signs v0 by default, with v = 0 or 1', () => {
        const tx = build();
        sender.signTransaction(tx, chainId);
        expect([0, 1]).toContain(tx.sig[64]);
    });

    it('signs v1 over the RLP and the chain id bytes, with v = 27 or 28', () => {
        const tx = build();
        sender.signTransaction(tx, chainId, { scheme: 'v1' });

        expect([27, 28]).toContain(tx.sig[64]);
        const unsigned = { ...tx, sig: new Uint8Array() };
        expect(signedBy(tx.sig, v1Preimage(unsigned, '1234'), sender)).toBe(true);
        // The text prefix of v0 is not in it.
        expect(signedBy(tx.sig, v1Preimage(unsigned, ''), sender)).toBe(false);
    });

    it('reads the chain id as the node does: hex with 0x, decimal without', () => {
        const hex = build();
        const dec = build();
        sender.signTransaction(hex, '0x1234', { scheme: 'v1' });
        sender.signTransaction(dec, '4660', { scheme: 'v1' });
        expect(Buffer.from(dec.sig)).toEqual(Buffer.from(hex.sig));

        const odd = build();
        sender.signTransaction(odd, '0xbea701', { scheme: 'v1' });
        expect(
            signedBy(odd.sig, v1Preimage({ ...odd, sig: new Uint8Array() }, 'bea701'), sender),
        ).toBe(true);
    });

    it('signs the payer v1 over the transaction with the sender signature in it', () => {
        const tx = build();
        sender.signTransaction(tx, chainId);
        payer.signTransactionAsPayer(tx, chainId, { scheme: 'v1' });

        expect([0, 1]).toContain(tx.sig[64]);
        expect([27, 28]).toContain(tx.payerSig[64]);
        const forPayer = { ...tx, payer: new Uint8Array(), payerSig: new Uint8Array() };
        expect(signedBy(tx.payerSig, v1Preimage(forPayer, '1234'), payer)).toBe(true);
    });

    it('verifyTrxProto checks each scheme by the signature it finds', () => {
        for (const scheme of ['v0', 'v1'] as const) {
            const tx = build();
            TrxProtoBuilder.signTrxProto(tx, sender, chainId, { scheme });
            expect(TrxProtoBuilder.verifyTrxProto(tx, sender, chainId)).toBe(true);
            expect(TrxProtoBuilder.verifyTrxProto(tx, sender, '0x9999')).toBe(false);
            expect(TrxProtoBuilder.verifyTrxProto(tx, payer, chainId)).toBe(false);
        }
        const tx = build();
        TrxProtoBuilder.signTrxProto(tx, sender, chainId);
        tx.sig[64] = 5;
        expect(TrxProtoBuilder.verifyTrxProto(tx, sender, chainId)).toBe(false);
    });

    it('signTrxProto and signTransaction give the same v1 signature', () => {
        const a = build();
        const b = build();
        TrxProtoBuilder.signTrxProto(a, sender, chainId, { scheme: 'v1' });
        sender.signTransaction(b, chainId, { scheme: 'v1' });
        expect(Buffer.from(a.sig)).toEqual(Buffer.from(b.sig));
    });

    it('refuses an unknown scheme and a chain id v1 cannot read', () => {
        expect(() => sender.signTransaction(build(), chainId, { scheme: 'v2' as never })).toThrow(
            InvalidInputError,
        );
        expect(() => sender.signTransaction(build(), 'testnet', { scheme: 'v1' })).toThrow(
            InvalidInputError,
        );
    });
});
