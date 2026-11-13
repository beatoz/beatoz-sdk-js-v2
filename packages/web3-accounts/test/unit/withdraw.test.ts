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
import { rlp } from 'ethereumjs-util';
import { privateKeyToAccount, TrxProtoBuilder, TrxProtoUtils } from '../../src';
import { RlpUtils } from '../../src/tx/trx_rlp';
import { BytesUint8Array } from '@beatoz/web3-types';

// Expected bytes are worked out by hand from beatoz-go. The payload is
// TrxPayloadWithdrawProto{ReqAmt: uint256.Int.Bytes()}, and Bytes() is minimal
// big-endian and empty for zero. The signed RLP list holds the payload as a
// byte string whose content is rlp(ReqAmt.Bytes()) - Trx.EncodeRLP encodes the
// payload first and then the list - so one decode of the list yields that
// inner encoding: 0x88 + 8 bytes for 1e18, 0x80 for zero.

const account = privateKeyToAccount(
    '2926cd769094b2755d84b74b9180811adf71d9a1bfacf86f81dbfcfd4b9da163',
);

const build = (reqAmt: string, overrides: object = {}) =>
    TrxProtoBuilder.buildWithdrawTrx({
        from: account.address,
        to: account.address,
        amount: '0',
        nonce: 7,
        gas: 100000,
        gasPrice: '48000000000',
        payload: { reqAmt },
        ...overrides,
    });

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

// The fields of the signed RLP list, in the order trx_rlp.ts writes them.
const AMOUNT = 5;
const GAS_PRICE = 7;
const TYPE = 8;
const PAYLOAD = 9;
const signedFields = (tx: ReturnType<typeof build>) =>
    rlp.decode(RlpUtils.encodeTrxProto(tx)) as unknown as Buffer[];

describe('buildWithdrawTrx', () => {
    it.each([
        ['1000000000000000000', '0a080de0b6b3a7640000', '880de0b6b3a7640000'],
        ['256', '0a020100', '820100'],
        ['255', '0a01ff', '81ff'],
        ['1', '0a0101', '01'],
        ['000256', '0a020100', '820100'],
        [(2n ** 256n - 1n).toString(), '0a20' + 'ff'.repeat(32), 'a0' + 'ff'.repeat(32)],
    ])('encodes reqAmt %s minimally, as the node re-encodes it', (reqAmt, payload, signed) => {
        const tx = build(reqAmt);

        expect(hex(tx.Payload)).toEqual(payload);
        expect(signedFields(tx)[PAYLOAD].toString('hex')).toEqual(signed);
    });

    it('is a type 8 transaction that moves no amount', () => {
        const tx = build('5');

        expect(tx.type).toEqual(8);
        expect(tx.Amount).toHaveLength(0);
        expect(signedFields(tx)[TYPE].toString('hex')).toEqual('08');
        expect(signedFields(tx)[AMOUNT]).toHaveLength(0);
    });

    it('encodes gasPrice minimally, and zero as no bytes', () => {
        expect(signedFields(build('5'))[GAS_PRICE].toString('hex')).toEqual('0b2d05e000');
        // The same rule the node uses for every uint256; a zero gasPrice is
        // the case that reaches it here, since a zero reqAmt is refused.
        expect(build('5', { gasPrice: '0' }).GasPrice).toHaveLength(0);
        expect(signedFields(build('5', { gasPrice: '0' }))[GAS_PRICE]).toHaveLength(0);
    });

    it.each([['0'], ['000']])('refuses to withdraw %j, which would only pay the fee', (reqAmt) => {
        expect(() => build(reqAmt)).toThrow('payload.reqAmt must be greater than 0');
    });

    it('decodes back to the same request', () => {
        const tx = build('1000000000000000000');
        TrxProtoBuilder.signTrxProto(tx, account, '0x1234');

        const decoded = TrxProtoBuilder.decodeTransaction(
            new BytesUint8Array(TrxProtoUtils.encode(tx).finish()),
        );

        expect(decoded.type).toEqual(8);
        expect(decoded.payload).toEqual({ reqAmt: '1000000000000000000' });
        expect(TrxProtoBuilder.verifyTrxProto(tx, account, '0x1234')).toBe(true);
    });

    it.each([
        ['', 'payload.reqAmt'],
        [' ', 'payload.reqAmt'],
        [' 1', 'payload.reqAmt'],
        ['-1', 'payload.reqAmt'],
        ['+1', 'payload.reqAmt'],
        ['0x10', 'payload.reqAmt'],
        ['1e18', 'payload.reqAmt'],
        ['1.5', 'payload.reqAmt'],
        [(2n ** 256n).toString(), 'does not fit in 256 bits'],
    ])('rejects reqAmt %j', (reqAmt, message) => {
        expect(() => build(reqAmt)).toThrow(message);
    });

    it('rejects a missing payload', () => {
        expect(() => build('1', { payload: undefined })).toThrow('mandatory argument is missed');
    });

    it('rejects a non-zero amount, which the chain refuses', () => {
        expect(() => build('1', { amount: '1' })).toThrow('a withdraw moves no amount');
    });

    it.each([[' '], [''], ['-1']])('rejects amount %j', (amount) => {
        expect(() => build('1', { amount })).toThrow('amount must be a decimal string');
    });

    it.each([[' '], [''], ['-1']])('rejects gasPrice %j', (gasPrice) => {
        expect(() => build('1', { gasPrice })).toThrow('gasPrice must be a decimal string');
    });
});
