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

import * as responses from '../responses.js';
import {
    Transaction1559UnsignedAPI,
    Transaction2930UnsignedAPI,
    TransactionLegacyUnsignedAPI,
} from './eth_execution_api.js';
import { Address } from '../beatoz_types.js';

// https://github.com/ethereum/execution-apis/blob/main/src/schemas/transaction.yaml#L144
export type TransactionUnsignedAPI =
    Transaction1559UnsignedAPI | Transaction2930UnsignedAPI | TransactionLegacyUnsignedAPI;

export type TransactionWithSenderAPI = TransactionUnsignedAPI & { from: Address };

export type BeatozExecutionAPI = {
    // start tendermint apis

    health: () => responses.HealthResponse;
    status: () => responses.StatusResponse;
    net_info: () => responses.NetInfoResponse;
    blockchain: (
        minHeight?: string | number,
        maxHeight?: string | number,
    ) => responses.BlockchainResponse;
    block: (height?: string | number) => responses.BlockResponse;
    block_by_hash: (hash: Uint8Array) => responses.BlockchainResponse;
    block_results: (height?: string | number) => responses.BlockResultsResponse;
    commit: (height?: string) => responses.CommitResponse;
    validators: (
        height: string | number,
        page?: number | string,
        per_page?: number | string,
    ) => responses.ValidatorsResponse;
    genesis: () => responses.GenesisResponse;
    genesis_chunked: (chunk: number | string) => responses.GenesisChunkedResponse;
    dump_consensus_state: () => responses.DumpConsensusStateResponse;
    consensus_state: () => responses.ConsensusStateResponse;
    consensus_params: (height?: number | string) => responses.ConsensusParamsResponse;
    unconfirmed_txs: (limit?: number | string) => responses.UnconfirmedTxsResponse;
    tx_search: (
        query: string,
        prove?: boolean,
        page?: number | string,
        per_page?: number | string,
        order_by?: string,
    ) => responses.TxSearchResponse;
    block_search: (
        query: string,
        page: string,
        per_page: string,
        order_by: string,
    ) => responses.BlockSearchResponse;
    tx: (hash: string) => responses.TxResponse;
    abci_info: () => responses.AbciInfoResponse;
    abci_query: (
        path: string,
        data: string,
        height?: string | number,
        prove?: boolean,
    ) => responses.AbciQueryResponse;
    check_tx: (tx: string) => responses.CheckTxResponse;
    num_unconfirmed_txs: () => responses.NumUnconfirmedTxsResponse;

    // broadcast apis
    broadcast_evidence: (evidence: string) => void;
    broadcast_tx_sync: (tx: string) => responses.BroadcastTxSyncResponse;
    broadcast_tx_async: (tx: string) => responses.BroadcastTxAsyncResponse;
    broadcast_tx_commit: (tx: string) => responses.BroadcastTxCommitResponse;

    // end tendermint apis

    // start not tendermint apis
    delegatee: (addr: string) => responses.DelegateeResponse;
    rule: () => responses.RuleResponse;
    account: (addr: string) => responses.AccountResponse;
    proposal: (txHash: string) => responses.ProposalResponse;
    stakes: (addr: string) => responses.StakesResponse;
    reward: (addr: string) => responses.RewardResponse;
    vmCall: (vmCall: string) => responses.VmCallResponse;
    // end not tendermint apis

    // The node answers the subscribe request itself with {}; the events
    // arrive on the stream that subscribe() returns.
    subscribe: (query: string) => Record<string, never>;
};
