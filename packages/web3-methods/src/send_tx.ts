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

import { Web3Context } from '@beatoz/web3-core';
import { rpcMethods } from '@beatoz/web3-rpc';
import {
    BroadcastTxAsyncResponse,
    BroadcastTxCommitResponse,
    BroadcastTxSyncResponse,
    SignScheme,
    TrxProto,
    Web3NonceManager,
} from '@beatoz/web3-types';
import { TrxProtoBuilder } from '@beatoz/web3-accounts';
import { InvalidInputError, TransactionFailedError } from '@beatoz/web3-errors';

/**
 * Counts nonces in memory, per address: the first send from an address reads
 * its nonce from the node, and each send after that takes the next one. A
 * failed send forgets the address, so the next one reads the node again.
 *
 * It only knows the sends made through it. Another process sending from the
 * same account makes its count wrong; the send that fails for it resets it.
 * Modelled on viem's `nonceManager` (viem `src/utils/nonceManager.ts`).
 */
export class NonceManager implements Web3NonceManager {
    // The next nonce per address, as a promise so that sends started together
    // ask the node once and get consecutive nonces.
    private readonly nonces = new Map<string, Promise<number>>();

    public consume(address: string, fetch: () => Promise<number>): Promise<number> {
        const key = addressKey(address);
        const current = this.nonces.get(key) ?? fetch();
        const next = current.then((nonce) => nonce + 1);
        this.nonces.set(key, next);
        // A failed lookup is not kept: the next send asks the node again.
        next.catch(() => {
            if (this.nonces.get(key) === next) this.nonces.delete(key);
        });
        return current;
    }

    public reset(address: string): void {
        this.nonces.delete(addressKey(address));
    }
}

const addressKey = (address: string) => address.toLowerCase().replace(/^0x/, '');

/**
 * The nonce to send with from `address`: `given` when there is one, else from
 * the context's nonce manager, else the node's.
 */
export async function nextNonce(
    web3Context: Web3Context,
    address: string,
    given?: number,
): Promise<number> {
    if (given !== undefined) return given;
    const fromNode = async () =>
        Number((await rpcMethods.getAccount(web3Context.requestManager, address)).value.nonce);
    return web3Context.nonceManager
        ? web3Context.nonceManager.consume(address, fromNode)
        : fromNode();
}

/**
 * Builds a transaction with the next nonce of `address` (see `nextNonce`).
 * When `build` throws, nothing was sent, so the nonce manager forgets
 * `address` rather than skip the nonce it gave out.
 */
export async function buildWithNonce<T>(
    web3Context: Web3Context,
    address: string,
    given: number | undefined,
    build: (nonce: number) => T,
): Promise<T> {
    const nonce = await nextNonce(web3Context, address, given);
    try {
        return build(nonce);
    } catch (error) {
        web3Context.nonceManager?.reset(address);
        throw error;
    }
}

/** How a send waits: for the block (`commit`), `check_tx` (`sync`) or nothing (`async`). */
export type SendMode = 'commit' | 'sync' | 'async';

export type SendTxResult<M extends SendMode> = M extends 'sync'
    ? BroadcastTxSyncResponse
    : M extends 'async'
      ? BroadcastTxAsyncResponse
      : BroadcastTxCommitResponse;

/**
 * Sends a signed transaction. When the node refuses it or it fails in the
 * block, the context's nonce manager forgets `from`, whose count is then not
 * to be trusted. The result is returned as the node gave it.
 */
export async function broadcastSigned<M extends SendMode = 'commit'>(
    web3Context: Web3Context,
    tx: TrxProto,
    from: string,
    sendMode?: M,
): Promise<SendTxResult<M>> {
    const rm = web3Context.requestManager;
    try {
        if (sendMode === 'async') {
            return (await rpcMethods.broadcastTxAsync(rm, tx)) as SendTxResult<M>;
        }
        if (sendMode === 'sync') {
            const res = await rpcMethods.broadcastTxSync(rm, tx);
            if (res.code !== 0) web3Context.nonceManager?.reset(from);
            return res as SendTxResult<M>;
        }
        const res = await rpcMethods.broadcastTxCommit(rm, tx);
        if (res.check_tx.code !== 0 || res.deliver_tx?.code !== 0) {
            web3Context.nonceManager?.reset(from);
        }
        return res as SendTxResult<M>;
    } catch (error) {
        web3Context.nonceManager?.reset(from);
        throw error;
    }
}

/**
 * What a native send takes besides the transaction. Each one left out is
 * filled from the chain.
 */
export interface SendTxOptions<M extends SendMode = 'commit'> {
    /** Default: the nonce manager's, or the account's nonce on the node. */
    nonce?: number;
    /**
     * Default: the chain's `minTrxGas`. A native transaction is charged all
     * the gas it carries (beatoz-go `node/trx_executor.go`), so more only
     * costs more.
     */
    gas?: number;
    /** Default: the chain's `gasPrice`. */
    gasPrice?: string;
    /** Default `commit`. */
    sendMode?: M;
    /** The signature scheme, `v0` by default; see `SignScheme`. */
    scheme?: SignScheme;
}

