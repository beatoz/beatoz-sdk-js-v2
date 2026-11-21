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

- The package carries its browser bundle, `dist/web3-validator.min.js`, built
  with the package (#154). It sets one global, `BeatozWeb3Validator`, holding
  the package's exports; `unpkg` and `jsdelivr` point at it. It was not
  published before, failed as it loaded in a browser (`process is not
  defined`), and its global was `undefined`.

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

- **BREAKING:** The validator no longer uses `is-my-json-valid` (#226). It
  required Node's `util`, so a webpack 5 app failed to build
  (`Can't resolve 'util'`), and it compiled each schema with `new Function`,
  which a page that forbids `unsafe-eval` in its Content-Security-Policy
  (browser extensions under Manifest V3, many production sites) does not
  allow. The package checks the schemas itself, for the keywords the SDK
  builds from ABI types and the ones web3.js's validator also takes: `type`,
  `items` (a tuple or one schema), `minItems`, `maxItems`, `format`,
  `required` (`true`, or a list of property names), `properties` and `oneOf`.
  It passes and refuses what `is-my-json-valid` did, but where #229 below
  changed it on purpose; `test/fixtures/validator_baseline.jsonl` records its
  answers for 2,800 inputs. A schema passed to
  `validateJSONSchema` with any other keyword (`pattern`, `enum`, `$ref`,
  `minimum`, ...) or type throws `InvalidInputError` instead of being
  checked, and the string formats `is-my-json-valid` had built in (`email`,
  `date-time`, `uri`, ...) are not checked, as an unknown format was not
  before. `Schema` lists only those keywords. `is-my-json-valid` and the six
  packages it brought (`generate-function`, `generate-object-property`,
  `is-property`, `is-my-ip-valid`, `jsonpointer`, `xtend`) are no longer
  installed.

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

- **BREAKING:** Invalid hex and tuple types without components throw
  `InvalidInputError` (#100). `isHexPrefixed` and `validateNoLeadingZeroes`,
  which nothing used, are gone.

- **BREAKING:** `Web3ValidatorError` extends `InvalidInputError` from
  `@beatoz/web3-errors` (#100); it has no `code`, and its error lines are in
  `metaMessages` (the message has a blank line after its first line). Other
  invalid input throws `InvalidInputError`.

- **BREAKING:** Adds an `exports` map, so only the package root and its
  `package.json` can be imported. Deep paths such as
  `@beatoz/web3-validator/lib/commonjs/index` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Everything under `lib/` used to be
  reachable, which meant the whole build output was public API.

- The `npm` range is gone from `engines`. These packages are installed with
  whatever the consumer uses, and a constraint on one package manager says
  nothing about the others.

- Adds a `types` field. Type resolution previously relied on `index.d.ts`
  happening to sit next to the file named by `main`.

### Removed

- **BREAKING:** The `Validate` type, `is-my-json-valid`'s compiled
  validator, and `RawValidationError`, its error (#226, #229). The validator
  reports `Web3ValidationErrorObject`s directly.

- **BREAKING:** The CommonJS build is gone. `lib/commonjs` is no longer built
  or published, and the package ships ESM only.

  Node 22.12 and later can `require()` an ES module, so a CommonJS consumer on a
  supported Node keeps working without source changes:

  ```js
  require('@beatoz/web3-validator')   // still resolves, via require(esm)
  ```

  The `exports` map uses a `default` condition rather than `import`, so the
  `require` condition matches it too. A bundler or a TypeScript setup pinned to
  an older Node resolution mode may still need updating.

- **BREAKING:** `main` now points at the ESM entry and the `module` field is
  gone; both described the same build before.

- No longer depends on `util`, the npm polyfill for the Node builtin, which it
  never imported.

- `.npmignore` is gone, from this package and from the repository root. `files`
  takes precedence over it, so keeping both would leave a file that looks like
  it decides what ships but does not. The root one had been reaching into the
  workspace packages and excluding `src/` from all of them.

### Fixed

- **BREAKING:** Array parameters are checked element by element against
  their type's size (#229): `uint8[2]` took `[1, 300]`, `bytes4[]` took a
  5-byte value, because an array's elements were checked as `uint` or
  `bytes` of any size. A nested array checks every row: `bool[2][3]` checked
  only the first, as its schema made the inner dimension a one-item tuple,
  which also replaced the other parameters' schemas when it came after
  them. Contract arguments were still refused by the ABI coder, so nothing
  wrong was sent; `validate` and the `utils` that use it accepted them.

- **BREAKING:** `int` and `uint` of every size, 8 to 256 bits in steps of 8,
  are checked (#229). Only the powers of two had a format, so `uint24` or
  `int40` took any value.

- **BREAKING:** Each validation error names its keyword (`format`, `type`,
  `required`, `minItems`, `maxItems`, `oneOf`), the value's place in the data
  (`instancePath`, a JSON pointer such as `/0/1/0`) and the keyword's place
  in the schema (`schemaPath`, such as `#/items/0/items/1/format`) (#229).
  For anything nested they were wrong: `keyword` held is-my-json-valid's
  field name (`data["0"]`), `instancePath` was `/0/items` for an element of
  an array parameter and `/1/0` for `[0][1][0]` of a tuple, and a length
  error named the parameter list's length: a `uint8[2]` given three items
  read `must NOT have more than 1 items`. The thrown message for a
  top-level value is unchanged (`value "9.5" at "/0" must pass "int"
  validation`). A wrong type reads `must be array` instead of
  `is the wrong type`, and `oneOf` reads
  `must match exactly one schema in oneOf`.

- `validateJSONSchema` applies `properties` to objects only (#229).
  `is-my-json-valid` read them from any value, so `1` lacked a required
  property and `null` threw a `TypeError` from inside it.

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
