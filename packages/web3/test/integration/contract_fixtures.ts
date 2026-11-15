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
 * Helpers for the contract suites in ./contract/. They moved here from
 * web3-contract, whose tests used Web3 - a package that depends on
 * web3-contract, not the other way round.
 */

import type { Web3 } from '../../src';
import type { BroadcastTxCommitResponse } from '@beatoz/web3-types';
import tokenJson from '../fixtures/erc20-contract.json';
import {
    getTestAccountAddress,
    getTestAccountPrivateKey,
    getTestChainId,
    getTestProposalAccountAddress,
    getTestProposalAccountPrivateKey,
    getTestServer,
    getTestWsServer,
} from './e2e_utils';

export { closeProvider } from './e2e_utils';

/**
 * Compatibility shape for tests that previously destructured a network out of
 * `.providers.json`, e.g. `const { TESTNET0: netInfo } = Providers`.
 *
 * Keeps the original field names so those tests only change their import.
 * The members are getters so each read goes through the environment; a plain
 * object would freeze the values at import time.
 */
export const netInfo = {
    get CHAINID(): string {
        return getTestChainId();
    },
    get HTTP(): string {
        return getTestServer();
    },
    get WS(): string {
        return getTestWsServer();
    },
    get ACCTS(): ReadonlyArray<{ ADDR: string; KEY: string }> {
        return [
            { ADDR: getTestAccountAddress(), KEY: getTestAccountPrivateKey() },
            { ADDR: getTestProposalAccountAddress(), KEY: getTestProposalAccountPrivateKey() },
        ];
    },
};

/**
 * Gas limit for the test deploys. The fee is the gas a deploy uses, so the
 * limit only needs to be large enough.
 */
export const DEPLOY_GAS = 10_000_000;

/**
 * Deploys a fresh ERC20 test token from the first test account and returns
 * where it lives.
 *
 * Each suite calls this in its own `beforeAll` instead of reading an address
 * another suite wrote to disk. Jest does not order suites, so a shared file
 * could hold an address from an earlier run - one that does not exist on a
 * freshly started node, which made calls hang until the timeout instead of
 * failing. Deploying per suite also lets any suite run on its own.
 *
 * The caller's wallet must already hold the first test account.
 */
export const deployTestToken = async (
    web3: Web3,
): Promise<{ address: string; deployer: string }> => {
    const deployer = web3.beatoz.accounts.wallet.get(getTestAccountAddress());
    if (deployer === undefined) {
        throw new Error('deployTestToken: the first test account is not in the wallet');
    }

    const { address } = await new web3.beatoz.Contract(tokenJson.abi)
        .deploy({ bytecode: tokenJson.bytecode, args: ['BeatozToken', 'RGT'] })
        .send({ from: deployer.address, gas: DEPLOY_GAS });
    return { address, deployer: deployer.address };
};

/** Initial supply the test token mints to its deployer: 10^9 tokens of 18 decimals. */
export const TEST_TOKEN_SUPPLY = 10n ** 27n;

/**
 * Throws unless the transaction passed both CheckTx and DeliverTx.
 *
 * Carries the node's log, so a rejected transaction fails with the reason
 * instead of a bare "expected 0, received 5".
 */
export const assertCommitted = (res: BroadcastTxCommitResponse): void => {
    if (res.check_tx.code !== 0 || res.deliver_tx?.code !== 0) {
        throw new Error(`tx ${res.hash} failed: ${res.check_tx.log || res.deliver_tx?.log}`);
    }
};

/** Reads an ERC20 balance through the contract's own `balanceOf`. */
export const tokenBalance = async (contract: any, owner: string): Promise<bigint> => {
    return (await contract.methods.balanceOf(owner).call()) as bigint;
};
