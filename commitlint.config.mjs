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

import fs from 'node:fs';

// The rules in guides/commits.md. Reverts are skipped by
// commitlint's default ignores, so their generated subjects may run long.

// A scope names one package, without the `web3-` prefix.
const scopes = fs
    .readdirSync(new URL('./packages', import.meta.url))
    .map((dir) => (dir === 'web3' ? dir : dir.replace(/^web3-/, '')));

export default {
    extends: ['@commitlint/config-conventional'],
    plugins: [
        {
            rules: {
                'body-required-for-type': ({ type, body }, _when, types = []) =>
                    !types.includes(type) || Boolean(body?.trim())
                        ? [true]
                        : [false, `a ${type} commit needs a body that says what was wrong and why`],
                // "Add ...", not "add ...". A name written as it is in code may
                // lead ("BytesUint8Array.fromHex ...", "ESM ..."); a plain
                // capitalized word cannot be told apart from one, so wrap such
                // a name in backticks.
                'subject-lowercase-start': ({ subject }) =>
                    /^[A-Z][a-z]+$/.test((subject ?? '').split(/\s/)[0])
                        ? [false, 'start the subject with a lowercase letter']
                        : [true],
                'no-tool-co-authors': ({ raw }) =>
                    /^co-authored-by:/im.test(raw)
                        ? [false, 'commits do not carry Co-Authored-By trailers']
                        : [true],
            },
        },
    ],
    rules: {
        'type-enum': [
            2,
            'always',
            ['feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'build', 'ci', 'chore', 'revert'],
        ],
        'scope-enum': [2, 'always', scopes],
        // config-conventional's subject-case also rejects a leading code name.
        'subject-case': [0],
        'subject-lowercase-start': [2, 'always'],
        'header-max-length': [2, 'always', 72],
        // Without the blank line, Git reads the first body line as part of the
        // subject.
        'body-leading-blank': [2, 'always'],
        // Wrap at 72; a warning, since code and URLs in a body cannot always wrap.
        'body-max-line-length': [1, 'always', 72],
        'body-required-for-type': [2, 'always', ['feat', 'fix']],
        'no-tool-co-authors': [2, 'always'],
    },
};
