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
    NewBlockHeaderSubscriptionEvent,
    NewBlockSubscriptionEvent,
    ResponsesDecoder,
    TxSubscriptionEvent,
} from '../../src';
import events from './fixtures/subscription_events.json';

// One event of each kind as the test node (the beatoz/beatoz-re image pinned
// in scripts/testnode.config.json) sent it on 2026-11-13, for a block with one
// transfer. Assigning them to the event types checks the types against what
// the node sends, wherever the tests are type-checked (#89).
const newBlock: NewBlockSubscriptionEvent = events.newBlock as NewBlockSubscriptionEvent;
const newBlockHeader: NewBlockHeaderSubscriptionEvent =
    events.newBlockHeader as NewBlockHeaderSubscriptionEvent;
const tx: TxSubscriptionEvent = events.tx as TxSubscriptionEvent;

describe('subscription events', () => {
    it('carry the type their subscription names', () => {
        expect(newBlock.data.type).toEqual('tendermint/event/NewBlock');
        expect(newBlockHeader.data.type).toEqual('tendermint/event/NewBlockHeader');
        expect(tx.data.type).toEqual('tendermint/event/Tx');
    });

    it('carry the node JSON: integers as strings, bytes as base64', () => {
        expect(newBlockHeader.data.value.header.height).toEqual('2906');
        expect(newBlockHeader.data.value.num_txs).toEqual('1');
        expect(newBlock.data.value.block.data.txs).toHaveLength(1);
        expect(newBlock.data.value.block.last_commit.round).toBe(0);
        expect(tx.data.value.TxResult.height).toEqual('2906');
        expect(tx.data.value.TxResult.result.gas_used).toEqual('5000');
        expect(Buffer.from(tx.data.value.TxResult.tx, 'base64').length).toBeGreaterThan(0);
    });

    it('decode a block event to the block the block query returns', () => {
        const block = ResponsesDecoder.decodeNewBlockEvent(newBlock);
        expect(block.header.height).toBe(2906);
        expect(block.data.txs).toHaveLength(1);
    });

    it('decode a block header event', () => {
        const header = ResponsesDecoder.decodeNewBlockHeaderEvent(newBlockHeader);
        expect(header.height).toBe(2906);
        expect(header.chain_id).toEqual('0x1234');
    });
});