type Fields = { from: string; nonce: number; gas: number; gasPrice: string };

async function sendNative<M extends SendMode>(
    web3Context: Web3Context,
    from: string,
    build: (fields: Fields) => TrxProto,
    options: SendTxOptions<M> = {},
): Promise<SendTxResult<M>> {
    const account = web3Context.wallet?.get(from);
    if (account === undefined) {
        throw new InvalidInputError(`from must be an account in the wallet, got ${from}`);
    }
    const needRule = options.gas === undefined || options.gasPrice === undefined;
    const rule = needRule ? (await rpcMethods.rule(web3Context.requestManager)).value : undefined;
    const chainId = web3Context.chainId ?? (await web3Context.decideChainId());
    // The caller's values go to the builder as given, which checks them.
    const tx = await buildWithNonce(web3Context, account.address, options.nonce, (nonce) =>
        build({
            from: account.address,
            nonce,
            gas: options.gas ?? Number(rule!.minTrxGas),
            gasPrice: options.gasPrice ?? rule!.gasPrice,
        }),
    );
    account.signTransaction(tx, chainId, { scheme: options.scheme });

    const res = await broadcastSigned(web3Context, tx, account.address, options.sendMode);
    assertAccepted(res, options.sendMode);
    return res;
}

/**
 * Throws `TransactionFailedError` for a transaction the node refused
 * (`check_tx`) or failed in the block (`deliver_tx`). An async send has no
 * result to look at, and passes.
 */
export function assertAccepted(
    res: BroadcastTxAsyncResponse | BroadcastTxSyncResponse | BroadcastTxCommitResponse,
    sendMode?: SendMode,
) {
    if (sendMode === 'async') return;
    if (sendMode === 'sync') {
        const sync = res as BroadcastTxSyncResponse;
        if (sync.code !== 0) {
            throw new TransactionFailedError({
                stage: 'check_tx',
                code: sync.code,
                log: sync.log,
                hash: sync.hash,
            });
        }
        return;
    }
    const commit = res as BroadcastTxCommitResponse;
    if (commit.check_tx.code !== 0) {
        throw new TransactionFailedError({
            stage: 'check_tx',
            code: commit.check_tx.code,
            log: commit.check_tx.log,
            hash: commit.hash,
        });
    }
    if (commit.deliver_tx === undefined || commit.deliver_tx.code !== 0) {
        throw new TransactionFailedError({
            stage: 'deliver_tx',
            code: commit.deliver_tx?.code ?? -1,
            log: commit.deliver_tx?.log,
            hash: commit.hash,
        });
    }
}

/** Sends `amount` (in the smallest unit) from `from` to `to`. */
export async function transfer<M extends SendMode = 'commit'>(
    web3Context: Web3Context,
    tx: { from: string; to: string; amount: string },
    options?: SendTxOptions<M>,
) {
    return sendNative(
        web3Context,
        tx.from,
        (fields) =>
            TrxProtoBuilder.buildTransferTrxProto({ ...fields, to: tx.to, amount: tx.amount }),
        options,
    );
}

/** Stakes `amount` (in the smallest unit) from `from` to the validator `to`. */
export async function delegate<M extends SendMode = 'commit'>(
    web3Context: Web3Context,
    tx: { from: string; to: string; amount: string },
    options?: SendTxOptions<M>,
) {
    return sendNative(
        web3Context,
        tx.from,
        (fields) =>
            TrxProtoBuilder.buildDelegateTrxProto({ ...fields, to: tx.to, amount: tx.amount }),
        options,
    );
}

/**
 * Takes back the stake made by the transaction `txHash` (hex) from the
 * validator `to`.
 */
export async function undelegate<M extends SendMode = 'commit'>(
    web3Context: Web3Context,
    tx: { from: string; to: string; txHash: string },
    options?: SendTxOptions<M>,
) {
    return sendNative(
        web3Context,
        tx.from,
        (fields) =>
            TrxProtoBuilder.buildUnDelegateTrxProto({
                ...fields,
                to: tx.to,
                amount: '0',
                payload: { txHash: tx.txHash },
            }),
        options,
    );
}

/** Withdraws `amount` (in the smallest unit) of `from`'s reward to its balance. */
export async function withdrawReward<M extends SendMode = 'commit'>(
    web3Context: Web3Context,
    tx: { from: string; amount: string },
    options?: SendTxOptions<M>,
) {
    return sendNative(
        web3Context,
        tx.from,
        (fields) =>
            TrxProtoBuilder.buildWithdrawTrx({
                ...fields,
                to: fields.from,
                amount: '0',
                payload: { reqAmt: tx.amount },
            }),
        options,
    );
}
