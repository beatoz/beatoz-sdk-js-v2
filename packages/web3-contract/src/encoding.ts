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
    AbiErrorFragment,
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
    encodeErrorSignature,
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

// Matches what abitype types an output as, as viem decodes it.
const smallInteger = /^u?int(8|16|24|32|40|48)$/;
const arrayType = /^(.*)\[\d*\]$/;

type OutputParameter = {
    readonly type: string;
    readonly name?: string;
    readonly components?: readonly OutputParameter[];
};

/**
 * Turns a decoded value into the shape abitype gives it: integers of 48 bits
 * or fewer are numbers (they fit exactly), wider ones stay bigints; a tuple
 * whose components all have names is an object, otherwise an array; arrays
 * are plain arrays. The ABI decoder returns bigints for every integer and
 * array-like objects with index and name keys for tuples.
 */
const toAbitypeShape = (param: OutputParameter, value: unknown): unknown => {
    const array = arrayType.exec(param.type);
    if (array) {
        const element = { ...param, type: array[1] };
        return Array.from(value as ArrayLike<unknown>, (item) => toAbitypeShape(element, item));
    }
    if (param.type === 'tuple') {
        const components = param.components ?? [];
        const fields = components.map((component, i) =>
            toAbitypeShape(component, (value as Record<number, unknown>)[i]),
        );
        return components.length > 0 && components.every((component) => component.name)
            ? Object.fromEntries(components.map((component, i) => [component.name, fields[i]]))
            : fields;
    }
    if (smallInteger.test(param.type)) {
        return Number(value);
    }
    return value;
};

/**
 * Decodes what a contract call returned, by the function's outputs: nothing
 * for no outputs, the value itself for one, an array for more, as viem's
 * decodeFunctionResult does. `returnValues` is hex, with or without 0x.
 */
export const decodeMethodReturn = (abi: AbiFunctionFragment, returnValues: HexString): unknown => {
    const outputs = (abi.outputs ?? []) as readonly OutputParameter[];
    if (outputs.length === 0) {
        return undefined;
    }
    const result = decodeParameters([...(abi.outputs ?? [])], returnValues.replace(/^0x/i, ''));
    const values = outputs.map((output, i) => toAbitypeShape(output, result[i]));
    return values.length === 1 ? values[0] : values;
};

// Solidity's built-in errors: require/revert with a message, and a panic.
const ERROR_SELECTOR = '0x08c379a0'; // Error(string)
const PANIC_SELECTOR = '0x4e487b71'; // Panic(uint256)

// https://docs.soliditylang.org/en/latest/control-structures.html#panic-via-assert-and-error-via-require
const panicReasons: Record<number, string> = {
    0x01: 'An `assert` condition failed.',
    0x11: 'Arithmetic operation resulted in underflow or overflow.',
    0x12: 'Division or modulo by zero (e.g. `5 / 0` or `23 % 0`).',
    0x21: 'Attempted to convert to an invalid type.',
    0x22: 'Attempted to access a storage byte array that is incorrectly encoded.',
    0x31: 'Performed `.pop()` on an empty array',
    0x32: 'Array index is out of bounds.',
    0x41: 'Allocated too much memory or created an array which is too large.',
    0x51: 'Attempted to call a zero-initialized variable of internal function type.',
};

export type DecodedRevert = {
    reason?: string;
    errorName?: string;
    args?: readonly unknown[];
    signature?: string;
};

/**
 * Decodes what a contract reverted with: `Error(string)`, `Panic(uint256)`,
 * or one of `errors` from the contract's ABI, matched by its 4-byte
 * selector. A selector none of them has is returned as `signature`. Data
 * shorter than a selector, as from `revert()` with nothing, decodes to
 * nothing. Arguments take the shapes `call()` returns.
 */
export const decodeRevert = (
    errors: readonly AbiErrorFragment[],
    data: HexString,
): DecodedRevert => {
    const hex = data.replace(/^0x/i, '').toLowerCase();
    if (hex.length < 8) {
        return {};
    }
    const selector = `0x${hex.slice(0, 8)}`;
    const body = hex.slice(8);
    if (selector === ERROR_SELECTOR) {
        const reason = decodeParameters(['string'], body)[0] as string;
        return { reason, errorName: 'Error', args: [reason] };
    }
    if (selector === PANIC_SELECTOR) {
        const code = decodeParameters(['uint256'], body)[0] as bigint;
        return {
            reason: panicReasons[Number(code)] ?? `Panic with code 0x${code.toString(16)}.`,
            errorName: 'Panic',
            args: [code],
        };
    }
    const error = errors.find((e) => encodeErrorSignature(e).slice(0, 10) === selector);
    if (error === undefined) {
        return { signature: selector };
    }
    const inputs = (error.inputs ?? []) as readonly OutputParameter[];
    const decoded = decodeParameters([...(error.inputs ?? [])], body);
    return {
        errorName: error.name,
        args: inputs.map((input, i) => toAbitypeShape(input, decoded[i])),
    };
};
