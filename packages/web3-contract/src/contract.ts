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
    AbiConstructorFragment,
    AbiErrorFragment,
    AbiFragment,
    AbiFunctionFragment,
    Address,
    BroadcastTxSyncResponse,
    BroadcastTxCommitResponse,
    ContractAbi,
    ContractMethod,
    ContractMethodInputParameters,
    ContractMethodOutputParameters,
    DataFormat,
    DEFAULT_RETURN_FORMAT,
    FilterAbis,
    HexString,
    Mutable,
    NonPayableCallOptions,
    PayableCallOptions,
    BeatozExecutionAPI,
    Web3ValidationErrorObject,
    BroadcastTxAsyncResponse,
} from '@beatoz/web3-types';
import { Web3Context } from '@beatoz/web3-core';
import {
    BroadcastTxOptions,
    ContractAbiWithSignature,
    ContractOptions,
    NonPayableMethodObject,
    NonPayableTxOptions,
    PayableMethodObject,
    PayableTxOptions,
} from './types.js';
import { bytesToHex, format, isNullish, toChecksumAddress } from '@beatoz/web3-utils';
import {
    decodeContractErrorData,
    encodeFunctionSignature,
    isAbiErrorFragment,
    isAbiFunctionFragment,
    jsonInterfaceMethodToString,
} from '@beatoz/web3-abi';
import {
    Web3ValidatorError,
    utils as validatorUtils,
    ValidationSchemaInput,
    validator,
} from '@beatoz/web3-validator';
import { encodeMethodABI } from './encoding.js';
import { ContractExecutionError, Web3ContractError } from '@beatoz/web3-errors';
import { getEthTxCallParams, getSendTxParams } from './utils.js';
import {
    broadcastTxAsync,
    broadcastTxCommit,
    broadcastTxSync,
    call,
    getAccount,
    rule,
    sendDeploy,
    vmEstimateGas,
} from '@beatoz/web3-methods';
import { TrxProtoBuilder, Web3Account } from '@beatoz/web3-accounts';
import HttpProvider from '@beatoz/web3-providers-http';
import WebsocketProvider from '@beatoz/web3-providers-ws';

type ContractBoundMethod<
    Abi extends AbiFunctionFragment,
    Method extends ContractMethod<Abi> = ContractMethod<Abi>,
> = (
    ...args: Method['Inputs']
) => Method['Abi']['stateMutability'] extends 'payable' | 'pure'
    ? PayableMethodObject<Method['Inputs'], Method['Outputs']>
    : NonPayableMethodObject<Method['Inputs'], Method['Outputs']>;

