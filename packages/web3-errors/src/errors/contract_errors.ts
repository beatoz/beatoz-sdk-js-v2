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

import { BaseError, BaseErrorParameters } from '../base_error.js';

/** A contract call or deployment the SDK refused or could not complete. */
export class Web3ContractError extends BaseError {
    public override name = 'Web3ContractError';

    public constructor(shortMessage: string, args?: BaseErrorParameters) {
        super(shortMessage, args);
    }
}

/**
 * A contract function failed in the EVM, as the node reported it in
 * `vmErr`. What the contract reverted with is decoded where it can be:
 * `Error(string)` gives `reason`, `Panic(uint256)` gives `reason` from the
 * panic code, and an error in the contract's ABI gives `errorName` and
 * `args`. An error not in the ABI leaves its 4-byte `signature`.
 */
export class ContractFunctionRevertedError extends BaseError {
    public override name = 'ContractFunctionRevertedError';
    /** The revert reason, or what the EVM said when there is no revert data. */
    public readonly reason?: string;
    /** `Error`, `Panic`, or the name of the contract's error. */
    public readonly errorName?: string;
    /** The error's arguments, decoded by the ABI. */
    public readonly args?: readonly unknown[];
    /** The 4-byte selector of an error the ABI does not have. */
    public readonly signature?: string;
    /** The revert data as the node returned it, hex. */
    public readonly data: string;

    public constructor({
        functionName,
        data,
        vmErr,
        reason,
        errorName,
        args,
        signature,
        metaMessages = [],
        cause,
    }: {
        functionName: string;
        data: string;
        vmErr: string;
        reason?: string;
        errorName?: string;
        args?: readonly unknown[];
        signature?: string;
        metaMessages?: string[];
        cause?: unknown;
    }) {
        const what = reason
            ? `with the reason: ${reason}`
            : errorName
              ? `with the error: ${errorName}(${(args ?? []).map(formatArg).join(', ')})`
              : signature
                ? `with an error the ABI does not have: ${signature}`
                : undefined;
        super(
            what
                ? `The contract function "${functionName}" reverted ${what}`
                : `The contract function "${functionName}" reverted.`,
            { metaMessages, details: vmErr, cause },
        );
        this.reason = reason;
        this.errorName = errorName;
        this.args = args;
        this.signature = signature;
        this.data = data;
    }
}

const formatArg = (arg: unknown): string =>
    typeof arg === 'bigint' ? arg.toString() : typeof arg === 'string' ? arg : JSON.stringify(arg);

/**
 * A contract function with outputs returned no data. The address may hold no
 * contract, or a contract without this function.
 */
export class ContractFunctionZeroDataError extends BaseError {
    public override name = 'ContractFunctionZeroDataError';

    public constructor({
        functionName,
        metaMessages = [],
    }: {
        functionName: string;
        metaMessages?: string[];
    }) {
        super(`The contract function "${functionName}" returned no data ("0x").`, {
            metaMessages: [
                ...metaMessages,
                'The address may hold no contract, or a contract without this function.',
            ],
        });
    }
}

/**
 * The node did not run a transaction to success: `check_tx` refused it
 * (bad nonce, too little balance, ...) or `deliver_tx` failed it in the
 * block. `code` and `log` are the node's.
 */
export class TransactionFailedError extends BaseError {
    public override name = 'TransactionFailedError';
    /** Where it failed: before the block (`check_tx`) or in it (`deliver_tx`). */
    public readonly stage: 'check_tx' | 'deliver_tx';
    /** The node's result code; not 0. */
    public readonly code: number;
    /** The node's log, its reason. */
    public readonly log?: string;
    /** The transaction's hash. */
    public readonly hash?: string;

    public constructor({
        stage,
        code,
        log,
        hash,
    }: {
        stage: 'check_tx' | 'deliver_tx';
        code: number;
        log?: string;
        hash?: string;
    }) {
        super(
            stage === 'check_tx'
                ? 'The node refused the transaction.'
                : 'The transaction failed in the block.',
            {
                details: log,
                metaMessages: [`Code: ${code}`, ...(hash ? [`Hash: ${hash}`] : [])],
            },
        );
        this.stage = stage;
        this.code = code;
        this.log = log;
        this.hash = hash;
    }
}
