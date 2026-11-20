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

import { Web3ValidationErrorObject } from '@beatoz/web3-types';
import { Web3ValidatorError } from './errors.js';
import { checkSchema } from './schema_check.js';
import { Json, Schema, RawValidationError } from './types.js';

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
        const rawErrors = checkSchema(schema, data);
        if (rawErrors.length > 0) {
            const errors = this.convertErrors(rawErrors, schema, data);
            if (errors) {
                if (options?.silent) {
                    return errors;
                }
                throw new Web3ValidatorError(errors);
            }
        }
        return undefined;
    }

    private convertErrors(
        errors: RawValidationError[] | undefined,
        schema: Schema,
        data: Json,
    ): Web3ValidationErrorObject[] | undefined {
        if (errors && Array.isArray(errors) && errors.length > 0) {
            return errors.map((error: RawValidationError) => {
                let message;
                let keyword;
                let params;
                let schemaPath;

                schemaPath = Array.isArray(error.schemaPath)
                    ? error.schemaPath.slice(1).join('/')
                    : '';

                const { field } = error;
                const _instancePath =
                    schemaPath ||
                    // eslint-disable-next-line no-useless-escape
                    (field?.length >= 4 ? `${field.slice(4).replace(/\"|\[|\]/g, '')}` : '/');

                const instancePath = _instancePath ? `/${_instancePath}` : '';
                if (error?.message === 'has less items than allowed') {
                    const schemaData = this.getObjectValueByPath(schema, schemaPath) as {
                        minItems?: number;
                    };

                    if (schemaData.minItems) {
                        keyword = 'minItems';
                        schemaPath = `${schemaPath}/minItems`;

                        params = { limit: schemaData.minItems };

                        message = `must NOT have fewer than ${schemaData.minItems} items`;
                    }
                } else if (error?.message === 'has more items than allowed') {
                    const schemaData = this.getObjectValueByPath(schema, schemaPath) as {
                        maxItems?: number;
                    };

                    if (schemaData.maxItems) {
                        keyword = 'maxItems';
                        schemaPath = `${schemaPath}/maxItems`;

                        params = { limit: schemaData.maxItems };

                        message = `must NOT have more than ${schemaData.maxItems} items`;
                    }
                } else if (
                    error?.message.startsWith('must be') &&
                    error?.message.endsWith('format')
                ) {
                    const formatName = error?.message.split(' ')[2];
                    if (formatName) {
                        message = `must pass "${formatName}" validation`;
                    }
                }

                const dataValue = this.getObjectValueByPath(data as object, instancePath);
                return {
                    keyword: keyword ?? error.field,
                    instancePath,
                    schemaPath: `#${schemaPath}`,

                    params: params ?? { value: dataValue },
                    message: message ?? error.message,
                } as Web3ValidationErrorObject;
            });
        }
        return undefined;
    }

    private getObjectValueByPath(obj: object, pointer: string, objpath?: object[]) {
        try {
            if (typeof obj !== 'object') throw new Error('Invalid input object');
            if (typeof pointer !== 'string') throw new Error('Invalid JSON pointer');
            const parts = pointer.split('/');
            if (!['', '#'].includes(parts.shift() as string)) {
                throw new Error('Invalid JSON pointer');
            }
            if (parts.length === 0) return obj;

            let curr: unknown = obj;
            for (const part of parts) {
                if (typeof part !== 'string') throw new Error('Invalid JSON pointer');

                if (objpath) objpath.push(curr as object); // does not include target itself, but includes head
                const prop = this.untilde(part);
                if (typeof curr !== 'object') return undefined;
                // A null curr throws here, as it did before; the catch below answers ''.
                if (!Object.prototype.hasOwnProperty.call(curr, prop)) return undefined;

                curr = (curr as Record<string, unknown>)[prop];
            }

            return curr;
        } catch (_e) {
            return '';
        }
    }

    private untilde(string: string) {
        if (!string.includes('~')) return string;
        return string.replace(/~[01]/g, (match) => {
            switch (match) {
                case '~1':
                    return '/';
                case '~0':
                    return '~';
                default:
                    throw new Error('Unreachable');
            }
        });
    }
}
