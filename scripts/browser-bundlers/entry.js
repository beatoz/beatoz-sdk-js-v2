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

/**
 * What scripts/browser-bundlers/bundle.mjs bundles with Vite and webpack, as an
 * app would, with no Node polyfills. Each step uses code that once reached for
 * a Node module: crypto (#218), Buffer (#220), events (#222), assert (#223),
 * util through the validator (#226). It needs no network.
 */
import { Web3, TrxProtoBuilder, BytesUint8Array } from '@beatoz/web3';
import { encodeFunctionCall, encodeParameters } from '@beatoz/web3-abi';
import { ResponsesDecoder } from '@beatoz/web3-types';
import { toHex } from '@beatoz/web3-utils';
import { validator } from '@beatoz/web3-validator';

const check = (condition, what) => {
    if (!condition) throw new Error(what);
};

const run = () => {
    const web3 = new Web3('http://127.0.0.1:1');
    const account = web3.beatoz.accounts.create();
    for (const scheme of ['v0', 'v1']) {
        const trx = TrxProtoBuilder.buildTransferTrxProto({
            from: account.address,
            to: account.address,
            amount: '1',
            gas: 100000,
            gasPrice: '48000000000',
        });
        const signed = account.signTransaction(trx, '0x1234', { scheme });
        check(TrxProtoBuilder.verifyTrxProto(trx, account, '0x1234'), `${scheme} verifies`);
        const decoded = TrxProtoBuilder.decodeTransaction(
            BytesUint8Array.b64ToBytes(signed.rawTransaction),
        );
        check(decoded.hash === signed.transactionHash, `${scheme} transaction hash`);
    }

    check(toHex(255) === '0xff', 'toHex');
    check(
        encodeParameters(['address', 'uint256'], [account.address, 10]).length === 130,
        'encodeParameters',
    );
    check(
        encodeFunctionCall(
            {
                name: 'transfer',
                type: 'function',
                inputs: [
                    { name: 'to', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                ],
            },
            [account.address, 10],
        ).startsWith('0xa9059cbb'),
        'encodeFunctionCall',
    );
    check(
        validator.validate(['uint8', 'address[]'], [255, [account.address]]) === undefined,
        'validator accepts',
    );
    let refused = false;
    try {
        validator.validate(['uint8'], [300]);
    } catch {
        refused = true;
    }
    check(refused, 'validator refuses');

    // Keeps the response decoder, which imported assert, in the bundle.
    check(typeof ResponsesDecoder.decodeCommit === 'function', 'ResponsesDecoder');
    return 'ok';
};

try {
    globalThis.__check = run();
} catch (error) {
    globalThis.__check = `${error?.name}: ${error?.message}`;
}
