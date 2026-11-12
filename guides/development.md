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
