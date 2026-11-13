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

import { Web3BaseWallet } from '@beatoz/web3-types';
import { Web3Account } from './types.js';
import { isNullish } from '@beatoz/web3-utils';

export class Wallet extends Web3BaseWallet<Web3Account> {
    private readonly _addressMap = new Map<string, number>();

    public create(numberOfAccounts: number): this {
        for (let i = 0; i < numberOfAccounts; i += 1) {
            this.add(this._accountProvider.create());
        }
        return this;
    }

    public add(account: Web3Account | string): this {
        if (typeof account === 'string') {
            if (account.startsWith('0x')) {
                account = account.substring(2);
            }
            return this.add(this._accountProvider.privateKeyToAccount(account));
        }
        let index = this.length;
        const existAccount = this.get(account.address);
        if (existAccount) {
            console.warn(`Account ${account.address.toLowerCase()} already exists.`);
            index = this._addressMap.get(account.address.toLowerCase()) ?? index;
        }
        this._addressMap.set(account.address.toLowerCase(), index);
        this[index] = account;

        return this;
    }

    public get(addressOrIndex: string | number): Web3Account | undefined {
        if (typeof addressOrIndex === 'string') {
            if (addressOrIndex.startsWith('0x')) {
                addressOrIndex = addressOrIndex.substring(2);
            }
            const index = this._addressMap.get(addressOrIndex.toLowerCase());

            if (!isNullish(index)) {
                return this[index];
            }

            return undefined;
        }

        return this[addressOrIndex];
    }

    public remove(addressOrIndex: string | number): boolean {
        if (typeof addressOrIndex === 'string') {
            if (addressOrIndex.startsWith('0x')) {
                addressOrIndex = addressOrIndex.substring(2);
            }
            const index = this._addressMap.get(addressOrIndex.toLowerCase());
            if (isNullish(index)) {
                return false;
            }
            this._addressMap.delete(addressOrIndex.toLowerCase());
            this.splice(index, 1);

            return true;
        }

        if (this[addressOrIndex]) {
            this.splice(addressOrIndex, 1);
            return true;
        }

        return false;
    }

    public clear(): this {
        this._addressMap.clear();
        this.length = 0;
        return this;
    }
}
