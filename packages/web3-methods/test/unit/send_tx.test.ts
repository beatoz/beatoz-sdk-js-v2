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
import { create, privateKeyToAccount, TrxProtoUtils, Wallet } from '@beatoz/web3-accounts';
import { InvalidInputError, TransactionFailedError } from '@beatoz/web3-errors';
import { Web3NonceManager } from '@beatoz/web3-types';
import { NonceManager, transfer, undelegate, withdrawReward } from '../../src/send_tx';

const wallet = new Wallet({ create, privateKeyToAccount });
const sender = wallet.create(1)[0];
const TO = '0x' + '11'.repeat(20);
const HASH = 'AB'.repeat(32);

type Sent = { method: string; params: Record<string, unknown> };

// A node that answers what a send asks: the account's nonce, the rules and
// the broadcast. `nonce` is what the node reports, as of the last block.
const fakeNode = (opts: { nonce?: number; checkCode?: number; deliverCode?: number } = {}) => {
    const sent: Sent[] = [];
    const send = jest.fn(async (request: Sent) => {
        sent.push(request);
        switch (request.method) {
            case 'account':
                return {
                    result: {
                        key: 'k',
                        value: {
                            address: sender.address,
                            nonce: String(opts.nonce ?? 7),
                            balance: '1',
                        },
                        height: '10',
                    },
                };
            case 'rule':
                return { result: { height: '10', value: { gasPrice: '250', minTrxGas: '5000' } } };
            case 'broadcast_tx_sync':
                return { result: { code: opts.checkCode ?? 0, log: 'invalid nonce', hash: HASH } };
            case 'broadcast_tx_commit':
                return {
                    result: {
                        height: '11',
                        hash: HASH,
                        check_tx: { code: opts.checkCode ?? 0, log: 'invalid nonce' },
                        deliver_tx: { code: opts.deliverCode ?? 0, log: 'out of gas' },
                    },
                };
            default:
                throw new Error(`unexpected ${request.method}`);
        }
    });
    return { sent, send };
};

const contextWith = (send: jest.Mock, nonceManager?: Web3NonceManager) =>
    ({
        requestManager: { send },
        wallet,
        chainId: '0x1234',
        nonceManager,
    }) as unknown as Web3Context;

// The transaction a broadcast carried.
const broadcastTx = (sent: Sent[]) => {
    const request = sent.find((r) => r.method.startsWith('broadcast_tx'))!;
    return TrxProtoUtils.decode(Buffer.from(request.params.tx as string, 'base64'));
};

