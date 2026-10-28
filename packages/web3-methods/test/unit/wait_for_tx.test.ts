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
import { Web3Context } from '@beatoz/web3-core';
import { OperationTimeoutError, ResponseError } from '@beatoz/web3-errors';
import { BeatozExecutionAPI } from '@beatoz/web3-types';
import { waitForTx } from '../../src/rpc_method_wrappers';

const HASH = 'ab'.repeat(32);

// What the node answers, through the request manager, for a hash it has not
// indexed: Tendermint's rpc/core Tx returns `tx (%X) not found`.
const notFound = () =>
    new ResponseError({
        jsonrpc: '2.0',
        id: 1,
        error: {
            code: -32603,
            message: 'Internal error',
            data: `tx (${HASH.toUpperCase()}) not found`,
        },
    });

const indexed = {
    result: { tx: 'AA==', hash: HASH, height: '5', index: 0, tx_result: { code: 0 } },
};

// waitForTx reaches the node only through requestManager.send.
const contextWith = (send: jest.Mock) =>
    ({ requestManager: { send } }) as unknown as Web3Context<BeatozExecutionAPI>;

describe('waitForTx', () => {
    it('looks again while the node has not indexed the transaction', async () => {
        const send = jest
            .fn()
            .mockRejectedValueOnce(notFound())
            .mockRejectedValueOnce(notFound())
            .mockResolvedValueOnce(indexed);

        const tx = await waitForTx(contextWith(send), HASH, { intervalMs: 1 });

        expect(tx.height).toEqual(5);
        expect(send).toHaveBeenCalledTimes(3);
    });

    it('throws any other node error at once', async () => {
        const disabled = new ResponseError({
            jsonrpc: '2.0',
            id: 1,
            error: {
                code: -32603,
                message: 'Internal error',
                data: 'transaction indexing is disabled',
            },
        });
        const send = jest.fn().mockRejectedValue(disabled);

        await expect(waitForTx(contextWith(send), HASH, { intervalMs: 1 })).rejects.toBe(disabled);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('throws an error that is not from the node at once', async () => {
        const refused = new Error('connect ECONNREFUSED 127.0.0.1:26657');
        const send = jest.fn().mockRejectedValue(refused);

        await expect(waitForTx(contextWith(send), HASH, { intervalMs: 1 })).rejects.toBe(refused);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('gives up after timeoutMs, keeping the last answer', async () => {
        const send = jest.fn().mockImplementation(() => Promise.reject(notFound()));
        const started = Date.now();

        const err = await waitForTx(contextWith(send), HASH, {
            timeoutMs: 100,
            intervalMs: 10,
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(OperationTimeoutError);
        expect((err as OperationTimeoutError).message).toContain(
            `transaction ${HASH} was not indexed within 100ms`,
        );
        expect((err as OperationTimeoutError).innerError).toBeInstanceOf(ResponseError);
        expect(Date.now() - started).toBeGreaterThanOrEqual(100);
        expect(send.mock.calls.length).toBeGreaterThan(1);
    });

    it('names a hash given as bytes in hex', async () => {
        const send = jest.fn().mockImplementation(() => Promise.reject(notFound()));

        await expect(
            waitForTx(contextWith(send), Buffer.from(HASH, 'hex'), { timeoutMs: 1, intervalMs: 1 }),
        ).rejects.toThrow(`transaction ${HASH} was not indexed`);
    });

    it.each([
        ['timeoutMs', 0],
        ['timeoutMs', -1],
        ['timeoutMs', Number.NaN],
        ['timeoutMs', Number.POSITIVE_INFINITY],
        ['intervalMs', 0],
        ['intervalMs', '500'],
    ])('rejects %s %p before asking the node', async (name, value) => {
        const send = jest.fn();

        await expect(
            waitForTx(contextWith(send), HASH, { [name]: value as number }),
        ).rejects.toThrow(`${name} must be a positive number of milliseconds`);
        expect(send).not.toHaveBeenCalled();
    });

    // setTimeout fires at once for a delay above 2^31 - 1 ms, which would make
    // the lookups run back to back.
    it.each([['timeoutMs'], ['intervalMs']])(
        'rejects %s above the longest timer delay',
        async (name) => {
            const send = jest.fn();

            await expect(waitForTx(contextWith(send), HASH, { [name]: 2 ** 31 })).rejects.toThrow(
                `${name} must be at most 2147483647 milliseconds`,
            );
            expect(send).not.toHaveBeenCalled();
        },
    );

    it('gives up after timeoutMs while a lookup is still unanswered', async () => {
        // A node that stopped answering, or a socket that dropped mid-request.
        const send = jest.fn().mockReturnValue(new Promise(() => {}));
        const started = Date.now();

        const err = await waitForTx(contextWith(send), HASH, { timeoutMs: 100 }).catch(
            (e: unknown) => e,
        );

        expect(err).toBeInstanceOf(OperationTimeoutError);
        expect((err as OperationTimeoutError).message).toContain('the node did not answer');
        expect((err as OperationTimeoutError).innerError).toBeUndefined();
        expect(Date.now() - started).toBeGreaterThanOrEqual(100);
        expect(Date.now() - started).toBeLessThan(1000);
    });

    it('keeps the last not-found answer when a later lookup goes unanswered', async () => {
        const send = jest
            .fn()
            .mockRejectedValueOnce(notFound())
            .mockReturnValue(new Promise(() => {}));

        const err = await waitForTx(contextWith(send), HASH, {
            timeoutMs: 100,
            intervalMs: 10,
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(OperationTimeoutError);
        expect((err as OperationTimeoutError).innerError).toBeInstanceOf(ResponseError);
    });
});
