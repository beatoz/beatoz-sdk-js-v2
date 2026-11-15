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

export type Components = {
    name: string;
    type: string;
    indexed?: boolean;
    components?: Components[];
};

export interface AbiStruct {
    [key: string]: unknown;

    name?: string;
    type: string;
}

export interface AbiCoderStruct extends AbiStruct {
    [key: string]: unknown;

    components?: Array<AbiStruct>;
}

// https://docs.soliditylang.org/en/latest/abi-spec.html#json
export type AbiParameter = {
    readonly name: string;
    readonly type: string;
    readonly baseType?: string;
    readonly indexed?: boolean;
    readonly components?: ReadonlyArray<AbiParameter>;
    readonly arrayLength?: number;
    readonly arrayChildren?: ReadonlyArray<AbiParameter>;
    readonly internalType?: string;
};

type FragmentTypes = 'constructor' | 'event' | 'function' | 'fallback' | 'receive';

export type AbiBaseFragment = {
    // type will default to string if passed ABI is declared without "as const"
    readonly type: string | FragmentTypes;
};

// To assign an ABI which is not declared `as const` need to specify a generic string

// https://docs.soliditylang.org/en/latest/abi-spec.html#json
export type AbiConstructorFragment = AbiBaseFragment & {
    readonly type: string | 'constructor';
    readonly stateMutability: string | 'nonpayable' | 'payable';
    readonly inputs?: ReadonlyArray<AbiParameter>;
};

// https://docs.soliditylang.org/en/latest/abi-spec.html#json
export type AbiFunctionFragment = AbiBaseFragment & {
    readonly name: string;
    readonly type: string | 'function';
    readonly stateMutability?: string | 'nonpayable' | 'payable' | 'pure' | 'view';
    readonly inputs?: ReadonlyArray<AbiParameter>;
    readonly outputs?: ReadonlyArray<AbiParameter>;

    readonly constant?: boolean; // stateMutability == 'pure' or stateMutability == 'view'
    readonly payable?: boolean; // stateMutability == 'payable'
};

export type AbiFallbackFragment = AbiBaseFragment & {
    readonly name: never;
    readonly type: string | 'fallback';
    readonly stateMutability: string | 'nonpayable' | 'payable' | 'pure' | 'view';
    readonly inputs: never;
    readonly outputs: never;

    // legacy properties
    readonly constant?: boolean; // stateMutability == 'pure' or stateMutability == 'view'
    readonly payable?: boolean; // stateMutability == 'payable'
};

// https://docs.soliditylang.org/en/latest/abi-spec.html#json
export type AbiEventFragment = AbiBaseFragment & {
    readonly name: string;
    readonly type: string | 'event';
    inputs?: ReadonlyArray<AbiParameter>;
    readonly anonymous?: boolean;
};

// https://docs.soliditylang.org/en/latest/abi-spec.html#errors
export type AbiErrorFragment = AbiBaseFragment & {
    readonly name: string;
    readonly type: string | 'error';
    readonly inputs?: ReadonlyArray<AbiParameter>;
};

// https://docs.soliditylang.org/en/latest/abi-spec.html#json
export type AbiFragment =
    | AbiConstructorFragment
    | AbiFunctionFragment
    | AbiEventFragment
    | AbiErrorFragment
    | AbiFallbackFragment;

export type ContractAbi = ReadonlyArray<AbiFragment>;

export type AbiInput =
    | string
    | AbiParameter
    | {
          name: string;
          type: string;
          components?: Components;
          index?: boolean;
          internalType?: string;
      }
    | { readonly [key: string]: unknown };

export interface DecodedParams extends Record<string, unknown> {
    __length__: number;
}
