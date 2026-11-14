# web3


## Usage

Web3 is the primary class to be imported and it extends `Web3Context`.

```js
import { Web3 } from '@beatoz/web3'

const web3 = new Web3('url of beatoz provider');

// example usage (testnet)
// let web3 = new Web3("https://rpc1.testnet.beatoz.io");
// let web3 = new Web3("wss://rpc1.testnet.beatoz.io") 


// accounts
let web3Account = web3.beatoz.accounts.create();


// rpc methods
const blockResponse: BlockResponse = await web3.beatoz.block();


// contracts
const contract = new web3.beatoz.Contract(abi, address);
const contractMethod = contract.methods.methodName();

// deploy: the account of `from` must be in the wallet
const { address, contract: deployed } = await new web3.beatoz.Contract(abi)
    .deploy({ bytecode, args: ['MyToken', 'MTK'] })
    .send({ from });


```

Web3 is initialized with a provider url, without which a warning is logged in the console saying - "NOTE: web3.js is running without provider. You need to pass a provider in order to interact with the network!".

# Summary

* [rpc_methods](./rpc_methods.md)
* [trx_pb.md](./trx_pb.md)

### Properties

- `version` It is the version of the current package
- `beatoz` It's an instance of `Web3MethodInterface`

- `utils` It's an instance of `@beatoz/web3-utils`  [utils.md](../web3-utils/README.md)

### Web3MethodInterface

The `beatoz` property in the `Web3` class exposes following properties - `accounts`, `Contract` and `abi`.

- `accounts` It initializes accounts for context.
- `Contract` It is a constructor to initiate contract context.
- `abi` It provides the application binary interface for the smart contracts.
