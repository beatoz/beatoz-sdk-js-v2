# Versioning and release policy

`@beatoz/*` packages follow [Semantic Versioning 2.0.0](https://semver.org).
This document defines what counts as a major, minor and patch change here, and
how releases are cut.

Packages depend on each other through caret ranges (`^1.6.5`), so a minor or
patch release reaches consumers without them asking for it. Anyone installing
for the first time, and anyone running `npm update`, gets it.

## Major, minor, patch

A change is **major** when a project depending on us has to change its code, its
build, or its tests. Code that compiles before the upgrade and does not compile
after it is a major change, even when the runtime behaviour is identical.

### Types

| Change | Release |
| --- | --- |
| Widen what a function accepts | minor |
| Narrow what a function accepts | **major** |
| Narrow what a function returns | minor |
| Widen what a function returns | **major** |
| Add an export | minor |
| Remove or rename an export | **major** |

Widening an input and narrowing an output only admit more callers. The opposite
directions reject code that used to compile.

Two cases are easy to misread:

- **Adding an overload to a function that took `any` is major.** Once a function
  has an overload declaration, its implementation signature is no longer
  callable from outside. The `any` line stays in the file, so the diff looks
  harmless, but callers passing `unknown` now fail.

- **Adding a member to a union return type is major.** Callers that switch
  exhaustively on it stop compiling.

### Runtime

| Change | Release |
| --- | --- |
| New function, new optional parameter | minor |
| New required parameter | **major** |
| Different return value for the same input | **major** |
| Normalising `null` to `undefined` at a boundary | **major** |
| Bug fix restoring documented behaviour | patch |

### Environment

| Change | Release |
| --- | --- |
| Raise the minimum Node version | **major** |
| Raise the minimum TypeScript version | **major** |
| Bump a dependency major, where its types appear in our public API | **major** |
| Bump a dependency within its own major | patch |

The supported ranges are declared in every package:

```json
"engines": { "node": ">=22.22.2" },
"peerDependencies": { "typescript": ">=5.8" },
"peerDependenciesMeta": { "typescript": { "optional": true } }
```

TypeScript is an optional peer so that a JavaScript consumer is not asked to
install it. No `npm` range is declared: these packages are installed with
whatever the consumer uses, and a constraint on one package manager says nothing
about the others.

The root `package.json` carries the same Node floor. It is `private`, so it is
describing the machine that builds this repository rather than one that consumes
it, and the two could legitimately differ - but one number is easier to keep
true than two, and nothing is lost by holding the repository to what it ships.

Three things set that number, and the highest one wins:

- `require(esm)`, which is why these packages can ship ESM only, landed in
  **22.12**.
- ESLint 10 declares `^20.19.0 || ^22.13.0 || >=24`, so it starts at **22.13**.
- lerna 10, which runs every build and test here, declares
  `^22.22.2 || ^24.15.0 || ^26.0.0`, so `yarn install` refuses anything below
  **22.22.2**.

The packages would run on 22.12. They are held to 22.22.2 with the repository,
so there is one number. It is also a security release (March 2026), which a
Node 22 user below it should take anyway.

The TypeScript floor is the oldest compiler every consumer can use. These
packages are built with TypeScript 6.0.3, and the emitted `.d.ts` uses
`Uint8Array<ArrayBufferLike>`, which TypeScript understands from 5.7; below that
a consumer gets `error TS2315: Type 'Uint8Array' is not generic`. The packages
are ES modules only, and a CommonJS project that resolves them with `nodenext`
can import them from 5.8 (`error TS1479` on 5.7), as Node 22.12 and later can
`require` them. So the floor is 5.8.

The release checks test the floor the way a consumer meets it. They pack the
packages, install them in an empty project and compile an import of each, from
an ES module and from a CommonJS file, with TypeScript 5.8.3, 6.0.3 and 7.0.2
and `skipLibCheck: false`. That setting
matters: with `skipLibCheck: true`, which most projects use, TypeScript does not
check declarations in `node_modules` and any floor looks fine. A change that
needs a newer compiler fails the `TypeScript 5.8.3` check.

### Node types stay out of the published declarations

No `.d.ts` we publish may refer to `NodeJS.*`, or import from `events`, `net`,
`fs`, `stream` or any other Node built-in. A consumer running in a browser
should not have to install `@types/node` to read our types, and on TypeScript 6
- which no longer includes `@types/*` packages automatically - they would also
have to add `"types": ["node"]` to their own `tsconfig.json`.

Writing Node types in the sources is fine; `tsconfig.base.json` sets
`"types": ["node"]` for exactly that. The rule is about what reaches `lib/types`.
Private fields and local variables are erased on the way out and do not count.

Reading the sources is not enough. `removeAllListeners()` was declared with no
return type, TypeScript inferred one from the body, and `EventEmitter<[never]>`
appeared in the published declaration although nobody wrote it.

The release checks catch it. They compile the declarations of the installed
packages with `"types": []`, so a `NodeJS.*` name or an import of `events`
fails. `check-dist.mjs` in the pull request checks does the same inside the
repository, but there a development dependency can supply the missing types:
`@types/events` comes in with `@types/node-localstorage`, a development
dependency of `web3-utils`, so an `events` import passes there and fails only
in the release checks.

A package that genuinely needs Node - an IPC provider, say - declares
`@types/node` in its own `dependencies` and is exempt. The point is that the
packages which do not need it are not carrying it for everyone else.

## Removing

Removals go in a major release. We do not add compatibility layers or fallbacks
for the removed path.

Mark with `@deprecated` before removing when there is a replacement to point at
and consumers who would see the warning. Otherwise remove directly.

An API that never worked is removed without a deprecation. It is still major: it
was exported.

## Package versions

`lerna.json` is set to `independent`, so each package can carry its own version.
It was locked to a single number until v2, and under that scheme every package
moved whenever any package moved - a version number said nothing about whether
that package had changed.

Independent configuration is not an instruction to release separately. It is
what makes releasing separately possible. **The default is still to release all
thirteen packages together under the same number.**

- v2 moves every package to `2.0.0` at once. Every package has a breaking
  change in it, so there is nothing to separate.
- After that, a release moves only the packages that changed. Fixing
  `web3-utils` takes it to `2.0.1` and leaves the other twelve at `2.0.0`.
- Internal dependencies are declared with caret ranges, so `web3-core` at
  `"@beatoz/web3-utils": "^2.0.0"` accepts `2.0.1` without being republished. A
  minor or patch release of a base package does not cascade.
- A package that has not changed stays where it is, however far behind that
  leaves it.

A consumer can therefore read something from the number: a package still at
`2.0.0` has not changed since v2.

[ethereumjs-monorepo](https://github.com/ethereumjs/ethereumjs-monorepo) works
this way: it releases its packages together under one number, and a package
that has not changed keeps its old one (`@ethereumjs/trie` has been at `6.2.1`
since 2024).

## Changelogs

Every package has a `CHANGELOG.md` in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. The root
`CHANGELOG.md` aggregates them.

Entries are written in the pull request that makes the change, under
`## [Unreleased]`. A change with no entry is not released.

Sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
Breaking entries start with `**BREAKING:**` and say what the consumer has to do.

## Cutting a release

Everything up to step 3 happens on `dev`, through pull requests. The packages
are published from `main`.

1. In a pull request to `dev`, move each `## [Unreleased]` section to the new
   version and date, and set the versions with

   ```bash
   npx lerna version --no-git-tag-version
   ```

   It asks for a version for each package that changed. Choose by this
   document: lerna cannot tell whether a type was widened or narrowed. When
   every package changed, give them one number, as in
   `npx lerna version 2.0.0 --no-git-tag-version`.

   `--no-git-tag-version` only changes the `package.json` files and leaves the
   commit to you. Without it lerna also commits, tags and pushes. The tags
   would stay on a commit that the rebase merge replaces, and run on `dev`
   itself, the push is refused because the new commit has no checks yet.
2. Merge it. Open a pull request from `dev` to `main` and wait for the release
   checks.
3. When every check is green, move `main`:

   ```bash
   git push origin <dev commit>:main
   ```
4. From a clean checkout of `main`, build and publish to the `next` dist-tag:

   ```bash
   yarn install --frozen-lockfile
   yarn build
   npx lerna publish from-package --dist-tag next
   ```

   `from-package` publishes each package whose version is not on npm yet.
   `--dist-tag next` keeps `latest` where it was; a plain publish moves it.
5. Install from `next` in the projects inside this organization and check them.
6. Move `latest` for each package you published:

   ```bash
   npm dist-tag add @beatoz/<package>@<version> latest
   ```

Step 5 is required for a major release. Step 6 is the one that cannot be
undone: moving the tag back does not reach anyone who installed in between, and
their lockfile now pins the release.

How releases are tagged in Git is still open (#14).

## Support

Only the current major gets fixes.

The previous major stays on npm and keeps working: published versions are not
removed, and a caret range does not cross a major, so existing installs are
untouched. We do not backport to it, and we do not promise to.

## Repositories

v2 and later are developed and released from this repository,
[beatoz/beatoz-sdk-js-v2](https://github.com/beatoz/beatoz-sdk-js-v2).
[beatoz/beatoz-sdk-js](https://github.com/beatoz/beatoz-sdk-js) keeps v1 on its
`main`. This repository's `main` began as that repository's `feature/sdk-v2`
branch, pushed with its history intact, so commit hashes are the same in both.

The packages keep their names. npm identifies a package by its name alone - the
repository is only a link in `package.json` - so both repositories publish to
the same `@beatoz/*` packages, and two rules keep them from colliding:

- This repository publishes `2.x` and later. The v1 repository publishes `1.x`
  only.
- A `1.x` release is published with `npm publish --tag v1`. A plain
  `npm publish` moves `latest` to whatever was just published, and a v1 patch
  released that way would send every new install back to v1.

Under [Support](#support) there are no v1 releases planned. The second rule is
for the case where one is made anyway.

## Reviewing this policy

Counting a type change as breaking costs us a major for every input we narrow.
Some libraries avoid that by releasing type changes as patches; viem does, and
asks its users to pin an exact version instead. We keep the strict rule for
two reasons. Our packages depend on each other through caret ranges, so a type
change released as a patch would break this repository first. And we are not
in a position to ask our users to pin exact versions.

Look at it again if one of these happens:

- Majors come so often that the number no longer warns anyone, say four in a
  year.
- Downloads change enough to matter. At the time of writing the packages see
  about fifty installs a week, most of them automated.
- Internal dependencies stop using caret ranges.
