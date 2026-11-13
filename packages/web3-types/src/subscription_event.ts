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

import type {
    RpcBlock,
    RpcConsensusParams,
    RpcEvent,
    RpcHeader,
    RpcTxData,
    RpcValidatorUpdate,
} from './response_decoder.js';

/**
 * One event from a subscription, as the node sends it. `Type` is the event's
 * `data.type` and `Value` its `data.value`; a subscription to an arbitrary
 * query does not know either, so they default to `string` and `unknown`.
 *
 * Values are the node's JSON, not decoded: integers are decimal strings and
 * bytes base64, as in the `Rpc*` types.
 */
export interface SubscriptionEvent<Type extends string = string, Value = unknown> {
    readonly query: string;
    readonly data: {
        readonly type: Type;
        readonly value: Value;
    };
    readonly events: Record<string, string[]>;
}

/** Events the node emits while running a block, as a block event carries them. */
export interface BlockEventResults {
    readonly result_begin_block: {
        readonly events?: readonly RpcEvent[];
    };
    readonly result_end_block: {
        readonly validator_updates?: readonly RpcValidatorUpdate[] | null;
        readonly consensus_param_updates?: RpcConsensusParams | null;
        readonly events?: readonly RpcEvent[];
    };
}

/**
 * What `subscribeNewBlock` emits. `ResponsesDecoder.decodeNewBlockEvent` turns
 * it into the decoded `Block` the block query returns.
 */
export type NewBlockSubscriptionEvent = SubscriptionEvent<
    'tendermint/event/NewBlock',
    BlockEventResults & { readonly block: RpcBlock }
>;

/**
 * What `subscribeNewBlockHeader` emits. `ResponsesDecoder.decodeNewBlockHeaderEvent`
 * turns it into a decoded `Header`.
 */
export type NewBlockHeaderSubscriptionEvent = SubscriptionEvent<
    'tendermint/event/NewBlockHeader',
    BlockEventResults & {
        readonly header: RpcHeader;
        /** Decimal string. */
        readonly num_txs: string;
    }
>;

/** What `subscribeTx` emits. */
export type TxSubscriptionEvent = SubscriptionEvent<
    'tendermint/event/Tx',
    {
        readonly TxResult: {
            /** Decimal string. */
            readonly height: string;
            /** Position in the block; left out when 0. */
            readonly index?: number;
            /** The encoded transaction, base64. */
            readonly tx: string;
            readonly result: RpcTxData;
        };
    }
>;
