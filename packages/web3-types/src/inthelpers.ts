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

import { formatValue, InvalidResponseError } from '@beatoz/web3-errors';

/**
 * Takes an integer value from the Tendermint RPC API and returns it as a
 * number. It must be a safe integer.
 */
export function apiToSmallInt(input: string | number): number {
    const value =
        typeof input === 'number' ? input : /^-?[0-9]+$/.test(input) ? Number(input) : Number.NaN;
    if (!Number.isSafeInteger(value)) {
        throw new InvalidResponseError(
            `an integer in the response must be a safe integer, got ${formatValue(input)}`,
        );
    }
    return value;
}
