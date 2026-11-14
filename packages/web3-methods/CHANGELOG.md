# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org). See
[guides/release.md](../../guides/release.md) for what counts as a major, minor or patch change.

## [Unreleased]

### Added

- `web3.beatoz.waitForTx(hash, { timeoutMs, intervalMs })` waits until the
  node has indexed a transaction and returns it. A broadcast, the commit
  reply included, can answer before the transaction is indexed, so looking it
  up straight away can fail as `tx (...) not found`; callers wrote their own
  polling for it. It retries only on that answer - any other error, such as a
  node with indexing disabled, is thrown at once. After `timeoutMs` (default
  30000, looking every `intervalMs`, default 500) it throws an
  `OperationTimeoutError` holding the node's last answer, also when a lookup is
  still unanswered then. Being indexed is not success: check
  `tx_result.code`.

- `reward(addr)` on `Web3Method`, so `web3.beatoz.reward(addr)` returns an
  account's reward ledger - in particular `cumulated`, the amount a withdraw
  transaction can take. The chain had the query; the SDK had no way to call it.

### Changed

- **BREAKING:** `waitForTx` refuses a bad `timeoutMs` or `intervalMs` with
  `InvalidInputError` (#100).

- **BREAKING:** `waitForTx` times out with `TimeoutError` (was
  `OperationTimeoutError`) and keeps the node's last answer in `cause` (was
  `innerError`) (#100). `SendTransactionEvents` and `ETH_DATA_FORMAT`, left
  from web3.js and used nowhere, are gone.

- **BREAKING:** The minimum TypeScript version is 5.8, raised from 5.7. The
  packages are ES modules only, and on 5.7 a CommonJS project that resolves them
  with `module`/`moduleResolution` `nodenext` cannot import them (`error
  TS1479`); from 5.8 it can, as Node 22.12 and later can `require` them. ES
  module projects and `moduleResolution` `node` or `bundler` worked on 5.7, but
  one floor that holds for every project is simpler to state. A project on
  TypeScript 5.7 or older upgrades TypeScript; nothing else changes.

- **BREAKING:** `subscribeNewBlock`, `subscribeNewBlockHeader` and `subscribeTx`
  return streams of `NewBlockSubscriptionEvent`,
  `NewBlockHeaderSubscriptionEvent` and `TxSubscriptionEvent`, whose
  `data.value` is typed, instead of `SubscriptionEvent` with `value: any`.
  `subscribe(query)` still returns `SubscriptionEvent`, whose `value` is now
  `unknown`.

- **BREAKING:** The minimum Node version is 22.22.2, raised from 22.13. lerna 10,
  which builds and tests the repository, does not install below it, and the
  packages keep the repository's floor so that there is one number. 22.22.2 is a
  security release of Node 22. A user on Node 22 below it upgrades Node; nothing
  else changes.

- **BREAKING:** The minimum Node version is 22.13, raised from 22.12. Two things
  set the floor and the higher one now wins: `require(esm)` - the reason these
  packages can ship ESM only - landed in 22.12, while ESLint 10, which this
  repository is linted with, declares `^20.19.0 || ^22.13.0 || >=24`. Holding the
  packages to 22.12 left the repository unable to satisfy its own toolchain at
  its own floor. The window given up, 22.12.0 through 22.12.x, ran from December
  2024 to January 2025.

- The `npm` range is gone from `engines`. These packages are installed with
  whatever the consumer uses, and a constraint on one package manager says
  nothing about the others.

### Changed

- **BREAKING:** The declared TypeScript floor is now 5.7, raised from 5.4. 5.4
  was never true: this package is built with TypeScript 6.0.3, and the emitted
  declarations use `Uint8Array<ArrayBufferLike>`, a generic form that only exists
  from 5.7. A consumer on 5.4 reading these declarations hit
  `error TS2315: Type 'Uint8Array' is not generic`.

  It went unnoticed because `skipLibCheck: true` - the setting most projects
  carry, and all four of ours - skips type-checking declarations in
  `node_modules` entirely. The claim only failed for consumers who check them.

### Fixed

- `subscribe(query)` no longer prints `subscribe query <query>` to the console
  on every call (#103).

- The published type declarations now follow ES module rules. `lib/types/` gets
  a `package.json` marking it as ESM, so a consumer's compiler reads the `.d.ts`
  files as ES modules rather than CommonJS. Without it the runtime half of the
  package was ESM while its types were interpreted as CommonJS, which made a
  default import ambiguous.

### Removed

- **BREAKING:** `sendDeploy` and `web3.beatoz.contractAddrFromTx` are gone
  (#42); `contract.deploy().send()` deploys and returns the address.
  `contractAddrFromTx` took the last `contractAddress` in the transaction's
  events, which is another contract's when the constructor calls one that
  logs. The package no longer depends on `@beatoz/web3-abi` and
  `@beatoz/web3-accounts`.

- **BREAKING:** The rpc method wrappers take a `Web3Context` with no type
  argument; `Web3Context<BeatozExecutionAPI>` is gone with the API spec (#37).

- No longer depends on `@beatoz/web3-utils`, which it never imported.

### Added

- Adds a `files` field, so the published package carries `lib/`, `src/`,
  `CHANGELOG.md`, `README.md`, `LICENSE` and `package.json`, and nothing else.
  Build leftovers no longer ship: `tsconfig.types.json`, `tsdoc.json` (which
  extended a file that was never published) and the `.tsbuildinfo` incremental
  build caches.

- Ships `src/`. The source maps have always pointed at `../../src/*.ts`, but
  those files were not published, so a debugger could not open the line a stack
  trace named. v2 is still moving quickly, and reading the source is part of
  using it.

- Ships `LICENSE`. Every package declared `Apache-2.0` while publishing no copy
  of the license text.

### Removed

- `.npmignore` is gone, from this package and from the repository root. `files`
  takes precedence over it, so keeping both would leave a file that looks like
  it decides what ships but does not. The root one had been reaching into the
  workspace packages and excluding `src/` from all of them.

### Removed

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and the package ships ESM only.

  Node 22.12 and later can `require()` an ES module, and the minimum supported
  Node is now 22.12 for that reason, raised from 22.0. A CommonJS consumer on a
  supported Node keeps working without source changes:

  ```js
  require('@beatoz/web3-methods')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

### Changed

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-methods/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Fixed

- Declares `@beatoz/web3-accounts`, `@beatoz/web3-errors` and `xstream`, which
  it imports but did not list. Installing this package on its own could fail at
  load. `xstream` appears only in emitted `.d.ts` files, but a consumer
  type-checking those declarations has to resolve it, so it is a runtime
  dependency rather than a development one.

  This was hidden by the monorepo: every dependency was hoisted to one
  `node_modules`, so these imports resolved here and only here.

### Changed

- **BREAKING:** The minimum supported Node.js version is now 22. It was 16.19,
  which had not been accurate for some time: several dependencies already
  required Node 18 or later.

### Added

- Declares `typescript: ">=5.4"` as an optional peer dependency. No supported
  compiler range was declared before.
