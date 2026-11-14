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

import { closeProvider, deployTestToken, netInfo } from './e2e_utils';
import { Web3 } from '@beatoz/web3';
import { toChecksumAddress } from '@beatoz/web3-utils';

describe('deploy test', () => {
    const web3 = new Web3(netInfo.WS);
    for (const acct of netInfo.ACCTS) {
        web3.beatoz.accounts.wallet.add(acct.KEY);
    }
    afterAll(() => closeProvider(web3));

    it('deploy function', async () => {
        const { address } = await deployTestToken(web3);
        expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
        expect(address).toBe(toChecksumAddress(address));
    });
});
