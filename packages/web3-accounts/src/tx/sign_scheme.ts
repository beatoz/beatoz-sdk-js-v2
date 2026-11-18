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
import { SignScheme, TrxProto } from '@beatoz/web3-types';
import { RlpUtils } from './trx_rlp.js';

/**
 * The bytes a signature covers, as the node builds them (beatoz-go
 * `ctrlers/types/signer_v0.go` and `signer_v1.go` `getPreimage`): the RLP of
 * the transaction without the payer fields, and
 * - `v0`: after the text prefix `\x19BEATOZ(<chainId>) Signed Message:\n<length>`;
 * - `v1`: followed by the chain id as a big-endian integer.
 *
 * The sender signs with `sig` empty, the payer with the sender's `sig` in it;
 * the caller sets `sig` accordingly. Both are hashed with sha256.
 */
export function signingPreimage(
    trxProto: TrxProto,
    chainId: string,
    scheme: SignScheme,
): Uint8Array {
    const rlp = RlpUtils.encodeTrxProto(trxProto);
    if (scheme === 'v1') {
        return new Uint8Array(Buffer.concat([rlp, chainIdBytes(chainId)]));
    }
    const prefix = `\x19BEATOZ(${chainId}) Signed Message:\n${rlp.length}`;
    return new Uint8Array(Buffer.concat([Buffer.from(prefix), rlp]));
}

/** The scheme a signature was made with, from its last byte (`v`). */
export function schemeOf(sig: Uint8Array): SignScheme | undefined {
    if (sig.length !== 65) return undefined;
    const v = sig[64];
    if (v === 0 || v === 1) return 'v0';
    if (v === 27 || v === 28) return 'v1';
    return undefined;
}

/**
 * Sets the recovery byte for `scheme`: 0/1 for v0, 27/28 for v1 (beatoz-go
 * `signer.go` `getSigner` picks the scheme by it).
 */
export function withSchemeV(sig: Uint8Array, scheme: SignScheme): Uint8Array {
    const out = new Uint8Array(sig);
    if (scheme === 'v1' && out[64] < 27) out[64] += 27;
    return out;
}

export function checkScheme(scheme: unknown): SignScheme {
    if (scheme === undefined) return 'v0';
    if (scheme === 'v0' || scheme === 'v1') return scheme;
    throw new InvalidInputError(`scheme must be 'v0' or 'v1', got ${formatValue(scheme)}`);
}

// The chain id as the node's uint256 holds it (beatoz-go cmd/config/config.go:
// hex with 0x, decimal without), as its minimal big-endian bytes; 0 is empty.
function chainIdBytes(chainId: string): Buffer {
    let value: bigint;
    if (/^0x[0-9a-fA-F]+$/.test(chainId)) {
        value = BigInt(chainId);
    } else if (/^[0-9]+$/.test(chainId)) {
        value = BigInt(chainId);
    } else {
        throw new InvalidInputError(
            `chainId must be a hex number with 0x or a decimal number, got ${formatValue(chainId)}`,
        );
    }
    const hex = value.toString(16);
    if (hex.length > 64) {
        throw new InvalidInputError(`chainId must fit in 256 bits, got ${formatValue(chainId)}`);
    }
    if (hex === '0') return Buffer.alloc(0);
    return Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
}
