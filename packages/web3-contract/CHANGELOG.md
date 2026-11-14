# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org). See
[guides/release.md](../../guides/release.md) for what counts as a major, minor or patch change.

## [Unreleased]

### Changed

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

- **BREAKING:** `Web3ContractError` extends `BaseError` from
  `@beatoz/web3-errors` (#100). The handlers for `ContractExecutionError`,
  which nothing threw, are gone; a call that reverts becomes an error in the
  next part of #100 (#101).

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

- **BREAKING:** The minimum TypeScript version is 5.8, raised from 5.7. The
  packages are ES modules only, and on 5.7 a CommonJS project that resolves them
  with `module`/`moduleResolution` `nodenext` cannot import them (`error
  TS1479`); from 5.8 it can, as Node 22.12 and later can `require` them. ES
  module projects and `moduleResolution` `node` or `bundler` worked on 5.7, but
  one floor that holds for every project is simpler to state. A project on
  TypeScript 5.7 or older upgrades TypeScript; nothing else changes.

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

### Removed

- **BREAKING:** `Contract` extends `Web3Context` with no type argument; the
  API spec it named is gone (#37).

- **BREAKING:** `LogsSubscription`, `ContractBoundEvent` and
  `ContractEventsInterface` are gone. `LogsSubscription` extended the
  `Web3Subscription` class removed from `@beatoz/web3-core`, and the chain above
  it was unreachable: `Contract` has no `events` property, so nothing produced a
  `ContractBoundEvent` and nothing consumed `ContractEventsInterface`.

### Removed

- **No longer depends on `web3` (the upstream web3.js package).** It was declared
  but never imported - the only mention was a `require('web3-eth-contract')` line
  inside a JSDoc example. Installing this package into an empty project drops from
  138 packages and 86 MB to 105 and 32 MB.

- No longer depends on `@beatoz/web3-abi`, `@beatoz/web3-errors`,
  `@beatoz/web3-providers-http`, `@beatoz/web3-providers-ws` or
  `@beatoz/web3-validator` beyond what it imports; the unused ones are gone.

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
  require('@beatoz/web3-contract')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

### Changed

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-contract/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Fixed

- Declares `@beatoz/web3-abi`, `@beatoz/web3-errors`,
  `@beatoz/web3-providers-http`, `@beatoz/web3-providers-ws` and
  `@beatoz/web3-validator`, which it imports but did not list. Installing this
  package on its own could fail at load.

  This was hidden by the monorepo: every dependency was hoisted to one
  `node_modules`, so these imports resolved here and only here.

### Changed

- **BREAKING:** The minimum supported Node.js version is now 22. It was 16.19,
  which had not been accurate for some time: several dependencies already
  required Node 18 or later.

### Added

- Declares `typescript: ">=5.4"` as an optional peer dependency. No supported
  compiler range was declared before.
