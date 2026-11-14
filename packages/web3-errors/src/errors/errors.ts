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

import { BaseError, BaseErrorParameters } from '../base_error.js';

/** A value passed to the SDK that it cannot use. Nothing was sent. */
export class InvalidInputError extends BaseError {
    public override name = 'InvalidInputError';

    public constructor(shortMessage: string, args?: BaseErrorParameters) {
        super(shortMessage, args);
    }
}

/** ABI encoding or decoding failed. */
export class AbiError extends BaseError {
    public override name = 'AbiError';

    public constructor(shortMessage: string, args?: BaseErrorParameters) {
        super(shortMessage, args);
    }
}

/** Waiting for something, such as a transaction to be indexed, took too long. */
export class TimeoutError extends BaseError {
    public override name = 'TimeoutError';

    public constructor(shortMessage: string, args?: BaseErrorParameters) {
        super(shortMessage, args);
    }
}
