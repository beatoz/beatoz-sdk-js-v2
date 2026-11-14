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

// The types of a contract's methods, computed from its ABI with abitype, the
// library viem uses. They are exact only for an ABI written `as const`; an ABI
// read from JSON has `string` where the names and types were, so it allows
// any method name with unknown arguments and result.

import type { AbiParameter, AbiParametersToPrimitiveTypes } from 'abitype';
import type { AbiFunctionFragment, ContractAbi } from '@beatoz/web3-types';
import type { NonPayableMethodObject, PayableMethodObject } from './types.js';

/**
 * Hex the SDK takes with or without 0x: abitype types addresses and bytes as
 * `0x${string}`, and the rest of the SDK accepts both forms.
 */
export type LooseHex<T> = T extends `0x${string}`
    ? string
    : T extends readonly unknown[]
      ? { -readonly [K in keyof T]: LooseHex<T[K]> }
      : T extends Record<string, unknown>
        ? { [K in keyof T]: LooseHex<T[K]> }
        : T;

type Parameters<P> = P extends readonly AbiParameter[] ? P : readonly [];

/** The arguments a function takes, as a tuple. */
export type MethodInputs<F extends AbiFunctionFragment> = LooseHex<
    AbiParametersToPrimitiveTypes<Parameters<F['inputs']>, 'inputs'>
>;

/**
 * What `call()` returns for a function: undefined for no outputs, the value for
 * one, a tuple for more, as viem's readContract does. Integers of 48 bits or
 * fewer are numbers, wider ones bigints; addresses and bytes are 0x hex.
 */
export type MethodOutputs<F extends AbiFunctionFragment> =
    AbiParametersToPrimitiveTypes<Parameters<F['outputs']>, 'outputs'> extends infer R
        ? R extends readonly []
            ? undefined
            : R extends readonly [infer Only]
              ? Only
              : R
        : never;

type FunctionNames<A extends ContractAbi> = A[number] extends infer E
    ? E extends { type: 'function'; name: infer N extends string }
        ? N
        : never
    : never;
type FunctionsNamed<A extends ContractAbi, N> = A[number] extends infer E
    ? E extends { type: 'function'; name: N }
        ? E
        : never
    : never;

// Distributive over the overloads of one name.
type ArgsOf<F> = Extract<F extends AbiFunctionFragment ? MethodInputs<F> : never, unknown[]>;
type MethodObjectOf<F> = F extends AbiFunctionFragment
    ? F['stateMutability'] extends 'payable'
        ? PayableMethodObject<MethodInputs<F>, MethodOutputs<F>>
        : NonPayableMethodObject<MethodInputs<F>, MethodOutputs<F>>
    : never;

/**
 * `contract.methods`: one entry per function name in the ABI. An overloaded
 * name takes the arguments of any of its overloads. A name the ABI does not
 * have is not there.
 */
export type ContractMethodsInterface<A extends ContractAbi> =
    // An ABI read from JSON has `type: string`, so no entry is known to be a
    // function: every name is allowed, with unknown arguments and result.
    string extends A[number]['type']
        ? Record<
              string,
              (
                  ...args: unknown[]
              ) =>
                  | NonPayableMethodObject<unknown[], unknown>
                  | PayableMethodObject<unknown[], unknown>
          >
        : {
              [N in FunctionNames<A>]: (
                  ...args: ArgsOf<FunctionsNamed<A, N>>
              ) => MethodObjectOf<FunctionsNamed<A, N>>;
          };

type ConstructorOf<A extends ContractAbi> = A[number] extends infer E
    ? E extends { type: 'constructor' }
        ? E
        : never
    : never;

/**
 * The arguments of the ABI's constructor, as a tuple; none when the ABI has
 * no constructor. An ABI read from JSON takes any.
 */
export type ConstructorArgs<A extends ContractAbi> = string extends A[number]['type']
    ? unknown[]
    : [ConstructorOf<A>] extends [never]
      ? []
      : LooseHex<AbiParametersToPrimitiveTypes<Parameters<ConstructorOf<A>['inputs']>, 'inputs'>>;

/** What `contract.deploy()` takes; `args` may be left out when there are none. */
export type DeployParams<A extends ContractAbi> = {
    /** The contract's creation bytecode, hex with or without 0x. */
    bytecode: string;
} & ([] extends ConstructorArgs<A> ? { args?: ConstructorArgs<A> } : { args: ConstructorArgs<A> });
