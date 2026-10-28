# Changelog

All notable changes across the `@beatoz/*` packages are documented in this file.
Each package also keeps its own `packages/<name>/CHANGELOG.md`, which is the one
to read when upgrading a single package.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org). See
[RELEASE.md](./RELEASE.md) for what counts as a major, minor or patch change.

## [Unreleased]

Work towards v2. Package versions become independent with this release, so the
entries below name the packages they apply to.

### Changed

- `@beatoz/web3-providers-ws`: **BREAKING:** A node error is thrown as a
  `ResponseError`, as the HTTP provider and the request manager throw it,
  instead of an `Error` whose message was the JSON-RPC error serialised to a
  string. The node's own answer, such as `tx (...) not found`, is in `data`,
  and the message reads `Returned error: Internal error`, over either provider.
  Code that parsed the old message reads `data` instead. `@beatoz/web3-errors`
  is now a dependency.

- `@beatoz/web3-types`, `@beatoz/web3-accounts`, `@beatoz/web3-rpc`:
  **BREAKING:** `BytesUint8Array.fromHex` accepts only hex digits, two per
  byte, with or without a `0x` prefix, and throws on anything else: `invalid
  hex: "zz"`, `hex must have an even number of digits: "0xabc"`. It never
  failed before. A non-hex digit became 0 (`'zz'` read as `00`) and an odd
  length gained a leading zero (`'0xabc'` read as `0abc`). The transaction
  builders read `from`, `to`, the unstaking hash and contract data with it, so
  a recipient address with one mistyped or dropped digit was signed as a
  different 20-byte address, which the node accepts. `BytesUint8Array.parse`
  with `'hex'` goes through the same check. Callers passing well-formed hex are
  unaffected.

- `@beatoz/web3-accounts`: **BREAKING:** Transaction payloads are typed per
  transaction type. `Transaction<T>` declared `payload?: object | T`, so any
  object compiled for any builder, a missing payload compiled too, and the
  builders cast it back to what they expected. `buildSetDocTrx` took
  `Transaction<object>`.

  - `buildTransferTrxProto` and `buildDelegateTrxProto` take no payload.
  - The other builders require theirs: `TransactionPayloadUnDelegating`,
    `TrxPayloadProposalProto`, `TrxPayloadVotingProto`,
    `TransactionPayloadContract` (newly exported), `TrxPayloadSetDocProto` and
    `TransactionPayloadWithdraw`.
  - `decodeTransaction` returns `DecodedTransaction`, a union on `type` 1 to 8:
    checking `type` narrows `payload` to that type's `DecodedPayload*` shape.
    The values it returns are unchanged.
  - `SignTransactionFunction` is removed. Nothing used it, and it described a
    signer that takes a `Transaction`, while `signTransaction` takes a
    `TrxProto`.

  Pass each builder the payload its type names, and check `type` before
  reading the payload of a decoded transaction. The encoded bytes are
  unchanged.

- `@beatoz/web3-accounts`: **BREAKING:** `TrxProtoBuilder.decodeTransaction`
  throws on a transaction type outside 1 to 8: `unknown transaction type 9; the
  chain accepts types 1 to 8`. It returned such bytes as a transaction with no
  payload, while beatoz-go defines only those eight types and rejects any other
  as `ErrInvalidTrxPayloadType`. Callers decoding bytes that may not be a
  BEATOZ transaction catch the error instead of checking for a missing payload.

- `@beatoz/web3-utils`, `@beatoz/web3`: **BREAKING:** The units below one BEATOZ
  are `wei`, `kwei`, `mwei`, `gwei`, `szabo` and `finney`, one name per value,
  at the values web3.js gives them. The converters are `fromWei` and `toWei`.
  Units from one BEATOZ up are unchanged. Any other unit name fails as `invalid
  unit`.

