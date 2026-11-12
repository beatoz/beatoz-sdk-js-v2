# Pull requests

Open them against `dev`.

The template ([`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md))
asks you to tick what you did. **Tick only what you actually did**, and for
anything left unticked say why. An unticked box with a reason is useful; a
ticked box that is not true is worse than none.

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
- **Commits that follow [the commit rules](./commits.md).** Pull requests are
  merged by rebasing, not squashing, so every commit lands on the branch as
  written. Fold review fixes into the commits they belong to
  (`git commit --fixup`, `git rebase -i --autosquash`) before merging.

CI checks every pull request; [CI](./ci.md) lists what it runs.

A pull request needs an approving review from a code owner
([`.github/CODEOWNERS`](../.github/CODEOWNERS)). Anyone may review, but only a
code owner's approval lets it merge, and a new push to the pull request
dismisses an earlier approval.
