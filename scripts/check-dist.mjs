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
 * Checks what the build hands to users, after `yarn build`.
 *
 * The unit tests run `src/` through babel, so none of them load `lib/`. These
 * checks do, through each package's `exports`, the way a user's code would:
 *
 *   1. every package loads with `import` and with `require`;
 *   2. the ESM build signs a transaction - `import * as` of a CommonJS module
 *      once left the build loading fine but unable to sign;
 *   3. the public types compile with no Node types available
 *      (`types: []`, `skipLibCheck: false`), so users do not need `@types/node`.
 *
 * With `--installed`, the same checks run in a project that installed the
 * packed packages: scripts/check-packed.mjs copies this file there, and the
 * packages and TypeScript are then the ones in that project's node_modules.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const installed = process.argv.includes('--installed');
const projectRoot = installed ? here : path.resolve(here, '..');
const require = createRequire(import.meta.url);

const names = installed
    ? fs
          .readdirSync(path.join(projectRoot, 'node_modules', '@beatoz'))
          .map((dir) => `@beatoz/${dir}`)
          .sort()
    : fs
          .readdirSync(path.join(projectRoot, 'packages'))
          .map((dir) => path.join(projectRoot, 'packages', dir, 'package.json'))
          .filter((file) => fs.existsSync(file))
          .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')).name)
          .sort();

let failed = false;
const fail = (what, error) => {
    failed = true;
    console.error(
        `✗ ${what}\n  ${String(error?.stack ?? error)
            .split('\n')
            .join('\n  ')}`,
    );
};

// 1. load
for (const name of names) {
    for (const [how, load] of [
        ['import', () => import(name)],
        ['require', async () => require(name)],
    ]) {
        try {
            const mod = await load();
            if (Object.keys(mod).length === 0) throw new Error('exports nothing');
        } catch (error) {
            fail(`${how} ${name}`, error);
        }
    }
}
if (!failed) console.log(`✓ ${names.length} packages load with import and require`);

// 2. sign with the ESM build
try {
    const { create, TrxProtoBuilder } = await import('@beatoz/web3-accounts');
    const account = create();
    const chainId = '0x1234';
    const trx = TrxProtoBuilder.buildTransferTrxProto({
        from: account.address,
        to: account.address,
        amount: '1',
        gas: 100000,
        gasPrice: '48000000000',
    });
    const signed = account.signTransaction(trx, chainId);
    if (!signed.rawTransaction || !/^[0-9a-f]{64}$/.test(signed.transactionHash)) {
        throw new Error(`unexpected result: ${JSON.stringify(signed)}`);
    }
    if (!TrxProtoBuilder.verifyTrxProto(trx, account, chainId)) {
        throw new Error('the signature does not verify');
    }
    console.log('✓ the ESM build signs a transaction and the signature verifies');
} catch (error) {
    fail('sign with the ESM build', error);
}

// 3. public types without Node types
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatoz-check-dist-'));
try {
    // Inside the project, so the imports resolve to its packages. One ES
    // module (.mts) and one CommonJS (.cts) consumer, whatever the project's
    // "type" says: the packages are ES modules only, and a CommonJS file can
    // import them under nodenext from TypeScript 5.8, the floor in
    // peerDependencies.
    const source = names
        .map((name, i) => `import * as p${i} from '${name}';\nvoid p${i};\n`)
        .join('');
    const consumers = ['mts', 'cts'].map((ext) =>
        path.join(projectRoot, `.check-dist-${process.pid}.${ext}`),
    );
    for (const consumer of consumers) fs.writeFileSync(consumer, source);
    const tsconfig = path.join(dir, 'tsconfig.json');
    fs.writeFileSync(
        tsconfig,
        JSON.stringify({
            compilerOptions: {
                module: 'nodenext',
                moduleResolution: 'nodenext',
                target: 'es2022',
                strict: true,
                noEmit: true,
                skipLibCheck: false,
                types: [],
            },
            files: consumers,
        }),
    );
    // Read the bin from package.json: TypeScript 7 does not export ./bin/tsc.
    const tsDir = require.resolve
        .paths('typescript')
        .map((modules) => path.join(modules, 'typescript'))
        .find((candidate) => fs.existsSync(path.join(candidate, 'package.json')));
    const tsManifest = JSON.parse(fs.readFileSync(path.join(tsDir, 'package.json'), 'utf8'));
    const tsc = path.join(tsDir, tsManifest.bin.tsc);
    const version = execFileSync(process.execPath, [tsc, '--version']).toString().trim();
    try {
        execFileSync(process.execPath, [tsc, '-p', tsconfig], { stdio: 'pipe' });
        console.log(
            `✓ the public types compile without @types/node, from an ES module and a CommonJS file (${version})`,
        );
    } catch (error) {
        fail('the public types compile without @types/node', error.stdout?.toString() || error);
    } finally {
        for (const consumer of consumers) fs.rmSync(consumer, { force: true });
    }
} finally {
    fs.rmSync(dir, { recursive: true, force: true });
}

process.exitCode = failed ? 1 : 0;
