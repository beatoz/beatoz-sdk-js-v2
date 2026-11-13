# Commit messages

```
<type>(<scope>): <subject>

<body>

<footer>
```

A message records what was wrong and why the change is the fix. History is
read long after the pull request is forgotten, so it has to stand on its own.

CI checks every commit in a pull request against these rules with
commitlint; the checks are in
[`commitlint.config.mjs`](../commitlint.config.mjs).

## Type

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

## Scope

Optional. When the change belongs to one package, name it without the `web3-`
prefix: `accounts`, `rpc`, `providers-ws`, and `web3` for the `@beatoz/web3`
package itself. Separate several with a comma: `fix(core,providers-ws): ...`.
Leave it out for changes that span the repository.

## Subject

- Imperative, present tense: "add", not "added" or "adds".
- Lowercase first letter, except for names written as they are in code.
- No period at the end.
- 50 characters or less where possible, never more than 72.

## Body

Required for `feat` and `fix`, and for anything whose reason is not obvious
from the subject. Say what was wrong, what the change does about it, and how it
was verified. Separate it from the subject with a blank line; without one, Git
reads the first body line as part of the subject. Wrap at 72 columns.

## Breaking changes

Mark them with `!` before the colon, and say in the body what a user has to
change:

```
feat!: validate amount and gasPrice in every transaction builder

...
```

The same change also gets a `**BREAKING:**` entry in the changelog
(see [Pull requests](./pull-requests.md)).

## References

Put them at the end of the body as trailers, one per line:

```
Fixes: #123
Refs: #120
```

`Refs:` only links the issue. `Fixes:` closes it when the commit reaches `dev`,
the default branch.

## Reverts

Use `git revert <hash>` and add why the commit is being reverted. The generated
`Revert "..."` subject may run past 72 characters; that is fine.

## Attribution

Commits name the people who wrote them. They do not carry `Co-Authored-By`
trailers for tools.
