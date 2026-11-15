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

import WebsocketProvider from '@beatoz/web3-providers-ws';

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

export const getTestProposalAccountAddress = (): string =>
    requireEnv('BEATOZ_TEST_PROPOSAL_ADDRESS');

/**
 * The reward node: the same image with a short inflation cycle, so a reward
 * accumulates while a test waits. `yarn node:start:reward` starts it and
 * writes these to `.env.reward`. They have no defaults - the regular node pays
 * rewards once a week of blocks and cannot stand in for it.
 */
export const getRewardServer = (): string => requireEnv('BEATOZ_REWARD_RPC_URL');

export const getRewardWsServer = (): string => requireEnv('BEATOZ_REWARD_WS_URL');

export const getRewardChainId = (): string => requireEnv('BEATOZ_REWARD_CHAIN_ID');

export const getRewardPrivateKey = (): string => requireEnv('BEATOZ_REWARD_PRIVATE_KEY');

/**
 * Closes the WebSocket behind a Web3 instance.
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
