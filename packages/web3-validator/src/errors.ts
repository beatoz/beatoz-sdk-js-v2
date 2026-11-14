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

import { InvalidInputError } from '@beatoz/web3-errors';
import { Web3ValidationErrorObject } from '@beatoz/web3-types';

import { isNullish } from './validation/object.js';

const errorFormatter = (error: Web3ValidationErrorObject): string => {
    if (error.message && error.instancePath && error.params && !isNullish(error.params.value)) {
        return `value "${(error.params as { value: unknown }).value}" at "${error.instancePath}" ${
            error.message
        }`;
    }

    if (error.message && error.instancePath) {
        return `value at "${error.instancePath}" ${error.message}`;
    }

    if (error.instancePath) {
        return `value at "${error.instancePath}" caused unspecified error`;
    }

    if (error.message) {
        return error.message;
    }

    return 'unspecified error';
};

/** Values that do not match the ABI types they are checked against. */
export class Web3ValidatorError extends InvalidInputError {
    public override name = 'Web3ValidatorError';
    public readonly errors: Web3ValidationErrorObject[];

    public constructor(errors: Web3ValidationErrorObject[]) {
        super(`Web3 validator found ${errors.length} error[s]:`, {
            metaMessages: errors.map(errorFormatter),
        });
        this.errors = errors;
    }
}
