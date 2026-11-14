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
import { Contract } from '../../src';
import erc20Json from '../fixtures/erc20-abi.json';
const abi = [
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'decimals',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
    {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        type: 'function',
        name: 'pair',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'ok', type: 'bool' },
        ],
    },
    {
        type: 'function',
        name: 'info',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            {
                name: 'p',
                type: 'tuple',
                components: [
                    { name: 'a', type: 'uint256' },
                    { name: 'b', type: 'bool' },
                ],
            },
        ],
    },
    { type: 'function', name: 'noop', stateMutability: 'nonpayable', inputs: [], outputs: [] },
    { type: 'event', name: 'Transfer', inputs: [], anonymous: false },
] as const;
const c = new Contract(abi, '0x15633e505d01691a71f40049e15ba1340c0eea29');
// Type-level tests. `yarn test:types` compiles this file and Jest never runs
// it. Each `@ts-expect-error` asserts that the next line does not compile.

export async function methodTypes() {
    const bal: bigint = await c.methods
        .balanceOf('0x15633e505d01691a71f40049e15ba1340c0eea29')
        .call();
    const bal2: bigint = await c.methods
        .balanceOf('15633e505d01691a71f40049e15ba1340c0eea29')
        .call();
    const dec: number = await c.methods.decimals().call();
    const ok: boolean = await c.methods.transfer('0xabc', 5n).call();
    const pr: readonly [bigint, boolean] = await c.methods.pair().call();
    const inf: { a: bigint; b: boolean } = await c.methods.info().call();
    const nothing: undefined = await c.methods.noop().call();
    // @ts-expect-error missing argument
    c.methods.balanceOf();
    // @ts-expect-error wrong argument type
    c.methods.transfer('0xabc', 'five');
    // @ts-expect-error no such method
    c.methods.nope();
    // @ts-expect-error events are not methods
    c.methods.Transfer();
    // @ts-expect-error decimals is a number, not a bigint
    const wrong: bigint = await c.methods.decimals().call();
    const j = new Contract(erc20Json, '0x00');
    const loose = await j.methods.balanceOf('0x00').call();
    return [bal, bal2, dec, ok, pr, inf, nothing, wrong, loose];
}

const tokenAbi = [
    {
        type: 'constructor',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'name', type: 'string' },
            { name: 'owner', type: 'address' },
        ],
    },
    ...abi,
] as const;

export async function deployTypes() {
    const from = '0x15633e505d01691a71f40049e15ba1340c0eea29';
    const t = new Contract(tokenAbi);
    const { address, contract } = await t
        .deploy({ bytecode: '0x00', args: ['Token', from.slice(2)] })
        .send({ from });
    const bal: bigint = await contract.methods.balanceOf(address).call();
    // @ts-expect-error the constructor takes arguments
    t.deploy({ bytecode: '0x00' });
    // @ts-expect-error wrong argument type
    t.deploy({ bytecode: '0x00', args: ['Token', 5] });
    // @ts-expect-error too few arguments
    t.deploy({ bytecode: '0x00', args: ['Token'] });
    // @ts-expect-error from is required
    await t.deploy({ bytecode: '0x00', args: ['Token', from] }).send({});
    // No constructor: no arguments.
    c.deploy({ bytecode: '0x00' });
    // @ts-expect-error no constructor, so no arguments
    c.deploy({ bytecode: '0x00', args: ['x'] });
    // An ABI read from JSON takes any arguments, or none.
    new Contract(erc20Json).deploy({ bytecode: '0x00', args: ['a', 1] });
    new Contract(erc20Json).deploy({ bytecode: '0x00' });
    return bal;
}
