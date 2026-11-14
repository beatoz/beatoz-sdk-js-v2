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
    AbiError,
    BaseError,
    ContractFunctionRevertedError,
    ContractFunctionZeroDataError,
    TransactionFailedError,
    formatValue,
    HttpRequestError,
    InvalidInputError,
    InvalidResponseError,
    isRpcErrorObject,
    RpcRequestError,
    TimeoutError,
    Web3ContractError,
} from '../../src';

describe('BaseError', () => {
    it('puts the short message, context lines and details together', () => {
        const err = new BaseError('Something failed.', {
            metaMessages: ['Method: tx'],
            details: 'because',
        });
        expect(err.shortMessage).toBe('Something failed.');
        expect(err.details).toBe('because');
        expect(err.message).toBe('Something failed.\n\nMethod: tx\n\nDetails: because');
    });

    it('is only the short message when there is nothing else', () => {
        expect(new BaseError('Something failed.').message).toBe('Something failed.');
    });

    it("takes details from the cause's message, or the cause's own details", () => {
        const plain = new BaseError('outer', { cause: new Error('inner') });
        expect(plain.details).toBe('inner');
        expect(plain.cause).toBeInstanceOf(Error);

        const nested = new BaseError('outer', { cause: new BaseError('mid', { details: 'root' }) });
        expect(nested.details).toBe('root');
    });

    it('walks the cause chain', () => {
        const root = new Error('root');
        const rpc = new RpcRequestError({ error: { code: -32603, message: 'Internal error' } });
        const err = new TimeoutError('timed out', { cause: new BaseError('mid', { cause: rpc }) });
        Object.defineProperty(rpc, 'cause', { value: root });

        expect(err.walk()).toBe(root);
        expect(err.walk((e) => e instanceof RpcRequestError)).toBe(rpc);
        expect(err.walk((e) => e instanceof TimeoutError)).toBe(err);
        expect(err.walk((e) => e instanceof HttpRequestError)).toBeUndefined();
    });

    it.each([
        [new InvalidInputError('x'), 'InvalidInputError'],
        [new AbiError('x'), 'AbiError'],
        [new TimeoutError('x'), 'TimeoutError'],
        [new Web3ContractError('x'), 'Web3ContractError'],
        [new RpcRequestError({ error: { code: 1, message: 'x' } }), 'RpcRequestError'],
        [new HttpRequestError({ url: 'http://n' }), 'HttpRequestError'],
        [new InvalidResponseError('x', { response: {} }), 'InvalidResponseError'],
    ])('%p is a BaseError named %s', (err, name) => {
        expect(err).toBeInstanceOf(BaseError);
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe(name);
        expect(String(err)).toMatch(new RegExp(`^${name}: `));
    });
});

describe('RpcRequestError', () => {
    it("keeps the node's code and data", () => {
        const err = new RpcRequestError({
            error: {
                code: -32602,
                message: 'Invalid params',
                data: 'error converting json params',
            },
            method: 'tx',
        });
        expect(err.code).toBe(-32602);
        expect(err.data).toBe('error converting json params');
        expect(err.details).toBe('Invalid params: error converting json params');
        expect(err.message).toContain('Method: tx');
    });

    it('leaves data that is not a string out of the details', () => {
        const err = new RpcRequestError({
            error: { code: -32000, message: 'Server error', data: { x: 1 } },
        });
        expect(err.details).toBe('Server error');
        expect(err.data).toEqual({ x: 1 });
    });
});

describe('HttpRequestError', () => {
    it('keeps the status and URL', () => {
        const err = new HttpRequestError({ status: 502, url: 'http://node', body: 'Bad Gateway' });
        expect(err.status).toBe(502);
        expect(err.url).toBe('http://node');
        expect(err.message).toBe(
            'HTTP request failed.\n\nStatus: 502\nURL: http://node\n\nDetails: Bad Gateway',
        );
    });
});

describe('isRpcErrorObject', () => {
    it.each([
        [{ code: -32603, message: 'Internal error' }, true],
        [{ code: -32603, message: 'Internal error', data: 'x' }, true],
        [{ code: '-32603', message: 'Internal error' }, false],
        [{ code: -32603 }, false],
        [null, false],
        ['error', false],
    ])('%p is %p', (value, expected) => {
        expect(isRpcErrorObject(value)).toBe(expected);
    });
});

describe('formatValue', () => {
    it.each([
        ['a', '"a"'],
        [1, '1'],
        [10n, '10n'],
        [undefined, 'undefined'],
        [null, 'null'],
        [{ a: 1n }, '{"a":"1n"}'],
        [new Uint8Array(3), 'Uint8Array(3)'],
    ])('%p as %s', (value, expected) => {
        expect(formatValue(value)).toBe(expected);
    });
});

describe('ContractFunctionRevertedError', () => {
    const base = { functionName: 'transfer', data: '0x', vmErr: 'execution reverted' };

    it('says the reason when there is one', () => {
        const err = new ContractFunctionRevertedError({
            ...base,
            reason: 'ERC20: transfer amount exceeds balance',
            errorName: 'Error',
            metaMessages: ['Contract: 0xabc'],
        });
        expect(err.shortMessage).toBe(
            'The contract function "transfer" reverted with the reason: ERC20: transfer amount exceeds balance',
        );
        expect(err.details).toBe('execution reverted');
        expect(err.message).toContain('Contract: 0xabc');
    });

    it('names a custom error with its arguments', () => {
        const err = new ContractFunctionRevertedError({
            ...base,
            errorName: 'ERC20InsufficientBalance',
            args: ['0xabc', 0n, 1000n],
        });
        expect(err.shortMessage).toBe(
            'The contract function "transfer" reverted with the error: ERC20InsufficientBalance(0xabc, 0, 1000)',
        );
    });

    it('gives the selector of an error it could not name', () => {
        const err = new ContractFunctionRevertedError({ ...base, signature: '0x12345678' });
        expect(err.shortMessage).toBe(
            'The contract function "transfer" reverted with an error the ABI does not have: 0x12345678',
        );
    });

    it('says only that it reverted when nothing more is known', () => {
        expect(new ContractFunctionRevertedError(base).shortMessage).toBe(
            'The contract function "transfer" reverted.',
        );
    });
});

describe('ContractFunctionZeroDataError', () => {
    it('says the function returned nothing', () => {
        expect(new ContractFunctionZeroDataError({ functionName: 'decimals' }).shortMessage).toBe(
            'The contract function "decimals" returned no data ("0x").',
        );
    });
});

describe('TransactionFailedError', () => {
    it("keeps the node's code and log", () => {
        const err = new TransactionFailedError({
            stage: 'check_tx',
            code: 3,
            log: 'invalid nonce',
            hash: 'AB',
        });
        expect(err).toMatchObject({ stage: 'check_tx', code: 3, log: 'invalid nonce', hash: 'AB' });
        expect(err.message).toBe(
            'The node refused the transaction.\n\nCode: 3\nHash: AB\n\nDetails: invalid nonce',
        );
        expect(new TransactionFailedError({ stage: 'deliver_tx', code: 1 }).shortMessage).toBe(
            'The transaction failed in the block.',
        );
    });
});
