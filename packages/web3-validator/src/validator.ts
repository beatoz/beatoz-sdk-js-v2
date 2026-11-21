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

import { Web3ValidatorError } from './errors.js';
import { checkSchema } from './schema_check.js';
import { Json, Schema } from './types.js';

export class Validator {
    private static validatorInstance?: Validator;

    private constructor() {}

    public static factory(): Validator {
        if (!Validator.validatorInstance) {
            Validator.validatorInstance = new Validator();
        }
        return Validator.validatorInstance;
    }

    public validate(schema: Schema, data: Json, options?: { silent?: boolean }) {
        const errors = checkSchema(schema, data);
        if (errors.length === 0) return undefined;
        if (options?.silent) return errors;
        throw new Web3ValidatorError(errors);
    }
}
