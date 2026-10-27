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
"engines": { "node": ">=22.13.0" },
"peerDependencies": { "typescript": ">=5.7" },
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

Two things set that number, and the higher one wins:

- `require(esm)`, which is why these packages can ship ESM only, landed in
  **22.12**.
- ESLint 10 declares `^20.19.0 || ^22.13.0 || >=24`, so it starts at **22.13**.

22.13 is one patch line above what the runtime needs. The window it gives up -
22.12.0 through 22.12.x, December 2024 to January 2025 - was superseded before
this was written, and taking it keeps the repository from having to explain why
its own floor does not satisfy its own toolchain.

The floor is measured, not chosen. It started at 5.4, picked as a round number
below where the declarations happened to parse. That was wrong: these packages
are built with TypeScript 6.0.3 and the emitted `.d.ts` uses
`Uint8Array<ArrayBufferLike>`, which only exists from 5.7, so a consumer on 5.4
hit `error TS2315: Type 'Uint8Array' is not generic`. Raising the number was
not a decision to support less - it was correcting a claim that had never been
checked.

Measure it the way a consumer meets it: pack the packages, install them into an
empty project, and type-check an import of each under the candidate compiler
with `skipLibCheck: false`. That last setting is the point. With it on - the
default most projects carry, including all four of ours - TypeScript skips
declarations in `node_modules` entirely and the floor appears to hold at any
version.

Nothing checks this automatically yet. Until CI does, a change that needs a
newer compiler will pass review and reach a consumer before anyone notices.

### Node types stay out of the published declarations

No `.d.ts` we publish may refer to `NodeJS.*`, or import from `events`, `net`,
`fs`, `stream` or any other Node built-in. A consumer running in a browser
should not have to install `@types/node` to read our types, and on TypeScript 6
- which no longer includes `@types/*` packages automatically - they would also
have to add `"types": ["node"]` to their own `tsconfig.json`.

Writing Node types in the sources is fine; `tsconfig.base.json` sets
`"types": ["node"]` for exactly that. The rule is about what reaches `lib/types`.
Private fields and local variables are erased on the way out and do not count.

This cannot be enforced by reading the sources. `removeAllListeners()` was
declared with no return type, TypeScript inferred one from the body, and
`EventEmitter<[never]>` appeared in the published declaration without anyone
writing it. Check the emitted files:

```console
$ grep -rn "NodeJS\.\|from 'events'" packages/*/lib/types
```

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

## Experimental APIs

An API prefixed `experimental_` may change or be removed in any release,
including a patch.

An API that stays experimental across two minor releases is either promoted or
removed.

If an experimental API cannot work yet because the chain does not implement what
it needs, it throws an error naming the missing capability. The error states
that the SDK does not support it, not that the call was wrong.

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

### Where this comes from

[ethereumjs-monorepo](https://github.com/ethereumjs/ethereumjs-monorepo) runs
exactly this way. On 2026-08-21 it published `@ethereumjs/util`, `rlp`,
`common`, `tx`, `block` and `vm` all at `10.1.3` within eleven minutes, while
`@ethereumjs/trie` has sat at `6.2.1` since 2024. The second fact is only
possible under independent versioning; the first is the operating rule above.

We do not take release practice from [web3.js](https://github.com/web3/web3.js),
which this SDK is forked from. Its last stable release was `4.16.0` on
2024-12-03. Its layout still tells us what our own code was meant to look like,
and the `exports` and `files` fields here were restored from it, but a
repository that has not shipped in two years is not evidence of how to run
releases.

## Changelogs

Every package has a `CHANGELOG.md` in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. The root
`CHANGELOG.md` aggregates them.

Entries are written in the pull request that makes the change, under
`## [Unreleased]`. A change with no entry is not released.

Sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
Breaking entries start with `**BREAKING:**` and say what the consumer has to do.

## Cutting a release

1. `yarn build`, `yarn test` and `npx eslint .` pass.
2. Move each `## [Unreleased]` section under the new version and date.
3. Run `lerna version`. It proposes a bump per package from the commit messages;
   override it where this document disagrees. It cannot see whether a type
   widened or narrowed.

   For a release where every package changed, give them all the same number -
   `lerna version 2.0.0` rather than the per-package prompt. Leave a package out
   only when it genuinely did not change.
4. Publish to the `next` dist-tag. `latest` keeps pointing at the previous
   release. A plain `npm publish` moves `latest` itself, so the tag is not
   optional either.
5. Install from `next` in the projects inside this organization and check them.
6. Move `latest` with `npm dist-tag add`.

Step 5 is not optional for a major release. Moving `latest` is the point that
cannot be undone: reverting the tag does not reach anyone who installed while it
was moved, and their lockfile now pins the release. A major is a breaking change
by definition, so what step 5 checks is not whether it breaks anything but
whether it breaks only what was intended.

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

Treating a type change as breaking is strict, and the cost lands on us: every
input we narrow is a major. Libraries that exempt types from semver do so to
avoid exactly that.

Two things make the strict rule right here, and neither is settled by shipping
2.0. Our own packages depend on each other through caret ranges, so a type
change released as a patch reaches this repository before it reaches anyone
else. And asking consumers to pin an exact version, which is what the lenient
policy requires of them, is not something this SDK is in a position to ask.

Revisit when one of these holds, not on a date:

- Majors have become frequent enough that the number stops carrying a warning.
  Four majors in a year means the rule does not match how the code actually
  changes.
- The download figures settle somewhere that changes the calculation. At the
  time of writing the packages see about fifty installs a week, most of it
  automation, which makes a looser policy cheap to try.
- Internal dependencies stop using caret ranges. That removes the first
  constraint, and the lenient policy becomes available in a way it is not now.
