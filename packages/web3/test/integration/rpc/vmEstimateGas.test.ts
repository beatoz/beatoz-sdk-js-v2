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
import { closeProvider, deployTestToken, netInfo, TEST_TOKEN_SUPPLY } from '../contract_fixtures';
import tokenJson from '../../fixtures/erc20-contract.json';

describe('vmEstimateGas check', () => {
    let web3: Web3;

    beforeAll(() => {
        web3 = new Web3(netInfo.WS);
        web3.beatoz.accounts.wallet.add(netInfo.ACCTS[0].KEY);
    });

    afterAll(() => closeProvider(web3));

    it('runs an EVM call and reports its gas, as a contract estimate does', async () => {
        const { address, deployer } = await deployTestToken(web3);
        const balanceOf = tokenJson.abi.find(
            (item) => item.type === 'function' && item.name === 'balanceOf',
        )!;
        const data = web3.beatoz.abi.encodeFunctionCall(balanceOf as never, [deployer]);

        const estimate = await web3.beatoz.vmEstimateGas(deployer, address, data);

        expect(estimate.value.vmErr).toBeUndefined();
        expect(BigInt(estimate.value.usedGas)).toBeGreaterThan(0n);
        // The node returns data from an estimate only when the call reverts
        // (beatoz-go ctrlers/vm/evm/query.go).
        expect(estimate.value.returnData).toBe('');

        // The same call through vm_call returns the deployer's balance, the
        // whole supply, for the same gas.
        const call = await web3.beatoz.vmCall(deployer, address, 0, data);
        expect(BigInt(`0x${call.value.returnData}`)).toBe(TEST_TOKEN_SUPPLY);
        expect(call.value.usedGas).toEqual(estimate.value.usedGas);

        // The ABI is JSON, not `as const`, so the methods are untyped here.
        const contract = new web3.beatoz.Contract(tokenJson.abi as never, address) as any;
        const viaContract = await contract.methods
            .balanceOf(deployer)
            .estimateGas({ from: deployer });
        expect(viaContract.value.usedGas).toEqual(estimate.value.usedGas);
    });
});
