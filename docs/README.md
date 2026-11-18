# BEATOZ JavaScript SDK documentation

`@beatoz/web3` talks to a BEATOZ node: it reads the chain, signs and sends
transactions, deploys and calls contracts, and subscribes to new blocks and
transactions.

| Guide                                   | What it covers                                                           |
| --------------------------------------- | ------------------------------------------------------------------------ |
| [Getting started](getting-started.md)   | Install, connect, read an account, send a first transfer                 |
| [Accounts and signing](accounts.md)     | Keys, the wallet, signing, signature schemes, fee payers                 |
| [Sending transactions](transactions.md) | Transfers and staking in one call, send modes, nonces, waiting, failures |
| [Contracts](contracts.md)               | Deploy, call, send, estimate gas, reverts, arguments                     |
| [Reading the chain](queries.md)         | Blocks, transactions, accounts, staking, rewards, chain-wide values      |
| [Subscriptions](subscriptions.md)       | New blocks and transactions over WebSocket                               |
| [Errors](errors.md)                     | Every error class and what to do about it                                |

Moving from 1.x? See [MIGRATION.md](../MIGRATION.md).

Every function is documented in its source (TSDoc), which your editor shows.
The examples here use the public testnet, `https://rpc-testnet0.beatoz.io`;
any node URL works the same way.
