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

- **BREAKING:** `listen(request)` takes a `JsonRpcSubscribeRequest`: method
  `'subscribe'` and `params: { query }`, the named parameter the node reads
  (#146). It was typed with positional `params`, so a correct request needed
  a cast and a wrong one compiled. A wrong request from JavaScript is still
  refused with `InvalidInputError`.

- **BREAKING:** `parseJsonRpcResponse`, `parseJsonRpcErrorResponse` and
  `parseJsonRpcSuccessResponse` take `unknown` instead of `any`, and the
  result they return is `unknown` instead of `JsonRpcResult`: they check that
  a result is there, not what it is, and the node may send `null` (#33). A
  response that is not an object, `null` included, is refused with
  `InvalidResponseError`; `null` used to escape as a `TypeError`. An error
  response whose `id` is `null` is refused too; the node leaves the id out
  instead.

- **BREAKING:** A dropped connection reaches the caller (#100, last part).
  A request waiting for its answer, or queued and not yet sent, fails with
  `SocketClosedError` (`url`) when the connection drops, instead of waiting
  forever; the queued ones are not sent on the next connection, so a
  broadcast the caller saw fail cannot land later. A subscription ends with
  `SocketClosedError` when the connection drops, and with `RpcRequestError`
  (the node's `code` and `data`) when the node answers it with an error, not
  a JSON string. A request after `disconnect()` fails with
  `SocketClosedError`. The constructor's `onError` argument, which was never
  called, is gone, as are `toListPromise` and `firstEvent`, which nothing
  used. Malformed answers throw `InvalidResponseError`, `listen` with a wrong
  request `InvalidInputError`, and the socket's internal errors `BaseError`.

- **BREAKING:** `request()` and `execute()` throw a node's JSON-RPC error as
  `RpcRequestError` with its `code` and `data` (#71, #100), as the HTTP
  provider and the request manager do, instead of an `Error` whose message was
  the JSON-RPC error serialised to a string. The node's own answer, such as
  `tx (...) not found`, is in `data`; code that parsed the old message reads
  `data` instead.

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-providers-ws/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- The `npm` range is gone from `engines`. These packages are installed with
  whatever the consumer uses, and a constraint on one package manager says
  nothing about the others.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Removed

- **BREAKING:** `WebsocketProvider` takes no `API` type parameter; the API
  spec it named is gone (#37). `request()` and `execute()` return the node's
  result as `unknown`.

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and the package ships ESM only.

  Node 22.12 and later can `require()` an ES module, so a CommonJS consumer on a
  supported Node keeps working without source changes:

  ```js
  require('@beatoz/web3-providers-ws')   // still resolves, via require(esm)
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

- `disconnect()` now stays disconnected. The reconnect logic read the
  `Disconnected` status that `disconnect()` itself reports as a dropped
  connection, and opened a new socket about 100ms later. Nothing could close a
  `WebsocketProvider` for good, so a Node process that used one never exited on
  its own; under Jest the run hung after the last test.

  The code comes from `@cosmjs/socket`, which still behaves this way as of
  0.39.0.

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
