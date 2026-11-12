# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org). See
[guides/release.md](../../guides/release.md) for what counts as a major, minor or patch change.

## [Unreleased]

### Changed

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

- The published type declarations now follow ES module rules. `lib/types/` gets
  a `package.json` marking it as ESM, so a consumer's compiler reads the `.d.ts`
  files as ES modules rather than CommonJS. Without it the runtime half of the
  package was ESM while its types were interpreted as CommonJS, which made a
  default import ambiguous.

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

- **BREAKING:** 43 error classes and 93 error code constants are gone - every
  one that no package in this repository constructs, extends or reads. They came
  with the web3.js fork and describe Ethereum machinery this chain does not have
  (ENS, hardforks, EIP-1559 fee markets, keystores, plugin namespaces, the
  EIP-1193 provider events) or code paths removed earlier, such as the WebSocket
  reconnect and subscription errors. None was ever thrown, so code that caught
  them never saw one.

  Kept: the 18 classes the packages throw, the two they only check for
  (`ContractExecutionError` with `instanceof`, `Eip838ExecutionError` as a
  type), their base classes, and all of `rpc_errors.ts`, whose classes
  `Web3RequestManager` picks by error code through `rpcErrorsMap` rather than
  naming them. The four internal consumers import nothing from this package.

  Removed classes: `ConfigChainMismatchError`, `ConfigHardforkMismatchError`,
  `ConnectionCloseError`, `ConnectionError`, `ConnectionNotOpenError`,
  `ConnectionTimeoutError`, `ContractEventDoesNotExistError`,
  `ContractInstantiationError`, `ContractMissingABIError`,
  `ContractMissingDeployDataError`, `ContractNoAddressDefinedError`,
  `ContractNoFromAddressDefinedError`, `ContractOnceRequiresCallbackError`,
  `ContractReservedEventError`, `ContractTransactionDataAndInputError`,
  `ExistingPluginNamespaceError`, `IVLengthError`, `InvalidBlockError`,
  `InvalidClientError`, `InvalidConnectionError`, `InvalidKdfError`,
  `InvalidMethodParamsError`, `InvalidNumberOfParamsError`,
  `InvalidPasswordError`, `InvalidPrivateKeyError`, `InvalidProviderError`,
  `InvalidSignatureError`, `InvalidTypeAbiInputError`, `InvalidTypeError`,
  `KeyDerivationError`, `KeyStoreVersionError`,
  `MaxAttemptsReachedOnReconnectingError`, `MethodNotImplementedError`,
  `OperationAbortError`, `PBKDF2IterationsError`,
  `PendingRequestsOnReconnectingError`, `PrivateKeyLengthError`,
  `ProviderError`, `RequestAlreadySentError`, `ResolverMethodMissingError`,
  `SignatureError`, `SubscriptionError`, `Web3WSProviderError`.

  Removed constants: everything in `error_codes.ts` the kept classes and the
  other packages do not use - the connection (`ERR_CONN*`), provider,
  subscription, signature, keystore and private key codes, all 39 transaction
  codes (`ERR_TX_*`), the ENS codes, the EIP-1193 `JSONRPC_ERR_*` codes and
  `GENESIS_BLOCK_NUMBER`.

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
  require('@beatoz/web3-errors')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

### Changed

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-errors/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Changed

- **BREAKING:** The minimum supported Node.js version is now 22. It was 16.19,
  which had not been accurate for some time: several dependencies already
  required Node 18 or later.

### Added

- Declares `typescript: ">=5.4"` as an optional peer dependency. No supported
  compiler range was declared before.
