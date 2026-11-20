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

import { formatValue, InvalidInputError } from '@beatoz/web3-errors';
import { RLP } from '@ethereumjs/rlp';
import { keccak256 } from 'ethereum-cryptography/keccak.js';
import { bytesToHex, hexToBytes } from 'ethereum-cryptography/utils.js';
import { toChecksumAddress } from '@beatoz/web3-utils';

/**
 * The address of the contract that `from` creates with a deploy transaction
 * of `nonce`: the last 20 bytes of keccak256(rlp([from, nonce])). The node
 * computes it the same way (go-ethereum's `crypto.CreateAddress`), as
 * Ethereum does. A contract that a contract creates is not covered.
 */
export function getContractAddress(from: string, nonce: number): string {
    const hex = from.startsWith('0x') ? from.slice(2) : from;
    if (!/^[0-9a-fA-F]{40}$/.test(hex)) {
        throw new InvalidInputError(`from must be 20 bytes of hex, got ${formatValue(from)}`);
    }
    if (!Number.isSafeInteger(nonce) || nonce < 0) {
        throw new InvalidInputError(
            `nonce must be a non-negative safe integer, got ${formatValue(nonce)}`,
        );
    }
    // RLP encodes a nonce of 0 as the empty string, as go-ethereum does.
    const hash = keccak256(RLP.encode([hexToBytes(hex), nonce]));
    return toChecksumAddress('0x' + bytesToHex(hash.slice(-20)));
}
