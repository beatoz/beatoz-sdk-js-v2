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
import * as rpcMethodsWrappers from './rpc_method_wrappers.js';
import { TrxProto } from '@beatoz/web3-types';
import { WaitForTxOptions } from './types.js';
import * as sendTx from './send_tx.js';
import { SendMode, SendTxOptions } from './send_tx.js';

export class Web3Method extends Web3Context {
    public constructor() {
        super();
    }

    getUrl(): string {
        return this.requestManager.provider.getClientUrl();
    }

    health() {
        return rpcMethodsWrappers.health(this);
    }

    status() {
        return rpcMethodsWrappers.status(this);
    }

    netInfo() {
        return rpcMethodsWrappers.netInfo(this);
    }

    blockchain(minHeight?: number | string, maxHeight?: number | string) {
        return rpcMethodsWrappers.blockchain(this, minHeight, maxHeight);
    }

    block(height?: string | number) {
        return rpcMethodsWrappers.block(this, height);
    }

    blockByHash(hash: string | Uint8Array) {
        return rpcMethodsWrappers.blockByHash(this, hash);
    }

    blockResults(height?: string | number) {
        return rpcMethodsWrappers.blockResults(this, height);
    }

    commit(height?: string | number) {
        return rpcMethodsWrappers.commit(this, height);
    }

    validators(height?: string | number, page?: number, per_page?: number) {
        return rpcMethodsWrappers.validators(this, height, page, per_page);
    }

    genesis() {
        return rpcMethodsWrappers.genesis(this);
    }

    genesisChunked(chunk: number | string) {
        return rpcMethodsWrappers.genesisChunked(this, chunk);
    }

    dumpConsensusState() {
        return rpcMethodsWrappers.dumpConsensusState(this);
    }

    consensusState() {
        return rpcMethodsWrappers.consensusState(this);
    }

    consensusParams(height?: string | number) {
        return rpcMethodsWrappers.consensusParams(this, height);
    }

    unconfirmedTxs(limit: number) {
        return rpcMethodsWrappers.unconfirmedTxs(this, limit);
    }

    txSearch(query: string, prove?: boolean, page?: number, per_page?: number) {
        return rpcMethodsWrappers.txSearch(this, query, prove, page, per_page);
    }

    tx(hash: string | Uint8Array) {
        return rpcMethodsWrappers.tx(this, hash);
    }

    waitForTx(hash: string | Uint8Array, options?: WaitForTxOptions) {
        return rpcMethodsWrappers.waitForTx(this, hash, options);
    }

    abciInfo() {
        return rpcMethodsWrappers.abciInfo(this);
    }

    abciQuery(path: string, data: string, height?: string | number, prove?: boolean) {
        return rpcMethodsWrappers.abciQuery(this, path, data, height, prove);
    }

    /**
     * The node's transaction check. Not a dry run: a passing check advances
     * the sender's nonce until the next block, so the same transaction sent
     * right after is refused as `invalid nonce`. See `rpcMethods.checkTx`.
     */
    checkTx(tx: TrxProto) {
        return rpcMethodsWrappers.checkTx(this, tx);
    }

    numUnconfirmedTxs() {
        return rpcMethodsWrappers.numUnconfirmedTxs(this);
    }

    broadcastTxSync(tx: TrxProto) {
        return rpcMethodsWrappers.broadcastTxSync(this, tx);
    }

    broadcastTxAsync(tx: TrxProto) {
        return rpcMethodsWrappers.broadcastTxAsync(this, tx);
    }

    broadcastTxCommit(tx: TrxProto) {
        return rpcMethodsWrappers.broadcastTxCommit(this, tx);
    }

    broadcastRawTxSync(signedRawTx: string) {
        return rpcMethodsWrappers.broadcastRawTxSync(this, signedRawTx);
    }

    broadcastRawTxAsync(signedRawTx: string) {
        return rpcMethodsWrappers.broadcastRawTxAsync(this, signedRawTx);
    }

    broadcastRawTxCommit(signedRawTx: string) {
        return rpcMethodsWrappers.broadcastRawTxCommit(this, signedRawTx);
    }

