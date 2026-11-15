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

/**
 * A Web3 built without a provider has nowhere to send a request, so calls
 * must reject rather than hang or throw something unrelated.
 *
 * This lived in the integration suite, sharing a `beforeAll` that called
 * setProvider - so it asserted "fails without a provider" on an instance
 * that had one. It also swallowed its own failure: `fail()` inside `.then()`
 * throws, `.catch()` caught that throw and called `done()`, so the test
 * passed exactly when it should have failed.
 *
 * Nothing here contacts a node, so it belongs in the unit layer.
 */
describe('Web3 without a provider', () => {
    it('is built without a warning', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            new Web3();
            expect(warn).not.toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });

    it('rejects instead of sending a request', async () => {
        const noProvider = new Web3();

        await expect(noProvider.beatoz.status()).rejects.toThrow();
    });
});
