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
import { Stream } from 'xstream';
import { TrxProtoBuilder, TrxProtoUtils } from '@beatoz/web3-accounts';
import type { Web3RequestManager } from '@beatoz/web3-core';
import { rpcMethods } from '../../src';

// The node's routes and the parameters each one reads, by name:
// tendermint-ethaddr rpc/core/routes.go, and beatoz-go rpc/routes.go for the
// chain's own queries (which also replaces validators, tx_search and subscribe).
const ROUTES: Record<string, string[]> = {
    health: [],
    status: [],
    net_info: [],
    blockchain: ['minHeight', 'maxHeight'],
    genesis: [],
    genesis_chunked: ['chunk'],
    block: ['height'],
    block_by_hash: ['hash'],
    block_results: ['height'],
    commit: ['height'],
    check_tx: ['tx'],
    tx: ['hash', 'prove'],
    tx_search: ['query', 'prove', 'page', 'per_page', 'order_by'],
    block_search: ['query', 'page', 'per_page', 'order_by'],
    validators: ['height', 'page', 'per_page'],
    consensus_params: ['height'],
    unconfirmed_txs: ['limit'],
    num_unconfirmed_txs: [],
    broadcast_tx_commit: ['tx'],
    broadcast_tx_sync: ['tx'],
    broadcast_tx_async: ['tx'],
    abci_query: ['path', 'data', 'height', 'prove'],
    abci_info: [],
    account: ['addr', 'height'],
    delegatee: ['addr', 'height'],
    stakes: ['addr', 'height'],
    reward: ['addr', 'height'],
    rule: ['height'],
    total_supply: ['height'],
    total_txfee: [],
    txn: [],
    'stakes/total_power': ['height'],
    'stakes/voting_power': ['height'],
    vm_call: ['addr', 'to', 'height', 'data'],
    vm_estimate_gas: ['addr', 'to', 'height', 'data'],
    subscribe: ['query'],
};

type Sent = { method: string; params: Record<string, unknown> };

// Records each request as it goes over the wire (JSON drops undefined), then
// stops: what the node answers is not this test's concern.
const sent: Sent[] = [];
const stop = new Error('stopped after sending');
const manager = {
    send: async (request: unknown) => {
        sent.push(JSON.parse(JSON.stringify(request)));
        throw stop;
    },
    subscribe: (request: unknown) => {
        sent.push(JSON.parse(JSON.stringify(request)));
        return Stream.never();
    },
} as unknown as Web3RequestManager;

const from = '15633e505d01691a71f40049e15ba1340c0eea29';
const trx = TrxProtoBuilder.buildTransferTrxProto({
    from,
    to: from,
    nonce: 0,
    gas: 100000,
    gasPrice: '1',
    amount: '0',
});
const trxBase64 = Buffer.from(TrxProtoUtils.encode(trx).finish()).toString('base64');

