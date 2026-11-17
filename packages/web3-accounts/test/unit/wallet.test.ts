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
import { create, privateKeyToAccount, Wallet } from '../../src';

const newWallet = (count: number) => {
    const wallet = new Wallet({ create, privateKeyToAccount });
    wallet.create(count);
    return wallet;
};

// remove() takes the account out with splice, which moves every later account
// down one place; lookups by address must follow (#139).
describe('Wallet.remove', () => {
    it('keeps every other address pointing at its own account, removed by address', () => {
        const wallet = newWallet(3);
        const [a, b, c] = [0, 1, 2].map((i) => wallet[i].address);

        expect(wallet.remove(a)).toBe(true);

        expect(wallet).toHaveLength(2);
        expect(wallet.get(a)).toBeUndefined();
        expect(wallet.get(b)?.address).toEqual(b);
        expect(wallet.get(c)?.address).toEqual(c);
    });

    it('forgets the address of an account removed by index', () => {
        const wallet = newWallet(3);
        const [a, b, c] = [0, 1, 2].map((i) => wallet[i].address);

        expect(wallet.remove(1)).toBe(true);

        expect(wallet.get(b)).toBeUndefined();
        expect(wallet.get(a)?.address).toEqual(a);
        expect(wallet.get(c)?.address).toEqual(c);
        expect(wallet.remove(b)).toBe(false);
    });

    it('adds again an account it removed', () => {
        const wallet = newWallet(2);
        const first = wallet[0];

        wallet.remove(first.address);
        wallet.add(first);

        expect(wallet).toHaveLength(2);
        expect(wallet.get(first.address)?.address).toEqual(first.address);
        expect(wallet.get(wallet[0].address)?.address).toEqual(wallet[0].address);
    });
});
