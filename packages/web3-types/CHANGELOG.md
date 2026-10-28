# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org). See
[RELEASE.md](../../RELEASE.md) for what counts as a major, minor or patch change.

## [Unreleased]

### Added

- `RewardResponse`, `ResponsesDecoder.decodeReward` and `reward` in
  `BeatozExecutionAPI`, for the chain's `reward` query. `issued`, `withdrawn`
  and `slashed` describe only the last block that changed the ledger, not
  totals; `cumulated` is what a withdraw can take.

### Fixed

- `crypto-js` and `base64-js` are imported as default rather than as
  namespaces. Both are CommonJS with no `exports` map, so `import * as` gave a
  namespace holding nothing but `default` and every member access returned
  `undefined` in the ESM build.

### Changed

- **BREAKING:** `BytesUint8Array.fromHex` accepts only hex digits, two per
  byte, with or without a `0x` prefix, and throws on anything else: `invalid
  hex: "zz"`, `hex must have an even number of digits: "0xabc"`. It never
  failed before. A non-hex digit became 0 (`'zz'` read as `00`) and an odd
  length gained a leading zero (`'0xabc'` read as `0abc`). The transaction
  builders read `from`, `to`, the unstaking hash and contract data with it, so
  a recipient address with one mistyped or dropped digit was signed as a
  different 20-byte address, which the node accepts. `BytesUint8Array.parse`
  with `'hex'` goes through the same check. Callers passing well-formed hex are
  unaffected.

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

- The published type declarations now follow ES module rules. `lib/types/` gets
  a `package.json` marking it as ESM, so a consumer's compiler reads the `.d.ts`
  files as ES modules rather than CommonJS. Without it the runtime half of the
  package was ESM while its types were interpreted as CommonJS, which made a
  default import ambiguous.

- Relative imports in the sources now carry their `.js` extension. ES modules do
  not guess extensions, and 9 of 245 relative imports were missing theirs. They
  were type-only imports, so `tsc` erased them from the emitted `.js` and the
  runtime never noticed - but they survive in the emitted `.d.ts`, where a
  consumer using `moduleResolution: node16` or `nodenext` hit
  `error TS2834: Relative import paths need explicit file extensions`.

### Removed

- **BREAKING:** `Web3BaseProviderConstructor` is gone. Its `net?: Socket`
  parameter was the only reason this package's declarations imported Node's
  `net` module, which forced every consumer - browser ones included - to
  install `@types/node` or hit `error TS2307: Cannot find module 'net'`. It is
  the signature of web3.js's IPC provider, and this SDK has no IPC provider.
  Nothing in this repository or in the four internal consumers referenced it.

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
  require('@beatoz/web3-types')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

### Changed

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-types/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Fixed

- Declares `bn.js`, which it imports but did not list. Installing this package
  into an empty project and requiring it raised `Cannot find module 'bn.js'`.

- Now resolves `bn.js` 5.x, the version its sibling packages already declared.
  While the dependency was undeclared it resolved to the hoisted 4.12.5 that
  `ethereumjs-util` pulls in. `BN` does not appear in this package's public
  declarations, so no API changes.

  This was hidden by the monorepo: every dependency was hoisted to one
  `node_modules`, so these imports resolved here and only here.

### Changed

- **BREAKING:** The minimum supported Node.js version is now 22. It was 16.19,
  which had not been accurate for some time: several dependencies already
  required Node 18 or later.

### Added

- Declares `typescript: ">=5.4"` as an optional peer dependency. No supported
  compiler range was declared before.

### Changed

- **BREAKING:** `TrxProto` gains `payer` and `payerSig`, the fee delegation
  fields the chain added in June 2025. Code that builds a `TrxProto` literal
  must set them; empty `Uint8Array`s mean "sender pays" and are omitted from
  the wire, so encoded bytes are unchanged.
