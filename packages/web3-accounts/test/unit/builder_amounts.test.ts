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
import { TrxProto } from '@beatoz/web3-types';

// Every builder turns `amount` and `gasPrice` into the bytes the node rebuilds
// with uint256.Int.Bytes() when it checks the signature: minimal big-endian,
// and nothing at all for zero. Any other bytes for the same number fail as
// `invalid signature`, so zero spelled '00' must encode exactly like '0'.

const from = '03ba93fdc3e164cd4e57370a828f6e5b05d4817d';
const to = '15633e505d01691a71f40049e15ba1340c0eea29';
const base = { from, to, nonce: 1, gas: 100000, gasPrice: '48000000000', amount: '0' };

type Fields = { amount?: unknown; gasPrice?: unknown };
const builders: Record<string, (f: Fields) => TrxProto> = {
    transfer: (f) => TrxProtoBuilder.buildTransferTrxProto({ ...base, ...f } as never),
    delegate: (f) => TrxProtoBuilder.buildDelegateTrxProto({ ...base, ...f } as never),
    undelegate: (f) =>
        TrxProtoBuilder.buildUnDelegateTrxProto({
            ...base,
            ...f,
            payload: { txHash: '11'.repeat(32) },
        } as never),
    contract: (f) =>
        TrxProtoBuilder.buildContractTrxProto({ ...base, ...f, payload: { data: '00' } } as never),
    setdoc: (f) =>
        TrxProtoBuilder.buildSetDocTrx({
            ...base,
            ...f,
            payload: { name: 'n', url: 'u' },
        } as never),
};
// A setDoc moves no value; its Amount is always empty. Withdraw has its own
// tests.
const withAmount = ['transfer', 'delegate', 'undelegate', 'contract'];

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

const valid: [string, string][] = [
    ['0', ''],
    ['00', ''],
    ['000', ''],
    ['1', '01'],
    ['255', 'ff'],
    ['256', '0100'],
    ['0256', '0100'],
    ['1000000000000000000', '0de0b6b3a7640000'],
    [(2n ** 256n - 1n).toString(), 'ff'.repeat(32)],
];

const invalid: [unknown, string][] = [
    ['', 'must be a decimal string'],
    [' ', 'must be a decimal string'],
    [' 1', 'must be a decimal string'],
    ['1 ', 'must be a decimal string'],
    ['-1', 'must be a decimal string'],
    ['+1', 'must be a decimal string'],
    ['0x10', 'must be a decimal string'],
    ['1e18', 'must be a decimal string'],
    ['1.5', 'must be a decimal string'],
    [1, 'must be a decimal string'],
    [undefined, 'must be a decimal string'],
    [(2n ** 256n).toString(), 'must fit in 256 bits'],
];

describe.each(withAmount)('%s amount', (name) => {
    it.each(valid)('encodes %j as %j', (amount, bytes) => {
        expect(hex(builders[name]({ amount }).Amount)).toEqual(bytes);
    });

    it.each(invalid)('rejects %j', (amount, message) => {
        expect(() => builders[name]({ amount })).toThrow(`amount ${message}`);
    });
});

describe.each(Object.keys(builders))('%s gasPrice', (name) => {
    it.each(valid)('encodes %j as %j', (gasPrice, bytes) => {
        expect(hex(builders[name]({ gasPrice }).GasPrice)).toEqual(bytes);
    });

    it.each(invalid)('rejects %j', (gasPrice, message) => {
        expect(() => builders[name]({ gasPrice })).toThrow(`gasPrice ${message}`);
    });
});

// A setDoc moves no value. Its input type leaves amount out; one passed anyway
// must be zero, since the chain would accept any other value and move nothing.
describe.each([['setdoc', 'a setDoc']])('%s', (name, kind) => {
    it.each([undefined, '0', '00'])('carries no amount for %p', (amount) => {
        expect(builders[name]({ amount }).Amount).toHaveLength(0);
    });

    it.each(['1', '5', '1000000000000000000'])('rejects amount %j', (amount) => {
        expect(() => builders[name]({ amount })).toThrow(`${kind} moves no amount`);
    });

    it.each(['', '-1', 'abc', 5])('rejects malformed amount %p', (amount) => {
        expect(() => builders[name]({ amount })).toThrow('amount must be a decimal string');
    });
});
