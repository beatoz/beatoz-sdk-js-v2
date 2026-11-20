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
import { EventEmitter } from 'events';
import { Web3EventEmitter } from '../../src';

// Web3EventEmitter no longer wraps Node's EventEmitter, which browser
// bundlers do not provide (#222). The same steps on both must give the same
// calls and the same answers.
type Ops = {
    on(e: string, fn: (p: unknown) => void): unknown;
    once(e: string, fn: (p: unknown) => void): unknown;
    off(e: string, fn: (p: unknown) => void): unknown;
    emit(e: string, p: unknown): unknown;
    listenerCount(e: string): number;
    listeners(e: string): unknown[];
    eventNames(): unknown[];
    removeAllListeners(): unknown;
};

function run(em: Ops) {
    const log: string[] = [];
    const a = (p: unknown) => log.push(`a:${String(p)}`);
    const b = (p: unknown) => log.push(`b:${String(p)}`);
    const c = (p: unknown) => {
        log.push(`c:${String(p)}`);
        em.off('x', a); // removed during an emit: still called this time
        em.on('x', b); // added during an emit: not called this time
    };
    const snapshot = () =>
        log.push(
            JSON.stringify({
                n: em.listenerCount('x'),
                same: em.listeners('x').map((f) => [a, b, c].indexOf(f as never)),
                names: em.eventNames(),
            }),
        );

    em.on('x', a);
    em.once('x', b);
    em.on('x', c);
    em.on('x', a);
    snapshot();
    em.emit('x', 1);
    snapshot();
    em.emit('x', 2);
    snapshot();
    em.off('x', b); // the most recently added b
    em.once('y', a);
    em.off('y', a); // a once listener, by its original function
    snapshot();
    em.emit('y', 3);
    em.emit('none', 4);
    em.removeAllListeners();
    snapshot();
    em.emit('x', 5);
    return log;
}

describe('Web3EventEmitter behaves as Node EventEmitter', () => {
    it('runs, adds and removes listeners in the same order', () => {
        const ours = run(new Web3EventEmitter<Record<string, unknown>>() as unknown as Ops);
        expect(ours).toEqual(run(new EventEmitter() as unknown as Ops));
        expect(ours.length).toBeGreaterThan(10);
    });

    it("throws an 'error' nobody listens for", () => {
        const err = new Error('boom');
        const ours = new Web3EventEmitter<{ error: Error }>();
        expect(() => ours.emit('error', err)).toThrow(err);
        const seen: unknown[] = [];
        ours.on('error', (e) => {
            seen.push(e);
        });
        ours.emit('error', err);
        expect(seen).toEqual([err]);
    });

    it('keeps the max listener threshold', () => {
        const ours = new Web3EventEmitter<Record<string, unknown>>();
        expect(ours.getMaxListeners()).toBe(new EventEmitter().getMaxListeners());
        ours.setMaxListenerWarningThreshold(3);
        expect(ours.getMaxListeners()).toBe(3);
    });
});
