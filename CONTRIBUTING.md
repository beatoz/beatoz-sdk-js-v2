# Contributing

This is the JavaScript SDK for the BEATOZ chain: thirteen `@beatoz/*` packages
in one repository. The chain's node, [beatoz-go](https://github.com/beatoz/beatoz-go),
is the reference for everything here - what it accepts, rejects and encodes is
what the SDK must match.

- Reporting a vulnerability: [SECURITY.md](./SECURITY.md) - not an issue

## Before you start

- **One problem per pull request.** A second bug found along the way, even in
  the same file or with the same root cause, gets its own issue and pull
  request. Combine two fixes only when one cannot work without the other.
- **Open an issue before changing public API.** Anything exported from a
  package - functions, types, errors - is a compatibility promise
  ([the release policy](./guides/release.md) says what counts as breaking).
  Agree on the change before writing it.
- **Check the node, not memory.** When a change touches transactions, signing or
  encoding, read what beatoz-go does and verify against a running node.

## Guides

The rules are in [`guides/`](./guides), one file per topic:

- [Development](./guides/development.md): setup, build, tests, the test nodes
- [Commit messages](./guides/commits.md)
- [Pull requests](./guides/pull-requests.md)
- [CI](./guides/ci.md): what each workflow checks
- [Branches](./guides/branches.md): `dev`, `main` and releases
- [Issues](./guides/issues.md)
- [Versioning and release policy](./guides/release.md)
