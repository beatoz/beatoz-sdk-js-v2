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

export class BytesUint8Array extends Uint8Array {
    /**
     * Reads hex digits, with or without a `0x` prefix, two per byte.
     *
     * Anything else is refused. A non-hex digit used to become 0 (parseInt
     * gives NaN, which a Uint8Array stores as 0) and an odd length gained a
     * leading zero, so a mistyped address was signed as a different address.
     */
    static fromHex(hex: string): BytesUint8Array {
        if (typeof hex !== 'string') {
            throw new InvalidInputError(`hex must be a string, got ${formatValue(hex)}`);
        }
        const digits = hex.startsWith('0x') ? hex.substring(2) : hex;
        if (!/^[0-9a-fA-F]*$/.test(digits)) {
            throw new InvalidInputError(`hex must be hex digits, got ${formatValue(hex)}`);
        }
        if (digits.length % 2 !== 0) {
            throw new InvalidInputError(
                `hex must have an even number of digits, got ${formatValue(hex)}`,
            );
        }
        const ret = new BytesUint8Array(digits.length / 2);
        for (let i = 0; i < ret.length; i++) {
            ret[i] = parseInt(digits.substring(i * 2, i * 2 + 2), 16);
        }
        return ret;
    }

    toHex(): string {
        let ret = '';
        for (let i = 0; i < this.length; i++) {
            const digits = this[i].toString(16);
            if (this[i] < 16) {
                ret += '0';
            }
            ret += digits;
        }
        return ret.toLowerCase();
    }

    isEqual(o: BytesUint8Array): boolean {
        for (let i = 0; i < this.length; i++) {
            if (this[i] !== o[i]) {
                return false;
            }
        }
        return true;
    }

    // atob and btoa are globals in browsers, web workers and Node 16+, where
    // Buffer is Node's only (#220).
    static b64ToBytes(base64: string): BytesUint8Array {
        const binary = atob(base64);
        const bytes = new BytesUint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    static bytesToB64(bytes: Uint8Array): string {
        let binary = '';
        // In chunks: String.fromCharCode takes each byte as an argument.
        for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
    }
}
