# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org). See
[guides/release.md](https://github.com/beatoz/beatoz-sdk-js-v2/blob/main/guides/release.md) for what counts as a major, minor or patch change.

## [Unreleased]

### Added

- `package.json` has `description`, `repository` (with this package's
  directory) and `bugs` (#196), so the npm page shows what the package is and
  links to the source and the issue tracker. The README is rewritten for the
  package (#197); it was the web3.js template.

- `totalSupply`, `totalTxFee`, `txCount`, `totalPower` and `votingPower`
  read the node's `total_supply`, `total_txfee`, `txn`, `stakes/total_power`
  and `stakes/voting_power` (#46), each a `ChainValueResponse`.
  `totalSupply`, `totalPower` and `votingPower` take an optional `height`;
  the node answers `total_txfee` and `txn` only at the latest block.

- `getAccount`, `delegatee`, `stakes`, `reward` and `rule` take an optional
  `height` (#47): the state at that block, the latest when left out. It is
  sent as a decimal string, as the node requires.

- `reward(requestManager, addr)` reads an account's reward ledger through the
  chain's `reward` query. The address may come with or without `0x`.

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

### Changed

- **BREAKING:** `stakes` returns an empty `value` array for an account with
  no stakes, instead of the node's `null`. See web3-types.

- **BREAKING:** The minimum Node version is 22.22.2, raised from 16.19, which
  had not been accurate for some time: several dependencies already required
  Node 18 or later. Three things set the floor, and the highest wins:
  `require(esm)`, which lets these packages ship ES modules only, landed in
  22.12; ESLint 10, which lints this repository, declares
  `^20.19.0 || ^22.13.0 || >=24`; and lerna 10, which builds and tests it, does
  not install below 22.22.2. The packages keep the repository's floor so that
  there is one number, and 22.22.2 is a security release of Node 22.

- **BREAKING:** Declares `typescript: ">=5.8"` as an optional peer dependency;
  no supported compiler was declared before. The emitted declarations use
  `Uint8Array<ArrayBufferLike>`, a generic form TypeScript has from 5.7
  (`error TS2315: Type 'Uint8Array' is not generic` below it), and a CommonJS
  project that resolves these ES-module-only packages with
  `module`/`moduleResolution` `nodenext` can import them from 5.8
  (`error TS1479` on 5.7). A project on TypeScript 5.7 or older upgrades
  TypeScript; nothing else changes.

- **BREAKING:** `consensusParams` returns numbers, as its type declared (#38);
  it returned the node's strings. See web3-types.

- **BREAKING:** `blockSearch` returns the decoded `BlockSearchResponse`
  (`blocks`, `total_count`) instead of the raw JSON-RPC response (#48), as
  `txSearch` does. The decoder was there and unused.

- **BREAKING:** `subscribeNewBlock`, `subscribeNewBlockHeader` and `subscribeTx`
  return streams of `NewBlockSubscriptionEvent`,
  `NewBlockHeaderSubscriptionEvent` and `TxSubscriptionEvent`, whose
  `data.value` is typed, instead of `SubscriptionEvent` with `value: any`.
  `subscribe(query)` still returns `SubscriptionEvent`, whose `value` is now
  `unknown`.

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-rpc/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- `validators(requestManager, height?)` takes the height as optional, as
  `block()` does (#144). With no height the node answers for the latest one.

- The `npm` range is gone from `engines`. These packages are installed with
  whatever the consumer uses, and a constraint on one package manager says
  nothing about the others.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Removed

- **BREAKING:** `dumpConsensusState` and `consensusState` are removed (#38).
  They show a node's consensus in progress, for whoever runs the node, not
  for SDK users; and their types did not match the node (`height` and
  `start_time` arrive as strings). Ask the node's `dump_consensus_state` and
  `consensus_state` routes directly.

- **BREAKING:** `broadcastEvidence(requestManager, evidence)` is removed
  (#179). Submitting evidence of validator misbehaviour is for validators and
  node operators, not SDK users (as for #95 and #148).

- **BREAKING:** `proposals(requestManager, txHash)` is removed (#148). It
  never returned a proposal: it asked the node for a `proposals` path the
  node does not answer (`invalid query path`), and sent the hash's text
  instead of its bytes. Proposals are made and voted on by validators, with
  their wallet, not through this SDK (#95).

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and the package ships ESM only.

  Node 22.12 and later can `require()` an ES module, so a CommonJS consumer on a
  supported Node keeps working without source changes:

  ```js
  require('@beatoz/web3-rpc')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

- No longer depends on `@beatoz/web3-utils` or `@beatoz/web3-validator`,
  neither of which it imported.

- `.npmignore` is gone, from this package and from the repository root. `files`
  takes precedence over it, so keeping both would leave a file that looks like
  it decides what ships but does not. The root one had been reaching into the
  workspace packages and excluding `src/` from all of them.

### Fixed

- The published type declarations now follow ES module rules. `lib/types/` gets
  a `package.json` marking it as ESM, so a consumer's compiler reads the `.d.ts`
  files as ES modules rather than CommonJS. Without it the runtime half of the
  package was ESM while its types were interpreted as CommonJS, which made a
  default import ambiguous.
