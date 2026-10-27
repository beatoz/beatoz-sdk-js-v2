<!--
One problem per pull request. See CONTRIBUTING.md.
Tick only what you actually did. For anything left unticked, say why on the same line.
-->

## What and why

<!-- What was wrong, and why this change is the fix. Link the issue: Fixes: #123 or Refs: #123 -->

## How it was verified

- [ ] A test that fails without this change and passes with it (undo the fix, see it fail, put it back)
- [ ] `yarn build`, `yarn test` and `npx eslint .` pass
- [ ] Ran against a node: `yarn test:integration`, and `yarn test:reward` for reward or withdraw paths <!-- needed when this touches transactions, signing, encoding or RPC -->

## Compatibility

- [ ] No change to anything a package exports
- [ ] Breaking: the commit is marked with `!`, and the changelog entry starts with `**BREAKING:**` and says what users have to change

## Release

- [ ] Changelog entries under `## [Unreleased]` in the root `CHANGELOG.md` and in each changed package
- [ ] Documentation updated, or not needed: <!-- say which -->
- [ ] Commits follow CONTRIBUTING.md, and review fixes are folded into the commits they belong to
