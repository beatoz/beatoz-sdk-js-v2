# @beatoz/web3

JavaScript SDK for the BEATOZ blockchain: query a node, sign and send transactions, call contracts.

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
    .send({ from: sender.address, gas: 100_000 });
```

`web3.beatoz` also sends `delegate`, `undelegate` and `withdrawReward`, reads
blocks, transactions and chain values, and subscribes to new blocks and
transactions over a `ws://` URL. The methods are documented in the sources
(TSDoc), which your editor shows.

To send several transactions from one account before the next block, set
`web3.beatoz.nonceManager = new NonceManager()` (exported from this package).

### In a browser

`dist/web3.min.js` sets one global, `BeatozWeb3`, holding what an `import`
from this package gives:

```html
<script src="https://unpkg.com/@beatoz/web3@2/dist/web3.min.js"></script>
<script>
    const { Web3 } = BeatozWeb3;
    const web3 = new Web3('https://rpc-testnet0.beatoz.io');
</script>
```

## Requirements

- Node.js 22.22.2 or later. The package is an ES module; `require()` works too,
  as Node 22.12 and later can load ES modules.
- TypeScript 5.8 or later, if you use TypeScript.

## Links

- [Source](https://github.com/beatoz/beatoz-sdk-js-v2/tree/main/packages/web3)
- [Changelog](https://github.com/beatoz/beatoz-sdk-js-v2/blob/main/packages/web3/CHANGELOG.md): what changed, and how to move from 1.x
- [Issues](https://github.com/beatoz/beatoz-sdk-js-v2/issues)

## License

Apache-2.0
