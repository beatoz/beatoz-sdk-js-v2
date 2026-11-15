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

import { Numbers } from './primitives_types.js';

// Make each attribute mutable by removing `readonly`
export type Mutable<T> = {
    -readonly [P in keyof T]: T[P];
};

export type ConnectionEvent = {
    code: number;
    reason: string;
    wasClean?: boolean; // if WS connection was closed properly
};

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
export type EncodingTypes = Numbers | boolean | Numbers[] | boolean[];

export type TypedObject = {
    type: string;
    value: EncodingTypes;
};

export type TypedObjectAbbreviated = {
    t: string;
    v: EncodingTypes;
};

export type Sha3Input = TypedObject | TypedObjectAbbreviated | Numbers | boolean | object;
