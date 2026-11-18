# Getting started

## Install

```bash
npm install @beatoz/web3
```

Node.js 22.22.2 or later. The package is an ES module; `require('@beatoz/web3')`
works too. TypeScript 5.8 or later, if you use TypeScript.

## Connect

```js
import { Web3 } from '@beatoz/web3';

const web3 = new Web3('https://rpc-testnet0.beatoz.io'); // HTTP
// const web3 = new Web3('wss://rpc-testnet0.beatoz.io/websocket'); // WebSocket
```

HTTP is enough for reading and sending. Subscriptions need WebSocket
([subscriptions.md](subscriptions.md)). A URL without `http(s)://` or
`ws(s)://` throws `InvalidInputError`.

## Read the chain

```js
import { utils } from '@beatoz/web3';

const status = await web3.beatoz.status();
console.log(status.node_info.network, status.sync_info.latest_block_height);

const { value } = await web3.beatoz.getAccount('0x0000000000000000000000000000000000000001');
console.log(utils.fromWei(value.balance, 'beatoz'), value.nonce);
```

Amounts are in the smallest unit, as decimal strings. `utils.fromWei` and
`utils.toWei` convert to and from `beatoz` (10^18 of the smallest unit).

## Send a transfer

Put the sender's private key in the wallet, then send. The SDK fills in the
nonce, gas, gas price and chain id, signs with the wallet account and waits
for the block.

```js
const sender = web3.beatoz.accounts.wallet.add(process.env.PRIVATE_KEY).get(0);

const res = await web3.beatoz.transfer({
    from: sender.address,
    to: '0x0000000000000000000000000000000000000001',
    amount: utils.toWei('1', 'beatoz'),
});
console.log(res.hash, res.height);
```

If the node refuses the transaction, or it fails in the block, `transfer`
throws `TransactionFailedError` with the node's reason
([transactions.md](transactions.md#when-a-transaction-fails)).

## In a browser

```html
<script src="https://unpkg.com/@beatoz/web3@2/dist/web3.min.js"></script>
<script>
    const { Web3 } = BeatozWeb3;
    const web3 = new Web3('https://rpc-testnet0.beatoz.io');
</script>
```

`BeatozWeb3` holds what `import ... from '@beatoz/web3'` gives. Pin an exact
version in production.
