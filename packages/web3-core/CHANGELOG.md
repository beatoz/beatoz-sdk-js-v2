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

- `Web3Context.nonceManager`: when set, sends take their nonce from it
  instead of reading the node each time (#43).

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

- **BREAKING:** `Web3RequestManager.subscribe` takes `{ method: 'subscribe',
  params: { query } }`, the shape the node reads, instead of any request
  (#146).

- **BREAKING:** `setProvider` and the constructor refuse a string that is not
  an `http(s)://` or `ws(s)://` URL with `InvalidInputError` (#168). One
  without a scheme, such as `localhost:26657`, used to leave the previous
  provider in place with no error, and an empty string was stored as the
  provider. `undefined` still means no provider.

- **BREAKING:** `subscribe` without a WebSocket provider throws
  `InvalidInputError` (#100).

- **BREAKING:** `Web3RequestManager.send()` throws a node's JSON-RPC error as
  `RpcRequestError` with the node's `code` and `data` (#71, #100), and an
  answer with neither a result nor an error as `InvalidResponseError`. It
  threw `ResponseError`, whose `code` was always 100.

- **BREAKING:** `Web3EventEmitter.removeAllListeners()` returns `void`. It had
  no declared return type, so TypeScript inferred one from the body and the
  emitted declaration became `removeAllListeners(): EventEmitter<[never]>` -
  handing callers the private `EventEmitter` this class wraps, and putting a
  Node-only type in the public API. Nothing used the return value.

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-core/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- The `npm` range is gone from `engines`. These packages are installed with
  whatever the consumer uses, and a constraint on one package manager says
  nothing about the others.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Removed

- **BREAKING:** `Web3RequestManager`, `Web3Context` and `Web3ContextObject`
  take no `API` type parameter; the API spec it named is gone (#37). `send()`
  takes a method name and returns the node's result as `unknown`, before
  decoding, which is what it always returned at runtime. `isWeb3Provider`,
  `isEIP1193Provider`, `isLegacyRequestProvider`, `isLegacySendProvider`,
  `isLegacySendAsyncProvider` and `isSupportedProvider` are gone; nothing used
  them, and the providers they checked for are not the SDK's.

- **BREAKING:** `Web3RequestManager`'s second constructor argument,
  `useRpcCallSpecification`, is gone. `Web3` never passed it, so it was always
  off; the error classes it switched to are removed from `@beatoz/web3-errors`.
  Node errors are thrown as before.

- **BREAKING:** The `Decoder` type is gone. Nothing used it, and it was built on
  `JsonRpcSuccessResponse`, removed from `@beatoz/web3-types`.

- **BREAKING:** `Web3Subscription`, `Web3SubscriptionManager`,
  `Web3SubscriptionConstructor` and `isSupportSubscriptions` are gone, 394 lines
  that could not run. They are web3.js's `eth_subscribe` machinery, ported
  without `sendSubscriptionRequest()` - the method that assigns a subscription
  its id. `_id` was therefore never set, and `addSubscription()` starts with
  `if (isNullish(sub.id)) throw`, so every call threw. Nothing ever populated
  `registeredSubscriptions` either.

  Subscriptions on this chain go through `web3.beatoz.subscribe()` and its
  siblings, which return an xstream `Stream` over the websocket provider. That
  path is untouched.

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and the package ships ESM only.

  Node 22.12 and later can `require()` an ES module, so a CommonJS consumer on a
  supported Node keeps working without source changes:

  ```js
  require('@beatoz/web3-core')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

- No longer depends on `@beatoz/web3-validator`, which it never imported.

- `.npmignore` is gone, from this package and from the repository root. `files`
  takes precedence over it, so keeping both would leave a file that looks like
  it decides what ships but does not. The root one had been reaching into the
  workspace packages and excluding `src/` from all of them.

### Fixed

- `setProvider()` with a URL now builds one provider. It built two and kept the
  second, so for a `ws://` URL the first opened a socket that nothing referenced
  and nothing could close, and a Node process that called it never exited on
  its own. This now matches web3.js 4.x, where `Web3Context.setProvider` hands
  the value to the request manager and the request manager alone turns a URL
  into a provider.

- The published type declarations now follow ES module rules. `lib/types/` gets
  a `package.json` marking it as ESM, so a consumer's compiler reads the `.d.ts`
  files as ES modules rather than CommonJS. Without it the runtime half of the
  package was ESM while its types were interpreted as CommonJS, which made a
  default import ambiguous.

- Declares `@beatoz/web3-errors` and `xstream`, which it imports but did not
  list. Installing this package on its own could fail at load. `xstream`
  appears only in emitted `.d.ts` files, but a consumer type-checking those
  declarations has to resolve it, so it is a runtime dependency rather than a
  development one.

  This was hidden by the monorepo: every dependency was hoisted to one
  `node_modules`, so these imports resolved here and only here.
