# BEATOZ JavaScript SDK

JavaScript and TypeScript SDK for the BEATOZ blockchain: query a node, sign and
send transactions, deploy and call contracts, and subscribe to blocks.

```bash
npm install @beatoz/web3
```

## Usage

```js
import { Web3, utils } from '@beatoz/web3';

const web3 = new Web3('https://rpc-testnet0.beatoz.io');

// Read the chain
const { value } = await web3.beatoz.getAccount('0x0000000000000000000000000000000000000001');
console.log(utils.fromWei(value.balance, 'beatoz'));

// Send: the sender's key goes in the wallet; the nonce, gas and gas price
// are filled in from the chain.
const sender = web3.beatoz.accounts.wallet.add(process.env.PRIVATE_KEY).get(0);
await web3.beatoz.transfer({
    from: sender.address,
    to: '0x0000000000000000000000000000000000000001',
    amount: utils.toWei('1', 'beatoz'),
});

// Contracts
const { contract: token } = await new web3.beatoz.Contract(abi)
    .deploy({ bytecode, args: ['Token', 'TKN'] })
    .send({ from: sender.address, gas: 10_000_000 });
console.log(await token.methods.balanceOf(sender.address).call());
await token.methods
    .transfer('0x0000000000000000000000000000000000000001', '1')
    .send({ from: sender.address, gas: 200_000 });
```

`web3.beatoz` also sends `delegate`, `undelegate` and `withdrawReward`, reads
blocks, transactions and chain values, and subscribes to new blocks and
transactions over a `ws://` URL.

- **[Documentation](docs/README.md)**: getting started, accounts and signing,
  sending transactions, contracts, reading the chain, subscriptions, errors.
- **[Migrating from 1.x](MIGRATION.md)**: what to change, in order.
- Every function is documented in its source (TSDoc), which your editor shows,
  and each package's `CHANGELOG.md` records what changed and why.

### In a browser

`@beatoz/web3` ships a bundle that sets one global, `BeatozWeb3`, holding the
same names an `import` from the package gives:

```html
<script src="https://unpkg.com/@beatoz/web3@2/dist/web3.min.js"></script>
<script>
    const { Web3 } = BeatozWeb3;
    const web3 = new Web3('https://rpc-testnet0.beatoz.io');
</script>
```

Pin an exact version in production (`@beatoz/web3@2.0.0`).
`@beatoz/web3-validator` ships `dist/web3-validator.min.js` the same way, as
`BeatozWeb3Validator`.

## Requirements

- Node.js 22.22.2 or later. The packages are ES modules; `require()` works too,
  as Node 22.12 and later can load ES modules.
- TypeScript 5.8 or later, if you use TypeScript.

## Packages

`@beatoz/web3` includes the others; install one on its own only to use it
without the rest.

| Package                                                       |                                                    |
| ------------------------------------------------------------- | -------------------------------------------------- |
| [`@beatoz/web3`](packages/web3)                               | The SDK: `new Web3(url)` and `web3.beatoz`         |
| [`@beatoz/web3-methods`](packages/web3-methods)               | The `web3.beatoz` methods                          |
| [`@beatoz/web3-rpc`](packages/web3-rpc)                       | Typed requests for the node's JSON-RPC routes      |
| [`@beatoz/web3-contract`](packages/web3-contract)             | Contract deploy, call and send                     |
| [`@beatoz/web3-accounts`](packages/web3-accounts)             | Accounts, wallet, transaction builders and signing |
| [`@beatoz/web3-abi`](packages/web3-abi)                       | ABI encoding and decoding                          |
| [`@beatoz/web3-core`](packages/web3-core)                     | Context and request manager                        |
| [`@beatoz/web3-providers-http`](packages/web3-providers-http) | HTTP provider                                      |
| [`@beatoz/web3-providers-ws`](packages/web3-providers-ws)     | WebSocket provider, with subscriptions             |
| [`@beatoz/web3-types`](packages/web3-types)                   | Types and response decoders                        |
| [`@beatoz/web3-utils`](packages/web3-utils)                   | Units, hashing and hex helpers                     |
| [`@beatoz/web3-validator`](packages/web3-validator)           | Validation against ABI types                       |
| [`@beatoz/web3-errors`](packages/web3-errors)                 | Error classes                                      |

## Building from source

```bash
git clone https://github.com/beatoz/beatoz-sdk-js-v2.git
cd beatoz-sdk-js-v2
yarn install --frozen-lockfile
yarn build
```

Node.js 22.22.2 or later and Yarn 1. [`guides/development.md`](guides/development.md)
covers tests, the local test node and regenerating the transaction proto.

Version 1.x is developed in [beatoz-sdk-js](https://github.com/beatoz/beatoz-sdk-js);
its [GitBook](https://beatoz.gitbook.io/beatoz-sdk-js/docs-en) documents 1.x and
does not match 2.0.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [`guides/`](./guides) for development, commit, issue and pull request rules, [the release policy](./guides/release.md) for versioning, and [SECURITY.md](./SECURITY.md) for reporting a vulnerability.

## License

```
Copyright 2023 All BEATOZ Developers

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
