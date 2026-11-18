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

- `signTransactionAsPayer(trxProto, privateKey, chainId)` and
  `Web3Account.signTransactionAsPayer(trxProto, chainId)`: fee delegation
  (#3). After the sender signs, another account signs as the payer, which sets
  `payer` and `payerSig`; the chain then charges the fee to the payer, so the
  sender needs only the amount it sends. The sender's signature does not cover
  the payer, so the payer can sign elsewhere (a server paying its users' fees).
  The payer signs the node's v0 preimage with the sender's signature in it, as
  beatoz-go's `SignerV0` verifies it; moving both signatures to v1 is #119. It
  throws if the sender has not signed or the payer is the sender.
  `decodeTransaction` returns `payer` and `payerSig` when they are set.

- `getContractAddress(from, nonce)`: the address of the contract a deploy
  transaction from `from` with `nonce` creates, the last 20 bytes of
  keccak256(rlp([from, nonce])) as the node computes it (#42).

- `TrxProtoBuilder.buildWithdrawTrx` builds a withdraw transaction (type 8),
  which moves part of the sender's accumulated staking reward into its balance.
  The chain accepted these all along; the SDK could decode one but not build it.
  The value goes in `payload.reqAmt`; `amount` must be zero, as the chain
  requires. A zero `reqAmt` is refused before anything is sent: the chain would
  accept it, but it moves nothing and only pays the fee.

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

- `privateKeyToAccount`, `privateKeyToPrvKey` and `sign` accept a `Uint8Array`
  private key. They previously declared `HexString | ArrayBufferLike`, which
  excluded the most common way to hold key bytes.

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

- **BREAKING:** Builders, signing and `getContractAddress` throw
  `InvalidInputError` instead of `Error` (#100, #66). The four `mandatory
  argument is missed` errors name the missing field (`payload`,
  `payload.txHash`, `payload.data`, `payload.reqAmt`), and some messages are
  reworded: `... must fit in 256 bits, got ...`, `transaction type must be 1
  to 8, the types the chain accepts, got ...`.

- **BREAKING:** Transaction payloads are typed per transaction type.
  `Transaction<T>` declared `payload?: object | T`, so any object compiled for
  any builder, a missing payload compiled too, and the builders cast it back
  to what they expected. `buildSetDocTrx` took `Transaction<object>`.

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

- **BREAKING:** `TrxProtoBuilder.decodeTransaction` throws on a transaction
  type outside 1 to 8: `unknown transaction type 9; the chain accepts types 1
  to 8`. It returned such bytes as a transaction with no payload, while
  beatoz-go defines only those eight types and rejects any other as
  `ErrInvalidTrxPayloadType`. Callers decoding bytes that may not be a BEATOZ
  transaction catch the error instead of checking for a missing payload.

- **BREAKING:** Every transaction builder now requires `amount` and `gasPrice`
  to be decimal strings of digits, and encodes them the way the node does. Both
  went straight to bn.js before, which is lenient in ways that reached the
  chain:

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

- **BREAKING:** Every transaction builder now requires `gas` and `nonce` to be
  non-negative safe integers. Both went straight to `Long.fromValue`, which
  changes a wrong number instead of failing: `1.5` was signed as 1, `NaN` as 0,
  and `-5` as -5. Now each of those fails before anything is signed, naming the
  field: `gas must be a non-negative safe integer, got 1.5`. A left-out
  `nonce` is still 0. Callers passing integers see no change. A nonce read from
  the node's raw JSON is a decimal string and is refused now; convert it with
  `Number()`, or read it with `web3.beatoz.getAccount`, which returns a number.

- **BREAKING:** `buildSetDocTrx` takes no `amount`. A setDoc moves no value, and
  the builder signed an empty amount whatever was passed, so `amount: '5'` was
  dropped without a word. Its input is the new `TransactionWithoutAmount<T>`,
  where passing `amount` does not compile; a non-zero amount passed anyway fails
  before signing: `a setDoc moves no amount; leave amount out`. Remove `amount`
  from setDoc calls. The signed bytes are unchanged.

- **BREAKING:** `signTrxProto`, `verifyTrxProto` and `signedRawTrxProto`
  refuse a transaction type outside 1 to 8: `unknown transaction type 9; the
  chain accepts types 1 to 8`. beatoz-go defines only those and rejects any
  other, and the RLP encoding signed the payload as it was for such a type.
  The builders always set a type from 1 to 8, so only a `type` changed by hand
  is affected.

- **BREAKING:** Every transaction builder requires `from` and `to` to be 20
  bytes: `to must be 20 bytes, got 19: "15633e..."`. An address with digits
  dropped was still well-formed hex, so it was signed as 19 bytes and beatoz-go
  rejected it as `invalid address` after it was sent. As on the node,
  `buildContractTrxProto` also accepts an empty `to`, which creates a
  contract.

- **BREAKING:** `buildUnDelegateTrxProto` takes the staking hash as `txHash`
  instead of `txhash`, and `decodeTransaction` returns it under the same name.
  `buildSetDocTrx` takes the new `TransactionPayloadSetDoc`, the same shape, so
  no builder input is a protobuf payload type any more.

- **BREAKING:** The builder input has no `type`, `hash` or `sig`. No builder
  read them: each sets its own type, and the hash and signature come from
  signing, so `type: 8` on a transfer still built a transfer. Passing one no
  longer compiles, and one passed anyway fails before anything is built:
  `type is not a builder input; each builder sets its own`. Remove them from
  builder calls; the result is unchanged.

- **BREAKING:** `decodeTransaction` returns each payload in the shape its
  builder takes, so a decoded transaction builds the same bytes again: a
  withdraw's `ReqAmt` (hex) is `reqAmt` (decimal string), and a contract's
  `Data` is `data`. Proposals and votes, which have no builder, use the chain's
  names and hex for bytes: a proposal's `applyHeight` is `applyingHeight`, and
  its `options` are hex strings instead of `Uint8Array`s. Read the new names;
  for a withdraw, the amount no longer needs converting from hex.

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-accounts/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- **BREAKING:** Transaction builders set `payer` and `payerSig` on the objects
  they return, following the `TrxProto` change in `@beatoz/web3-types`.

- No longer depends on `ethereumjs-util` (#192), a 2019 release no longer
  maintained, which brought `pbkdf2` (a moderate advisory) and `elliptic`
  into every install for two calls. The signed RLP is encoded with
  `@ethereumjs/rlp`, and `getContractAddress` hashes with `ethereum-cryptography`.
  The bytes are the same for every transaction, checked over 814 cases of all
  eight types, except the one below.

- `long` is now `^5.3.2`, up from an exact `5.2.3` (#17). `protobufjs`
  ^7.6.6 depends on `long` ^5.3.2, so the pin installed a second copy;
  encoded transactions are byte for byte the same.

- `buildTransferTrxProto` uses the `time` it is given, as the other builders
  do. It always used the current time before.

- The `npm` range is gone from `engines`. These packages are installed with
  whatever the consumer uses, and a constraint on one package manager says
  nothing about the others.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

- `src/tx/trx_pb.proto` is now a verbatim copy of the chain's
  `protos/trx.proto`. The copy in this repository had been edited after
  generation: `TrxPayloadProposalProto` field numbers were renumbered and the
  fee delegation fields were missing. The generated code carried the chain's
  numbers, so nothing on the wire changes.

### Removed

- **BREAKING:** The keystore stubs are gone: `Wallet.encrypt`, `decrypt`, `save`
  and `load`, `web3.accounts.decrypt`, the matching abstract methods of
  `Web3BaseWallet`, `Web3AccountProvider.decrypt`, and the `KeyStore`, `Cipher`,
  `CipherOptions`, `ScryptParams` and `PBKDF2SHA256Params` types. Every one of
  them only threw `not implemented` or `Not supported yet`; they came with the
  web3.js fork. Nothing changes for a caller that did not call them.

- **BREAKING:** `buildProposalTrx`, `buildVotingTrx` and their input types
  `TransactionPayloadProposal` and `TransactionPayloadVoting` are gone.
  beatoz-go accepts proposals and votes only from validators, who send them with
  the BEATOZ wallet, and no service used the SDK for them. `decodeTransaction`,
  `signTrxProto` and `verifyTrxProto` still handle these transaction types.

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and the package ships ESM only.

  Node 22.12 and later can `require()` an ES module, so a CommonJS consumer on a
  supported Node keeps working without source changes:

  ```js
  require('@beatoz/web3-accounts')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

- No longer depends on `crypto-js`, `@types/crypto-js`, `constants-browserify`,
  `crypto-browserify` or `path-browserify`, none of which it imported. The three
  `*-browserify` packages are webpack polyfills used by this repository's browser
  build; they are declared at the root, where that build runs.

- `ts-proto` moved from `dependencies` to `devDependencies`. It provides the
  `protoc-gen-ts_proto` binary used to regenerate `trx_pb.ts`; consumers never
  regenerate protobuf code.

- `.npmignore` is gone, from this package and from the repository root. `files`
  takes precedence over it, so keeping both would leave a file that looks like
  it decides what ships but does not. The root one had been reaching into the
  workspace packages and excluding `src/` from all of them.

### Fixed

- A transaction whose `time` is 0 (1970-01-01) is signed over the bytes the
  node verifies (#192). `ethereumjs-util` encoded that 0 as `0x00`, where the
  node (go-ethereum rlp, a `uint64`) writes `0x80`, so the node would have
  refused its signature.

- `Wallet.remove()` left lookups by address pointing at the wrong account
  (#139). Removing moves every later account down one place, but the address
  map kept the old places, so `wallet.get(address)` returned another account,
  and a caller signing with it signed with another key; removing by index did
  not forget the address at all. The map is rebuilt after each removal.

- `wallet.add()` with an address already in the wallet no longer prints
  `Account <address> already exists.` to the console (#129). It puts the
  account back in its place, as before.

- `signTransaction` on a transaction that already has a signature signed
  over that signature, which the node leaves out, so the node rejected the
  result as `invalid signature`. It now clears `sig` first, as
  `TrxProtoBuilder.signTrxProto` does (#3).

- **Signing works in the ESM build.** `privateKeyToAccount` and everything
  downstream of it threw `TypeError: secp256k1.privateKeyVerify is not a
  function`, so an ESM consumer could not sign a transaction at all.

  `secp256k1` is CommonJS and publishes no `exports` map. Importing it as
  `import * as secp256k1` gives a namespace whose only key is `default`, so
  every call through it was a call on `undefined`. A default import gets the
  module itself, which is how ES modules are meant to consume CommonJS.

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

- The ESM build could not be imported. The generated protobuf code imported
  `protobufjs/minimal` without an extension, which `require()` resolves and
  ESM does not, so the module failed with `ERR_MODULE_NOT_FOUND`.

### Security

- `protobufjs` is now `^7.6.6`, up from an exact `7.2.5`. 7.2.5 is inside the
  affected range of eleven advisories, one critical. Most concern loading
  schemas or JSON descriptors at runtime, which this package never does: it
  ships code generated by ts-proto and uses only `protobufjs/minimal`. Two reach
  that path - GHSA-q6x5-8v7m-xcrf (overlong UTF-8 accepted by the fallback
  decoder used outside Node, so in browsers) and GHSA-685m-2w69-288q (no depth
  limit when skipping unknown group fields while decoding).

  The range is no longer pinned, so later 7.x security releases reach consumers
  without a release of this package.

  The bytes on the wire do not change. Every message type in `trx_pb.proto`,
  across 156 cases including int64 extremes and multi-byte strings, encodes to
  the same bytes under 7.2.5 and 7.6.6, so signatures over them are unchanged.
  Against the official node, CheckTx decoded one transaction of each of the
  eight types beatoz-go accepts, and the integration suites pass.
