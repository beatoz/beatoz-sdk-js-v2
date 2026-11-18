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

import { HexString } from '@beatoz/web3-types';

export interface Web3ConfigOptions {
    handleRevert: boolean;
    defaultAccount?: HexString;
    defaultBlock: number | HexString;
}

export abstract class Web3Config {
    public config: Web3ConfigOptions = {
        handleRevert: false,
        defaultAccount: undefined,
        defaultBlock: 'latest',
    };

    public constructor(options?: Partial<Web3ConfigOptions>) {
        this.setConfig(options ?? {});
    }

    public setConfig(options: Partial<Web3ConfigOptions>) {
        Object.assign(this.config, options);
    }
}
