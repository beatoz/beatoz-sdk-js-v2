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

- **BREAKING:** One name per function (#167). The web3.js aliases are gone;
  use the name that says what it converts:

  | Removed | Use |
  | --- | --- |
  | `fromUtf8`, `stringToHex` | `utf8ToHex` |
  | `hexToString` | `hexToUtf8` |
  | `fromAscii` | `asciiToHex` |
  | `toAscii` | `hexToAscii` |
  | `toDecimal` | `hexToNumber` |
  | `fromDecimal` | `numberToHex` |
  | `leftPad`, `rightPad` | `padLeft`, `padRight` |

  `toUtf8` stays: it also takes bytes.

- **BREAKING:** `soliditySha3` and friends refuse an array value without its
  type with `InvalidInputError` (#100). `hexStringToUint8Array` and the
  unused `storage.ts`, with the `node-localstorage` dependency, are gone.

- **BREAKING:** Invalid input throws `InvalidInputError` from
  `@beatoz/web3-errors` (#100) instead of `InvalidBytesError`,
  `InvalidNumberError`, `InvalidAddressError`, `InvalidUnitError`,
  `HexProcessingError`, `NibbleWidthError`, `FormatterError` and the other
  `Invalid*Error` classes, with messages that name what was expected and what
  was given. `Web3DeferredPromise` times out with `TimeoutError`.
  `ChunkResponseParser`, which nothing used, is gone.

- **BREAKING:** The units below one BEATOZ are `wei`, `kwei`, `mwei`, `gwei`,
  `szabo` and `finney`, one name per value, at the values web3.js gives them.
  The converters are `fromWei` and `toWei`. Units from one BEATOZ up are
  unchanged. Any other unit name fails as `invalid unit`.

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-utils/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- `long` is now `^5.3.2`, up from an exact `5.2.3` (#17). `protobufjs`
  ^7.6.6 depends on `long` ^5.3.2, so the pin installed a second copy;
  encoded transactions are byte for byte the same.

- `jsonRpc.toPayload` is typed as the one `JsonRpcRequest` it returns rather
  than `JsonRpcPayload`, a request or a batch (#37).

- The `npm` range is gone from `engines`. These packages are installed with
  whatever the consumer uses, and a constraint on one package manager says
  nothing about the others.

- `rejectIfTimeout` and `rejectIfConditionAtInterval` return
  `ReturnType<typeof setTimeout>` instead of `NodeJS.Timer`. The value is the
  same; `NodeJS.Timer` is a name from `@types/node`, while this one resolves to
  whatever the running environment returns - an object on Node, a number in a
  browser. The old code cast through `as unknown as NodeJS.Timer`, which was
  the signal that the declared type did not match.

- `ChunkResponseParser`'s constructor accepts `ChunkEventSink` - anything with
  an `emit` method - rather than Node's `EventEmitter`. `emit` is the only
  member it ever called. An `EventEmitter` still satisfies it, so no existing
  call breaks.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Removed

- **BREAKING:** `isResponseRpcError` is gone. Only the removed
  `useRpcCallSpecification` path of `Web3RequestManager` called it.

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and the package ships ESM only.

  Node 22.12 and later can `require()` an ES module, so a CommonJS consumer on a
  supported Node keeps working without source changes:

  ```js
  require('@beatoz/web3-utils')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

- No longer depends on `bn.js`, `crypto-js`, `@types/crypto-js`, `protobufjs`,
  `ts-proto`, `constants-browserify`, `crypto-browserify` or `path-browserify`.
  None of them were imported. Installing this package drops from 8 of these to 0.

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

- `formatter` no longer relies on an implicit `this` binding inside an
  `Array.prototype.find` callback.
