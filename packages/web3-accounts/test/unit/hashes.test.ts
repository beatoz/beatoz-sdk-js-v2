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
import { BytesUint8Array } from '@beatoz/web3-types';
import {
    PrvKey,
    PubKey,
    TrxProtoBuilder,
    getContractAddress,
    privateKeyToAccount,
} from '../../src';

// The hashes come from ethereum-cryptography so that the package builds for a
// browser (#218). These check them against Node's crypto, which 1.x used.
const node = (alg: string, b: Uint8Array) => new Uint8Array(createHash(alg).update(b).digest());

describe('hashes match Node crypto', () => {
    const keys = Array.from({ length: 20 }, () => new PrvKey());
    const msg = new TextEncoder().encode('message');

    it('makes valid new keys, each different', () => {
        const hex = new Set(keys.map((k) => k.exportKey().toHex()));
        expect(hex.size).toBe(keys.length);
        for (const k of keys) {
            expect(secp256k1.privateKeyVerify(k.exportKey())).toBe(true);
        }
    });

    it('signs and verifies over sha256 of the message', () => {
        for (const k of keys) {
            const pub = new PubKey(k);
            const { signature } = k.sign(msg);
            expect(secp256k1.ecdsaVerify(signature, node('sha256', msg), pub.compressed)).toBe(
                true,
            );
            expect(pub.verify(signature, msg)).toBe(true);
        }
    });

    it('shaAddress and btcAddress', () => {
        for (const k of keys) {
            const pub = new PubKey(k);
            const point = new Uint8Array([...pub.x, ...pub.y]);
            expect(new Uint8Array(pub.shaAddress())).toEqual(node('sha256', point).subarray(12));
            expect(new Uint8Array(pub.btcAddress())).toEqual(
                node('ripemd160', node('sha256', pub.compressed)),
            );
        }
    });

    it('transaction hash in signTransaction and decodeTransaction', () => {
        const account = privateKeyToAccount(keys[0].exportKey().toHex());
        const tx = TrxProtoBuilder.buildTransferTrxProto({
            from: account.address,
            to: account.address,
            nonce: 1,
            gas: 1000000,
            gasPrice: '250000000000',
            amount: '10',
        });
        const { rawTransaction, transactionHash } = account.signTransaction(tx, '0x1234');
        const raw = BytesUint8Array.b64ToBytes(rawTransaction);
        expect(transactionHash).toBe(new BytesUint8Array(node('sha256', raw)).toHex());
        expect(TrxProtoBuilder.decodeTransaction(raw).hash).toBe(transactionHash);
    });
});

// A browser has no Buffer (#220): signing gives the same bytes without it.
describe('signing without the Buffer global', () => {
    const buffer = globalThis.Buffer;
    const key = new PrvKey().exportKey().toHex();
    const tx = () =>
        TrxProtoBuilder.buildTransferTrxProto({
            from: privateKeyToAccount(key).address,
            to: '15633e505d01691a71f40049e15ba1340c0eea29',
            time: new Date('2026-11-21T00:00:00Z'),
            nonce: 3,
            gas: 1000000,
            gasPrice: '250000000000',
            amount: '1000000000000000000',
        });
    const withBuffer = (['v0', 'v1'] as const).map((scheme) =>
        privateKeyToAccount(key).signTransaction(tx(), '0x1234', { scheme }),
    );
    const payerKey = new PrvKey().exportKey().toHex();
    const signedTx = () => {
        const t = tx();
        TrxProtoBuilder.signTrxProto(t, privateKeyToAccount(key), '0x1234');
        return t;
    };
    const payerWithBuffer = privateKeyToAccount(payerKey).signTransactionAsPayer(
        signedTx(),
        '0x1234',
    );
    const contract = getContractAddress(privateKeyToAccount(key).address, 7);

    beforeAll(() => {
        (globalThis as { Buffer?: unknown }).Buffer = undefined;
    });
    afterAll(() => {
        globalThis.Buffer = buffer;
    });

    it('signs as sender, with v0 and v1', () => {
        (['v0', 'v1'] as const).forEach((scheme, i) =>
            expect(privateKeyToAccount(key).signTransaction(tx(), '0x1234', { scheme })).toEqual(
                withBuffer[i],
            ),
        );
    });

    it('signs as payer', () => {
        expect(privateKeyToAccount(payerKey).signTransactionAsPayer(signedTx(), '0x1234')).toEqual(
            payerWithBuffer,
        );
    });

    it('computes a contract address', () => {
        expect(getContractAddress(privateKeyToAccount(key).address, 7)).toBe(contract);
    });
});
