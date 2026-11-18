# Sending transactions

`web3.beatoz` sends the chain's own transactions in one call. The sender must
be an account in the wallet ([accounts.md](accounts.md#the-wallet)).

```js
const sender = web3.beatoz.accounts.wallet.add(process.env.PRIVATE_KEY).get(0);
```

| Method                             | Does                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| `transfer({ from, to, amount })`   | sends `amount` to `to`                                |
| `delegate({ from, to, amount })`   | stakes `amount` to the validator `to`                 |
| `undelegate({ from, to, txHash })` | takes back the stake made by the transaction `txHash` |
| `withdrawReward({ from, amount })` | moves `amount` of `from`'s reward to its balance      |

Amounts are decimal strings in the smallest unit; `utils.toWei('1', 'beatoz')`
gives one BEATOZ.

```js
const res = await web3.beatoz.transfer({
    from: sender.address,
    to: '0x0000000000000000000000000000000000000001',
    amount: utils.toWei('1', 'beatoz'),
});

const validator = (await web3.beatoz.validators()).validators[0].address;
const stake = await web3.beatoz.delegate({
    from: sender.address,
    to: validator,
    amount: utils.toWei('1000', 'beatoz'),
});
await web3.beatoz.undelegate({ from: sender.address, to: validator, txHash: stake.hash });
```

## What is filled in

Each of these can be given in the second argument; whatever is left out comes
from the chain.

| Option     | Default                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `nonce`    | the nonce manager's, or the account's nonce on the node                                                  |
| `gas`      | the chain's `minTrxGas`; a native transaction is charged all the gas it carries, so more only costs more |
| `gasPrice` | the chain's `gasPrice`                                                                                   |
| `sendMode` | `'commit'`                                                                                               |
| `scheme`   | `'v0'` ([signature schemes](accounts.md#signature-schemes))                                              |

## Send modes

| `sendMode`           | Returns when                         | Result                                   |
| -------------------- | ------------------------------------ | ---------------------------------------- |
| `'commit'` (default) | the transaction is in a block        | `{ hash, height, check_tx, deliver_tx }` |
| `'sync'`             | the node has checked it (`check_tx`) | `{ hash, code, log, ... }`               |
| `'async'`            | the node has received it             | `{ hash }`                               |

A `sync` or `async` send returns before the block. To get the result, wait for
it:

```js
const { hash } = await web3.beatoz.transfer({ from, to, amount }, { sendMode: 'sync' });
const tx = await web3.beatoz.waitForTx(hash); // { height, tx_result, ... }
if (tx.tx_result.code !== 0) console.log(tx.tx_result.log);
```

`waitForTx(hash, { timeoutMs, intervalMs })` looks the transaction up until
the node has indexed it, 30 s at most by default, and throws `TimeoutError`
after that. Being indexed is not success: check `tx_result.code`.

## Several transactions before the next block

The node reports an account's nonce as of the last block. Two `sync` sends
before the next block both read the same nonce, and the node refuses the
second with `invalid nonce`. A `NonceManager` counts on from the first:

```js
import { NonceManager } from '@beatoz/web3';

web3.beatoz.nonceManager = new NonceManager();

for (const to of recipients) {
    await web3.beatoz.transfer({ from: sender.address, to, amount: '1' }, { sendMode: 'sync' });
}
```

It reads the node once per address and then adds one per send; a failed send
makes it read the node again. It keeps the count in memory, so it does not
know about sends from another process or server with the same account. Contract
sends and deploys use it too.

## When a transaction fails

```js
import { TransactionFailedError } from '@beatoz/web3';

try {
    await web3.beatoz.transfer({ from, to, amount });
} catch (e) {
    if (e instanceof TransactionFailedError) {
        console.log(e.stage); // 'check_tx': refused, or 'deliver_tx': failed in the block
        console.log(e.code, e.log, e.hash);
    }
}
```

A refused transaction (`check_tx`) costs nothing and does not use the nonce.
One that fails in the block (`deliver_tx`) is charged and does.
