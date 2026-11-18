# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org). See
[guides/release.md](https://github.com/beatoz/beatoz-sdk-js-v2/blob/main/guides/release.md) for what counts as a major, minor or patch change.

## [Unreleased]

### Added

- `SignScheme` (`'v0' | 'v1'`) and `SignOptions`; `Web3BaseWalletAccount.signTransaction`
  takes `SignOptions` as an optional third argument (#119).

- `package.json` has `description`, `repository` (with this package's
  directory) and `bugs` (#196), so the npm page shows what the package is and
  links to the source and the issue tracker. The README is rewritten for the
  package (#197); it was the web3.js template.

- `Web3NonceManager`, the shape of a nonce manager (#43): `consume(address,
  fetch)` and `reset(address)`. `NonceManager` in `@beatoz/web3-methods`
  implements it.

- `ChainValueResponse` (`height`, `value`) and
  `ResponsesDecoder.decodeChainValue`, for the node's single-value queries
  (#46). `value` is a decimal string, as amounts exceed a JavaScript number.

- `AccountResponse.height`: the block the query was answered at, as the
  other state query responses have it (#47).

- `JsonRpcSubscribeRequest`: a subscribe request as the node reads it,
  method `'subscribe'` with a named `query` (#146).

- `RewardResponse`, `ResponsesDecoder.decodeReward` and `reward` in
  `BeatozExecutionAPI`, for the chain's `reward` query. `issued`, `withdrawn`
  and `slashed` describe only the last block that changed the ledger, not
  totals; `cumulated` is what a withdraw can take.

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

- **BREAKING:** `StakesResponse.value` is always an array, empty for an
  account with no stakes. The node sends `null` then (a nil slice in
  beatoz-go's `queryStakes`), which reached the caller under a type that said
  `undefined` or an array; `ResponsesDecoder.decodeStakes` turns it into `[]`.

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

- **BREAKING:** `ResponsesDecoder.decodeConsensusParams` decodes the
  response instead of casting it (#38). The node sends `block_height` and
  every parameter as a decimal string, while `ConsensusParamsResponse` declared
  numbers; they are now numbers, as `blockResults` already decoded its
  `consensus_param_updates`. A value beyond a safe integer throws
  `InvalidResponseError`.

- **BREAKING:** `StakesValue` and `DelegateeValue` describe what the node's
  `stakes` and `delegatee` queries send (#128). `StakesValue` loses `amount`,
  `ReceivedReward` and `refundHeight`, and `DelegateeValue` loses
  `selfAmount`, `totalAmount` and `rewardAmount`; the node sends none of them,
  so they were always `undefined`. `power`, `startHeight`, `selfPower` and
  `totalPower` are decimal strings, as the node sends them, not numbers.
  `DelegateeValue` gains `slashedPower`, `delegators` and
  `notSingedBlockCount` (the node's spelling), and its `stakes` is optional and
  deprecated, as the node marks it. `DelegateeStake` is gone; `stakes` uses
  `StakesValue`. Both responses gain `height`.

- **BREAKING:** `NonPayableCallOptions`, `PayableCallOptions` and
  `ContractInitOptions` are removed (#6). `@beatoz/web3-contract` now defines
  its own method options (`CallOptions`, `NonPayableTxOptions`,
  `PayableTxOptions`) with the builder's types: `gas` and `nonce` numbers,
  `gasPrice` and `value` decimal strings.

- **BREAKING:** Decoding a node answer whose values have the wrong shape
  throws `InvalidResponseError`, and `BytesUint8Array.fromHex` throws
  `InvalidInputError`, instead of `Error`, with messages that name what was
  expected and what was given (#100). Unused internal helpers are removed
  (`Uint32`, `Uint53`, `Uint64`, the amino encoders, `apiToBigInt`,
  `smallIntToApi`, `assert.ts`, `base64.ts`) with the `base64-js`
  dependency.

- **BREAKING:** The `Web3Error` interface is gone; SDK errors extend
  `BaseError` from `@beatoz/web3-errors` (#100).

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

- **BREAKING:** `BytesUint8Array.fromHex` accepts only hex digits, two per
  byte, with or without a `0x` prefix, and throws on anything else: `invalid
  hex: "zz"`, `hex must have an even number of digits: "0xabc"`. It never
  failed before. A non-hex digit became 0 (`'zz'` read as `00`) and an odd
  length gained a leading zero (`'0xabc'` read as `0abc`). The transaction
  builders read `from`, `to`, the unstaking hash and contract data with it, so
  a recipient address with one mistyped or dropped digit was signed as a
  different 20-byte address, which the node accepts. Callers passing
  well-formed hex are unaffected.

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-types/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- **BREAKING:** `TrxProto` gains `payer` and `payerSig`, the fee delegation
  fields the chain added in June 2025. Code that builds a `TrxProto` literal
  must set them; empty `Uint8Array`s mean "sender pays" and are omitted from
  the wire, so encoded bytes are unchanged.

- `long` is now `^5.3.2`, up from an exact `5.2.3` (#17). `protobufjs`
  ^7.6.6 depends on `long` ^5.3.2, so the pin installed a second copy;
  encoded transactions are byte for byte the same.

- The `npm` range is gone from `engines`. These packages are installed with
  whatever the consumer uses, and a constraint on one package manager says
  nothing about the others.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Removed

- **BREAKING:** Ethereum-only types from web3.js are removed (#202). They
  describe what BEATOZ does not have, and nothing in the SDK used them:
  `Uncles`, `BlockTags`, `BlockTag`, `Hardfork`, `HardforksOrdered`,
  `ValidChains`, `CustomChain`, `Common`, `AccessList`, `AccessListEntry`,
  `AccessListResult`, `FeeHistory`, `FeeHistoryBase`, `StorageProof`,
  `AccountObject`, `BlockBase`, `HexString256Bytes`, the `PopulatedUnsigned*`
  transactions, the `*Input`/`*Output` formatter types (`TransactionInput`,
  `BlockOutput`, `ReceiptOutput`, `LogsOutput`, `PostInput`, `SyncOutput`
  and the rest), `Receipt`, `TransactionInfo`, `TransactionForAccessList` and
  the `TransactionWith*LocalWalletIndex` types. `Transaction` keeps `from`,
  `to`, `value`, `gas`, `gasPrice`, `data`, `input` and `nonce`, the fields the
  contract package reads; its Ethereum fields (`accessList`, `common`,
  `chain`, `hardfork`, `maxFeePerGas`, `maxPriorityFeePerGas`, `chainId`,
  `networkId`, `gasLimit`, `type`, `v`, `r`, `s`, `yParity`) are gone. A
  second, identical declaration of `Log`, `LogBase` and
  `TransactionReceiptBase` is removed.

- **BREAKING:** `BytesUint8Array.fromWords` and `toWords` are removed, and
  with them the dependencies on `crypto-js` and `@types/crypto-js` (#193).
  They converted to and from `crypto-js` word arrays, which nothing in the SDK
  used, and `crypto-js` is no longer developed (npm marks it deprecated), so
  every install printed its warning. Use `fromHex`/`toHex`, or convert with
  `crypto-js` directly if you hold its word arrays.

- **BREAKING:** `DumpConsensusStateResponse`, `ConsensusStateResponse` and the
  types only they used (`RoundState`, `PeerInfo`, `PeerState`,
  `PeerRoundState`, `LastCommitInfo`, `DumpConsensusValidators`,
  `DumpConsensusValidator`, `ConsensusRoundState`, `HeightVoteSet`, and a
  second `Vote` that merged into the block `Vote`), with their decoders
  (#38). Their queries are gone; see web3-rpc. `TxSizeParams` and
  `BlockGossipParams`, which nothing used, are gone too.

- **BREAKING:** `ProposalResponse`, an empty interface, is removed with the
  `proposals()` method it typed (#148).

- **BREAKING:** The ABI type computation inherited from web3.js is gone (#134):
  `MatchPrimitiveType`, `PrimitiveStringType`, `PrimitiveBooleanType`,
  `PrimitiveIntegerType`, `PrimitiveBytesType`, `PrimitiveTupleType`,
  `ContractMethodInputParameters`, `ContractMethodOutputParameters`,
  `ContractConstructor`, `ContractConstructorArgs`, `ContractMethod`,
  `ContractMethods`, `ContractEvent`, `ContractEvents`, `FilterAbis`,
  `ConvertToNumber`, `JsonFunctionInterface`, `JsonEventInterface`, and
  `FixedSizeArray` and `GrowToSize`, which only they used. Contract method
  types have come from abitype since #36 and nothing used these. To type an
  ABI's arguments or results, use abitype (`AbiParametersToPrimitiveTypes`).

- **BREAKING:** The API spec types are gone (#37): `BeatozExecutionAPI`,
  `EthExecutionAPI` with the Ethereum `*API` types it used, `Web3APISpec`,
  `Web3APIMethod`, `Web3APIParams` and `Web3APIReturnType`. The spec checked
  nothing: a bug made every string a method name, and it listed methods the
  node does not have (`vmCall`, `proposal`) in place of the ones the SDK sends
  (`vm_call`, `vm_estimate_gas`, `proposals`). Its result types were the
  decoded responses, while a request returns the node's result before
  decoding. `Web3APIRequest` and `Web3APIPayload` take no type parameters and
  a method name as a string, and the `ResponsesDecoder` methods take the
  node's result as `unknown`. Also gone, unused and typed by the spec:
  `Web3BaseProvider`, `SupportedProviders`, `EIP1193Provider`,
  `SimpleProvider`, `LegacyRequestProvider`, `LegacySendProvider`,
  `LegacySendAsyncProvider`, `SocketRequestItem`, `ProviderMessage`,
  `ProviderRpcError`, `ProviderConnectInfo`, `ProviderInfo`,
  `ProviderChainId`, `ProviderAccounts`, `Eip1193EventName`, the
  `Web3Provider*` callback and status types, and `ContractInitOptions.provider`.

- **BREAKING:** The keystore stubs are gone: `Wallet.encrypt`, `decrypt`, `save`
  and `load`, `web3.accounts.decrypt`, the matching abstract methods of
  `Web3BaseWallet`, `Web3AccountProvider.decrypt`, and the `KeyStore`, `Cipher`,
  `CipherOptions`, `ScryptParams` and `PBKDF2SHA256Params` types. Every one of
  them only threw `not implemented` or `Not supported yet`; they came with the
  web3.js fork. Nothing changes for a caller that did not call them.

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
  compiled and failed at run time. Call `BytesUint8Array.fromHex(hex)` instead;
  `fromWords` is gone too (#193).

- **BREAKING:** `Web3BaseProviderConstructor` is gone. Its `net?: Socket`
  parameter was the only reason this package's declarations imported Node's
  `net` module, which forced every consumer - browser ones included - to
  install `@types/node` or hit `error TS2307: Cannot find module 'net'`. It is
  the signature of web3.js's IPC provider, and this SDK has no IPC provider.
  Nothing in this repository or in the four internal consumers referenced it.

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and the package ships ESM only.

  Node 22.12 and later can `require()` an ES module, so a CommonJS consumer on a
  supported Node keeps working without source changes:

  ```js
  require('@beatoz/web3-types')   // still resolves, via require(esm)
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

- Relative imports in the sources now carry their `.js` extension. ES modules do
  not guess extensions, and 9 of 245 relative imports were missing theirs. They
  were type-only imports, so `tsc` erased them from the emitted `.js` and the
  runtime never noticed - but they survive in the emitted `.d.ts`, where a
  consumer using `moduleResolution: node16` or `nodenext` hit
  `error TS2834: Relative import paths need explicit file extensions`.

