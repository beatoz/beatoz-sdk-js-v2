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
import erc20Json from '../fixtures/erc20-abi.json';
import rep20Json from '../fixtures/REP20.json';
import { closeProvider, deployTestToken, netInfo } from './e2e_utils';
import { Web3 } from '@beatoz/web3';
import { ContractFunctionRevertedError, ContractFunctionZeroDataError } from '@beatoz/web3-errors';

const ZERO = '0x0000000000000000000000000000000000000000';
// An address with no balance and no code.
const NOBODY = '0x00000000000000000000000000000000000000ab';

const errorFrom = (p: Promise<unknown>) =>
    p.then(
        () => undefined,
        (e: unknown) => e,
    );

describe('contract errors', () => {
    const web3 = new Web3(netInfo.WS);
    web3.beatoz.accounts.wallet.add(netInfo.ACCTS[0].KEY);
    let token: string;
    let rep20: string;

    beforeAll(async () => {
        ({ address: token } = await deployTestToken(web3));
        ({ address: rep20 } = await new web3.beatoz.Contract(rep20Json.abi)
            .deploy({ bytecode: rep20Json.bytecode, args: ['Rep', 'REP'] })
            .send({ from: netInfo.ACCTS[0].ADDR }));
    });

    afterAll(() => closeProvider(web3));

    // The test token is OpenZeppelin 4: require with a message.
    it('throws a require message as the reason', async () => {
        const contract = new web3.beatoz.Contract(erc20Json, token);
        const err = await errorFrom(
            contract.methods.transfer(netInfo.ACCTS[0].ADDR, 1).call({ from: NOBODY }),
        );

        expect(err).toBeInstanceOf(ContractFunctionRevertedError);
        expect(err).toMatchObject({
            errorName: 'Error',
            reason: expect.stringMatching(/^ERC20: /),
        });
        expect((err as ContractFunctionRevertedError).message).toContain(`Contract: ${token}`);
    });

    it('throws the same from estimateGas', async () => {
        const contract = new web3.beatoz.Contract(erc20Json, token);
        const err = await errorFrom(
            contract.methods.transfer(netInfo.ACCTS[0].ADDR, 1).estimateGas({ from: NOBODY }),
        );

        expect(err).toBeInstanceOf(ContractFunctionRevertedError);
        expect(err).toMatchObject({ errorName: 'Error' });
    });

    // REP20 is OpenZeppelin 5: custom errors, decoded by the ABI.
    it("decodes a custom error from the contract's ABI", async () => {
        const contract = new web3.beatoz.Contract(rep20Json.abi, rep20);
        const err = await errorFrom(contract.methods.approve(ZERO, 1).call({ from: NOBODY }));

        expect(err).toBeInstanceOf(ContractFunctionRevertedError);
        expect(err).toMatchObject({ errorName: 'ERC20InvalidSpender', args: [ZERO] });
    });

    it('throws a call to an address without code as returning no data', async () => {
        const contract = new web3.beatoz.Contract(erc20Json, NOBODY);
        const err = await errorFrom(contract.methods.decimals().call());

        expect(err).toBeInstanceOf(ContractFunctionZeroDataError);
    });
});
