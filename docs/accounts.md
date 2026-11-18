# Accounts and signing

A BEATOZ account is a secp256k1 key pair, and its address is derived as on
Ethereum (the last 20 bytes of the keccak256 of the public key). The SDK holds
keys in memory and signs with them; storing keys is up to you.

## Create or import an account

```js
const created = web3.beatoz.accounts.create(); // a new random key
const imported = web3.beatoz.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);

console.log(imported.address); // hex, 40 digits
console.log(imported.privateKey); // hex, keep it secret
```

## The wallet

The wallet is the set of accounts `web3.beatoz` signs with. `transfer` and the
other sends, and contract sends and deploys, look their `from` up in it.

```js
const wallet = web3.beatoz.accounts.wallet;
const sender = wallet.add(process.env.PRIVATE_KEY).get(0); // add, then get by index
wallet.get(sender.address); // or by address
wallet.remove(sender.address);
```

## Sign a message

```js
const signature = sender.sign(new TextEncoder().encode('hello')); // 65 bytes
console.log(signature.toHex());
```

`sign` hashes the bytes with sha256 and returns the 64-byte signature followed
by the recovery id.

## Sign a transaction yourself

The one-call sends ([transactions.md](transactions.md)) do all of this. To
build and sign by hand, for example to send from another process:

```js
import { TrxProtoBuilder } from '@beatoz/web3';

const chainId = (await web3.beatoz.genesis()).chain_id;
const { gasPrice, minTrxGas } = (await web3.beatoz.rule()).value;
const { nonce } = (await web3.beatoz.getAccount(sender.address)).value;

const tx = TrxProtoBuilder.buildTransferTrxProto({
    from: sender.address,
    to: '0x0000000000000000000000000000000000000001',
    amount: utils.toWei('1', 'beatoz'),
    nonce,
    gas: Number(minTrxGas),
    gasPrice,
});
const { rawTransaction, transactionHash } = sender.signTransaction(tx, chainId);

await web3.beatoz.broadcastRawTxCommit(rawTransaction);
```

The builders check their input before anything is signed: `amount` and
`gasPrice` are decimal strings, `gas` and `nonce` non-negative integers, and
`from` and `to` 20 bytes of hex. Anything else throws `InvalidInputError`
naming the field. A native transaction is charged all the gas it carries, so
`minTrxGas` is the cheapest that works.

The other builders are `buildDelegateTrxProto`, `buildUnDelegateTrxProto`
(payload `{ txHash }`), `buildWithdrawTrx` (payload `{ reqAmt }`),
`buildContractTrxProto` (payload `{ data }`) and `buildSetDocTrx` (payload
`{ name, url }`). `TrxProtoBuilder.decodeTransaction(bytes)` reads a
transaction back in the shape its builder takes.

## Signature schemes

The node accepts two signature schemes and tells them apart by the
signature's last byte.

| Scheme         | Signs                                                 | Last byte | Nodes             |
| -------------- | ----------------------------------------------------- | --------- | ----------------- |
| `v0` (default) | a text prefix with the chain id, then the transaction | 0 or 1    | every version     |
| `v1`           | the transaction, then the chain id's bytes            | 27 or 28  | v1.10.0 and later |

```js
sender.signTransaction(tx, chainId, { scheme: 'v1' });
await web3.beatoz.transfer({ from, to, amount }, { scheme: 'v1' });
await token.methods.transfer(to, '1').send({ from, gas: 200_000, scheme: 'v1' });
```

`TrxProtoBuilder.verifyTrxProto(tx, account, chainId)` checks a signature by
the scheme its last byte names.

## Paying another account's fee

A second account can pay the fee of a transaction its sender has signed.

```js
const payer = web3.beatoz.accounts.privateKeyToAccount(process.env.PAYER_KEY);

sender.signTransaction(tx, chainId);
payer.signTransactionAsPayer(tx, chainId); // sets payer and payerSig
await web3.beatoz.broadcastTxCommit(tx);
```

The payer signs the sender's signature too, so sign as the sender first. The
sender and the payer may use different schemes.
