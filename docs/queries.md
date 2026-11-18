# Reading the chain

Every query is a method on `web3.beatoz` and works over HTTP or WebSocket.
Heights are numbers or decimal strings. Amounts and powers come back as
decimal strings, since they exceed what a JavaScript number holds.

## Node and chain

```js
const status = await web3.beatoz.status(); // node_info, sync_info, validator_info
const chainId = (await web3.beatoz.genesis()).chain_id;
const { value: rule } = await web3.beatoz.rule(); // gasPrice, minTrxGas, ... (governance parameters)
await web3.beatoz.health(); // throws if the node is down
```

## Blocks

```js
const latest = await web3.beatoz.block(); // the latest block
const block = await web3.beatoz.block(100); // { block_id, block: { header, data: { txs } } }
const byHash = await web3.beatoz.blockByHash(block.block_id.hash);
const results = await web3.beatoz.blockResults(100); // each transaction's result and events
const headers = await web3.beatoz.blockchain(90, 100);
const found = await web3.beatoz.blockSearch('block.height > 100', 1, 10, 'desc');
```

## Transactions

```js
const tx = await web3.beatoz.tx(hash); // { height, tx_result: { code, log, events } }
const page = await web3.beatoz.txSearch(`tx.height=${height}`, false, 1, 30, 'asc');
const waited = await web3.beatoz.waitForTx(hash); // waits until indexed
```

`tx(hash)` throws `RpcRequestError` while the node has not indexed the
transaction yet; `waitForTx` retries until it has
([transactions.md](transactions.md#send-modes)).

A transaction's bytes come as base64, in `tx.tx` and in a block's
`block.data.txs`. `decodeTransaction` reads them:

```js
import { BytesUint8Array, TrxProtoBuilder } from '@beatoz/web3';

const decoded = TrxProtoBuilder.decodeTransaction(BytesUint8Array.b64ToBytes(tx.tx));
// { hash, type, from, to, amount, nonce, gas, gasPrice, payload, sig, ... }
```

## Accounts

```js
const { value } = await web3.beatoz.getAccount(address);
// { address, nonce, balance, name?, docURL?, code? }
```

`nonce` is a number; `balance` a decimal string in the smallest unit; `code`
is set for a contract.

## Staking and rewards

```js
const validators = await web3.beatoz.validators(); // the current validator set
const delegatee = await web3.beatoz.delegatee(validatorAddress);
// value: { address, selfPower, totalPower, slashedPower, delegators, ... }

const stakes = await web3.beatoz.stakes(address);
// value: [{ owner, to, txhash, startHeight, power }], empty with no stake

const reward = await web3.beatoz.reward(address);
// value: { cumulated, ... }: cumulated is what withdrawReward can take
```

## Chain-wide values

```js
await web3.beatoz.totalSupply(); // { height, value }: all coins, smallest unit
await web3.beatoz.totalTxFee(); // fees paid so far
await web3.beatoz.txCount(); // transactions run so far
await web3.beatoz.totalPower(); // power staked to every validator
await web3.beatoz.votingPower(); // power of the validators in the set
```

## At a past height

`getAccount`, `delegatee`, `stakes`, `reward`, `rule`, `totalSupply`,
`totalPower` and `votingPower` take a height as their last argument and answer
as of that block:

```js
const then = await web3.beatoz.getAccount(address, 1000);
console.log(then.height, then.value.balance);
```

`totalTxFee` and `txCount` answer only for the latest block.

## Calling the EVM without a transaction

```js
const res = await web3.beatoz.vmCall(from, to, 0, data); // height 0: the latest
console.log(res.value.returnData, res.value.usedGas); // hex, decimal string
const estimate = await web3.beatoz.vmEstimateGas(from, to, data);
```

A contract's methods do this for you ([contracts.md](contracts.md)).
