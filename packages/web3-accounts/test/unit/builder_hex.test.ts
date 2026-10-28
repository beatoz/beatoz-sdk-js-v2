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

// The builders read addresses, hashes and call data as hex. A mistyped one
// used to be signed as different bytes - a non-hex digit became 0 and a
// dropped digit shifted the rest - so a transfer could go to an address
// nobody wrote. Now it fails before anything is signed.

const from = '03ba93fdc3e164cd4e57370a828f6e5b05d4817d';
const to = '15633e505d01691a71f40049e15ba1340c0eea29';
const base = { from, to, gas: 100000, gasPrice: '48000000000', amount: '1' };

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

describe('builders read hex strictly', () => {
    it('builds the addresses as written, with or without 0x', () => {
        const tx = TrxProtoBuilder.buildTransferTrxProto({ ...base, to: `0x${to}` });

        expect(hex(tx.from)).toEqual(from);
        expect(hex(tx.to)).toEqual(to);
    });

    it.each([
        // A letter that is not hex. It used to become 00 and be sent.
        ['a non-hex digit', `${to.slice(0, -1)}g`, 'invalid hex'],
        // One digit dropped. It used to gain a leading 0, shifting every byte.
        ['a dropped digit', to.slice(1), 'hex must have an even number of digits'],
    ])('rejects a recipient with %s', (_, mistyped, message) => {
        expect(() => TrxProtoBuilder.buildTransferTrxProto({ ...base, to: mistyped })).toThrow(
            message,
        );
    });

    it('rejects a sender that is not hex', () => {
        expect(() =>
            TrxProtoBuilder.buildTransferTrxProto({ ...base, from: 'not-an-address' }),
        ).toThrow('invalid hex');
    });

    it('rejects an unstaking hash that is not hex', () => {
        expect(() =>
            TrxProtoBuilder.buildUnDelegateTrxProto({
                ...base,
                amount: '0',
                payload: { txhash: 'zz'.repeat(32) },
            }),
        ).toThrow('invalid hex');
    });

    it('rejects contract data with an odd number of digits', () => {
        expect(() =>
            TrxProtoBuilder.buildContractTrxProto({ ...base, payload: { data: '0x608' } }),
        ).toThrow('hex must have an even number of digits');
    });
});