    /** `height`: the block to read the state at; the latest when left out. */
    delegatee(addr: string, height?: number | string) {
        return rpcMethodsWrappers.delegatee(this, addr, height);
    }

    /** `height`: the block to read the rules at; the latest when left out. */
    rule(height?: number | string) {
        return rpcMethodsWrappers.rule(this, height);
    }

    /** `height`: the block to read the state at; the latest when left out. */
    getAccount(addr: string, height?: number | string) {
        return rpcMethodsWrappers.getAccount(this, addr, height);
    }

    /** `height`: the block to read the state at; the latest when left out. */
    stakes(addr: string, height?: number | string) {
        return rpcMethodsWrappers.stakes(this, addr, height);
    }

    /** `height`: the block to read the state at; the latest when left out. */
    reward(addr: string, height?: number | string) {
        return rpcMethodsWrappers.reward(this, addr, height);
    }

    /** Total supply, in the smallest unit; `height` as for `getAccount`. */
    totalSupply(height?: number | string) {
        return rpcMethodsWrappers.totalSupply(this, height);
    }

    /** Fees paid by every transaction so far, at the latest block. */
    totalTxFee() {
        return rpcMethodsWrappers.totalTxFee(this);
    }

    /** Transactions the chain has run so far, at the latest block. */
    txCount() {
        return rpcMethodsWrappers.txCount(this);
    }

    /** Power staked to every delegatee; `height` as for `getAccount`. */
    totalPower(height?: number | string) {
        return rpcMethodsWrappers.totalPower(this, height);
    }

    /** Power of the delegatees that qualify as validators; `height` as for `getAccount`. */
    votingPower(height?: number | string) {
        return rpcMethodsWrappers.votingPower(this, height);
    }

    vmCall(addr: string, to: string, height: number, data: string) {
        return rpcMethodsWrappers.vmCall(this, addr, to, height, data);
    }

    /** The gas an EVM call from `addr` to `to` with `data` would use, at the latest block. */
    vmEstimateGas(addr: string, to: string, data: string) {
        return rpcMethodsWrappers.vmEstimateGas(this, addr, to, data);
    }

    /** Blocks matching a query on block events, such as `block.height > 100`. */
    blockSearch(query: string, page?: number, per_page?: number, order_by?: 'asc' | 'desc') {
        return rpcMethodsWrappers.blockSearch(this, query, page, per_page, order_by);
    }

    subscribe(query: string) {
        return rpcMethodsWrappers.subscribe(this, query);
    }

    subscribeNewBlock() {
        return rpcMethodsWrappers.subscribeNewBlock(this);
    }

    subscribeNewBlockHeader() {
        return rpcMethodsWrappers.subscribeNewBlockHeader(this);
    }

    subscribeTx(query?: string) {
        return rpcMethodsWrappers.subscribeTx(this, query);
    }

    /** Sends `amount` from `from`, an account in the wallet, to `to`. See `SendTxOptions`. */
    transfer<M extends SendMode = 'commit'>(
        tx: { from: string; to: string; amount: string },
        options?: SendTxOptions<M>,
    ) {
        return sendTx.transfer(this, tx, options);
    }

    /** Stakes `amount` from `from` to the validator `to`. See `SendTxOptions`. */
    delegate<M extends SendMode = 'commit'>(
        tx: { from: string; to: string; amount: string },
        options?: SendTxOptions<M>,
    ) {
        return sendTx.delegate(this, tx, options);
    }

    /** Takes back the stake made by `txHash` from the validator `to`. See `SendTxOptions`. */
    undelegate<M extends SendMode = 'commit'>(
        tx: { from: string; to: string; txHash: string },
        options?: SendTxOptions<M>,
    ) {
        return sendTx.undelegate(this, tx, options);
    }

    /** Withdraws `amount` of `from`'s reward to its balance. See `SendTxOptions`. */
    withdrawReward<M extends SendMode = 'commit'>(
        tx: { from: string; amount: string },
        options?: SendTxOptions<M>,
    ) {
        return sendTx.withdrawReward(this, tx, options);
    }
}
