# Subscriptions

The node pushes new blocks and transactions over WebSocket. Connect with a
`ws://` or `wss://` URL:

```js
const web3 = new Web3('wss://rpc-testnet0.beatoz.io/websocket');
```

A subscription over HTTP throws `InvalidInputError`.

## New blocks

```js
const blocks = web3.beatoz.subscribeNewBlock();
const subscription = blocks.subscribe({
    next: (event) => console.log(event.data.value.block.header.height),
    error: (e) => console.error(e),
    complete: () => {},
});

// later
subscription.unsubscribe();
```

Each subscription is a stream (`xstream`): `subscribe` or `addListener` with
`next`, `error` and `complete`. Unsubscribing the last listener ends the
subscription on the node. `subscribeNewBlockHeader()` gives headers only.

## Transactions

`subscribeTx(query)` takes a query on transaction events, joined to
`tm.event='Tx'`:

```js
const sender = '07BB0762BEDA139A46BD0E1665BD62D913383FD3';
const txs = web3.beatoz.subscribeTx(`tx.sender='${sender}'`);
txs.subscribe({
    next: (event) => console.log(event.data.value.TxResult.height),
    error: console.error,
    complete: () => {},
});
```

Without a query it delivers every transaction. `subscribe(query)` takes any
event query and gives untyped events.

## When the connection drops

A subscription ends with `SocketClosedError` in `error` when the connection
drops, and a request waiting for its answer fails with it. They are not
resumed or resent on the next connection: subscribe again, and look up a
transaction you sent (`web3.beatoz.tx(hash)`) before sending it again.

`disconnect()` closes the connection for good, and lets a Node process exit:

```js
web3.getProvider().disconnect();
```
