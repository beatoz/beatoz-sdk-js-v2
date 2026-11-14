# web3-accounts

## 개요
이 모듈은 Web3 라이브러리를 사용하여 BEATOZ 계정을 처리하고 트랜잭션에 서명하는 유틸리티를 제공합니다.

## 시작하기

### `create()`
`create` 함수는 임의의 BEATOZ 계정을 생성합니다. 생성이 완료되면 `Web3Account` 객체를 반환합니다.
```typescript
import { Web3 } from '@beatoz/web3';
import { Web3Account } from '@beatoz/web3-accounts';

// create address
const account: Web3Account = web3.beatoz.accounts.create();
```
### `privateKeyToAccount(privateKey)`
`privateKeyToAccount` 함수는 입력된 `private key` 로부터 `Web3Account` 객체를 반환합니다.
```typescript
import { Web3 } from '@beatoz/web3';
import { Web3Account } from '@beatoz/web3-accounts';

// import private key
const privateKey: string = 'your private key';
const account: Web3Account = privateKeyToAccount(privateKey);
```
반환된 `Web3Account` 객체는 아래와 같습니다.
```shell
{
    address: string,
    privateKey: string,
    prvKey: PrvKey,
    pubKey: PubKey,
    sign: [Function: sign],
    signTransaction: [Function: signTransaction],
    signTransactionAsPayer: [Function: signTransactionAsPayer]
}
```

### `signTransaction(trxProto, chainId)`
`signTransaction` 함수는 트랜잭션에 서명합니다. 서명하기 위해서는 트랜잭션을 제출할 BEATOZ 블록체인의 `CHAIN ID`가 필요합니다.
`signTransaction`의 필수 인자 값은 아래와 같습니다.
- TrxProto : `BEATOZ` 네트워크에 제출하기 위한 트랜잭션 형태
- ChainId : `BEATOZ` 네트워크의 Chain ID

아래는 `Web3Account` 객체를 활용해서 테스트넷 `BEATOZ` 전송을 구현한 `signTransaction` 예시입니다.
```typescript
import { Web3, TrxProtoBuilder, TrxProto } from '@beatoz/web3';
import { Web3Account } from '@beatoz/web3-accounts';

// create web3 instance
const web3 = new Web3('https://rpc1.testnet.beatoz.io');

// import private key
const privateKey: string = 'your private key';
const account: Web3Account = privateKeyToAccount(privateKey);

// get accountInfo
const accountInfo = await web3.beatoz.getAccount(account.address);

// create transaction
const trxProto: TrxProto = TrxProtoBuilder.buildTransferTrxProto({
    from: account.value.address,
    nonce: account.value.nonce,
    to: 'address',
    amount: '100',
    gas: 1000000,
    gasPrice: '250000000000',
});

// sign transaction
const { rawTransaction } = account.signTransaction(tx, 'testnet0');

// broadcast raw transaction
const result = await web3.beatoz.broadcastRawTxCommit(rawTransaction);
console.log(result);
```
코드의 결과 값은 아래와 같습니다.
```shell
{
  height: 280652,
  hash: '96289E5CA50E28AAB181E9D2E13367B82C06DAF9F34DB013EE2A1F4AAA77CFB2',
  check_tx: {
    code: 0,
    codespace: '',
    log: '',
    data: null,
    events: [],
    gas_wanted: '1000000',
    gas_used: '1000000'
  },
  deliver_tx: {
    code: 0,
    codespace: '',
    log: '',
    data: null,
    events: [ [Object] ],
    gas_wanted: '1000000',
    gas_used: '1000000'
  }
}
```

### `signTransactionAsPayer(trxProto, chainId)`
`signTransactionAsPayer` 는 다른 계정이 트랜잭션의 수수료를 대신 내게 합니다. 보내는 사람이 먼저 `signTransaction` 으로 서명하고, 수수료를 낼 계정(payer)이 이어서 서명하면 `payer` 와 `payerSig` 가 채워집니다. 체인은 수수료를 payer 에게서 뺍니다. 보내는 사람은 보내는 금액만, payer 는 수수료(`gas` × `gasPrice`)만 있으면 됩니다.

보내는 사람의 서명에는 payer 가 들어가지 않으므로, 보통 두 서명은 다른 곳에서 합니다. 사용자의 앱이 보내는 사람으로 서명해 서버로 보내고, 서버가 payer 로 서명해 노드로 보냅니다. payer 의 서명에는 보내는 사람의 서명이 들어가므로, 그 뒤에 보내는 사람이 다시 서명하면 payer 서명은 무효가 됩니다.

```typescript
// 사용자의 앱
const tx = TrxProtoBuilder.buildTransferTrxProto({ from: user.address, /* ... */ });
user.signTransaction(tx, chainId);

// 수수료를 내는 서버
const { rawTransaction } = feePayer.signTransactionAsPayer(tx, chainId);
const result = await web3.beatoz.broadcastRawTxCommit(rawTransaction);
```

보내는 사람이 서명하지 않았거나 payer 가 보내는 사람과 같으면 에러를 냅니다.
