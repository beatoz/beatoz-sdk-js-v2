# Branches

| Branch | What it holds | How it changes |
| --- | --- | --- |
| `dev` | The default branch: work towards the next release | Pull requests, merged by rebasing |
| `main` | What `dev` was at the last release | Fast-forwarded to `dev` when releasing |

Rulesets on both branches enforce this: changes arrive through a pull request
approved by a code owner and passing the CI checks, `dev` accepts only rebase
merges and `main` only merge commits, and neither can be force-pushed or
deleted. Repository admins bypass these rules, except the
[required checks](./ci.md#required-checks), which apply to everyone.

`main` moves only when a release is made, so it always holds what was last
published. It moves by fast-forward, so that it holds exactly the commits on
`dev`, with the same hashes - changelogs, issues and work logs refer to
commits by hash. An admin opens a pull request from `dev` to `main` as the
record. On top of the checks every pull request gets, it runs the
[release checks](./ci.md#release-checks). When all of them pass, the admin
pushes:

```bash
git push origin <dev commit>:main
```

GitHub marks the pull request merged when its commits reach `main`. Do not use
the merge buttons on that pull request: "Rebase and merge" copies every commit
with a new hash, and "Create a merge commit" leaves `main` one commit ahead of
`dev`.

The admin bypass exists for this push. It also lets an admin push anything
else to either branch; that is not how the branches are used.

The push still has to pass the required checks: GitHub refuses it unless
the commit has every check of `ci.yml` and every release check green.
