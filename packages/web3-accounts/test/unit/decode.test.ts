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
import { privateKeyToAccount, TrxProtoBuilder, TrxProtoUtils } from '../../src';
import { BytesUint8Array } from '@beatoz/web3-types';

const account = privateKeyToAccount(
    '2926cd769094b2755d84b74b9180811adf71d9a1bfacf86f81dbfcfd4b9da163',
);

// Encodes a transfer with its type replaced. An empty payload decodes as the
// default message for every payload type, so each type 1-8 decodes.
const encodeWithType = (type: number) => {
    const tx = TrxProtoBuilder.buildTransferTrxProto({
        from: account.address,
        to: account.address,
        amount: '1',
        gas: 100000,
        gasPrice: '250000000000',
    });
    tx.type = type;
    return new BytesUint8Array(TrxProtoUtils.encode(tx).finish());
};

describe('decodeTransaction', () => {
    it.each([1, 2, 3, 4, 5, 6, 7, 8])('decodes type %i, which the chain defines', (type) => {
        expect(TrxProtoBuilder.decodeTransaction(encodeWithType(type)).type).toEqual(type);
    });

    // beatoz-go rejects every type outside 1-8 as ErrInvalidTrxPayloadType.
    it.each([0, 9, 255, -1])('rejects type %i, which the chain does not define', (type) => {
        expect(() => TrxProtoBuilder.decodeTransaction(encodeWithType(type))).toThrow(
            `unknown transaction type ${type}; the chain accepts types 1 to 8`,
        );
    });
});
