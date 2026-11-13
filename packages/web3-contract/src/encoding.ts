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

import { format, isNullish, keccak256 } from '@beatoz/web3-utils';

import {
    AbiConstructorFragment,
    AbiEventFragment,
    AbiFunctionFragment,
    LogsInput,
    Filter,
    HexString,
    Topic,
    FMT_NUMBER,
    FMT_BYTES,
    DataFormat,
    DEFAULT_RETURN_FORMAT,
} from '@beatoz/web3-types';

import {
    decodeLog,
    decodeParameters,
    encodeEventSignature,
    encodeFunctionSignature,
    encodeParameter,
    encodeParameters,
    isAbiConstructorFragment,
    jsonInterfaceMethodToString,
} from '@beatoz/web3-abi';

import { blockSchema, logSchema } from '@beatoz/web3-methods';

import { Web3ContractError } from '@beatoz/web3-errors';

import { ContractOptions, ContractAbiWithSignature, EventLog } from './types.js';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };
export const encodeEventABI = (
    { address }: ContractOptions,
    event: AbiEventFragment & { signature: string },
    options?: Filter,
) => {
    const topics = options?.topics;
    const filter = options?.filter ?? {};
    const opts: Writeable<Filter> = {};

    if (!isNullish(options?.fromBlock)) {
        opts.fromBlock = format(blockSchema.properties.number, options?.fromBlock, {
            number: FMT_NUMBER.HEX,
            bytes: FMT_BYTES.HEX,
        });
    }
    if (!isNullish(options?.toBlock)) {
        opts.toBlock = format(blockSchema.properties.number, options?.toBlock, {
            number: FMT_NUMBER.HEX,
            bytes: FMT_BYTES.HEX,
        });
    }

    if (topics && Array.isArray(topics)) {
        opts.topics = [...topics] as Topic[];
    } else {
        opts.topics = [];
        // add event signature
        if (event && !event.anonymous && event.name !== 'ALLEVENTS') {
            opts.topics.push(
                event.signature ?? encodeEventSignature(jsonInterfaceMethodToString(event)),
            );
        }

        // add event topics (indexed arguments)
        if (event.name !== 'ALLEVENTS' && event.inputs) {
            for (const input of event.inputs) {
                if (!input.indexed) {
                    continue;
                }

                const value = filter[input.name];
                if (!value) {
                    opts.topics.push(null);
                    continue;
                }

                // TODO: https://github.com/ethereum/web3.js/issues/344
                // TODO: deal properly with components
                if (Array.isArray(value)) {
                    opts.topics.push(value.map((v) => encodeParameter(input.type, v)));
                } else if (input.type === 'string') {
                    opts.topics.push(keccak256(value as string));
                } else {
                    opts.topics.push(encodeParameter(input.type, value));
                }
            }
        }
    }

    if (!opts.topics.length) delete opts.topics;

    if (address) {
        opts.address = address.toLowerCase();
    }

    return opts;
};

export const decodeEventABI = (
    event: AbiEventFragment & { signature: string },
    data: LogsInput,
    jsonInterface: ContractAbiWithSignature,
    returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
): EventLog => {
    let modifiedEvent = { ...event };

    const result = format(logSchema, data, returnFormat);

    // if allEvents get the right event
    if (modifiedEvent.name === 'ALLEVENTS') {
        const matchedEvent = jsonInterface.find((j) => j.signature === data.topics[0]);
        if (matchedEvent) {
            modifiedEvent = matchedEvent as AbiEventFragment & { signature: string };
        } else {
            modifiedEvent = { anonymous: true } as unknown as AbiEventFragment & {
                signature: string;
            };
        }
    }

    // create empty inputs if none are present (e.g. anonymous events on allEvents)
    modifiedEvent.inputs = modifiedEvent.inputs ?? event.inputs ?? [];

    // Handle case where an event signature shadows the current ABI with non-identical
    // arg indexing. If # of topics doesn't match, event is anon.
    if (!modifiedEvent.anonymous) {
        let indexedInputs = 0;
        (modifiedEvent.inputs ?? []).forEach((input) => {
            if (input.indexed) {
                indexedInputs += 1;
            }
        });

        if (indexedInputs > 0 && data?.topics && data?.topics.length !== indexedInputs + 1) {
            // checks if event is anonymous
            modifiedEvent = {
                ...modifiedEvent,
                anonymous: true,
                inputs: [],
            };
        }
    }

    const argTopics = modifiedEvent.anonymous ? data.topics : (data.topics ?? []).slice(1);
    return {
        ...result,
        returnValues: decodeLog([...(modifiedEvent.inputs ?? [])], data.data, argTopics),
        event: modifiedEvent.name,
        signature:
            modifiedEvent.anonymous || !data.topics || data.topics.length === 0 || !data.topics[0]
                ? undefined
                : data.topics[0],

        raw: {
            data: data.data,
            topics: data.topics,
        },
    };
};

export const encodeMethodABI = (
    abi: AbiFunctionFragment | AbiConstructorFragment,
    args: unknown[],
    deployData?: HexString,
) => {
    const inputLength = Array.isArray(abi.inputs) ? abi.inputs.length : 0;

    if (inputLength !== args.length) {
        throw new Web3ContractError(
            `The number of arguments is not matching the methods required number. You need to pass ${inputLength} arguments.`,
        );
    }

    const params = encodeParameters(Array.isArray(abi.inputs) ? abi.inputs : [], args).replace(
        '0x',
        '',
    );

    if (isAbiConstructorFragment(abi)) {
        if (!deployData)
            throw new Web3ContractError(
                'The contract has no contract data option set. This is necessary to append the constructor parameters.',
            );

        if (!deployData.startsWith('0x')) {
            return `0x${deployData}${params}`;
        }

        return `${deployData}${params}`;
    }

    return `${encodeFunctionSignature(abi)}${params}`;
};

/**
 * Decodes what a contract call returned, by the function's outputs: nothing
 * for no outputs, the value itself for one, an array for more, as viem's
 * decodeFunctionResult does. `returnValues` is hex, with or without 0x.
 */
export const decodeMethodReturn = (abi: AbiFunctionFragment, returnValues: HexString): unknown => {
    const outputs = abi.outputs ?? [];
    if (outputs.length === 0) {
        return undefined;
    }
    const result = decodeParameters([...outputs], returnValues.replace(/^0x/i, ''));
    if (outputs.length === 1) {
        return result[0];
    }
    return outputs.map((_, i) => result[i]);
};
