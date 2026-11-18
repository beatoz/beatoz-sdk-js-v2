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
import { TrxProtoBuilder } from '../../src';
import { RlpUtils } from '../../src/tx/trx_rlp';

// The bytes a transaction is signed over. The node builds the same RLP
// (beatoz-go ctrlers/types/trx.go EncodeRLP: every integer a uint64, go-ethereum
// rlp) and verifies the signature against it, so a single differing byte makes
// the node refuse the transaction.

const FROM = '15633e505d01691a71f40049e15ba1340c0eea29';
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

describe('RlpUtils.encodeTrxProto', () => {
    it('encodes a transfer as it did with ethereumjs-util', () => {
        const tx = TrxProtoBuilder.buildTransferTrxProto({
            from: FROM,
            to: FROM,
            time: new Date('2026-11-18T00:00:00.123Z'),
            nonce: 1,
            gas: 1,
            gasPrice: '1',
            amount: '128',
        });

        expect(hex(RlpUtils.encodeTrxProto(tx))).toBe(
            'f83c018818e8fa9c295dd4c0019415633e505d01691a71f40049e15ba1340c0eea299415633e505d01691a71f40049e15ba1340c0eea2981800101018080',
        );
    });

    // go-ethereum encodes a uint64 0 as 0x80, the empty string. ethereumjs-util
    // encoded a time of 0 as 0x00, so a transaction dated 1970-01-01 was
    // signed over bytes the node does not build.
    it('encodes a time of 0 as the node does', () => {
        const tx = TrxProtoBuilder.buildTransferTrxProto({
            from: FROM,
            to: 'ff'.repeat(20),
            time: new Date(0),
            nonce: 0,
            gas: 5000,
            gasPrice: '0',
            amount: '0',
        });

        const encoded = hex(RlpUtils.encodeTrxProto(tx));
        // list header, version 1, then the time.
        expect(encoded.slice(2, 6)).toBe('0180');
        expect(encoded).toBe(
            'f50180809415633e505d01691a71f40049e15ba1340c0eea2994ffffffffffffffffffffffffffffffffffffffff8082138880018080',
        );
    });
});
