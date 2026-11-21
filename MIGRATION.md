# Migrating from 1.x to 2.0

2.0 fixes many places where 1.x returned a wrong result without an error, and
removes what never worked. Most of the breaking changes show up as a compile
error or an exception at the line that needs changing. This guide lists them
in the order you are likely to meet them. Each package's `CHANGELOG.md` has the
full detail and the reasons.

- [1. Environment](#1-environment)
- [2. Renamed and removed](#2-renamed-and-removed)
- [3. Errors](#3-errors)
- [4. Contracts](#4-contracts)
- [5. Building and signing transactions](#5-building-and-signing-transactions)
- [6. Responses](#6-responses)
- [7. Providers](#7-providers)
- [8. New in 2.0](#8-new-in-20)

## 1. Environment

|                  | 1.x                   | 2.0                                         |
| ---------------- | --------------------- | ------------------------------------------- |
| Node.js          | declared 16.19        | **22.22.2** or later                        |
| TypeScript       | not declared          | **5.8** or later (optional peer dependency) |
| Module format    | CommonJS and ESM      | **ESM only**                                |
| Importable paths | anything under `lib/` | the package root only                       |

- `require('@beatoz/web3')` keeps working: Node 22.12 and later can `require()`
  an ES module.
- A deep import such as `@beatoz/web3-types/lib/commonjs/...` fails with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Import from the package root.
- In a browser, `@beatoz/web3/dist/web3.min.js` sets the global `BeatozWeb3`.

## 2. Renamed and removed

| 1.x                                                                                                                                | 2.0                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils.fromUtf8`, `utils.stringToHex`                                                                                              | `utils.utf8ToHex`                                                                                                                                                                 |
| `utils.hexToString`                                                                                                                | `utils.hexToUtf8`                                                                                                                                                                 |
| `utils.fromAscii` / `utils.toAscii`                                                                                                | `utils.asciiToHex` / `utils.hexToAscii`                                                                                                                                           |
| `utils.toDecimal` / `utils.fromDecimal`                                                                                            | `utils.hexToNumber` / `utils.numberToHex`                                                                                                                                         |
| `utils.leftPad` / `utils.rightPad`                                                                                                 | `utils.padLeft` / `utils.padRight`                                                                                                                                                |
| Unit names below one BEATOZ                                                                                                        | `wei`, `kwei`, `mwei`, `gwei`, `szabo`, `finney`; any other name throws                                                                                                           |
| `sendDeploy`, `web3.beatoz.contractAddrFromTx`                                                                                     | `new web3.beatoz.Contract(abi).deploy({ bytecode, args }).send({ from, gas })` ([§4](#4-contracts))                                                                               |
| `TrxProtoBuilder.signedRawTrxProto(tx, account)`                                                                                   | `account.signTransaction(tx, chainId).rawTransaction`                                                                                                                             |
| `BytesUint8Array.parse`, `fromWords`, `toWords`                                                                                    | `BytesUint8Array.fromHex`, `toHex`                                                                                                                                                |
| `web3.beatoz.proposals`, `TrxProtoBuilder.buildProposalTrx`, `buildVotingTrx`                                                      | none: validators make and vote on proposals with the BEATOZ wallet                                                                                                                |
| `web3.beatoz.broadcastEvidence`                                                                                                    | none: for validators and node operators                                                                                                                                           |
| `web3.beatoz.dumpConsensusState`, `consensusState`                                                                                 | none: ask the node's `dump_consensus_state` route directly                                                                                                                        |
| `Wallet.encrypt`, `decrypt`, `save`, `load`, `web3.accounts.decrypt`                                                               | none: they only threw. Keystore files hold ordinary secp256k1 keys, so ethers' `encryptKeystoreJson` / `decryptKeystoreJson` work for BEATOZ keys                                 |
| Ethereum-only types and schemas (`Uncles`, `Hardfork`, `AccessList`, `FeeHistory`, `blockSchema`, `transactionReceiptSchema`, ...) | none: BEATOZ has none of these                                                                                                                                                    |
| `Web3Subscription`, `LogsSubscription`, `ContractBoundEvent`                                                                       | `web3.beatoz.subscribe`, `subscribeNewBlock`, `subscribeTx` ([docs/subscriptions.md](docs/subscriptions.md))                                                                      |
| `JsonRpcSuccessResponse`                                                                                                           | `JsonRpcResponseWithResult<T>`                                                                                                                                                    |
| `NewBlockEvent`, `NewBlockHeaderEvent`                                                                                             | `Block`, `Header`                                                                                                                                                                 |
| `validator.validateJSONSchema` with any JSON schema keyword; the `Validate` type                                                   | `validateJSONSchema` takes `type`, `items`, `minItems`, `maxItems`, `format`, `required`, `properties` and `oneOf`, and throws `InvalidInputError` for others; `Validate` is gone |

## 3. Errors

Every error the SDK throws extends `BaseError` from `@beatoz/web3-errors`
(re-exported by `@beatoz/web3`). Tell them apart by class, not by code: the
numeric `ERR_*` codes and `innerError` are gone. `shortMessage` says what
failed, `details` why, and `cause` holds the original error.

| 1.x                                                                                                   | 2.0                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ResponseError` (`code` always 100); over WebSocket, an `Error` whose message held the JSON-RPC error | `RpcRequestError`, with the node's `code` and `data`                                                                                          |
| `Web3ContractError`                                                                                   | `InvalidInputError` for bad input, `ContractFunctionRevertedError` for a revert, `TransactionFailedError` for a refused or failed transaction |
| `OperationTimeoutError`                                                                               | `TimeoutError`                                                                                                                                |
| `InvalidAddressError`, `InvalidNumberError`, the other `Invalid*Error`s, plain `Error`                | `InvalidInputError`                                                                                                                           |
| `RpcError` and its subclasses                                                                         | `RpcRequestError`                                                                                                                             |

```js
import { RpcRequestError, TransactionFailedError } from '@beatoz/web3';

try {
    await web3.beatoz.tx(hash);
} catch (e) {
    if (e instanceof RpcRequestError) {
        console.log(e.code, e.data); // -32603 'tx (...) not found'
    }
}
```

Code that parsed the old error message reads `data` instead.

`Web3ValidatorError.errors` name the failing keyword and, as JSON pointers,
where the value is (`instancePath: '/0/1'`) and which part of the schema
failed. In 1.x `keyword` held a field name and nested paths were wrong; the
message for a top-level value reads as before.
[docs/errors.md](docs/errors.md) lists every class.

## 4. Contracts

**Deploying is one call**, and `gas` is required.

```js
// 1.x
const res = await contract.deploy(bytecode, args, account, chainId, gas);
const address = await web3.beatoz.contractAddrFromTx(res.hash);

// 2.0
const { address, contract: token } = await new web3.beatoz.Contract(abi)
    .deploy({ bytecode, args: ['Token', 'TKN'] })
    .send({ from: sender.address, gas: 10_000_000 });
```

**`call()` returns the decoded result**, not the node's `vm_call` response.

```js
// 1.x
const res = await token.methods.balanceOf(owner).call();
const balance = decodeParameter('uint256', res.value.returnData);

// 2.0
const balance = await token.methods.balanceOf(owner).call(); // 1000n
```

One output returns the value, several return an array, none returns
`undefined`. `web3.beatoz.vmCall` still returns the whole response, now with
`returnData` as hex instead of base64.

**A revert throws.** `call()`, `estimateGas()` and a deploy whose constructor
reverts throw `ContractFunctionRevertedError` with the decoded `reason`, or
`errorName` and `args` for a custom error. 1.x returned a failed call like a
successful one.

**Method options take the builder's types.** `gas` is a number and is
required by `send()` and `broadcast()`; `gasPrice` is a decimal string;
`nonce` is a number. A payable method's `value` is sent (1.x always sent 0).
`maxFeePerGas`, `maxPriorityFeePerGas` and `type` are gone.

**A failed send throws.** `send()` and `broadcast()` throw
`TransactionFailedError` when the node refuses the transaction or it fails in
the block, as `deploy().send()` and `web3.beatoz.transfer` do. 1.x returned the
node's answer, and a failure went unnoticed unless the caller read its codes.

**Arguments are checked.** A `bool` argument takes only `true` or `false`, and
a `string` argument only a string; anything else throws `AbiError`. In 1.x the
string `'false'` was sent as `true`. Numbers may still be given as numbers,
bigints or decimal or hex strings.

**Methods are typed from the ABI.** With the ABI written `as const`,
`contract.methods` has exactly its functions, with typed arguments and
results, and casting contracts to `any` is no longer needed. An ABI read from
JSON stays untyped: any name, unknown arguments and result.

## 5. Building and signing transactions

The builders refuse input they used to change silently. Each refusal is an
`InvalidInputError` that names the field.

| Field                 | 2.0 rule                              | What 1.x did                                                            |
| --------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `amount`, `gasPrice`  | decimal strings of digits             | `'-1'` built a transfer of 1; `'00'` made the node refuse the signature |
| `gas`, `nonce`        | non-negative safe integers            | `1.5` was signed as 1, `NaN` as 0                                       |
| `from`, `to`          | 20 bytes of hex, with or without `0x` | a mistyped or shortened address was signed as a different address       |
| `type`, `hash`, `sig` | not inputs                            | ignored                                                                 |
| setDoc `amount`       | not an input                          | dropped                                                                 |
| undelegate payload    | `{ txHash }`                          | `{ txhash }`                                                            |

- A nonce read from the node's raw JSON is a string; pass `Number(nonce)`, or
  read it with `web3.beatoz.getAccount`, which returns a number.
- `TrxProto` has `payer` and `payerSig`. Code that builds a `TrxProto` literal
  sets them to empty `Uint8Array`s; the builders do it for you.
- `decodeTransaction` returns each payload in the shape its builder takes: a
  withdraw's `reqAmt` as a decimal string, a contract's `data` as hex. It
  throws on a transaction type outside 1 to 8.
- `BytesUint8Array.fromHex` throws on anything but even-length hex, instead of
  reading a bad digit as 0.

Most code no longer needs the builders at all: see
[docs/transactions.md](docs/transactions.md).

## 6. Responses

The response types now say what the node sends; several said otherwise.

- `RuleResponse` lists the 21 parameters the node sends (nine it never sent
  are gone). int64 values are decimal strings, int32 values numbers.
- `StakesValue` and `DelegateeValue` lose fields the node never sent
  (`amount`, `ReceivedReward`, `selfAmount`, ...); `power`, `startHeight`,
  `selfPower` and `totalPower` are decimal strings.
- `consensusParams()` returns numbers, as its type always said; it returned
  the node's strings.
- `blockSearch()` returns the decoded `BlockSearchResponse`, as `txSearch()`
  does, instead of the raw JSON-RPC response.
- `Block.evidence` is `unknown` instead of `any`.
- Subscription events are typed: `subscribeNewBlock()` gives
  `NewBlockSubscriptionEvent`, and so on, instead of `value: any`.

## 7. Providers

- `setProvider` and `new Web3(url)` refuse a string that is not an `http(s)://`
  or `ws(s)://` URL. 1.x kept the old provider without a word.
- Over WebSocket, a request waiting for its answer when the connection drops
  fails with `SocketClosedError`, and is not resent on the next connection.
  A subscription ends with `SocketClosedError`.
- `disconnect()` stays disconnected. In 1.x the socket reconnected about 100 ms
  later, so a Node process using it never exited.

## 8. New in 2.0

- **One-call sends:** `web3.beatoz.transfer`, `delegate`, `undelegate` and
  `withdrawReward` fill in the nonce, gas, gas price and chain id, sign with
  the wallet and throw `TransactionFailedError` with the node's reason.
- **`waitForTx(hash)`** waits until a transaction is indexed.
- **`NonceManager`** lets one account send several transactions before the
  next block.
- **Signature scheme v1:** `{ scheme: 'v1' }` on signing and sends; `v0` stays
  the default.
- **Queries:** a past `height` for `getAccount`, `delegatee`, `stakes`,
  `reward` and `rule`; `totalSupply`, `totalTxFee`, `txCount`, `totalPower`,
  `votingPower`, `vmEstimateGas`, `blockSearch`.
- **Fee payer:** `account.signTransactionAsPayer(tx, chainId)`.

[docs/](docs/README.md) covers each of these with examples.
