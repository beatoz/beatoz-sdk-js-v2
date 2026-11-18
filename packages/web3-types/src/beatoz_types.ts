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

import { Bytes, HexString, Numbers } from './primitives_types.js';

export type ValueTypes = 'address' | 'bool' | 'string' | 'int256' | 'uint256' | 'bytes' | 'bigint';
// Hex encoded 32 bytes
export type HexString32Bytes = HexString;
// Hex encoded 16 bytes
export type HexString16Bytes = HexString;
// Hex encoded 8 bytes
export type HexString8Bytes = HexString;
// Hex encoded 1 byte
export type HexStringSingleByte = HexString;
// Hex encoded 1 byte
export type HexStringBytes = HexString;
// Hex encoded unsigned integer
export type Uint = HexString;
// Hex encoded unsigned integer 32 bytes
export type Uint256 = HexString;
// Hex encoded address
export type Address = HexString;

export type Topic = HexString32Bytes;

export type TransactionHash = HexString;

export interface TransactionReceiptBase<numberType, hashByteType, logsBloomByteType, logsType> {
    readonly transactionHash: hashByteType;
    readonly transactionIndex: numberType;
    readonly blockHash: hashByteType;
    readonly blockNumber: numberType;
    readonly from: Address;
    readonly to: Address;
    readonly cumulativeGasUsed: numberType;
    readonly gasUsed: numberType;
    readonly effectiveGasPrice?: numberType;
    readonly contractAddress?: Address;
    readonly logs: logsType[];
    readonly logsBloom: logsBloomByteType;
    readonly root: hashByteType;
    readonly status: numberType;
    readonly type?: numberType;
}

export type TransactionReceipt = TransactionReceiptBase<Numbers, Bytes, Bytes, Log>;

export interface Log extends LogBase<Numbers, Bytes> {
    readonly id?: string;
}

export interface LogBase<NumberType, ByteType> {
    readonly removed?: boolean;
    readonly logIndex?: NumberType;
    readonly transactionIndex?: NumberType;
    readonly transactionHash?: ByteType;
    readonly blockHash?: ByteType;
    readonly blockNumber?: NumberType;
    readonly address?: Address;
    readonly data?: ByteType;
    readonly topics?: ByteType[];
    readonly id?: string;
}

export type BlockNumberOrTag = Numbers;

export interface Proof {
    readonly address: HexString;
    readonly nonce: string;
    readonly balance: string;
}

export interface LogsInput {
    readonly blockHash?: HexString;
    readonly transactionHash?: HexString;
    readonly logIndex?: HexString;
    readonly id?: string;
    readonly blockNumber?: HexString;
    readonly transactionIndex?: HexString;
    readonly address: HexString;
    readonly topics: HexString[];
    readonly data: HexString;
}
type FilterOption = Record<string, Numbers | Numbers[] | boolean | boolean[]>;

// https://github.com/ethereum/execution-apis/blob/main/src/schemas/filter.json#L28
export interface Filter {
    readonly fromBlock?: BlockNumberOrTag;
    readonly toBlock?: BlockNumberOrTag;
    readonly address?: Address | Address[];
    readonly blockHash?: Address;
    // Using "null" type intentionally to match specifications
    readonly topics?: (null | Topic | Topic[])[];
    readonly filter?: FilterOption;
}

// What the contract package assembles before building a transaction: the
// values the caller gave and the encoded call.
interface TransactionBase {
    value?: Numbers;
    gas?: Numbers;
    gasPrice?: Numbers;
    data?: Bytes;
    input?: Bytes;
    nonce?: Numbers;
}

export interface Transaction extends TransactionBase {
    from?: Address;
    to?: Address | null;
}

export interface TransactionCall extends Transaction {
    to: Address;
}
