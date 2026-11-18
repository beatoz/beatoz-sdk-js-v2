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
import { ResponsesDecoder } from '../../src';

// The node marshals an account with no stakes as a nil slice, `null`
// (beatoz-go ctrlers/vpower/ctrler_query.go queryStakes).
const decode = (value: unknown) =>
    ResponsesDecoder.decodeStakes({
        jsonrpc: '2.0',
        id: 1,
        result: { key: 'AB', value, height: '10' },
    } as never);

describe('ResponsesDecoder.decodeStakes', () => {
    it('gives an empty array for an account with no stakes', () => {
        expect(decode(null).value).toEqual([]);
    });

    it('keeps the stakes the node sends', () => {
        const stake = { owner: 'AB', to: 'CD', txhash: '00', startHeight: '1', power: '100' };
        expect(decode([stake])).toEqual({ key: 'AB', value: [stake], height: '10' });
    });
});
