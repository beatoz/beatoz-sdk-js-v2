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

export enum Method {
    Subscribe = 'subscribe',
}

/**
 * Raw values must match the tendermint event name
 *
 * @see https://godoc.org/github.com/tendermint/tendermint/types#pkg-constants
 */
export enum SubscriptionEventType {
    NewBlock = 'NewBlock',
    NewBlockHeader = 'NewBlockHeader',
    Tx = 'Tx',
}

export interface SubscribeRequest {
    readonly method: Method.Subscribe;
    readonly query: {
        readonly type: SubscriptionEventType;
        readonly raw?: string;
    };
}

interface QueryTag {
    readonly key: string;
    readonly value: string;
}

export interface BuildQueryComponents {
    readonly tags?: readonly QueryTag[];
    readonly raw?: string;
}

export function buildQuery(components: BuildQueryComponents): string {
    const tags = components.tags ? components.tags : [];
    const tagComponents = tags.map((tag) => `${tag.key}='${tag.value}'`);
    const rawComponents = components.raw ? [components.raw] : [];

    return [...tagComponents, ...rawComponents].join(' AND ');
}
