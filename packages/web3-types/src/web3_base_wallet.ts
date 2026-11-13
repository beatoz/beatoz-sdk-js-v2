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

export interface Web3BaseWalletAccount {
    [key: string]: unknown;

    readonly address: string;
    readonly privateKey: string;

    sign(msg: Uint8Array): BytesUint8Array;

    signTransaction(
        trxProto: TrxProto,
        chainId: string,
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
