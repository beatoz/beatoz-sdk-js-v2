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
 * Export all packages grouped by name spaces
 */
import Web3 from './web3.js';

export default Web3;

/**
 * Named exports for all objects which are the default-exported-object in their packages
 */

export { Web3 };
export { Contract } from '@beatoz/web3-contract';

/**
 * Export all packages grouped by name spaces
 */
export * as core from '@beatoz/web3-core';
export * as errors from '@beatoz/web3-errors';
export * as beatoz from './methods.exports.js';
export { HttpProvider } from '@beatoz/web3-providers-http';
export { WebsocketProvider } from '@beatoz/web3-providers-ws';
export * as providers from './providers.exports.js';
export * as rpcMethods from '@beatoz/web3-rpc';
export { Web3Validator } from '@beatoz/web3-validator';
export * as utils from '@beatoz/web3-utils';
export * as validator from '@beatoz/web3-validator';
export { TrxProtoBuilder } from '@beatoz/web3-accounts';
export { NonceManager } from '@beatoz/web3-methods';

/**
 * Export all types from `web3-types` without a namespace (in addition to being available at `types` namespace).
 * To enable the user to write: `function something(): Web3Api` without the need for `types.Web3Api`.
 * And the same for `web3-errors`. Because this package contains error classes and constants.
 */
export * from '@beatoz/web3-errors';
export * from '@beatoz/web3-types';
