# Guides

How this repository is worked on. [CONTRIBUTING.md](../CONTRIBUTING.md) is the
starting point.

| Guide | What it covers |
| --- | --- |
| [Development](./development.md) | Setup, build, tests, the test nodes |
| [Commit messages](./commits.md) | Type, scope, subject, body, breaking changes, references |
| [Pull requests](./pull-requests.md) | What a pull request needs, review, merging |
| [CI](./ci.md) | What each workflow checks, and the required checks |
| [Branches](./branches.md) | `dev` and `main`, and how `main` moves at a release |
| [Issues](./issues.md) | The issue forms |
| [Versioning and release policy](./release.md) | What counts as major, minor and patch, and how releases are cut |

Where the rules are enforced, the guides describe them and the tools check
them: [`commitlint.config.mjs`](../commitlint.config.mjs) for commit messages,
[`.github/workflows/`](../.github/workflows) for CI, and the branch rulesets in
the repository settings.

## Keeping them current

A pull request that changes a rule - a CI check, a commit check, the branch
model, the release process - updates the guide for it in the same pull
request.
