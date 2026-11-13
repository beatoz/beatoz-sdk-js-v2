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
import { TrxProtoBuilder, TrxProtoUtils } from '../../src';
import { BytesUint8Array } from '@beatoz/web3-types';
import { TrxPayloadUnstakingProto } from '../../src/tx/trx_pb';

// Unstaking takes the staking hash as the hex the node returns, under the name
// txHash, and decodeTransaction returns it the same way.

const from = '03ba93fdc3e164cd4e57370a828f6e5b05d4817d';
const base = { from, nonce: 1, gas: 100000, gasPrice: '48000000000' };
const hash = 'ab'.repeat(32);
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

describe('buildUnDelegateTrxProto', () => {
    it('reads txHash as hex, and decodeTransaction returns it under the same name', () => {
        const tx = TrxProtoBuilder.buildUnDelegateTrxProto({
            ...base,
            to: from,
            amount: '0',
            payload: { txHash: hash },
        });
        expect(hex(TrxPayloadUnstakingProto.decode(tx.Payload).txHash)).toEqual(hash);

        const decoded = TrxProtoBuilder.decodeTransaction(
            new BytesUint8Array(TrxProtoUtils.encode(tx).finish()),
        );
        expect(decoded.type === 3 && decoded.payload.txHash).toEqual(hash);
    });
});
