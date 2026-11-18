# Errors

Every error the SDK throws extends `BaseError`, and all of them are exported
from `@beatoz/web3`. Tell them apart with `instanceof`.

```js
import { BaseError, RpcRequestError } from '@beatoz/web3';

try {
    await web3.beatoz.tx(hash);
} catch (e) {
    if (e instanceof RpcRequestError) console.log(e.code, e.data);
    else if (e instanceof BaseError) console.log(e.shortMessage, e.details);
    else throw e;
}
```

Every `BaseError` has `shortMessage` (what failed), `details` (why, from the
cause), `cause` (the original error) and `walk()`, which follows the cause
chain.

| Class                           | Thrown when                                                                                | Fields                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `InvalidInputError`             | the SDK refuses an argument before sending anything: a bad address, amount, URL, option    |                                            |
| `AbiError`                      | a contract argument does not fit its ABI type, or a result cannot be decoded               |                                            |
| `RpcRequestError`               | the node answered with a JSON-RPC error, such as `tx (...) not found`                      | `code`, `data`, `method`                   |
| `HttpRequestError`              | an HTTP request failed without a JSON-RPC answer: no connection, a non-2xx status          | `status`, `url`                            |
| `SocketClosedError`             | the WebSocket connection dropped or was closed while a request or subscription was open    | `url`                                      |
| `InvalidResponseError`          | the node's answer does not have the shape the SDK expects                                  | `response`                                 |
| `TransactionFailedError`        | a one-call send or a deploy was refused (`check_tx`) or failed in the block (`deliver_tx`) | `stage`, `code`, `log`, `hash`             |
| `ContractFunctionRevertedError` | a contract call, gas estimate or deploy reverted                                           | `reason`, `errorName`, `args`, `signature` |
| `ContractFunctionZeroDataError` | a function with outputs returned nothing, as an address without code does                  |                                            |
| `TimeoutError`                  | `waitForTx` gave up                                                                        | `cause`: the node's last answer            |

What to do:

- **`InvalidInputError`, `AbiError`**: the message names the argument and
  what was expected; fix the call.
- **`RpcRequestError`**: read `data`, the node's own message. `tx (...) not
found` right after a send means the transaction is not indexed yet; use
  `waitForTx`.
- **`HttpRequestError`, `SocketClosedError`**: the node could not be reached.
  A transaction sent when this happened may or may not have arrived; look it
  up by hash before sending it again.
- **`TransactionFailedError`**: `log` is the node's reason, such as `invalid
nonce` or `insufficient fund`. A `check_tx` failure cost nothing; a
  `deliver_tx` failure was charged.
- **`ContractFunctionRevertedError`**: the contract refused; `reason` or
  `errorName` says why.
