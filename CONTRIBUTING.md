# Contributing

This is the JavaScript SDK for the BEATOZ chain: thirteen `@beatoz/*` packages
in one repository. The chain's node, [beatoz-go](https://github.com/beatoz/beatoz-go),
is the reference for everything here - what it accepts, rejects and encodes is
what the SDK must match.

- Versioning and releases: [RELEASE.md](./RELEASE.md)
- Reporting a vulnerability: [SECURITY.md](./SECURITY.md) - not an issue

## Before you start

- **One problem per pull request.** A second bug found along the way, even in
  the same file or with the same root cause, gets its own issue and pull
  request. Combine two fixes only when one cannot work without the other.
- **Open an issue before changing public API.** Anything exported from a
  package - functions, types, errors - is a compatibility promise
  ([RELEASE.md](./RELEASE.md) says what counts as breaking). Agree on the change
  before writing it.
- **Check the node, not memory.** When a change touches transactions, signing or
  encoding, read what beatoz-go does and verify against a running node.

## Development

Node.js 22.13 or later, and Yarn 1.

```bash
yarn install
yarn build
yarn test                 # unit tests, no node needed
npx eslint .
```

Integration tests talk to a node. `yarn node:start` runs the published image,
pinned by digest, and writes the `.env` the tests read:

```bash
yarn node:start
yarn test:integration
```

The reward tests need a second node whose genesis issues staking rewards every
20 blocks instead of every week of blocks:

```bash
yarn node:start:reward
yarn test:reward
```

`yarn node:stop` and `yarn node:stop:reward` remove them.

## Commit messages

```
<type>(<scope>): <subject>

<body>

<footer>
```

A message records what was wrong and why the change is the fix. History is
read long after the pull request is forgotten, so it has to stand on its own.

### Type

| Type | Use for |
| --- | --- |
| `feat` | A new capability for SDK users |
| `fix` | A bug fix for SDK users |
| `perf` | A change that makes something faster, with no other effect |
| `refactor` | A change to code that neither fixes a bug nor adds a feature |
| `test` | Tests only |
| `docs` | Documentation only |
| `build` | Build, packaging or dependencies |
| `ci` | CI configuration |
| `chore` | Anything else that does not reach a published package |
| `revert` | Reverting an earlier commit |

### Scope

Optional. When the change belongs to one package, name it without the `web3-`
prefix: `accounts`, `rpc`, `providers-ws`, and `web3` for the `@beatoz/web3`
package itself. Separate several with a comma: `fix(core,providers-ws): ...`.
Leave it out for changes that span the repository.

### Subject

- Imperative, present tense: "add", not "added" or "adds".
- Lowercase first letter, except for names written as they are in code.
- No period at the end.
- 50 characters or less where possible, never more than 72.

### Body

Required for `feat` and `fix`, and for anything whose reason is not obvious
from the subject. Say what was wrong, what the change does about it, and how it
was verified. Wrap at 72 columns.

### Breaking changes

Mark them with `!` before the colon, and say in the body what a user has to
change:

```
feat!: validate amount and gasPrice in every transaction builder

...
```

The same change also gets a `**BREAKING:**` entry in the changelog
(see [Pull requests](#pull-requests)).

### References

Put them at the end of the body as trailers, one per line:

```
Fixes: #123
Refs: #120
```

`Refs:` only links the issue. `Fixes:` closes it, but only when the commit
reaches `main`, the default branch: GitHub ignores closing keywords on the way
into `dev`, so the issue stays open until the change is released.

### Reverts

Use `git revert <hash>` and add why the commit is being reverted. The generated
`Revert "..."` subject may run past 72 characters; that is fine.

### Attribution

Commits name the people who wrote them. They do not carry `Co-Authored-By`
trailers for tools.

## Pull requests

Open them against `dev`.

The template asks you to tick what you did. **Tick only what you actually did**,
and for anything left unticked say why. An unticked box with a reason is useful;
a ticked box that is not true is worse than none.

What a pull request needs:

- **A test that fails without the change and passes with it.** Check it: undo
  the fix, see the test fail, put the fix back.
- **A run against a node** when the change touches transactions, signing,
  encoding or RPC: `yarn test:integration`, and `yarn test:reward` for reward
  and withdraw paths.
- **A changelog entry** under `## [Unreleased]` in the root `CHANGELOG.md` and in
  the changelog of every package it changes. A change with no entry is not
  released. Breaking entries start with `**BREAKING:**` and say what the user
  has to do.
- **Commits that follow the rules above.** Pull requests are merged by
  rebasing, not squashing, so every commit lands on the branch as written. Fold
  review fixes into the commits they belong to (`git commit --fixup`,
  `git rebase -i --autosquash`) before merging.

A pull request needs an approving review from a code owner
([`.github/CODEOWNERS`](./.github/CODEOWNERS)). Anyone may review, but only a
code owner's approval lets it merge, and a new push to the pull request
dismisses an earlier approval.

## Branches

| Branch | What it holds | How it changes |
| --- | --- | --- |
| `dev` | Work in progress towards the next release | Pull requests, merged by rebasing |
| `main` | What `dev` was at the last promotion | Fast-forwarded to `dev` |

Rulesets on both branches enforce this: changes arrive through a pull request
approved by a code owner, `dev` accepts only rebase merges and `main` only
merge commits, and neither can be force-pushed or deleted. Repository admins
bypass the rulesets.

`main` moves only by fast-forward, so that it holds exactly the commits on
`dev`, with the same hashes - changelogs, issues and work logs refer to
commits by hash. An admin opens a pull request from `dev` to `main` as the
record, then pushes:

```bash
git push origin <dev commit>:main
```

GitHub marks the pull request merged when its commits reach `main`, and the
`Fixes:` trailers close their issues then. Do not use the merge buttons on that
pull request: "Rebase and merge" copies every commit with a new hash, and
"Create a merge commit" leaves `main` one commit ahead of `dev`.

The admin bypass exists for this push. It also lets an admin push anything
else to either branch; that is not how the branches are used.

Nothing enforces that a pull request into `main` comes from `dev`. A check for
it belongs with CI, which does not exist yet.

## Issues

Use the forms: bug report, feature request or documentation. The bug form asks
for the package versions, Node.js version and a minimal reproduction; without a
reproduction a bug usually cannot be acted on.

Do not report security vulnerabilities in issues. See [SECURITY.md](./SECURITY.md).
