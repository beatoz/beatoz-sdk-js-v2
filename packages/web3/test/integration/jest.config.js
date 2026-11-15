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
const base = require('../config/jest.config');

module.exports = {
    ...base,
    // Load .env before the test framework starts, so e2e_utils sees it.
    setupFiles: ['<rootDir>/../../scripts/jest/load-env.js'],
    // These tests talk to a running node and mutate chain state, so they must
    // not run concurrently: they send from the same funded accounts and share
    // their nonces (#22).
    maxWorkers: 1,
    testTimeout: 30000,
    testMatch: ['<rootDir>/test/integration/**/*.(spec|test).(js|ts)'],
    collectCoverage: false,
};
