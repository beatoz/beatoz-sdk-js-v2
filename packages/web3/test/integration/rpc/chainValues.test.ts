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
import { Web3 } from '../../../src';
import { getTestServer, getTestWsServer, closeProvider } from '../e2e_utils';

const DECIMAL = /^\d+$/;

// The node's own answer to a route, over HTTP.
const raw = async (path: string) => {
    const response = await fetch(`${getTestServer()}/${path}`);
    return (await response.json()).result as { value: string; height: string };
};

describe('chain-wide values', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(getTestWsServer());
    });

    afterAll(() => closeProvider(web3));

    it('returns each value as the node reports it', async () => {
        const supply = await web3.beatoz.totalSupply();
        const fee = await web3.beatoz.totalTxFee();
        const count = await web3.beatoz.txCount();
        const total = await web3.beatoz.totalPower();
        const voting = await web3.beatoz.votingPower();

        for (const response of [supply, fee, count, total, voting]) {
            expect(response.value).toMatch(DECIMAL);
            expect(response.height).toMatch(DECIMAL);
        }
        expect(BigInt(supply.value)).toBeGreaterThan(0n);
        expect(BigInt(total.value)).toBeGreaterThan(0n);
        expect(BigInt(voting.value)).toBeLessThanOrEqual(BigInt(total.value));

        // Values that only grow are at least what the node answered before.
        const node = await raw('txn');
        expect(BigInt(node.value)).toBeGreaterThanOrEqual(BigInt(count.value));
    });

    it('reads at a past height', async () => {
        const supply = await web3.beatoz.totalSupply(1);
        const total = await web3.beatoz.totalPower('1');
        const voting = await web3.beatoz.votingPower(1);

        expect(supply.height).toBe('1');
        expect(total.height).toBe('1');
        expect(voting.height).toBe('1');
        expect(supply.value).toBe((await raw('total_supply?height="1"')).value);
    });
});
