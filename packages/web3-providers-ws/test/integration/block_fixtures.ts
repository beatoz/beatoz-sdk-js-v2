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

import {
    privateKeyToAccount,
    TrxProtoBuilder,
    TrxProtoUtils,
    Web3Account,
} from '@beatoz/web3-accounts';
import { WebsocketProvider } from '../../src';
import {
    getTestAccountAddress,
    getTestChainId,
    getTestProposalAccountPrivateKey,
    getTestServer,
} from './e2e_utils';

const rpc = async (method: string, params: Record<string, unknown>): Promise<any> => {
    const response = await fetch(getTestServer(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const body = await response.json();
    if (body.error) {
        throw new Error(`${method} failed: ${JSON.stringify(body.error)}`);
    }
    return body.result;
};

/**
 * Sends a transfer so the chain produces a block.
 *
 * This node only produces empty blocks on a 60s timer, so a test that waits for
 * block events without causing any just times out. Gas comes from the chain's
 * own rule rather than a constant - it is the node that decides.
 *
 * The transaction goes out over plain HTTP rather than through the websocket
 * under test, so that driving the chain cannot mask a fault in the transport
 * these tests exist to check.
 */
export const produceBlock = async (): Promise<void> => {
    const account = privateKeyToAccount(getTestProposalAccountPrivateKey()) as Web3Account;

    const rule = (await rpc('rule', {})).value;
    const sender = (await rpc('account', { addr: account.address })).value;

    const tx = TrxProtoBuilder.buildTransferTrxProto({
        // The node's JSON carries the nonce as a decimal string.
        nonce: Number(sender.nonce),
        from: account.address,
        to: getTestAccountAddress().replace(/^0x/i, ''),
        amount: '10',
        gas: Number(rule.minTrxGas),
        gasPrice: String(rule.gasPrice),
    });
    TrxProtoBuilder.signTrxProto(tx, account, getTestChainId());

    const encoded = Buffer.from(TrxProtoUtils.encode(tx).finish()).toString('base64');
    const result = await rpc('broadcast_tx_commit', { tx: encoded });
    if (result.check_tx?.code !== 0 || result.deliver_tx?.code !== 0) {
        throw new Error(`the node rejected the transfer: ${JSON.stringify(result)}`);
    }
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

/** The height the chain reports right now. */
export const latestHeight = async (): Promise<number> =>
    Number((await rpc('status', {})).sync_info.latest_block_height);

/**
 * Makes the chain produce blocks and reports the height it reached.
 *
 * Two transfers sent in quick succession can share a block, so the number of
 * blocks is not the number of transfers. The height the chain reports is.
 */
export const produceBlocks = async (transfers: number): Promise<number> => {
    for (let i = 0; i < transfers; i++) {
        await produceBlock();
    }
    return latestHeight();
};

/**
 * Fails unless `heights` is an unbroken ascending run. A gap means the stream
 * dropped a block, which is the one thing a subscription must not do.
 */
export const assertUnbroken = (heights: number[]): void => {
    expect(heights.length).toBeGreaterThan(0);
    for (let i = 1; i < heights.length; i++) {
        if (heights[i] !== heights[i - 1] + 1) {
            throw new Error(`the subscription skipped a block: received ${heights.join(', ')}`);
        }
    }
};

export type { WebsocketProvider };
