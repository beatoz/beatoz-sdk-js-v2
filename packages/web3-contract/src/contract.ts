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
    AbiInput,
    Address,
    BroadcastTxSyncResponse,
    BroadcastTxCommitResponse,
    ContractAbi,
    DataFormat,
    DEFAULT_RETURN_FORMAT,
    HexString,
    Mutable,
    NonPayableCallOptions,
    PayableCallOptions,
    Web3ValidationErrorObject,
    BroadcastTxAsyncResponse,
} from '@beatoz/web3-types';
import { Web3Context } from '@beatoz/web3-core';
import {
    BroadcastTxOptions,
    ContractAbiWithSignature,
    ContractOptions,
    DeployOptions,
    NonPayableMethodObject,
    NonPayableTxOptions,
    PayableMethodObject,
    PayableTxOptions,
} from './types.js';
import { ContractMethodsInterface, DeployParams } from './method_types.js';
import { bytesToHex, format, isNullish, toChecksumAddress } from '@beatoz/web3-utils';
import {
    decodeContractErrorData,
    encodeFunctionSignature,
    encodeParameters,
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
import { decodeMethodReturn, encodeMethodABI } from './encoding.js';
import { ContractExecutionError, Web3ContractError } from '@beatoz/web3-errors';
import { getEthTxCallParams, getSendTxParams } from './utils.js';
import {
    broadcastTxAsync,
    broadcastTxCommit,
    broadcastTxSync,
    call,
    getAccount,
    rule,
    vmEstimateGas,
} from '@beatoz/web3-methods';
import { TrxProtoBuilder, getContractAddress } from '@beatoz/web3-accounts';
import HttpProvider from '@beatoz/web3-providers-http';
import WebsocketProvider from '@beatoz/web3-providers-ws';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** What a deploy resolves with. */
export interface DeployResult<Abi extends ContractAbi> {
    /** The new contract's address, checksummed. */
    address: Address;
    /** A contract at that address, on the same provider and wallet. */
    contract: Contract<Abi>;
    /** The deploy transaction's hash. */
    hash: HexString;
    /** The height of the block it is in. */
    height: number;
}

// A method as the contract builds it at run time; ContractMethodsInterface
// gives each one its type from the ABI.
type ContractBoundMethod = (
    ...params: unknown[]
) => NonPayableMethodObject<unknown[], unknown> | PayableMethodObject<unknown[], unknown>;

export class Contract<Abi extends ContractAbi> extends Web3Context {
    public readonly options: ContractOptions;
    private _address?: Address;

    private _functions: Record<
        string,
        {
            signature: string;
            method: ContractBoundMethod;
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
    ): ContractBoundMethod {
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

            return methods;
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
            const res = await call(
                this,
                tx.to,
                tx.input ? tx.input.toString() : '0x',
                tx.from,
                height,
            );
            // The node returns the call's bytes; the ABI says what they are.
            return decodeMethodReturn(abi, res.value.returnData);
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

    /**
     * Deploys the contract: `deploy({ bytecode, args }).send({ from })`. The
     * account of `from` must be in the wallet; the chain id is filled in, the
     * gas is the node's estimate and the gas price the chain's unless given.
     * Resolves once the transaction is in a block, with the new contract's
     * address and a `Contract` at it; throws if the deploy failed.
     */
    public deploy(params: DeployParams<Abi>) {
        const ctor = this._jsonInterface.find((j) => j.type === 'constructor') as
            AbiConstructorFragment | undefined;
        const inputs = (ctor?.inputs ?? []) as AbiInput[];
        const args = (params.args ?? []) as unknown[];
        if (args.length !== inputs.length) {
            throw new Web3ContractError(
                `the constructor takes ${inputs.length} arguments, got ${args.length}`,
            );
        }
        const data =
            inputs.length > 0
                ? params.bytecode + encodeParameters(inputs, args).slice(2)
                : params.bytecode;

        return {
            send: (options: DeployOptions): Promise<DeployResult<Abi>> =>
                this._deploy(data, options),
        };
    }

    private async _deploy(data: string, options: DeployOptions): Promise<DeployResult<Abi>> {
        const account = this.wallet?.get(options.from);
        if (account === undefined) {
            throw new Web3ContractError(`not found account of ${options.from}`);
        }

        const chainId = this.chainId ?? (await this.decideChainId());
        const nonce = Number((await getAccount(this, account.address)).value.nonce);
        const gasPrice = options.gasPrice ?? (await rule(this)).value.gasPrice;
        let gas = options.gas;
        if (gas === undefined) {
            const estimate = await vmEstimateGas(this, account.address, ZERO_ADDRESS, data);
            if (estimate.value.vmErr !== undefined) {
                throw new Web3ContractError(`deploy would fail: ${estimate.value.vmErr}`);
            }
            gas = Number(estimate.value.usedGas);
        }

        const tx = TrxProtoBuilder.buildContractTrxProto({
            from: account.address,
            to: ZERO_ADDRESS,
            nonce,
            gas,
            gasPrice,
            amount: '0',
            payload: { data },
        });
        account.signTransaction(tx, chainId);
        const res = await broadcastTxCommit(this, tx);
        if (res.check_tx.code !== 0) {
            throw new Web3ContractError(`deploy rejected: ${res.check_tx.log}`);
        }
        if (res.deliver_tx?.code !== 0) {
            throw new Web3ContractError(`deploy failed: ${res.deliver_tx?.log}`);
        }

        // The node derives the address from the sender and the nonce, so it
        // needs no lookup, which would wait for the transaction to be indexed.
        const address = getContractAddress(account.address, nonce);
        const contract = new Contract<Abi>(this._jsonInterface as unknown as Abi, address);
        contract._requestManager = this._requestManager;
        contract._wallet = this._wallet;
        contract._accountProvider = this._accountProvider;
        contract._chainId = chainId;
        return { address, contract, hash: res.hash, height: res.height };
    }

    public settingsProvider(providers: HttpProvider | WebsocketProvider): void {
        this.requestManager.setProvider(providers);
    }
}
