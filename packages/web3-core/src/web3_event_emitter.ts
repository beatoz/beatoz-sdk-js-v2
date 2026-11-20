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

export type Web3EventMap = Record<string, unknown>;
export type Web3EventKey<T extends Web3EventMap> = string & keyof T;
export type Web3EventCallback<T> = (params: T) => void | Promise<void>;
export interface Web3Emitter<T extends Web3EventMap> {
    on<K extends Web3EventKey<T>>(eventName: K, fn: Web3EventCallback<T[K]>): void;
    once<K extends Web3EventKey<T>>(eventName: K, fn: Web3EventCallback<T[K]>): void;
    off<K extends Web3EventKey<T>>(eventName: K, fn: Web3EventCallback<T[K]>): void;
    emit<K extends Web3EventKey<T>>(eventName: K, params: T[K]): void;
}

type Listener = ((params: unknown) => void | Promise<void>) & { listener?: Listener };

/**
 * An event emitter that behaves as Node's for the methods below, without
 * Node's `events` module, which browser bundlers do not provide (#222).
 *
 * Listeners run in the order they were added, on a copy of the list, so one
 * that adds or removes listeners does not change the current emit. `once`
 * removes its listener before running it. `off` removes the most recently
 * added match, a `once` listener included by its original function.
 */
export class Web3EventEmitter<T extends Web3EventMap> implements Web3Emitter<T> {
    private readonly _listeners = new Map<string, Listener[]>();
    private _maxListeners = 10;

    public on<K extends Web3EventKey<T>>(eventName: K, fn: Web3EventCallback<T[K]>) {
        this.add(eventName, fn as Listener);
    }

    public once<K extends Web3EventKey<T>>(eventName: K, fn: Web3EventCallback<T[K]>) {
        const wrapper: Listener = (params) => {
            this.remove(eventName, wrapper);
            return (fn as Listener)(params);
        };
        wrapper.listener = fn as Listener;
        this.add(eventName, wrapper);
    }

    public off<K extends Web3EventKey<T>>(eventName: K, fn: Web3EventCallback<T[K]>) {
        this.remove(eventName, fn as Listener);
    }

    public emit<K extends Web3EventKey<T>>(eventName: K, params: T[K]) {
        const list = this._listeners.get(eventName);
        if (!list) {
            // As Node does, an 'error' nobody listens for is thrown.
            if (eventName === 'error') {
                throw params instanceof Error
                    ? params
                    : new Error(`Unhandled error. (${String(params)})`);
            }
            return;
        }
        for (const fn of [...list]) {
            void fn(params);
        }
    }

    public listenerCount<K extends Web3EventKey<T>>(eventName: K) {
        return this._listeners.get(eventName)?.length ?? 0;
    }

    public listeners<K extends Web3EventKey<T>>(eventName: K) {
        return (this._listeners.get(eventName) ?? []).map((fn) => fn.listener ?? fn);
    }

    public eventNames() {
        return [...this._listeners.keys()];
    }

    public removeAllListeners(): void {
        this._listeners.clear();
    }
    public setMaxListenerWarningThreshold(maxListenersWarningThreshold: number) {
        this._maxListeners = maxListenersWarningThreshold;
    }
    public getMaxListeners() {
        return this._maxListeners;
    }

    private add(eventName: string, fn: Listener) {
        const list = this._listeners.get(eventName);
        if (list) list.push(fn);
        else this._listeners.set(eventName, [fn]);
    }

    private remove(eventName: string, fn: Listener) {
        const list = this._listeners.get(eventName);
        if (!list) return;
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i] === fn || list[i].listener === fn) {
                list.splice(i, 1);
                if (list.length === 0) this._listeners.delete(eventName);
                return;
            }
        }
    }
}
