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

- Method sends and deploys take their nonce from `web3.beatoz.nonceManager`
  when it is set (#43), read at each send, so a contract made before the
  manager was set uses it too. A send that fails resets the account in it.

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

- **BREAKING:** Method options take the types the transaction builder does
  (#6). `broadcast()` and `send()` take `gas` and `nonce` as numbers and
  `gasPrice` as a decimal string, passed to the builder unchanged; they went
  through `Number()` before, so a gas price of 10^21 became `1e+21` and was
  refused, and one past 2^53 was rounded. A payable method's `broadcast()`
  sends `value` (wei, decimal string) with the call; it always sent zero
  before. `call()` and `estimateGas()` take only `from` (`CallOptions`),
  since the node runs both with the caller and the call data alone, and a
  value of zero. `maxFeePerGas`, `maxPriorityFeePerGas` and `type`, which
  the node has no use for and were dropped without a word, are gone, as are
  `ContractOptions.gas`, `gasPrice`, `maxFeePerGas` and `maxPriorityFeePerGas`,
  which nothing could set, and the unused `getCreateAccessListParams` and
  `isContractInitOptions`.

- **BREAKING:** `gas` is required by a method's `broadcast()` and by
  `deploy().send()` (#127). Left out, `broadcast()` used the chain's
  `minTrxGas`, below the EVM's intrinsic 21000, so every such call was
  refused; `deploy().send()` used the node's estimate, which runs once with
  a value of zero and returns the gas used, not the limit the transaction
  needs. The fee is the gas used, so a generous limit costs nothing more.
  `deploy().send()` still runs the deploy once before sending: a reverting
  constructor throws `ContractFunctionRevertedError` as before, and a `gas`
  below the gas that run used throws `InvalidInputError`, both without
  sending.

- **BREAKING:** Wrong arguments, a missing address or `from`, and a `from`
  not in the wallet throw `InvalidInputError` instead of `Web3ContractError`
  (#100), with messages like `transfer takes 2 arguments, got 1` and
  `from must be an account in the wallet, got ...`.

- **BREAKING:** A contract call the EVM fails throws (#101, #100). `call()`
  and `estimateGas()` used to return a failed call like a successful one;
  when the node sets `vmErr` they now throw `ContractFunctionRevertedError`,
  with what the contract reverted with decoded: `Error(string)` as `reason`,
  `Panic(uint256)` as `reason` from the panic code, an error in the
  contract's ABI as `errorName` and `args` (shaped as `call()` returns
  values), and one the ABI does not have as its 4-byte `signature`. Without
  revert data, the EVM's own error (`out of gas`, ...) is the reason. A
  function with outputs that returns no data, as a call to an address
  without code does, throws `ContractFunctionZeroDataError` instead of an ABI
  decoding error. `decodeRevert(errors, data)` is exported.

- **BREAKING:** `deploy().send()` throws `ContractFunctionRevertedError` when
  the gas estimate shows the constructor reverting, and
  `TransactionFailedError` (`stage`, the node's `code` and `log`, `hash`) when
  the node refuses or fails the transaction. Both were `Web3ContractError`
  with the reason in the message.

- **BREAKING:** `Web3ContractError` is gone (#100): wrong input throws
  `InvalidInputError` and a call the EVM fails throws
  `ContractFunctionRevertedError` (see above). The handlers for
  `ContractExecutionError`, which nothing threw, are gone.

- **BREAKING:** Deploying takes one call and resolves with the contract's
  address (#42): `contract.deploy({ bytecode, args }).send({ from })` returns
  `{ address, contract, hash, height }`, where `contract` is a `Contract` at
  the new address on the same provider and wallet. The account of `from` comes
  from the wallet and the chain id is filled in; the gas is the node's
  `vm_estimate_gas` for the deploy and the gas price the chain's unless given.
  `args` is typed from the ABI's constructor (`ConstructorArgs`,
  `DeployParams`). A deploy the node rejects or that fails throws
  `Web3ContractError` with the node's log, as does one the estimate says would
  fail. The address is computed from the sender and the nonce, as the node
  does, so it needs no lookup and no wait for indexing.
  `deploy(bytecode, args, account, chainId, gas)`, which returned the commit
  response, is gone.

- **BREAKING:** Contract methods are typed from the ABI with abitype, the
  library viem uses. The inherited types turned an `address` argument into
  `never` and an `uint256` result into an unresolved type, so correct calls did
  not compile and callers cast contracts to `any`. With an ABI written `as
  const`, `contract.methods` has exactly the ABI's function names (a missing
  method or an event name no longer compiles), each takes its arguments as a
  tuple (addresses and bytes with or without `0x`), and `call()` returns the
  decoded result typed from the outputs. An ABI read from JSON allows any name
  with unknown arguments and result. `call()`'s results take the shape abitype
  gives them, as viem returns them: integers of 48 bits or fewer are numbers
  (`decimals()` is `18`, not `18n`), wider ones bigints, and a tuple with named
  components is an object (`{ a, b }`) rather than an array-like object with
  index keys and `__length__`. `call()` no longer takes a type argument for its
  result, `estimateGas()` is typed as the `VmCallResponse` it returns, and
  methods are no longer typed under their signature
  (`'transfer(address,uint256)'`) or selector. `ContractOverloadedMethodInputs`
  and `ContractOverloadedMethodOutputs` are removed; `ContractMethodsInterface`,
  `MethodInputs` and `MethodOutputs` replace them.

- **BREAKING:** A contract method's `call()` returns its decoded result instead
  of the node's `vm_call` response: the value itself for one output (`1000n`,
  `'MyToken'`), an array for more (`[1000n, true]`), and `undefined` for none,
  as viem's `readContract` does. Callers decoded `res.value.returnData` with
  `decodeParameter` themselves, although the contract holds the ABI that says
  what the bytes are; drop that step. `web3.beatoz.vmCall` still returns the
  whole response. `decodeMethodReturn`, which does the decoding, returns
  `undefined` rather than `null` for no outputs and an array rather than an
  object with `__length__` for several, takes hex with or without `0x` (it cut
  two characters whatever they were), and no longer returns constructor data as
  it was.

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-contract/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- The `npm` range is gone from `engines`. These packages are installed with
  whatever the consumer uses, and a constraint on one package manager says
  nothing about the others.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Removed

- **BREAKING:** `Contract` extends `Web3Context` with no type argument; the
  API spec it named is gone (#37).

- **BREAKING:** `LogsSubscription`, `ContractBoundEvent` and
  `ContractEventsInterface` are gone. `LogsSubscription` extended the
  `Web3Subscription` class removed from `@beatoz/web3-core`, and the chain above
  it was unreachable: `Contract` has no `events` property, so nothing produced a
  `ContractBoundEvent` and nothing consumed `ContractEventsInterface`.

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and the package ships ESM only.

  Node 22.12 and later can `require()` an ES module, so a CommonJS consumer on a
  supported Node keeps working without source changes:

  ```js
  require('@beatoz/web3-contract')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

- **No longer depends on `web3` (the upstream web3.js package).** It was declared
  but never imported - the only mention was a `require('web3-eth-contract')` line
  inside a JSDoc example. Installing this package into an empty project drops from
  138 packages and 86 MB to 105 and 32 MB.

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

- Declares `@beatoz/web3-abi`, `@beatoz/web3-errors`,
  `@beatoz/web3-providers-http`, `@beatoz/web3-providers-ws` and
  `@beatoz/web3-validator`, which it imports but did not list. Installing this
  package on its own could fail at load.

  This was hidden by the monorepo: every dependency was hoisted to one
  `node_modules`, so these imports resolved here and only here.
