# Development

Node.js 22.22.2 or later (`.nvmrc` has the version CI uses), and Yarn 1.

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

## Regenerating the transaction proto

`packages/web3-accounts/src/tx/trx_pb.ts` is generated from `trx_pb.proto`,
which is a verbatim copy of beatoz-go's `protos/trx.proto`: the chain owns the
wire format, so copy it, never edit or renumber it. Regenerate only when the
chain's file changes. The tools are not dependencies; `npx` fetches the
versions that produced the current file:

```bash
cd packages/web3-accounts/src/tx
cat > /tmp/buf.gen.yaml <<'YAML'
version: v2
plugins:
  - local: protoc-gen-ts_proto
    out: .
    opt: [esModuleInterop=true, forceLong=long, importSuffix=.js]
YAML
npx -y -p @bufbuild/buf@1.73.0 -p ts-proto@1.181.2 -- \
  buf generate --template /tmp/buf.gen.yaml trx_pb.proto
npx prettier --write trx_pb.ts
```

Then make the two edits by hand that keep the package's API:

1. Delete the generated `TrxProto` interface and import it instead:
   `import { TrxProto } from '@beatoz/web3-types';`
2. Rename the generated `TrxProto` object to `TrxProtoUtils` (its declaration
   and the `TrxProto.fromPartial` call in `create`).

With an unchanged `.proto`, the result is identical to the committed file.
Check the wire bytes before committing a changed one: encode transactions of
every type with the old and new code and compare (see 066fd85).
