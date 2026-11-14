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

import { Web3Config } from './web3_config.js';
import { Web3RequestManager } from './web3_request_manager.js';
import {
    Web3AccountProvider,
    Web3BaseWalletAccount,
    Web3BaseWallet,
    ResponsesDecoder,
} from '@beatoz/web3-types';
import HttpProvider from '@beatoz/web3-providers-http';
import WebsocketProvider from '@beatoz/web3-providers-ws';

export type Web3ContextConstructor<T extends Web3Context, T2 extends unknown[]> = new (
    ...args: [...extras: T2, context: Web3ContextObject]
) => T;

// To avoid circular dependencies, we need to export type from here.
export type Web3ContextObject = {
    requestManager: Web3RequestManager;
    wallet?: Web3BaseWallet<Web3BaseWalletAccount>;
    accountProvider?: Web3AccountProvider<Web3BaseWalletAccount>;
    chainId?: string;
};

export class Web3Context extends Web3Config {
    public readonly providers = Web3RequestManager.providers;
    protected _requestManager: Web3RequestManager;
    protected _accountProvider?: Web3AccountProvider<Web3BaseWalletAccount>;
    protected _wallet?: Web3BaseWallet<Web3BaseWalletAccount>;
    protected _chainId?: string;

    public get requestManager() {
        return this._requestManager!;
    }
    public get wallet() {
        return this._wallet;
    }
    public get accountProvider() {
        return this._accountProvider;
    }
    public get chainId() {
        return this._chainId!;
    }

    public set provider(provider: HttpProvider | WebsocketProvider | string | undefined) {
        this.requestManager.setProvider(provider);
    }

    public constructor(providerOrContext?: string) {
        super();
        this._requestManager = new Web3RequestManager(providerOrContext);
    }

    public use<T extends Web3Context, T2 extends unknown[]>(
        ContextRef: Web3ContextConstructor<T, T2>,
        ...args: [...T2]
    ) {
        const useContext = new ContextRef(
            ...([...args, this.getContextObject()] as unknown as [...T2, Web3ContextObject]),
        );

        useContext._requestManager = this.requestManager;
        return useContext;
    }

    public getContextObject(): Web3ContextObject {
        return {
            requestManager: this.requestManager,
            wallet: this.wallet,
            accountProvider: this.accountProvider,
            chainId: this._chainId,
        };
    }

    public getProvider() {
        return this.requestManager.provider;
    }

    public setProvider(provider?: HttpProvider | WebsocketProvider | string): boolean {
        // The request manager turns a URL into a provider. Doing it here as
        // well built a second one, and the first - for a ws:// URL an open
        // socket - was lost with no way to close it.
        this.provider = provider;
        return true;
    }

    public async decideChainId() {
        const resp = await this.requestManager.send({
            method: 'genesis',
            params: {},
        });
        const gen = ResponsesDecoder.decodeGenesis(resp);
        this._chainId = gen.chain_id;
        return this._chainId;
    }
}
