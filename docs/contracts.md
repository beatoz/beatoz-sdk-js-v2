# Contracts

BEATOZ runs the EVM, so a Solidity contract's ABI and bytecode work as on
Ethereum. Contract sends and deploys sign with an account in the wallet
([accounts.md](accounts.md#the-wallet)).

## Deploy

```js
const {
    address,
    contract: token,
    hash,
    height,
} = await new web3.beatoz.Contract(abi)
    .deploy({ bytecode, args: ['Token', 'TKN'] })
    .send({ from: sender.address, gas: 10_000_000 });
```

- `args` are the constructor's arguments.
- `gas` is required. The fee is the gas the deploy uses, so a generous limit
  costs nothing more; a limit below what the deploy needs throws before
  anything is sent.
- `gasPrice` (a decimal string) and `scheme` are optional.
- The returned `contract` is a `Contract` at the new address, on the same
  provider and wallet.

If the constructor would revert, `send` throws `ContractFunctionRevertedError`
without sending. If the node refuses the deploy or it fails in the block, it
throws `TransactionFailedError`.

## Use a deployed contract

```js
const token = new web3.beatoz.Contract(abi, '0x91F112EC78fD597f54237631FBB3971B4cf060A5');
```

With the ABI written `as const` in TypeScript, `token.methods` has exactly the
ABI's functions, with typed arguments and results. An ABI loaded from JSON
works the same at run time, without the types.

## Call a function without a transaction

```js
const name = await token.methods.name().call(); // 'Token'
const balance = await token.methods.balanceOf(sender.address).call(); // 1000000000000000000000000000n
```

`call()` returns the decoded result: the value for one output, an array for
several, `undefined` for none. Integers come back as `bigint`.

## Send a transaction to a function

```js
const res = await token.methods
    .transfer('0x0000000000000000000000000000000000000001', '1000')
    .send({ from: sender.address, gas: 200_000 });

if (res.check_tx.code !== 0 || res.deliver_tx?.code !== 0) {
    console.log(res.check_tx.log || res.deliver_tx?.log);
}
```

`send()` and `broadcast()` are the same. `gas` is required. Unlike
`web3.beatoz.transfer`, a contract send **returns** the node's answer when the
transaction fails instead of throwing, so check its codes. A gas limit below
what the call uses fails in the block, and the fee is still charged.

Options:

| Option     |                                                                                        |
| ---------- | -------------------------------------------------------------------------------------- |
| `from`     | the sender; its account must be in the wallet                                          |
| `gas`      | required, a number                                                                     |
| `gasPrice` | a decimal string; the chain's when left out                                            |
| `nonce`    | a number; the nonce manager's or the node's when left out                              |
| `value`    | for a payable function, the amount to send, a decimal string                           |
| `sendMode` | `'commit'` (default), `'sync'` or `'async'` ([send modes](transactions.md#send-modes)) |
| `scheme`   | `'v0'` (default) or `'v1'`                                                             |

## Estimate gas

```js
const estimate = await token.methods
    .transfer('0x0000000000000000000000000000000000000001', '1000')
    .estimateGas({ from: sender.address });
console.log(estimate.value.usedGas); // '126297'
```

The node runs the call once and reports the gas it used. A transaction can
need a little more than that, so leave some margin in `gas`.

## Arguments

| ABI type          | Takes                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| `uint*`, `int*`   | a number, a `bigint`, or a decimal or hex string (`'1000'`, `'0x3e8'`) |
| `address`         | hex with or without `0x`, lower case, upper case or checksummed        |
| `bool`            | `true` or `false` only                                                 |
| `string`          | a string only                                                          |
| `bytes`, `bytesN` | hex, or a `Uint8Array`                                                 |
| `tuple`           | an array in component order, or an object keyed by component name      |

A value the type does not take throws `AbiError` naming the argument, before
anything is sent: `approved must be true or false, got "false"; write false,
not 'false'`.

## Reverts

`call()` and `estimateGas()` throw when the contract reverts:

```js
import { ContractFunctionRevertedError } from '@beatoz/web3';

try {
    await token.methods.transfer(to, 10n ** 40n).call({ from: sender.address });
} catch (e) {
    if (e instanceof ContractFunctionRevertedError) {
        console.log(e.reason); // 'ERC20: transfer amount exceeds balance'
        console.log(e.errorName); // a custom error's name, with e.args
    }
}
```

`reason` is the message of `require`/`revert` or a decoded panic. A custom
error in the ABI comes as `errorName` and `args`; one not in the ABI as its
4-byte `signature`.

## Encode a call yourself

```js
const data = token.methods.transfer(to, '1000').encodeABI();
```

`data` is the input of a contract transaction:
`TrxProtoBuilder.buildContractTrxProto({ ..., payload: { data } })`
([accounts.md](accounts.md#sign-a-transaction-yourself)). `web3.beatoz.abi`
has the encoders and decoders on their own.
