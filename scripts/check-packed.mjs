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
 * Checks the packages as npm would publish them, installed into projects
 * outside the repository. Inside the repository every dependency is hoisted
 * into one node_modules, so a package resolves imports it never declared.
 *
 *   node scripts/check-packed.mjs pack <dir>
 *       `npm pack` every package into <dir>, after `yarn build`. npm, not
 *       yarn: yarn 1 ignores the `files` field.
 *   node scripts/check-packed.mjs install <dir> [--typescript <version>]
 *       install every tarball into one new project, then run check-dist.mjs
 *       there: load, sign, and compile the public types with that TypeScript.
 *   node scripts/check-packed.mjs standalone <dir>
 *       for each package, a new project with only that package and the
 *       `@beatoz` packages it declares; it has to load with import and require.
 *   node scripts/check-packed.mjs publint <dir>
 *       run publint on each tarball.
 *
 * The packages still carry the version 1.x has on npm, so a missing tarball
 * would be filled from the registry without a word. Every install checks that
 * each `@beatoz` package came from a tarball.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const [command, dirArg, ...rest] = process.argv.slice(2);
if (!command || !dirArg) {
    console.error(
        'usage: check-packed.mjs <pack|install|standalone|publint> <dir> [--typescript <version>]',
    );
    process.exit(2);
}
const dir = path.resolve(dirArg);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// name -> { dir, manifest } for every package in the repository
const packages = new Map(
    fs
        .readdirSync(path.join(repoRoot, 'packages'))
        .map((name) => path.join(repoRoot, 'packages', name))
        .filter((pkgDir) => fs.existsSync(path.join(pkgDir, 'package.json')))
        .map((pkgDir) => {
            const manifest = readJson(path.join(pkgDir, 'package.json'));
            return [manifest.name, { dir: pkgDir, manifest }];
        }),
);

// The file `npm pack` writes for a package: @beatoz/web3-types@1.6.5 ->
// beatoz-web3-types-1.6.5.tgz
const tarballOf = (name) =>
    path.join(
        dir,
        `${name.replace(/^@/, '').replace('/', '-')}-${packages.get(name).manifest.version}.tgz`,
    );

// The package and every `@beatoz` package it depends on, directly or not.
const withInternalDependencies = (name, seen = new Set()) => {
    if (seen.has(name)) return seen;
    seen.add(name);
    for (const dependency of Object.keys(packages.get(name).manifest.dependencies ?? {})) {
        if (packages.has(dependency)) withInternalDependencies(dependency, seen);
    }
    return seen;
};

// A new project outside the repository with these tarballs (and any extra
// specs) installed. Returns its directory.
const installProject = (names, extra = []) => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'beatoz-check-packed-'));
    fs.writeFileSync(
        path.join(project, 'package.json'),
        JSON.stringify({ name: 'consumer', version: '0.0.0', private: true }),
    );
    execFileSync(
        npm,
        [
            'install',
            '--no-audit',
            '--no-fund',
            '--loglevel=error',
            ...names.map(tarballOf),
            ...extra,
        ],
        { cwd: project, stdio: ['ignore', 'ignore', 'inherit'] },
    );
    const lock = readJson(path.join(project, 'package-lock.json'));
    for (const [where, entry] of Object.entries(lock.packages)) {
        const name = where.replace(/^.*node_modules\//, '');
        if (!name.startsWith('@beatoz/')) continue;
        if (!names.includes(name) || !entry.resolved?.startsWith('file:')) {
            throw new Error(
                `${name} at ${where} did not come from a tarball: ${entry.resolved ?? entry.version}`,
            );
        }
    }
    return project;
};

const run = (what, fn) => {
    try {
        fn();
        return true;
    } catch (error) {
        console.error(
            `✗ ${what}\n  ${String(error?.stack ?? error)
                .split('\n')
                .join('\n  ')}`,
        );
        return false;
    }
};

let ok = true;

if (command === 'pack') {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, { dir: pkgDir }] of packages) {
        execFileSync(npm, ['pack', '--silent', '--pack-destination', dir], {
            cwd: pkgDir,
            stdio: ['ignore', 'ignore', 'inherit'],
        });
        if (!fs.existsSync(tarballOf(name))) {
            ok = false;
            console.error(`✗ npm pack did not write ${tarballOf(name)}`);
        }
    }
    if (ok) console.log(`✓ packed ${packages.size} packages into ${dir}`);
} else if (command === 'install') {
    const at = rest.indexOf('--typescript');
    const typescript =
        at === -1
            ? readJson(path.join(repoRoot, 'package.json')).devDependencies.typescript
            : rest[at + 1];
    ok = run(`install the packages with typescript@${typescript}`, () => {
        const project = installProject([...packages.keys()], [`typescript@${typescript}`]);
        try {
            fs.copyFileSync(
                path.join(here, 'check-dist.mjs'),
                path.join(project, 'check-dist.mjs'),
            );
            console.log(
                `✓ installed ${packages.size} packages from tarballs, Node ${process.version}`,
            );
            execFileSync(process.execPath, ['check-dist.mjs', '--installed'], {
                cwd: project,
                stdio: 'inherit',
            });
        } finally {
            fs.rmSync(project, { recursive: true, force: true });
        }
    });
} else if (command === 'standalone') {
    for (const name of packages.keys()) {
        const names = [...withInternalDependencies(name)];
        ok =
            run(`${name} alone`, () => {
                const project = installProject(names);
                try {
                    execFileSync(
                        process.execPath,
                        [
                            '--input-type=module',
                            '-e',
                            `import { createRequire } from 'node:module';
                             const loaded = [await import('${name}'), createRequire(import.meta.url)('${name}')];
                             if (loaded.some((mod) => Object.keys(mod).length === 0)) throw new Error('exports nothing');`,
                        ],
                        { cwd: project, stdio: ['ignore', 'ignore', 'pipe'] },
                    );
                } catch (error) {
                    throw new Error(error.stderr?.toString() || String(error), { cause: error });
                } finally {
                    fs.rmSync(project, { recursive: true, force: true });
                }
            }) && ok;
        if (ok) console.log(`✓ ${name} loads with only ${names.length - 1} @beatoz dependencies`);
    }
} else if (command === 'publint') {
    const { publint } = await import('publint');
    const { formatMessage } = await import('publint/utils');
    for (const name of packages.keys()) {
        let result;
        try {
            const tarball = fs.readFileSync(tarballOf(name));
            // Without pkgDir, publint reads the package from the tarball itself.
            result = await publint({
                level: 'warning',
                pack: {
                    tarball: tarball.buffer.slice(
                        tarball.byteOffset,
                        tarball.byteOffset + tarball.byteLength,
                    ),
                },
            });
        } catch (error) {
            ok = false;
            console.error(`✗ publint ${name}\n  ${error.message}`);
            continue;
        }
        const { messages, pkg } = result;
        if (messages.length === 0) {
            console.log(`✓ publint ${name}`);
            continue;
        }
        ok = false;
        console.error(`✗ publint ${name}`);
        for (const message of messages)
            console.error(`  ${message.type}: ${formatMessage(message, pkg)}`);
    }
} else {
    console.error(`unknown command: ${command}`);
    ok = false;
}

process.exitCode = ok ? 0 : 1;
