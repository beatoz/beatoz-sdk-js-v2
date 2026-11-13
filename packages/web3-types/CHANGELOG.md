# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org). See
[guides/release.md](../../guides/release.md) for what counts as a major, minor or patch change.

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

- **BREAKING:** `Evidence`, the type of `Block.evidence`, is `unknown` instead
  of `any`. It holds Tendermint's `DuplicateVoteEvidence` or
  `LightClientAttackEvidence` as the node sends it, which only exists after a
  validator misbehaves, so its shape could not be checked against a node; a
  precise type can follow without breaking anyone. Code reading its fields
  checks them first. Slashing is also reported as events in the block results.

- **BREAKING:** `SubscriptionEvent.data.value` is no longer `any`.
  `SubscriptionEvent<Type, Value>` takes the event's `data.type` and
  `data.value`, and defaults to `string` and `unknown`, since an arbitrary
  subscription does not know what it receives. `NewBlockSubscriptionEvent`,
  `NewBlockHeaderSubscriptionEvent` and `TxSubscriptionEvent` describe what the
  node sends for its three events, checked against a live node: the node's JSON,
  with integers as decimal strings and bytes as base64. They use the raw types
  the decoder already had, now exported (`RpcBlock`, `RpcHeader`, `RpcTxData`,
  `RpcEvent` and those they refer to); `RpcCommit.round` is `number | string`,
  since the node sends a number. `ResponsesDecoder.decodeNewBlockEvent` and
  `decodeNewBlockHeaderEvent` take the matching event type. Code reading `value`
  from a plain `SubscriptionEvent` narrows it first, for example with `as
  NewBlockHeaderSubscriptionEvent` when its query names that event.

- **BREAKING:** `VmCallResponse.value.returnData` is hex, and the type says so.
  `web3.beatoz.vmCall` returned it as the base64 the node sends, while a
  contract call converted it to hex itself, under one type with `returnData:
  any`. `ResponsesDecoder.decodeVmCall` now converts it for both, returns `''`
  when the call returned nothing, and puts back a zero `usedGas` the node leaves
  out. The type also lists `key`, `height`, `usedGas` and `vmErr`, which the
  node sends. Code that decoded base64 from `vmCall` reads hex instead; a
  contract call returns the same as before.

- **BREAKING:** `RuleResponse` describes what the node's `rule` query sends. It
  listed nine parameters the node does not send (`maxTrxGas`, `maxBlockGas`,
  `rewardPerPower`, `lazyRewardBlocks`, `minValidatorStake`,
  `minSelfStakeRatio`, `maxUpdatableStakeRatio`, `slashRatio`,
  `signedBlocksWindow`), which were always `undefined`, and lacked most it does.
  It now has `height` and the 21 parameters a caller acts on (gas and block
  limits, validator and delegation limits, reward, slashing and supply), each in
  the JSON type the node uses: int64 as a decimal string, int32 as a number. The
  node leaves a zero parameter out; `ResponsesDecoder.decodeRule` puts it back
  as `'0'` or `0`. Internal values the node also sends (pool addresses, block
  interval, version, proposal timing, and two parameters it does not apply) stay
  in `value` untyped. Code reading a removed name gets a compile error; it was
  `undefined` before.

- **BREAKING:** The minimum Node version is 22.22.2, raised from 22.13. lerna 10,
  which builds and tests the repository, does not install below it, and the
  packages keep the repository's floor so that there is one number. 22.22.2 is a
  security release of Node 22. A user on Node 22 below it upgrades Node; nothing
  else changes.

- **BREAKING:** `BytesUint8Array.fromHex` accepts only hex digits, two per
  byte, with or without a `0x` prefix, and throws on anything else: `invalid
  hex: "zz"`, `hex must have an even number of digits: "0xabc"`. It never
  failed before. A non-hex digit became 0 (`'zz'` read as `00`) and an odd
  length gained a leading zero (`'0xabc'` read as `0abc`). The transaction
  builders read `from`, `to`, the unstaking hash and contract data with it, so
  a recipient address with one mistyped or dropped digit was signed as a
  different 20-byte address, which the node accepts. Callers passing
  well-formed hex are unaffected.

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

- **BREAKING:** `JsonRpcSuccessResponse`, the `Responses` interface and the
  `Response` union are gone. `JsonRpcSuccessResponse` (`result: any`) duplicated
  `JsonRpcResponseWithResult<T>`, which the SDK uses everywhere; `Responses`
  listed decoder signatures that `ResponsesDecoder` does not implement; and
  nothing but `@beatoz/web3-core`'s unused `Decoder` used `Response`. Use
  `JsonRpcResponseWithResult<T>`. `BeatozExecutionAPI['subscribe']` returns
  `Record<string, never>`, the empty object the node answers a subscribe request
  with, instead of `any`; events arrive on the stream `subscribe()` returns.

- **BREAKING:** `NewBlockEvent`, `NewBlockHeaderEvent` and `TxEvent` are gone.
  The first two were other names for `Block` and `Header`, used only as the
  return types of `ResponsesDecoder.decodeNewBlockEvent` and
  `decodeNewBlockHeaderEvent`, which now declare `Block` and `Header`; `TxEvent`
  had no decoder and no user. Next to the subscription events
  (`NewBlockSubscriptionEvent` and the others) they read as a second set of
  event types. Use `Block` and `Header`.

- **BREAKING:** `BytesUint8Array.parse(d, enc)` is gone. It took `any` and an
  encoding name and only called `fromHex` or `fromWords`, so a wrong input
  compiled and failed at run time. Call `BytesUint8Array.fromHex(hex)` or
  `BytesUint8Array.fromWords(words)` instead.

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
