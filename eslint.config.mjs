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

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';
import licenseHeader from 'eslint-plugin-license-header';
import globals from 'globals';

/**
 * Apache 2.0 header required at the top of every source file.
 * Wording is kept identical to the previous eslint-plugin-header configuration.
 */
const APACHE_LICENSE_HEADER = [
    '/*',
    '    Copyright 2023 All BEATOZ Developers',
    '',
    '    Licensed under the Apache License, Version 2.0 (the "License");',
    '    you may not use this file except in compliance with the License.',
    '    You may obtain a copy of the License at',
    '',
    '        http://www.apache.org/licenses/LICENSE-2.0',
    '',
    '    Unless required by applicable law or agreed to in writing, software',
    '    distributed under the License is distributed on an "AS IS" BASIS,',
    '    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.',
    '    See the License for the specific language governing permissions and',
    '    limitations under the License.',
    '*/',
];

/**
 * Boundary files that legitimately handle `null`.
 *
 * This SDK is a JSON-RPC client, so `null` arrives over the wire as a normal
 * value: JSON has no `undefined` and expresses "no value" as `null`.
 * Files that touch the wire directly may therefore use `null`, while code
 * inside the boundary standardises on `undefined`.
 *
 * If internal code starts dealing with `null`, do not add it to this list.
 * Find the boundary that failed to normalise it to `undefined` instead.
 */
const RPC_BOUNDARY_FILES = [
    'packages/web3-types/src/response_decoder.ts',
    'packages/web3-types/src/responses.ts',
    'packages/web3-types/src/encodings.ts',
    'packages/web3-types/src/web3_base_provider.ts',
    'packages/web3-types/src/assert.ts',
    'packages/web3-core/src/web3_request_manager.ts',
    'packages/web3-contract/src/log_subscription.ts',
    'packages/web3-contract/src/encoding.ts',
    'packages/web3-utils/src/storage.ts',
];

export default tseslint.config(
    // ---------------------------------------------------------------
    // 1. Global ignores
    //    Consolidated from the per-package .eslintignore files.
    // ---------------------------------------------------------------
    {
        ignores: [
            '**/node_modules/**',
            '**/lib/**',
            '**/dist/**',
            '**/coverage/**',
            '**/.coverage/**',
            '**/*.tsbuildinfo',
            '**/jest.config.js',
            '**/webpack.config.js',
            '**/webpack.analyze.js',
            // Generated protobuf code - not hand-edited.
            'packages/web3-accounts/src/tx/trx_pb.ts',
            // Dead code: the entire file is commented out.
            // The license-header autofix treats the leading comment run as a
            // malformed header and replaces it, wiping the contents. Must stay ignored.
            // (Whether to keep or delete this file is a separate decision.)
            'packages/web3-accounts/src/transfer_test.ts',
            // Individual exclusions carried over from the old .eslintignore files
            'packages/web3-providers-ws/test/websocket_provider.test.ts',
            'packages/web3-utils/test/**',
            'packages/web3-validator/test/**',
            // Miscellaneous scripts outside the build output
            'tools/**',
            'examples/**',
        ],
    },

    // ---------------------------------------------------------------
    // 2. Recommended rule sets
    // ---------------------------------------------------------------
    js.configs.recommended,
    ...tseslint.configs.recommended,

    // ---------------------------------------------------------------
    // 3. TypeScript sources: type-aware linting plus repo-wide rules
    // ---------------------------------------------------------------
    {
        files: ['**/*.ts'],
        languageOptions: {
            parserOptions: {
                // projectService resolves the right tsconfig per file automatically.
                // This single setting replaces the per-package `project` paths that
                // all 13 workspaces used to duplicate in their own .eslintrc.js.
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            'import-x': importX,
            unicorn,
            'license-header': licenseHeader,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            'license-header/header': ['error', APACHE_LICENSE_HEADER],

            // Intentionally unused identifiers are marked with a leading `_`.
            // Mostly parameters that must stay in the signature but are unused in the body.
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],

            // Internal code standardises on `undefined`. Boundary files are excepted in section 4.
            'unicorn/no-null': 'error',

            // Block circular imports. The previous config declared the resolver but
            // never registered the plugin, so this rule was never loaded.
            'import-x/no-cycle': 'error',
        },
        settings: {
            'import-x/resolver': {
                typescript: true,
            },
        },
    },

    // ---------------------------------------------------------------
    // 4. RPC boundary files: `null` allowed
    // ---------------------------------------------------------------
    {
        files: RPC_BOUNDARY_FILES,
        rules: {
            'unicorn/no-null': 'off',
        },
    },

    // ---------------------------------------------------------------
    // 5. Test code: looser than production code
    // ---------------------------------------------------------------
    {
        files: ['**/test/**/*.ts', '**/test/**/*.js'],
        languageOptions: {
            globals: {
                jest: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                beforeEach: 'readonly',
                afterAll: 'readonly',
                afterEach: 'readonly',
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'license-header/header': 'off',
            'unicorn/no-null': 'off',
            // Type-level tests declare a value and reference it only via `typeof`,
            // so the value being unused at runtime is expected.
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
        },
    },

    // ---------------------------------------------------------------
    // 6. Config and script JavaScript: not subject to type-aware linting.
    // ---------------------------------------------------------------
    {
        files: ['**/*.js', '**/*.cjs'],
        ...tseslint.configs.disableTypeChecked,
        languageOptions: {
            sourceType: 'commonjs',
            globals: globals.node,
        },
        rules: {
            'license-header/header': 'off',
            '@typescript-eslint/no-require-imports': 'off',
        },
    },

    // ---------------------------------------------------------------
    // 7. ESM scripts: modules rather than CommonJS, so no `require`.
    // ---------------------------------------------------------------
    {
        files: ['**/*.mjs'],
        ...tseslint.configs.disableTypeChecked,
        languageOptions: {
            sourceType: 'module',
            globals: globals.node,
        },
        rules: {
            'license-header/header': 'off',
        },
    },

    // ---------------------------------------------------------------
    // 8. Prettier integration must come last: it disables rules that conflict
    //    with formatting and reports formatting violations as lint errors.
    // ---------------------------------------------------------------
    prettierRecommended,
);
