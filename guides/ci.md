# CI

Two workflows check the repository. Both run on GitHub Actions and need no
secrets: the test node is a public image pinned by digest.

## Every pull request

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) checks every pull
request: the commit messages (`npx commitlint`, see [Commit messages](./commits.md)),
`yarn build`, `npx eslint .`, `yarn test`, what the build hands to users
(`node scripts/check-dist.mjs`), and `yarn test:integration` against the test
node. A draft runs only the first four; mark it ready for review to run the
rest. It also runs on every push to `dev`.

| Check | What it runs |
| --- | --- |
| `Commit messages` | commitlint over the pull request's commits |
| `Build, lint, unit tests` | build, ESLint, unit tests, `check-dist.mjs` (not on drafts) |
| `Integration tests` | the test node and `yarn test:integration` (not on drafts) |

## Release checks

[`.github/workflows/release-checks.yml`](../.github/workflows/release-checks.yml)
runs on pull requests to `main`, on top of the checks every pull request gets:
that it comes from `dev`, and the packages as npm would publish them -
installed outside the repository on Node 22.22.2, 24 and 26 and TypeScript
5.7.3, 6.0.3 and 7.0.2, each package alone, publint - and the reward paths
against a node.

| Check | What it runs |
| --- | --- |
| `From dev` | the pull request comes from `dev` in this repository |
| `Pack` | build, `npm pack`, publint (`scripts/check-packed.mjs`) |
| `Node 22.22.2`, `Node 24`, `Node 26` | install the packed packages in an empty project and load, sign and type-check them |
| `TypeScript 5.7.3`, `TypeScript 6.0.3`, `TypeScript 7.0.2` | the same type check with each TypeScript |
| `Each package alone` | each package installed with only the `@beatoz` packages it declares |
| `Reward withdrawal` | the reward node and `yarn test:reward` |

The release checks also run on every push to `dev`, so a problem shows up when
it lands rather than at release. There a failure blocks nothing; GitHub emails
whoever pushed.

## Required checks

The rulesets `dev checks` and `main checks` make checks required by name, so
renaming a job or changing a matrix value means updating the ruleset in the
same change.

- `dev`: the three checks of `ci.yml`.
- `main`: the three checks of `ci.yml` and every release check.

These rulesets have no bypass: a pull request with a failing or missing
required check cannot be merged, and a push to the branch is refused, for
admins too. A job skipped by its condition counts as passed, so the push of a
`dev` commit to `main` passes `Commit messages` and `From dev`, which run only
on pull requests. The other rules on the branches (review, merge method,
force push, deletion) are in separate rulesets that admins bypass.
