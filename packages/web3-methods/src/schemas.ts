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

/** The fields of a contract log, as decodeEventABI formats them. */
export const logSchema = {
    type: 'object',
    properties: {
        removed: {
            format: 'bool',
        },
        logIndex: {
            format: 'uint',
        },
        transactionIndex: {
            format: 'uint',
        },
        transactionHash: {
            format: 'bytes32',
        },
        blockHash: {
            format: 'bytes32',
        },
        blockNumber: {
            format: 'uint',
        },
        address: {
            format: 'address',
        },
        data: {
            format: 'bytes',
        },
        topics: {
            type: 'array',
            items: {
                format: 'bytes32',
            },
        },
    },
};