describe('transfer', () => {
    it('fills the nonce, gas and gas price from the chain', async () => {
        const { sent, send } = fakeNode();

        const res = await transfer(contextWith(send), {
            from: sender.address,
            to: TO,
            amount: '1000',
        });

        expect(res.check_tx.code).toBe(0);
        const tx = broadcastTx(sent);
        expect(tx.nonce.toNumber()).toBe(7);
        // A native transaction is charged all its gas, so the minimum.
        expect(tx.gas.toNumber()).toBe(5000);
        expect(Buffer.from(tx.GasPrice).toString('hex')).toBe('fa');
        expect(sent.map((r) => r.method)).toEqual(['rule', 'account', 'broadcast_tx_commit']);
    });

    it('sends the values it is given without asking the node', async () => {
        const { sent, send } = fakeNode();

        await transfer(
            contextWith(send),
            { from: sender.address, to: TO, amount: '1' },
            { nonce: 3, gas: 6000, gasPrice: '300' },
        );

        const tx = broadcastTx(sent);
        expect(tx.nonce.toNumber()).toBe(3);
        expect(tx.gas.toNumber()).toBe(6000);
        expect(sent.map((r) => r.method)).toEqual(['broadcast_tx_commit']);
    });

    it('refuses a sender that is not in the wallet', async () => {
        const { send } = fakeNode();

        await expect(
            transfer(contextWith(send), { from: TO, to: TO, amount: '1' }),
        ).rejects.toThrow(InvalidInputError);
        expect(send).not.toHaveBeenCalled();
    });

    it('throws with the node log when check_tx refuses it', async () => {
        const { send } = fakeNode({ checkCode: 21 });

        const error = await transfer(contextWith(send), {
            from: sender.address,
            to: TO,
            amount: '1',
        }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(TransactionFailedError);
        expect(error).toMatchObject({ stage: 'check_tx', code: 21, log: 'invalid nonce' });
    });

    it('throws when the transaction fails in the block', async () => {
        const { send } = fakeNode({ deliverCode: 5 });

        await expect(
            transfer(contextWith(send), { from: sender.address, to: TO, amount: '1' }),
        ).rejects.toMatchObject({ stage: 'deliver_tx', code: 5 });
    });

    it('throws when a sync send is refused', async () => {
        const { send } = fakeNode({ checkCode: 21 });

        await expect(
            transfer(
                contextWith(send),
                { from: sender.address, to: TO, amount: '1' },
                { sendMode: 'sync' },
            ),
        ).rejects.toMatchObject({ stage: 'check_tx', code: 21 });
    });
});

describe('undelegate and withdrawReward', () => {
    it('put the stake hash and the amount in the payload', async () => {
        const a = fakeNode();
        await undelegate(contextWith(a.send), { from: sender.address, to: TO, txHash: HASH });
        const unstake = broadcastTx(a.sent);
        expect(unstake.type).toBe(3);

        const b = fakeNode();
        await withdrawReward(contextWith(b.send), { from: sender.address, amount: '5' });
        const withdraw = broadcastTx(b.sent);
        expect(withdraw.type).toBe(8);
        expect(Buffer.from(withdraw.to).toString('hex')).toBe(
            sender.address.replace(/^0x/, '').toLowerCase(),
        );
    });
});

describe('NonceManager', () => {
    const sync = { sendMode: 'sync' as const };
    const tx = { from: sender.address, to: TO, amount: '1' };

    it('counts on from the node, which reports the same nonce until the block', async () => {
        const { sent, send } = fakeNode({ nonce: 7 });
        const context = contextWith(send, new NonceManager());

        await transfer(context, tx, sync);
        await transfer(context, tx, sync);
        await transfer(context, tx, sync);

        const nonces = sent
            .filter((r) => r.method === 'broadcast_tx_sync')
            .map((r) =>
                TrxProtoUtils.decode(Buffer.from(r.params.tx as string, 'base64')).nonce.toNumber(),
            );
        expect(nonces).toEqual([7, 8, 9]);
        expect(sent.filter((r) => r.method === 'account')).toHaveLength(1);
    });

    it('without one, each send reads the node and repeats the nonce', async () => {
        const { sent, send } = fakeNode({ nonce: 7 });
        const context = contextWith(send);

        await transfer(context, tx, sync);
        await transfer(context, tx, sync);

        expect(sent.filter((r) => r.method === 'account')).toHaveLength(2);
    });

    it('reads the node again after a refused send', async () => {
        const manager = new NonceManager();
        const refused = fakeNode({ nonce: 7, checkCode: 21 });
        await expect(transfer(contextWith(refused.send, manager), tx, sync)).rejects.toThrow(
            TransactionFailedError,
        );

        const next = fakeNode({ nonce: 7 });
        await transfer(contextWith(next.send, manager), tx, sync);

        expect(broadcastTx(next.sent).nonce.toNumber()).toBe(7);
        expect(next.sent.filter((r) => r.method === 'account')).toHaveLength(1);
    });

    it('gives back the nonce when the builder refuses the input', async () => {
        const { sent, send } = fakeNode({ nonce: 7 });
        const context = contextWith(send, new NonceManager());

        await expect(transfer(context, { ...tx, amount: '-1' }, sync)).rejects.toThrow(
            InvalidInputError,
        );
        await transfer(context, tx, sync);

        expect(broadcastTx(sent).nonce.toNumber()).toBe(7);
    });

    it('gives consecutive nonces to sends started together', async () => {
        const manager = new NonceManager();
        const fetch = jest.fn().mockResolvedValue(4);

        const nonces = await Promise.all([
            manager.consume('0xAB', fetch),
            manager.consume('ab', fetch),
            manager.consume('0xab', fetch),
        ]);

        expect(nonces).toEqual([4, 5, 6]);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('asks the node again after a failed lookup', async () => {
        const manager = new NonceManager();
        const fetch = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(2);

        await expect(manager.consume('ab', fetch)).rejects.toThrow('down');
        await expect(manager.consume('ab', fetch)).resolves.toBe(2);
    });
});