// To avoid circular dependency between types and encoding, declared these types here.
export type ContractMethodsInterface<Abi extends ContractAbi> = {
    [
        MethodAbi in FilterAbis<
            Abi,
            AbiFunctionFragment & { type: 'function' }
        > as MethodAbi['name']
    ]: ContractBoundMethod<MethodAbi>;
    // To allow users to use method signatures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & { [key: string]: ContractBoundMethod<any> };

export type ContractOverloadedMethodInputs<AbiArr extends ReadonlyArray<unknown>> = NonNullable<
    AbiArr extends readonly []
        ? undefined
        : AbiArr extends readonly [infer A, ...infer R]
          ? A extends AbiFunctionFragment
              ? ContractMethodInputParameters<A['inputs']> | ContractOverloadedMethodInputs<R>
              : undefined
          : undefined
>;

export type ContractOverloadedMethodOutputs<AbiArr extends ReadonlyArray<unknown>> = NonNullable<
    AbiArr extends readonly []
        ? undefined
        : AbiArr extends readonly [infer A, ...infer R]
          ? A extends AbiFunctionFragment
              ? ContractMethodOutputParameters<A['outputs']> | ContractOverloadedMethodOutputs<R>
              : undefined
          : undefined
>;

export class Contract<Abi extends ContractAbi> extends Web3Context<BeatozExecutionAPI> {
    public readonly options: ContractOptions;
    private _address?: Address;

    private _functions: Record<
        string,
        {
            signature: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            method: ContractBoundMethod<any>;
        }
    > = {};

    private _methods!: ContractMethodsInterface<Abi>;

    private _jsonInterface!: ContractAbiWithSignature;

    private _errorsInterface!: AbiErrorFragment[];

    private readonly _overloadedMethodAbis: Map<string, AbiFunctionFragment[]>;

    public constructor(jsonInterface: Abi, addressOrOptionsOrContext?: Address | Web3Context) {
        super();

        this._overloadedMethodAbis = new Map<string, AbiFunctionFragment[]>();

        this._parseAndSetJsonInterface(jsonInterface);

        // TODO: Address CheckSum Settings
        const address =
            typeof addressOrOptionsOrContext === 'string' ? addressOrOptionsOrContext : undefined;
        this.options = {
            address,
            jsonInterface: this._jsonInterface,
        };

        Object.defineProperty(this.options, 'jsonInterface', {
            set: (value: ContractAbi) => this._parseAndSetJsonInterface(value),
            get: () => this._jsonInterface,
        });
    }

    private _parseAndSetJsonInterface(abis: ContractAbi) {
        this._functions = {};

        this._methods = {} as ContractMethodsInterface<Abi>;

        let result: ContractAbi = [];

        const functionsAbi = abis.filter((abi) => abi.type !== 'error');
        const errorsAbi = abis.filter((abi) =>
            isAbiErrorFragment(abi),
        ) as unknown as AbiErrorFragment[];

        for (const a of functionsAbi) {
            const abi: Mutable<AbiFragment & { signature: HexString }> = {
                ...a,
                signature: '',
            };

            if (isAbiFunctionFragment(abi)) {
                const methodName = jsonInterfaceMethodToString(abi);
                const methodSignature = encodeFunctionSignature(methodName);
                abi.signature = methodSignature;

                // make constant and payable backwards compatible
                abi.constant =
                    abi.stateMutability === 'view' ||
                    abi.stateMutability === 'pure' ||
                    abi.constant;

                abi.payable = abi.stateMutability === 'payable' || abi.payable;
                this._overloadedMethodAbis.set(abi.name, [
                    ...(this._overloadedMethodAbis.get(abi.name) ?? []),
                    abi,
                ]);
                const abiFragment = this._overloadedMethodAbis.get(abi.name) ?? [];
                const contractMethod = this._createContractMethod<
                    typeof abiFragment,
                    AbiErrorFragment
                >(abiFragment, errorsAbi);

                this._functions[methodName] = {
                    signature: methodSignature,
                    method: contractMethod,
                };

                // We don't know a particular type of the Abi method so can't type check
                this._methods[abi.name as keyof ContractMethodsInterface<Abi>] = this._functions[
                    methodName
                ].method as never;

                // We don't know a particular type of the Abi method so can't type check
                this._methods[methodName as keyof ContractMethodsInterface<Abi>] = this._functions[
                    methodName
                ].method as never;

                // We don't know a particular type of the Abi method so can't type check
                this._methods[methodSignature as keyof ContractMethodsInterface<Abi>] = this
                    ._functions[methodName].method as never;
            }

            result = [...result, abi];
        }

        this._jsonInterface = [...result] as unknown as ContractAbiWithSignature;
        this._errorsInterface = errorsAbi;
    }

    private _createContractMethod<T extends AbiFunctionFragment[], E extends AbiErrorFragment>(
        abiArr: T,
        errorsAbis: E[],
    ): ContractBoundMethod<T[0]> {
        const abi = abiArr[abiArr.length - 1];
        return (...params: unknown[]) => {
            let abiParams!: Array<unknown>;
            const abis = this._overloadedMethodAbis.get(abi.name) ?? [];
            let methodAbi: AbiFunctionFragment = abis[0];
            const internalErrorsAbis = errorsAbis;

            const arrayOfAbis: AbiFunctionFragment[] = abis.filter(
                (_abi) => (_abi.inputs ?? []).length === params.length,
            );

            if (abis.length === 1 || arrayOfAbis.length === 0) {
                abiParams = this._getAbiParams(methodAbi, params);

                // TODO : need validate check
                // validator.validate(abi.inputs ?? [], abiParams);
            } else {
                const errors: Web3ValidationErrorObject[] = [];

                for (const _abi of arrayOfAbis) {
                    try {
                        abiParams = this._getAbiParams(_abi, params);
                        validator.validate(
                            _abi.inputs as unknown as ValidationSchemaInput,
                            abiParams,
                        );
                        methodAbi = _abi;
                        break;
                    } catch (e) {
                        errors.push(e as Web3ValidationErrorObject);
                    }
                }
                if (errors.length === arrayOfAbis.length) {
                    throw new Web3ValidatorError(errors);
                }
            }

            const methods = {
                arguments: abiParams,

                call: async (
                    options?: PayableCallOptions | NonPayableCallOptions,
                    height?: number,
                ) =>
                    this._contractMethodCall(
                        methodAbi,
                        abiParams,
                        internalErrorsAbis,
                        options,
                        height,
                    ),

                estimateGas: async (options?: PayableCallOptions | NonPayableTxOptions) =>
                    this._contractMethodEstimateGas(
                        methodAbi,
                        abiParams,
                        internalErrorsAbis,
                        options,
                    ),

                // original:
                // send: (options?: PayableTxOptions | NonPayableTxOptions): Web3PromiEvent< FormatType<TransactionReceipt, typeof DEFAULT_RETURN_FORMAT>, SendTransactionEvents<typeof DEFAULT_RETURN_FORMAT>>
                send: (
                    options?:
                        | PayableTxOptions
                        | NonPayableTxOptions
                        | BroadcastTxOptions
                        | BroadcastTxOptions,
                ): Promise<
                    BroadcastTxAsyncResponse | BroadcastTxSyncResponse | BroadcastTxCommitResponse
                > =>
                    this._contractMethodBroadcast(
                        methodAbi,
                        abiParams,
                        internalErrorsAbis,
                        options,
                    ),

                broadcast: (
                    options?: PayableTxOptions | NonPayableTxOptions | BroadcastTxOptions,
                ): Promise<
                    BroadcastTxAsyncResponse | BroadcastTxSyncResponse | BroadcastTxCommitResponse
                > =>
                    this._contractMethodBroadcast(
                        methodAbi,
                        abiParams,
                        internalErrorsAbis,
                        options,
                    ),

                encodeABI: () => encodeMethodABI(methodAbi, abiParams),
            };

            if (methodAbi.stateMutability === 'payable') {
                return methods as unknown as PayableMethodObject<
                    ContractOverloadedMethodInputs<T>,
                    ContractOverloadedMethodOutputs<T>
                >;
            }
            return methods as unknown as NonPayableMethodObject<
                ContractOverloadedMethodInputs<T>,
                ContractOverloadedMethodOutputs<T>
            >;
        };
    }

    private async _contractMethodCall<Options extends PayableCallOptions | NonPayableCallOptions>(
        abi: AbiFunctionFragment,
        params: unknown[],
        errorsAbi: AbiErrorFragment[],
        options?: Options,
        height?: number,
    ) {
        const tx = getEthTxCallParams({
            abi,
            params,
            options,
            contractOptions: {
                ...this.options,
                from: this.options.from ?? this.config.defaultAccount,
            },
        });

        // If the from address is not set, enter the from address as the to address
        if (!tx.from) {
            tx.from = tx.to;
        }
        try {
            return await call(this, tx.to, tx.input ? tx.input.toString() : '0x', tx.from, height);
        } catch (error: unknown) {
            if (error instanceof ContractExecutionError) {
                // this will parse the error data by trying to decode the ABI error inputs according to EIP-838
                decodeContractErrorData([], error.innerError);
                // decodeContractErrorData(errorsAbi, error.innerError);
            }
            throw error;
        }
    }

    private async _contractMethodEstimateGas<Options extends NonPayableCallOptions>(
        abi: AbiFunctionFragment,
        params: unknown[],
        errorsAbi: AbiErrorFragment[],
        options?: Options,
    ) {
        const tx = getEthTxCallParams({
            abi,
            params,
            options,
            contractOptions: {
                ...this.options,
                from: this.options.from ?? this.config.defaultAccount,
            },
        });

        // If the from address is not set, enter the from address as the to address
        if (!tx.from) {
            tx.from = tx.to;
        }
        try {
            return await vmEstimateGas(this, tx.from, tx.to, tx.input ? tx.input.toString() : '0x');
        } catch (error: unknown) {
            if (error instanceof ContractExecutionError) {
                // this will parse the error data by trying to decode the ABI error inputs according to EIP-838
                decodeContractErrorData([], error.innerError);
                // decodeContractErrorData(errorsAbi, error.innerError);
            }
            throw error;
        }
    }

    // DEPRECATED
    private _contractMethodSend<Options extends PayableCallOptions | NonPayableCallOptions>(
        abi: AbiFunctionFragment,
        params: unknown[],
        errorsAbi: AbiErrorFragment[],
        options?: Options,
        contractOptions?: ContractOptions,
    ) {
        let modifiedContractOptions = contractOptions ?? this.options;
        modifiedContractOptions = {
            ...modifiedContractOptions,
            input: undefined,
            from: modifiedContractOptions.from ?? undefined,
        };

        getSendTxParams({
            abi,
            params,
            options,
            contractOptions: modifiedContractOptions,
        });

        const transactionToSend = Promise.resolve('');
        //
        // const transactionToSend = sendTransaction(this, tx, {
        //     // TODO Should make this configurable by the user
        //     checkRevertBeforeSending: false,
        // });

        // TODO: PromiEvent has no signature for the `error` event.
        // @ts-expect-error remove once the PromiEvent event types are filled in
        void transactionToSend.on('error', (error: unknown) => {
            if (error instanceof ContractExecutionError) {
                // this will parse the error data by trying to decode the ABI error inputs according to EIP-838
                decodeContractErrorData(errorsAbi, error.innerError);
            }
        });

        return transactionToSend;
    }

    private async _contractMethodBroadcast<
        Options extends PayableCallOptions | NonPayableCallOptions | BroadcastTxOptions,
    >(
        abi: AbiFunctionFragment,
        params: unknown[],
        errorsAbi: AbiErrorFragment[],
        options?: Options,
        contractOptions?: ContractOptions,
    ): Promise<BroadcastTxAsyncResponse | BroadcastTxSyncResponse | BroadcastTxCommitResponse> {
        let modifiedContractOptions = contractOptions ?? this.options;
        modifiedContractOptions = {
            ...modifiedContractOptions,
            input: undefined,
            from: modifiedContractOptions.from ?? undefined,
        };

        const _tx = getSendTxParams({
            abi,
            params,
            options: options && 'from' in options ? options : undefined,
            contractOptions: modifiedContractOptions,
        });

        const fromAcct = this.wallet?.get(_tx.from!);
        if (fromAcct === undefined) {
            throw new Web3ContractError(`not found account of ${_tx.from}`);
        }
        // getSendTxParams always sets input to the encoded call.
        if (isNullish(_tx.input)) {
            throw new Web3ContractError('no call data to send');
        }

        const chainId = this.chainId ?? (await this.decideChainId());
        const nonce = Number(_tx.nonce ?? (await getAccount(this, fromAcct.address)).value.nonce);
        if (isNullish(_tx.gas) || isNullish(_tx.gasPrice)) {
            const govParams = (await rule(this)).value;
            if (isNullish(_tx.gas)) _tx.gas = govParams.minTrxGas;
            if (isNullish(_tx.gasPrice)) _tx.gasPrice = govParams.gasPrice;
        }
        const gas = Number(_tx.gas);
        const gasPrice = Number(_tx.gasPrice);

        const txProto = TrxProtoBuilder.buildContractTrxProto({
            from: fromAcct.address,
            to: _tx.to,
            nonce: nonce,
            gas: gas,
            gasPrice: gasPrice.toString(),
            amount: '0',
            // TransactionCall types input as Bytes and the builder takes hex.
            // A string goes through as it always has; bytesToHex would also
            // reject hex without 0x, which the builder accepts.
            payload: {
                data: typeof _tx.input === 'string' ? _tx.input : bytesToHex(_tx.input),
            },
        });

        fromAcct.signTransaction(txProto, chainId);

        if (!isNullish(options) && 'sendMode' in options) {
            if (options.sendMode === 'sync') {
                return broadcastTxSync(this, txProto);
            } else if (options.sendMode === 'async') {
                return broadcastTxAsync(this, txProto);
            }
        }
        return broadcastTxCommit(this, txProto);
    }

    private _getAbiParams(abi: AbiFunctionFragment, params: unknown[]): Array<unknown> {
        try {
            return validatorUtils.transformJsonDataToAbiFormat(abi.inputs ?? [], params);
        } catch (error) {
            throw new Web3ContractError(
                `Invalid parameters for method ${abi.name}: ${(error as Error).message}`,
            );
        }
    }

    public set provider(provider: string | HttpProvider | WebsocketProvider | undefined) {
        this.requestManager.setProvider(provider);
    }

    private _parseAndSetAddress(value?: Address, returnFormat: DataFormat = DEFAULT_RETURN_FORMAT) {
        this._address = value
            ? toChecksumAddress(format({ format: 'address' }, value, returnFormat))
            : value;
    }

    public get methods() {
        return this._methods;
    }

    public deploy(
        bytecode: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contract arguments need ABI-derived inference; to be resolved by the typed API work.
        args: any[],
        rWeb3Account: Web3Account,
        chainId: string,
        gas: number,
    ) {
        let abi = this._jsonInterface.find(
            (j) => j.type === 'constructor',
        ) as AbiConstructorFragment;

        if (!abi) {
            abi = {
                type: 'constructor',
                inputs: [],
                stateMutability: '',
            } as AbiConstructorFragment;
        }

        return {
            send: (): Promise<BroadcastTxCommitResponse> => {
                return sendDeploy(
                    this,
                    abi as AbiFunctionFragment,
                    bytecode,
                    args,
                    rWeb3Account,
                    chainId,
                    gas,
                );
            },
        };
    }

    public settingsProvider(providers: HttpProvider | WebsocketProvider): void {
        this.requestManager.setProvider(providers);
    }
}
