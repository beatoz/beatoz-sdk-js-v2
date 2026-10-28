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
 * Sample values read from whichever chain the tests are pointed at.
 *
 * Several suites used to query a pinned height (10000) or a pinned block
 * hash. Those values are stable on a given chain - Tendermint commits are
 * final and never reorganise - but they only exist on the one chain they
 * were taken from, so the suites broke as soon as the target changed.
 *
 * The suites do not assert anything about the contents of a particular
 * block. They check that the SDK builds the request and decodes the reply,
 * which any committed block exercises equally well. So ask the chain for a
 * sample rather than naming one.
 *
 * This is deliberately not in `e2e_utils.ts`: that file is configuration and
 * touches no chain, while everything here needs a live connection.
 */

import { Web3 } from '../../src';
import erc20Contract from '../fixtures/erc20-contract.json';
import { privateKeyToAccount, TrxProtoBuilder, Web3Account } from '@beatoz/web3-accounts';
import {
    getTestAccountAddress,
    getTestChainId,
    getTestProposalAccountPrivateKey,
} from './e2e_utils';

/** Height of the latest committed block on the target chain. */
export const getLatestHeight = async (web3: Web3): Promise<number> => {
    const status = await web3.beatoz.status();
    return status.sync_info.latest_block_height;
};

/**
 * A height that is committed and safe to query.
 *
 * One below the tip, because results and validator sets for the newest
 * block may not be queryable the instant it is reported. Falls back to the
 * tip on a chain that only has one block.
 */
export const getSampleHeight = async (web3: Web3): Promise<number> => {
    const latest = await getLatestHeight(web3);
    return latest > 1 ? latest - 1 : latest;
};

/** The block id hash at a given height, in the form `blockByHash` accepts. */
export const getBlockHashAt = async (web3: Web3, height: number): Promise<string> => {
    const block = await web3.beatoz.block(height);
    return block.block_id.hash;
};

/**
 * The node returns addresses as bare uppercase hex, with no `0x`. It accepts
 * either form on the way in, so a round trip is only comparable once both sides
 * are reduced to what the node itself uses.
 */
export const asNodeAddress = (address: string): string => address.replace(/^0x/i, '').toLowerCase();

/**
 * Heights come back from the node as strings, the way Tendermint reports them.
 * A height computed on this side is a number, so comparisons have to pick one.
 */
export const asNodeHeight = (height: number | string): string => String(height);

/**
 * A validator address taken from the chain under test. Delegation queries need
 * one that actually exists, and which that is depends on the chain.
 */
export const getValidatorAddress = async (web3: Web3): Promise<string> => {
    const { validators } = await web3.beatoz.validators();
    if (!validators?.length) {
        throw new Error('the chain reports no validators, so delegation cannot be queried');
    }
    return validators[0].address;
};

/**
 * Sends a transfer and returns the hash the node assigned it.
 *
 * Several tests need a transaction that exists on the chain they are talking
 * to - to look up by hash, or to make the chain produce a block. Tendermint
 * only produces empty blocks on a timer (60s on this image), so a test that
 * waits for blocks without causing any will sit there until it times out.
 *
 * Gas comes from the chain's own rule rather than a constant, for the same
 * reason the chain id does: it is the node that decides.
 */
export const sendSampleTransfer = async (web3: Web3): Promise<string> => {
    const account = privateKeyToAccount(getTestProposalAccountPrivateKey()) as Web3Account;
    const { value: rule } = await web3.beatoz.rule();
    const { value: sender } = await web3.beatoz.getAccount(account.address);

    const tx = TrxProtoBuilder.buildTransferTrxProto({
        nonce: sender.nonce,
        from: account.address,
        to: asNodeAddress(getTestAccountAddress()),
        amount: '10',
        gas: Number(rule.minTrxGas),
        gasPrice: String(rule.gasPrice),
    });
    TrxProtoBuilder.signTrxProto(tx, account, getTestChainId());

    const result = await web3.beatoz.broadcastTxCommit(tx);
    if (result.check_tx?.code !== 0 || result.deliver_tx?.code !== 0) {
        throw new Error(`the node rejected the sample transfer: ${JSON.stringify(result)}`);
    }
    return result.hash;
};

/**
 * Deploys the ERC20 fixture and returns the hash of the deploying transaction.
 *
 * `contractAddrFromTx` reads the contract address out of that transaction's
 * events, so it needs one that actually deployed something on the chain under
 * test - a hash recorded from somewhere else resolves to nothing here.
 */
export const deploySampleContract = async (web3: Web3): Promise<string> => {
    const account = privateKeyToAccount(getTestProposalAccountPrivateKey()) as Web3Account;
    web3.beatoz.accounts.wallet.add(account.privateKey);

    const contract = new web3.beatoz.Contract(erc20Contract.abi);
    const result = await contract
        .deploy(erc20Contract.bytecode, ['BeatozToken', 'RGT'], account, getTestChainId(), 10000000)
        .send();

    await web3.beatoz.waitForTx(result.hash);
    return result.hash;
};

/** Polls `check` until it passes, or gives up with `what` in the message. */
export const waitUntil = async (
    check: () => boolean,
    what: string,
    timeoutMs = 20000,
): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (!check()) {
        if (Date.now() > deadline) {
            throw new Error(`${what} within ${timeoutMs}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
};

/**
 * Sends `count` transfers and returns their hashes, in the order sent.
 */
export const sendTransfers = async (web3: Web3, count: number): Promise<string[]> => {
    const hashes: string[] = [];
    for (let i = 0; i < count; i++) {
        hashes.push(await sendSampleTransfer(web3));
    }
    return hashes;
};

/**
 * Makes the chain produce blocks and reports the height it reached.
 *
 * Each transfer is broadcast with commit, so it returns once its block exists -
 * but two sent in quick succession can share one block, so the number of blocks
 * is not the number of transfers. The height the chain reports afterwards is,
 * which is why it is read rather than assumed.
 */
export const produceBlocks = async (web3: Web3, transfers: number): Promise<number> => {
    await sendTransfers(web3, transfers);
    return getLatestHeight(web3);
};

/**
 * Fails unless `heights` is an unbroken ascending run.
 *
 * This is what a subscription promises: not that some events arrive, but that
 * none are missed. A gap means the stream dropped a block.
 */
export const assertUnbroken = (heights: number[]): void => {
    expect(heights.length).toBeGreaterThan(0);
    for (let i = 1; i < heights.length; i++) {
        if (heights[i] !== heights[i - 1] + 1) {
            throw new Error(`the subscription skipped a block: received ${heights.join(', ')}`);
        }
    }
};
