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

import { BytesUint8Array } from './bytes_unit8array.js';
import { TrxProto } from './trx_proto.js';

/**
 * How a transaction is signed. The node takes both and tells them apart by
 * the signature's last byte (beatoz-go `ctrlers/types/signer.go`):
 * - `v0`: a text prefix and the transaction's RLP; `v` is 0 or 1. The node
 *   marks it deprecated, but every node version accepts it.
 * - `v1`: the RLP followed by the chain id's bytes; `v` is 27 or 28. Nodes
 *   from v1.10.0 accept it.
 */
export type SignScheme = 'v0' | 'v1';

export interface SignOptions {
    /** Default `v0`. */
    scheme?: SignScheme;
}

export interface Web3BaseWalletAccount {
    [key: string]: unknown;

    readonly address: string;
    readonly privateKey: string;

    sign(msg: Uint8Array): BytesUint8Array;

    signTransaction(
        trxProto: TrxProto,
        chainId: string,
        options?: SignOptions,
    ): {
        rawTransaction: string;
        transactionHash: string;
    };
}

export interface Web3AccountProvider<T> {
    privateKeyToAccount: (privateKey: string) => T;
    create: () => T;
}

export abstract class Web3BaseWallet<T extends Web3BaseWalletAccount> extends Array<T> {
    protected readonly _accountProvider: Web3AccountProvider<T>;

    public constructor(accountProvider: Web3AccountProvider<T>) {
        super();
        this._accountProvider = accountProvider;
    }

    public abstract create(numberOfAccounts: number): this;

    public abstract add(account: T | string): this;

    public abstract get(addressOrIndex: string | number): T | undefined;

    public abstract remove(addressOrIndex: string | number): boolean;

    public abstract clear(): this;
}