const m = rpcMethods;
const cases: Array<[string, () => unknown, Sent]> = [
    ['health', () => m.health(manager), { method: 'health', params: {} }],
    ['status', () => m.status(manager), { method: 'status', params: {} }],
    ['netInfo', () => m.netInfo(manager), { method: 'net_info', params: {} }],
    [
        'blockchain',
        () => m.blockchain(manager, 1, 10),
        { method: 'blockchain', params: { minHeight: '1', maxHeight: '10' } },
    ],
    ['genesis', () => m.genesis(manager), { method: 'genesis', params: {} }],
    [
        'genesisChunked',
        () => m.genesisChunked(manager, 0),
        { method: 'genesis_chunked', params: { chunk: '0' } },
    ],
    ['block', () => m.block(manager, 5), { method: 'block', params: { height: '5' } }],
    ['block without a height', () => m.block(manager), { method: 'block', params: {} }],
    [
        'blockByHash',
        () => m.blockByHash(manager, '0A0B'),
        { method: 'block_by_hash', params: { hash: 'Cgs=' } },
    ],
    [
        'blockResults',
        () => m.blockResults(manager, 5),
        { method: 'block_results', params: { height: '5' } },
    ],
    ['commit', () => m.commit(manager, 5), { method: 'commit', params: { height: '5' } }],
    [
        'validators',
        () => m.validators(manager, 5, 2, 30),
        { method: 'validators', params: { height: '5', page: '2', per_page: '30' } },
    ],
    // The node answers for the latest height when there is none (#144).
    [
        'validators without a height',
        () => m.validators(manager),
        { method: 'validators', params: {} },
    ],
    [
        'consensusParams',
        () => m.consensusParams(manager, 5),
        { method: 'consensus_params', params: { height: '5' } },
    ],
    [
        'unconfirmedTxs',
        () => m.unconfirmedTxs(manager, 10),
        { method: 'unconfirmed_txs', params: { limit: '10' } },
    ],
    [
        'txSearch',
        () => m.txSearch(manager, 'tx.height=5', false, 2, 30, 'asc'),
        {
            method: 'tx_search',
            params: {
                query: 'tx.height=5',
                prove: false,
                page: '2',
                per_page: '30',
                order_by: 'asc',
            },
        },
    ],
    ['tx', () => m.tx(manager, '0A0B'), { method: 'tx', params: { hash: 'Cgs=', prove: true } }],
    ['abciInfo', () => m.abciInfo(manager), { method: 'abci_info', params: {} }],
    [
        'abciQuery',
        () => m.abciQuery(manager, '/p', 'ab', 5, true),
        { method: 'abci_query', params: { path: '/p', data: 'ab', height: '5', prove: true } },
    ],
    ['checkTx', () => m.checkTx(manager, trx), { method: 'check_tx', params: { tx: trxBase64 } }],
    [
        'numUnconfirmedTxs',
        () => m.numUnconfirmedTxs(manager),
        { method: 'num_unconfirmed_txs', params: {} },
    ],
    [
        'broadcastTxAsync',
        () => m.broadcastTxAsync(manager, trx),
        { method: 'broadcast_tx_async', params: { tx: trxBase64 } },
    ],
    [
        'broadcastTxSync',
        () => m.broadcastTxSync(manager, trx),
        { method: 'broadcast_tx_sync', params: { tx: trxBase64 } },
    ],
    [
        'broadcastTxCommit',
        () => m.broadcastTxCommit(manager, trx),
        { method: 'broadcast_tx_commit', params: { tx: trxBase64 } },
    ],
    [
        'broadcastRawTxAsync',
        () => m.broadcastRawTxAsync(manager, trxBase64),
        { method: 'broadcast_tx_async', params: { tx: trxBase64 } },
    ],
    [
        'broadcastRawTxSync',
        () => m.broadcastRawTxSync(manager, trxBase64),
        { method: 'broadcast_tx_sync', params: { tx: trxBase64 } },
    ],
    [
        'broadcastRawTxCommit',
        () => m.broadcastRawTxCommit(manager, trxBase64),
        { method: 'broadcast_tx_commit', params: { tx: trxBase64 } },
    ],
    [
        'delegatee',
        () => m.delegatee(manager, from),
        { method: 'delegatee', params: { addr: `0x${from}` } },
    ],
    ['rule', () => m.rule(manager), { method: 'rule', params: {} }],
    // A state query's height goes as a decimal string; the node refuses a
    // JSON number (#47).
    ['rule at a height', () => m.rule(manager, 7), { method: 'rule', params: { height: '7' } }],
    [
        'getAccount at a height',
        () => m.getAccount(manager, from, 5),
        { method: 'account', params: { addr: `0x${from}`, height: '5' } },
    ],
    [
        'delegatee at a height',
        () => m.delegatee(manager, from, '6'),
        { method: 'delegatee', params: { addr: `0x${from}`, height: '6' } },
    ],
    [
        'stakes at a height',
        () => m.stakes(manager, from, 8),
        { method: 'stakes', params: { addr: `0x${from}`, height: '8' } },
    ],
    [
        'reward at a height',
        () => m.reward(manager, from, 9),
        { method: 'reward', params: { addr: `0x${from}`, height: '9' } },
    ],
    [
        'getAccount',
        () => m.getAccount(manager, from),
        { method: 'account', params: { addr: `0x${from}` } },
    ],
    [
        'getAccount with 0x',
        () => m.getAccount(manager, `0x${from}`),
        { method: 'account', params: { addr: `0x${from}` } },
    ],
    ['stakes', () => m.stakes(manager, from), { method: 'stakes', params: { addr: `0x${from}` } }],
    ['reward', () => m.reward(manager, from), { method: 'reward', params: { addr: `0x${from}` } }],
    ['totalSupply', () => m.totalSupply(manager), { method: 'total_supply', params: {} }],
    [
        'totalSupply at a height',
        () => m.totalSupply(manager, 5),
        { method: 'total_supply', params: { height: '5' } },
    ],
    ['totalTxFee', () => m.totalTxFee(manager), { method: 'total_txfee', params: {} }],
    ['txCount', () => m.txCount(manager), { method: 'txn', params: {} }],
    ['totalPower', () => m.totalPower(manager), { method: 'stakes/total_power', params: {} }],
    [
        'totalPower at a height',
        () => m.totalPower(manager, '6'),
        { method: 'stakes/total_power', params: { height: '6' } },
    ],
    ['votingPower', () => m.votingPower(manager), { method: 'stakes/voting_power', params: {} }],
    [
        'votingPower at a height',
        () => m.votingPower(manager, 7),
        { method: 'stakes/voting_power', params: { height: '7' } },
    ],
    [
        'vmCall',
        () => m.vmCall(manager, from, from, 5, '0A0B'),
        {
            method: 'vm_call',
            params: { addr: `0x${from}`, to: `0x${from}`, height: '5', data: 'Cgs=' },
        },
    ],
    [
        'vmEstimateGas',
        () => m.vmEstimateGas(manager, from, from, '0A0B'),
        {
            method: 'vm_estimate_gas',
            params: { addr: `0x${from}`, to: `0x${from}`, height: '0', data: 'Cgs=' },
        },
    ],
    [
        'blockSearch',
        () => m.blockSearch(manager, 'block.height>1', 2, 30, 'desc'),
        {
            method: 'block_search',
            params: { query: 'block.height>1', page: '2', per_page: '30', order_by: 'desc' },
        },
    ],
    [
        'subscribeNewBlock',
        () => m.subscribeNewBlock(manager),
        { method: 'subscribe', params: { query: "tm.event='NewBlock'" } },
    ],
    [
        'subscribeNewBlockHeader',
        () => m.subscribeNewBlockHeader(manager),
        { method: 'subscribe', params: { query: "tm.event='NewBlockHeader'" } },
    ],
    [
        'subscribeTx',
        () => m.subscribeTx(manager, 'tx.height>5'),
        { method: 'subscribe', params: { query: "tm.event='Tx' AND tx.height>5" } },
    ],
];

describe('rpc methods send what the node reads', () => {
    beforeEach(() => {
        sent.length = 0;
    });

    it.each(cases)('%s', async (_name, call, expected) => {
        try {
            await call();
        } catch (e) {
            if (e !== stop) throw e;
        }

        expect(sent).toEqual([expected]);
        const [request] = sent;
        expect(Object.keys(ROUTES)).toContain(request.method);
        for (const name of Object.keys(request.params)) {
            expect(ROUTES[request.method]).toContain(name);
        }
    });
});
