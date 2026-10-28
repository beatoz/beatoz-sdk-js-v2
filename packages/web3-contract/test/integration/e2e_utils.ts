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
 * Network configuration for integration tests.
 *
 * These tests need a reachable node and funded accounts. This file makes no
 * assumption about where either comes from: everything is read from the
 * environment. See .env.example at the repository root.
 *
 * Values that cannot have a safe default are required rather than guessed.
 * A missing one fails with the name of the variable, instead of surfacing
 * later as a signature or balance error that says nothing about the cause.
 *
 * Nothing is read at import time. An earlier version did
 * `import secrets from '../../../../.secrets.json'` at the top level, so a
 * gitignored file that does not exist after a clone took down every test file
 * that imported it - including tests that never contacted a node.
 */

import type { Web3 } from '@beatoz/web3';
import WebsocketProvider from '@beatoz/web3-providers-ws';
import { decodeParameter } from '@beatoz/web3-abi';
import type { BroadcastTxCommitResponse } from '@beatoz/web3-types';
import tokenJson from '../fixtures/erc20-contract.json';

const env = (key: string, fallback: string): string => process.env[key] ?? fallback;

/** Reads a variable that has no safe default. */
const requireEnv = (key: string): string => {
    const value = process.env[key];
    if (value === undefined || value === '') {
        throw new Error(
            `${key} is not set. Integration tests need a node and funded accounts; ` +
                `see .env.example at the repository root.`,
        );
    }
    return value;
};

export const getTestServer = (): string => env('BEATOZ_RPC_URL', 'http://localhost:26657');

export const getTestWsServer = (): string => env('BEATOZ_WS_URL', 'ws://localhost:26657/websocket');

/**
 * The chain id that goes into the signing preimage.
 *
 * It must match what the node reports as `node_info.network`. If it does not,
 * the node recomputes the preimage with its own value, gets a different hash,
 * and rejects the transaction as `invalid signature` - which reads as a broken
 * signer rather than a configuration mismatch.
 */
export const getTestChainId = (): string => requireEnv('BEATOZ_CHAIN_ID');

export const getTestAccountAddress = (): string => requireEnv('BEATOZ_TEST_ADDRESS');

export const getTestAccountPrivateKey = (): string => requireEnv('BEATOZ_TEST_PRIVATE_KEY');

/** A second funded account, for tests that need two distinct signers. */
export const getTestProposalAccountPrivateKey = (): string =>
    requireEnv('BEATOZ_TEST_PROPOSAL_PRIVATE_KEY');

export const getTestAccounts = (): ReadonlyArray<{ address: string; privateKey: string }> => [
    { address: getTestAccountAddress(), privateKey: getTestAccountPrivateKey() },
    {
        address: requireEnv('BEATOZ_TEST_PROPOSAL_ADDRESS'),
        privateKey: getTestProposalAccountPrivateKey(),
    },
];

/**
 * Whether a node is reachable. Suites call this and skip instead of failing,
 * so running without a node reports skips rather than a wall of connection
 * errors.
 */
export const isNodeReachable = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${getTestServer()}/status`, {
            signal: AbortSignal.timeout(3000),
        });
        return response.ok;
    } catch {
        return false;
    }
};

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
        return getTestAccounts().map((a) => ({ ADDR: a.address, KEY: a.privateKey }));
    },
};

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

    const res = await new web3.beatoz.Contract(tokenJson.abi)
        .deploy(tokenJson.bytecode, ['BeatozToken', 'RGT'], deployer, getTestChainId(), 10000000)
        .send();
    if (res.check_tx.code !== 0 || res.deliver_tx?.code !== 0) {
        throw new Error(
            `deployTestToken: deploy failed: ${res.check_tx.log || res.deliver_tx?.log}`,
        );
    }

    // The commit reply comes before the node has indexed the transaction, so
    // looking it up straight away can answer `tx (...) not found`.
    await web3.beatoz.waitForTx(res.hash);
    const address = await web3.beatoz.contractAddrFromTx(res.hash);
    return { address, deployer: deployer.address };
};

/**
 * Closes the WebSocket behind a Web3 instance or contract.
 *
 * An open socket keeps Node's event loop alive, so Jest never exits after the
 * last test and the run hangs instead of finishing. Suites that open one close
 * it in `afterAll`.
 */
export const closeProvider = (context: { getProvider(): unknown }): void => {
    const provider = context.getProvider();
    if (provider instanceof WebsocketProvider) {
        provider.disconnect();
    }
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
    const resp = await contract.methods.balanceOf(owner).call();
    return BigInt(String(decodeParameter('uint', resp.value.returnData)));
};
