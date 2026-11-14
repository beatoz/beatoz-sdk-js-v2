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
import { getContractAddress, privateKeyToAccount, TrxProtoBuilder } from '../../src';

// Every input the SDK refuses is an InvalidInputError, thrown before
// anything is signed or sent.
const from = '15633e505d01691a71f40049e15ba1340c0eea29';
const base = { from, to: from, nonce: 0, gas: 100000, gasPrice: '1', amount: '0' };
const account = privateKeyToAccount(
    '2926cd769094b2755d84b74b9180811adf71d9a1bfacf86f81dbfcfd4b9da163',
);

describe('input errors', () => {
    it.each([
        [
            'a gas that is not an integer',
            () => TrxProtoBuilder.buildTransferTrxProto({ ...base, gas: 1.5 }),
        ],
        ['a short address', () => TrxProtoBuilder.buildTransferTrxProto({ ...base, to: '1234' })],
        [
            'a payload left out',
            () => TrxProtoBuilder.buildUnDelegateTrxProto({ ...base, payload: undefined as never }),
        ],
        [
            'a payer signing before the sender',
            () => account.signTransactionAsPayer(TrxProtoBuilder.buildTransferTrxProto(base), 'x'),
        ],
        ['a negative nonce for an address', () => getContractAddress(from, -1)],
    ])('refuses %s', (_, call) => {
        expect(call).toThrow(InvalidInputError);
    });

    it('names the missing payload field', () => {
        expect(() =>
            TrxProtoBuilder.buildUnDelegateTrxProto({ ...base, payload: {} as never }),
        ).toThrow('payload.txHash must be set, got undefined');
    });
});