- Every package's `homepage` now points to
  [beatoz/beatoz-sdk-js-v2](https://github.com/beatoz/beatoz-sdk-js-v2), where v2
  is developed and released. v1 stays in beatoz/beatoz-sdk-js. See `RELEASE.md`
  for which repository publishes which versions.

- `@beatoz/web3-accounts`: **BREAKING:** Every transaction builder now requires
  `amount` and `gasPrice` to be decimal strings of digits, and encodes them the
  way the node does. Both went straight to bn.js before, which is lenient in
  ways that reached the chain:

  - `'-1'` was read as -1 and encoded as `01`, because the bytes drop the sign:
    it built a transfer of 1, and the node's CheckTx accepts that transaction.
  - Zero was encoded as no bytes only when written exactly `'0'`. `'00'`,
    `'000'` and `''` became `[0x00]`, while the node rebuilds zero as no bytes
    to check the signature, so it refused them as `invalid signature`.
  - `' '` became a number with no value, which failed with `Cannot read
    properties of null`.

  Now any spelling of zero in digits encodes as no bytes and reaches the chain,
  and `''`, `' '`, a sign or anything but digits fails before anything is
  signed, naming the field: `amount must be a decimal string of digits`. The
  SDK's own callers and the internal services that use the builders already pass
  decimal strings; a JavaScript caller passing a number instead of a string is
  refused too.

### Security

- `@beatoz/web3-accounts`: `protobufjs` is now `^7.6.6`, up from an exact
  `7.2.5`. 7.2.5 is inside the affected range of eleven advisories, one
  critical. Most concern loading schemas or JSON descriptors at runtime, which
  this package never does: it ships code generated by ts-proto and uses only
  `protobufjs/minimal`. Two reach that path - GHSA-q6x5-8v7m-xcrf (overlong
  UTF-8 accepted by the fallback decoder used outside Node, so in browsers) and
  GHSA-685m-2w69-288q (no depth limit when skipping unknown group fields while
  decoding).

  The range is no longer pinned, so later 7.x security releases reach consumers
  without a release of this package.

  The bytes on the wire do not change. Every message type in `trx_pb.proto`,
  across 156 cases including int64 extremes and multi-byte strings, encodes to
  the same bytes under 7.2.5 and 7.6.6, so signatures over them are unchanged.
  Against the official node, CheckTx decoded one transaction of each of the
  eight types beatoz-go accepts, and the integration suites pass.

### Added

- `@beatoz/web3-methods`, `@beatoz/web3`:
  `web3.beatoz.waitForTx(hash, { timeoutMs, intervalMs })` waits until the
  node has indexed a transaction and returns it. A broadcast, the commit
  reply included, can answer before the transaction is indexed, so looking it
  up straight away can fail as `tx (...) not found`; callers wrote their own
  polling for it. It retries only on that answer - any other error, such as a
  node with indexing disabled, is thrown at once. After `timeoutMs` (default
  30000, looking every `intervalMs`, default 500) it throws an
  `OperationTimeoutError` holding the node's last answer, also when a lookup is
  still unanswered then. Being indexed is not success: check
  `tx_result.code`.

- `@beatoz/web3-accounts`: `TrxProtoBuilder.buildWithdrawTrx` builds a withdraw
  transaction (type 8), which moves part of the sender's accumulated staking
  reward into its balance. The chain accepted these all along; the SDK could
  decode one but not build it. The value goes in `payload.reqAmt`; `amount` must
  be zero, as the chain requires. A zero `reqAmt` is refused before anything is
  sent: the chain would accept it, but it moves nothing and only pays the fee.

  `reqAmt`, `amount` and `gasPrice` must be decimal strings of digits. `reqAmt`
  and `gasPrice` are encoded the way beatoz-go's `uint256.Int.Bytes()` encodes
  them - minimal, and empty for zero - because the node re-encodes them that way
  to check the signature; any other form of the same number fails as `invalid
  signature`.

  Against the regular test node it reaches the reward check (`not found result`
  for an account with no reward), so the node decoded it and accepted the
  signature. The payout is tested against a second node from the same image
  whose genesis lowers inflationCycleBlocks to 20 (`yarn node:start:reward`,
  `yarn test:reward`): delegate, wait for a reward, withdraw exactly what
  accumulated, and the balance rises by the reward less the fee; a request above
  the reward is refused as `insufficient reward`.

- `@beatoz/web3-methods`, `@beatoz/web3-rpc`, `@beatoz/web3-types`:
  `web3.beatoz.reward(addr)` returns an account's reward ledger. `cumulated` is
  the amount a withdraw transaction can take; `issued`, `withdrawn` and
  `slashed` describe only the last block that changed the ledger.

- Every package now has a `files` field, so a published package carries
  `lib/`, `src/`, `CHANGELOG.md`, `README.md`, `LICENSE` and `package.json`,
  and nothing else. Build leftovers no longer ship: `tsconfig.types.json`,
  `tsdoc.json` - which extended a file that was never published, so it could
  not be read where it landed - and the `.tsbuildinfo` incremental build
  caches, which record absolute paths from the machine that built them.

- Every package now ships `src/`. The source maps have always pointed at
  `../../src/*.ts`, but those files were not published, so a debugger could not
  open the line a stack trace named. A stack trace already reported the right
  `.ts` file and line without this, under `--enable-source-maps`; what `src/`
  adds is being able to read that line, and having "Go to Definition" land on
  the implementation instead of stopping at the `.d.ts`. v2 is still moving
  quickly and reading the source is part of using it.

- Every package now ships `LICENSE`. All thirteen declared `Apache-2.0` while
  publishing no copy of the license text.

### Removed

- `@beatoz/web3-errors`: **BREAKING:** 43 error classes and 93 error code
  constants are gone - every one that no package in this repository constructs,
  extends or reads. They came with the web3.js fork and describe Ethereum
  machinery this chain does not have (ENS, hardforks, EIP-1559 fee markets,
  keystores, plugin namespaces, the EIP-1193 provider events) or code paths
  removed earlier, such as the WebSocket reconnect and subscription errors. None
  was ever thrown, so code that caught them never saw one.

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

- **BREAKING:** `@beatoz/web3-types` no longer exports
  `Web3BaseProviderConstructor`. Its `net?: Socket` parameter was the only reason
  this package's declarations imported Node's `net` module, which forced every
  consumer - browser ones included - to install `@types/node` or hit
  `error TS2307: Cannot find module 'net'`. It is the signature of web3.js's IPC
  provider, and this SDK has no IPC provider. Nothing in this repository or in
  the four internal consumers referenced it.

- **BREAKING:** The `eth_subscribe` subscription subsystem is gone - 509 lines
  that could not run. `@beatoz/web3-core` loses `Web3Subscription`,
  `Web3SubscriptionManager`, `Web3SubscriptionConstructor` and
  `isSupportSubscriptions`; `@beatoz/web3-contract` loses `LogsSubscription`,
  `ContractBoundEvent` and `ContractEventsInterface`.

  It is web3.js's machinery, ported without `sendSubscriptionRequest()` - the
  method that assigns a subscription its id from the `eth_subscribe` response.
  `_id` was never set to anything but `undefined`, and `addSubscription()` opens
  with `if (isNullish(sub.id)) throw`, so every call threw. Nothing ever
  populated `registeredSubscriptions`, and `Contract` has no `events` property,
  so the contract half was unreachable too.

  **Subscriptions still work.** `web3.beatoz.subscribe()`,
  `subscribeNewBlock()`, `subscribeNewBlockHeader()` and `subscribeTx()` return
  an xstream `Stream` over the websocket provider, and that path is untouched.
  This release removes the half that never did.

- **BREAKING:** 22 declared dependencies that no package imported are gone. The
  largest is `web3` itself: `@beatoz/web3-contract` depended on the upstream
  web3.js package while the only mention of it in the source was a
  `require('web3-eth-contract')` line inside a JSDoc example. Installing
  `@beatoz/web3-contract` into an empty project drops from 138 packages and
  86 MB to 105 and 32 MB.

  | Package | No longer depends on |
  | --- | --- |
  | `@beatoz/web3-contract` | `web3` |
  | `@beatoz/web3-utils` | `bn.js`, `crypto-js`, `@types/crypto-js`, `protobufjs`, `ts-proto`, `constants-browserify`, `crypto-browserify`, `path-browserify` |
  | `@beatoz/web3-accounts` | `crypto-js`, `@types/crypto-js`, `constants-browserify`, `crypto-browserify`, `path-browserify` |
  | `@beatoz/web3-rpc` | `@beatoz/web3-utils`, `@beatoz/web3-validator` |
  | `@beatoz/web3-abi` | `@beatoz/web3-rpc` |
  | `@beatoz/web3-core` | `@beatoz/web3-validator` |
  | `@beatoz/web3-methods` | `@beatoz/web3-utils` |
  | `@beatoz/web3-providers-ws` | `@beatoz/web3-errors` |
  | `@beatoz/web3-validator` | `util` |

  Removing a dependency is breaking because a consumer may have been reaching it
  through us rather than declaring it themselves.

  Three declarations that look unused are kept, because a text search is not
  what decides: `ws` in `@beatoz/web3-providers-ws` is a peer dependency of
  `isomorphic-ws`; `@types/crypto-js` in `@beatoz/web3-types` is needed because
  that package's public `.d.ts` imports `crypto-js`, which ships no types of its
  own; and the `*-browserify` packages are webpack polyfills resolved by this
  repository's browser build, so they move to the root rather than disappearing.

- `ts-proto` moved from `dependencies` to `devDependencies` in
  `@beatoz/web3-accounts`. It provides the `protoc-gen-ts_proto` binary that
  regenerates `trx_pb.ts`; consumers never regenerate protobuf code.

- `.npmignore` is gone, from every package and from the repository root.
  `files` takes precedence over it, so keeping both would leave fourteen files
  that look like they decide what ships but no longer do. The root one had also
  been reaching into the workspace packages: it listed `src/`, which is why no
  package published its sources even though no package's own `.npmignore`
  excluded them.

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and every package ships ESM only. This halves what is
  published: `@beatoz/web3-types` goes from 214 files and 588 kB unpacked to
  124 files and 347 kB.

  Node 22.12 and later can `require()` an ES module, which is why the minimum
  supported Node moves from 22.0 to 22.12. A CommonJS consumer on a supported
  Node keeps working without source changes:

  ```js
  require('@beatoz/web3')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. Pointing `exports` at `import` alone
  would reject `require()` outright rather than fall through to it.

  Every comparable SDK still ships both builds - ethers, viem, `@cosmjs/*`,
  `@solana/web3.js` - because they support Node 18 and 20, where `require(esm)`
  does not exist. Having already set the floor at Node 22, we do not.

  A bundler or a TypeScript setup pinned to an older Node resolution mode may
  still need updating.

- **BREAKING:** The `module` field is gone and `main` now points at the ESM
  entry. Both described the same build.

### Changed

- **BREAKING:** The minimum supported Node.js version is now 22.13, across all
  packages and the repository root. It was 16.19, which had not been accurate for
  some time: several dependencies already required Node 18 or later, so installs
  on Node 16 were already failing in ways the declared range did not explain.

  Two things set the floor and the higher one wins. `require(esm)` - the reason
  these packages can ship ESM only - landed in **22.12**. ESLint 10, which this
  repository is linted with, declares `^20.19.0 || ^22.13.0 || >=24` and so
  starts at **22.13**. Holding the packages to 22.12 left the repository unable
  to satisfy its own toolchain at its own floor; the window that resolves it,
  22.12.0 through 22.12.x, ran from December 2024 to January 2025.

- The `npm` range is gone from `engines` in the published packages. They are
  installed with whatever the consumer uses, and a constraint on one package
  manager says nothing about the others. The root keeps its `npm` range, since
  it describes the machine that builds this repository.

- **BREAKING:** `@beatoz/web3-types`: `TrxProto` gains `payer` and `payerSig`,
  the fee delegation fields the chain added in June 2025. Code that builds a
  `TrxProto` literal must set them; empty values mean "sender pays" and are
  omitted from the wire, so encoded bytes are unchanged.

- `@beatoz/web3-accounts`: `src/tx/trx_pb.proto` is now a verbatim copy of the
  chain's `protos/trx.proto`. The copy here had been edited after generation -
  proposal field numbers renumbered, fee delegation fields missing - while the
  generated code carried the chain's numbers.

- **BREAKING:** Every package now has an `exports` map, so only the package
  root and its `package.json` can be imported. Deep paths such as
  `@beatoz/web3-types/lib/commonjs/integers` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API and no internal
  file could be moved or renamed without risk. Nothing in this repository or in
  the four internal consumers imported a deep path.

  `./package.json` stays reachable because build tools read it.

- Every package now declares `types`. Type resolution previously relied on
  `index.d.ts` happening to sit next to the file named by `main`.

- **BREAKING:** Package versions are no longer locked to a single number.
  `lerna.json` is set to `independent`, so each package can carry its own
  version. Under the previous scheme every package was republished whenever any
  package changed, so a version number did not indicate whether that package had
  changed.

  This release still moves all thirteen packages to the same number, because
  every one of them has a breaking change in it. What changes is what happens
  afterwards: a fix to `@beatoz/web3-utils` moves that package alone, and the
  other twelve keep the number they were released at. Internal dependencies use
  caret ranges, so a dependent accepts the new patch without being republished.
  See [RELEASE.md](./RELEASE.md) for the operating rule.

### Added

- Every package now declares `typescript: ">=5.7"` as an optional peer
  dependency. Nothing declared a supported compiler range before. It is
  optional so a JavaScript consumer is not asked to install TypeScript.

  The number started at 5.4 and was raised once it was measured. These packages
  are built with TypeScript 6.0.3, and the emitted declarations use
  `Uint8Array<ArrayBufferLike>` - a generic form that only exists from 5.7 - so a
  consumer on 5.4 hit `error TS2315: Type 'Uint8Array' is not generic`. 5.4 was
  a claim nothing had checked.

  It went unnoticed because `skipLibCheck: true` - the setting most projects
  carry, and all four of ours - skips type-checking declarations in
  `node_modules` entirely. The floor only mattered to consumers who check them,
  and npm now refuses to install an older compiler against these packages.

- `@beatoz/web3-accounts`: `privateKeyToAccount`, `privateKeyToPrvKey` and
  `sign` accept a `Uint8Array` private key. They previously declared
  `HexString | ArrayBufferLike`, which excluded the most common way to hold key
  bytes.

### Fixed

- `@beatoz/web3-core`: `setProvider()` with a URL now builds one provider. It
  built two and kept the second, so for a `ws://` URL the first opened a socket
  that nothing referenced and nothing could close, and a Node process that
  called it never exited on its own. This now matches web3.js 4.x, where
  `Web3Context.setProvider` hands the value to the request manager and the
  request manager alone turns a URL into a provider.

- `@beatoz/web3-providers-ws`: `disconnect()` now stays disconnected. The
  reconnect logic read the `Disconnected` status that `disconnect()` itself
  reports as a dropped connection, and opened a new socket about 100ms later.
  Nothing could close a `WebsocketProvider` for good, so a Node process that
  used one never exited on its own; under Jest the run hung after the last test.

  The code comes from `@cosmjs/socket`, which still behaves this way as of
  0.39.0.

- **Signing works in the ESM build.** `privateKeyToAccount`, and so every path
  that signs a transaction, threw `TypeError: secp256k1.privateKeyVerify is not
  a function`. An ESM consumer could not sign at all.

  Three modules imported a CommonJS package as a namespace:

  | Package | Module |
  | --- | --- |
  | `@beatoz/web3-accounts` | `secp256k1` |
  | `@beatoz/web3-types` | `crypto-js`, `base64-js` |

  None of the three publishes an `exports` map, so `import * as x from 'pkg'`
  gives a namespace whose only key is `default`, and every member access through
  it returns `undefined`. A default import gets the module itself. This is how
  ES modules consume CommonJS, and it only started to matter when the CommonJS
  build - where `require()` erases the distinction - was removed.

  Nothing caught it. `yarn test` runs the sources through Babel, the integration
  tests import from `src/`, and the ESM check added alongside the CommonJS
  removal imports each package without calling into it. Loading succeeded; using
  it did not.

- No published declaration refers to a Node-only type any more, so consumers do
  not need `@types/node` to read them. Three places leaked one:

  | Package | Was | Now |
  | --- | --- | --- |
  | `@beatoz/web3-core` | `removeAllListeners(): EventEmitter<[never]>` | `removeAllListeners(): void` |
  | `@beatoz/web3-utils` | `[NodeJS.Timer, …]` | `[ReturnType<typeof setTimeout>, …]` |
  | `@beatoz/web3-utils` | `constructor(eventEmitter: EventEmitter, …)` | `constructor(eventEmitter: ChunkEventSink, …)` |

  The first was not written by anyone: `removeAllListeners()` had no declared
  return type, so TypeScript inferred one from the body and published it. That
  is why this class of problem cannot be caught by reading the sources - it only
  appears in the emitted `.d.ts`.

  A browser consumer was carrying Node's type definitions because of these three
  lines, and on TypeScript 6 - which no longer includes `@types/*` packages
  automatically - had to add `"types": ["node"]` to their own `tsconfig.json`.
  Neither is needed now.

- The published type declarations now follow ES module rules, finishing the move
  to ESM. Two things were wrong, and both were invisible at runtime:

  `lib/types/` had no `package.json` marking it as ESM, so a consumer's compiler
  read the `.d.ts` files as CommonJS while the `.js` beside them was ESM. The
  build now writes that marker, the same way it already did for `lib/esm/`.

  9 of 245 relative imports in the sources were missing their `.js` extension.
  All nine were type-only, so `tsc` erased them from the emitted `.js` and every
  runtime check passed - but they survive in the emitted `.d.ts`, where a
  consumer on `moduleResolution: node16` or `nodenext` hit `error TS2834`.

- Five packages did not declare dependencies they import, so installing any one
  of them on its own failed at load. Installing `@beatoz/web3-types` into an
  empty project and requiring it raised `Cannot find module 'bn.js'`. The
  monorepo hid this: every dependency was hoisted to one `node_modules`, so the
  imports resolved here and only here. Now declared:

  | Package | Now declares |
  | --- | --- |
  | `@beatoz/web3` | `web3-abi`, `web3-accounts`, `web3-errors`, `web3-providers-ws`, `web3-rpc`, `web3-types`, `web3-utils` |
  | `@beatoz/web3-contract` | `web3-abi`, `web3-errors`, `web3-providers-http`, `web3-providers-ws`, `web3-validator` |
  | `@beatoz/web3-methods` | `web3-accounts`, `web3-errors`, `xstream` |
  | `@beatoz/web3-core` | `web3-errors`, `xstream` |
  | `@beatoz/web3-types` | `bn.js` |

  `xstream` appears only in emitted `.d.ts` files, but a consumer type-checking
  those declarations has to resolve it, so it is a runtime dependency rather
  than a development one.

- `@beatoz/web3-types`: now resolves `bn.js` 5.x, the version its sibling
  packages already declared. Because the dependency was undeclared it had been
  resolving to the hoisted 4.12.5 that `ethereumjs-util` pulls in, a different
  major version from the one `@beatoz/web3-utils` and `@beatoz/web3-accounts`
  use. `BN` does not appear in this package's public declarations, so no API
  changes.

- `@beatoz/web3-accounts`: the ESM build could not be imported. The generated
  protobuf code imported `protobufjs/minimal` without an extension, which
  `require()` resolves and ESM does not.

- `@beatoz/web3-utils`: `formatter` no longer relies on an implicit `this`
  binding inside an `Array.prototype.find` callback.

### Changed (build and test only)

These do not change the published output, and are listed because they explain
the version jump.

- Build toolchain moved to TypeScript 6.0.3 from 4.9.5, with
  `moduleResolution: bundler`. The published output is unchanged.
- Lint toolchain moved to ESLint 10 flat config. The previous configuration
  never extended `js.configs.recommended` and never registered the import
  plugin, so circular-import checking had never run.
- Dependency baseline pinned (`@types/minimatch`, `webpack`) and `yarn.lock`
  brought under version control.
- `lerna bootstrap` removed; it duplicated Yarn workspaces and was dropped
  upstream in Lerna 7.
- Tests split into `test/unit` and `test/integration`. The unit layer runs
  without a node. Integration configuration moved to environment variables;
  the two gitignored JSON files it used to import are gone.
- `typescript`, `jest`, `@types/jest`, `jest-extended` and `prettier` are
  declared once at the repository root instead of in all thirteen packages.
  That was 60 lines pinning versions that decided nothing: Yarn hoists a single
  copy of each to the root `node_modules`, and every package already resolved
  that one. The declarations were inert only because all thirteen happened to
  agree - the moment one differed, Yarn would install a nested copy and that
  package really would build with a different compiler, which is what
  `crypto-browserify` is doing in `web3-accounts` and `web3-utils` today.
  Package-specific tools such as `@bufbuild/buf` and the `@types/*` packages
  stay where they are, since they record what that package needs.
