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
 * Hands out the nonces an account sends with. The node's `account` query
 * reports the nonce of the last committed block, so transactions sent before
 * the next block would all read the same one; a nonce manager counts on from
 * it instead. `Web3Context` holds one, and `NonceManager` in
 * `@beatoz/web3-methods` implements it.
 */
export interface Web3NonceManager {
    /**
     * The nonce to send with from `address`. The first call for an address
     * takes it from `fetch`, which asks the node; each call after that returns
     * one more than the last.
     */
    consume(address: string, fetch: () => Promise<number>): Promise<number>;
    /** Forgets `address`, so its next nonce comes from the node again. */
    reset(address: string): void;
}
