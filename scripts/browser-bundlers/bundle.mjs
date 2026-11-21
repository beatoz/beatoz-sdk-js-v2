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

/**
 * Bundles entry.js for a browser with Vite and with webpack 5, as an app
 * would, with no Node polyfills, then runs each bundle where only a
 * browser's globals exist. Run by `check-packed.mjs bundlers` as
 * `node bundle.mjs <app> <tools>`: <app> installed the packed packages and
 * holds entry.js, <tools> installed Vite and webpack, apart, so that nothing
 * the bundlers depend on can stand in for a Node module the SDK imports.
 *
 * A bundle fails if the build errors, if Vite externalizes a Node module
 * ("has been externalized for browser compatibility": the import becomes an
 * empty object and fails at run time), or if entry.js does not report `ok`.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const [root, tools] = process.argv.slice(2).map((dir) => path.resolve(dir));
const entry = path.join(root, 'entry.js');
const requireTool = createRequire(path.join(tools, 'package.json'));

// What a browser has, and nothing of Node's (no process, Buffer, require).
const runInBrowser = (file) => {
    const context = {
        TextEncoder,
        TextDecoder,
        crypto: webcrypto,
        atob,
        btoa,
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        URL,
        AbortController,
    };
    context.self = context;
    context.window = context;
    context.globalThis = context;
    vm.runInContext(fs.readFileSync(file, 'utf8'), vm.createContext(context));
    return context.__check;
};

const bundles = {
    async vite() {
        const { build, createLogger } = await import(
            pathToFileURL(requireTool.resolve('vite')).href
        );
        const warnings = [];
        const logger = createLogger('warn');
        const warn = logger.warn.bind(logger);
        logger.warn = (message, options) => {
            warnings.push(message);
            warn(message, options);
        };
        logger.warnOnce = logger.warn;
        await build({
            root,
            configFile: false,
            logLevel: 'warn',
            customLogger: logger,
            build: {
                outDir: 'dist-vite',
                emptyOutDir: true,
                lib: { entry, formats: ['iife'], name: 'check', fileName: () => 'bundle.js' },
            },
            plugins: [
                {
                    // Rollup reports through onwarn, not Vite's logger.
                    name: 'collect-warnings',
                    configResolved(config) {
                        const onwarn = config.build.rollupOptions.onwarn;
                        config.build.rollupOptions.onwarn = (warning, handler) => {
                            warnings.push(warning.message);
                            if (onwarn) onwarn(warning, handler);
                            else handler(warning);
                        };
                    },
                },
            ],
        });
        const externalized = warnings.filter((w) =>
            /externalized for browser compatibility/.test(w),
        );
        if (externalized.length > 0) throw new Error(externalized.join('\n'));
        return path.join(root, 'dist-vite', 'bundle.js');
    },

    async webpack() {
        const webpack = requireTool('webpack');
        const stats = await new Promise((resolve, reject) =>
            webpack(
                {
                    mode: 'production',
                    target: 'web',
                    context: root,
                    entry,
                    output: { path: path.join(root, 'dist-webpack'), filename: 'bundle.js' },
                    performance: { hints: false },
                },
                (error, result) => (error ? reject(error) : resolve(result)),
            ),
        );
        const { errors, warnings } = stats.toJson({ all: false, errors: true, warnings: true });
        const messages = [...errors, ...warnings].map((e) => e.message);
        if (messages.length > 0) throw new Error(messages.join('\n'));
        return path.join(root, 'dist-webpack', 'bundle.js');
    },
};

let failed = false;
for (const [name, bundle] of Object.entries(bundles)) {
    const version = JSON.parse(
        fs.readFileSync(path.join(tools, 'node_modules', name, 'package.json'), 'utf8'),
    ).version;
    try {
        const file = await bundle();
        const result = runInBrowser(file);
        if (result !== 'ok') throw new Error(`in the browser context: ${result}`);
        const kb = Math.round(fs.statSync(file).size / 1024);
        console.log(
            `✓ ${name} ${version} bundles the packages with no polyfills (${kb} KB), and they run in a browser context`,
        );
    } catch (error) {
        failed = true;
        console.error(
            `✗ ${name} ${version}\n  ${String(error?.message ?? error)
                .split('\n')
                .join('\n  ')}`,
        );
    }
}
process.exitCode = failed ? 1 : 0;
