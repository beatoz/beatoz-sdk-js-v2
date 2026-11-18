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

- `SocketClosedError` (`url`), for requests and subscriptions the
  WebSocket connection closed under (#100).

- `ContractFunctionRevertedError` (`reason`, `errorName`, `args`,
  `signature`, `data`), `ContractFunctionZeroDataError` and
  `TransactionFailedError` (`stage`, `code`, `log`, `hash`), for contract
  calls and transactions that fail (#100, #101).

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

- **BREAKING:** `Web3ContractError` is gone; the contract package throws
  `InvalidInputError` for what it reported (#100). `InvalidResponseError`'s
  `response` is optional, for a value in a response rather than the whole.

- **BREAKING:** Rewritten around `BaseError`, shaped like viem's (#100):
  `shortMessage`, `details`, `cause`, `metaMessages`, `walk()`, and a `name`
  per kind. The classes are `InvalidInputError`, `AbiError`, `TimeoutError`,
  `Web3ContractError`, `RpcRequestError` (the node's JSON-RPC `code` and
  `data`, #71), `HttpRequestError` (`status`, `url`) and
  `InvalidResponseError` (`response`), plus `isRpcErrorObject` and
  `formatValue`. Removed: `BaseWeb3Error`, `InvalidValueError`, the `ERR_*`
  codes, `ResponseError`, `OperationTimeoutError`, `FormatterError`, the
  `Invalid*Error` classes, `HexProcessingError`, `NibbleWidthError`,
  `ContractExecutionError` and `Eip838ExecutionError`. No longer depends on
  `@beatoz/web3-types`.

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-errors/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- The `npm` range is gone from `engines`. These packages are installed with
  whatever the consumer uses, and a constraint on one package manager says
  nothing about the others.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Removed

- **BREAKING:** `RpcError`, its twelve subclasses (`ParseError`,
  `InvalidRequestError`, `MethodNotFoundError`, `InvalidParamsError`,
  `InternalError`, `InvalidInputError`, `MethodNotSupported`,
  `ResourceUnavailableError`, `ResourcesNotFoundError`,
  `VersionNotSupportedError`, `TransactionRejectedError`, `LimitExceededError`),
  `rpcErrorsMap` and the `ERR_RPC_*` codes are gone. They came with the web3.js
  fork, many for EIP-1474 codes Tendermint does not use, and were thrown only
  when `Web3RequestManager` was built with `useRpcCallSpecification`, which
  nothing did. A node error is thrown as `RpcRequestError` (#100).

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

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and the package ships ESM only.

  Node 22.12 and later can `require()` an ES module, so a CommonJS consumer on a
  supported Node keeps working without source changes:

  ```js
  require('@beatoz/web3-errors')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

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
