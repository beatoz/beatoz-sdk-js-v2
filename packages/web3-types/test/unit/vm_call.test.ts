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
import { ResponsesDecoder } from '../../src';

// The node's vm_call sends returnData as base64 and leaves empty fields out.
// decodeVmCall returns it as hex, as every other byte value in the SDK, so
// web3.beatoz.vmCall and a contract call (which used to convert it itself)
// return the same thing.

// ABI encoding of the string 'MyToken': offset 32, length 7, then the bytes.
const myTokenHex =
    '0000000000000000000000000000000000000000000000000000000000000020' +
    '0000000000000000000000000000000000000000000000000000000000000007' +
    '4d79546f6b656e00000000000000000000000000000000000000000000000000';
const myTokenBase64 = Buffer.from(myTokenHex, 'hex').toString('base64');

const decode = (value: object) =>
    ResponsesDecoder.decodeVmCall({
        jsonrpc: '2.0',
        id: 1,
        result: { key: 'AB', value, height: '2894' },
    } as never);

describe('ResponsesDecoder.decodeVmCall', () => {
    it('returns returnData as hex', () => {
        const res = decode({ usedGas: '21064', returnData: myTokenBase64 });
        expect(res.value.returnData).toEqual(myTokenHex);
        expect(res.value.usedGas).toEqual('21064');
        expect(res.height).toEqual('2894');
    });

    it('returns empty returnData as an empty string', () => {
        // What the node sent for a call to an account with no code.
        const res = decode({ usedGas: '24000' });
        expect(res.value.returnData).toEqual('');
    });

    it('puts back a zero usedGas the node left out', () => {
        expect(decode({}).value.usedGas).toEqual('0');
    });

    it('keeps vmErr when the call failed', () => {
        const res = decode({ usedGas: '23000', vmErr: 'execution reverted' });
        expect(res.value.vmErr).toEqual('execution reverted');
    });
});
