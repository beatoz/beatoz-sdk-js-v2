# web3


## 사용법

Web3는 가져와야 하는 주요 클래스이며, `Web3Context`를 확장합니다.

```js
import { Web3 } from '@beatoz/web3'

const web3 = new Web3('지급자 url of beatoz');

// 예상 사용법 (testnet)
// let web3 = new Web3("https://rpc1.testnet.beatoz.io");
// let web3 = new Web3("wss://rpc1.testnet.beatoz.io") 


// 계정들
let web3Account = web3.beatoz.accounts.create();


// rpc 방법들
const blockResponse: BlockResponse = await web3.beatoz.block();


// 계약들
const contract = new web3.beatoz.Contract(abi, address);
const contractMethod = contract.methods.methodName();

// 배포: `from` 의 계정이 지갑에 있어야 합니다
const { address, contract: deployed } = await new web3.beatoz.Contract(abi)
    .deploy({ bytecode, args: ['MyToken', 'MTK'] })
    .send({ from });


```

Web3은 제공자 url로 초기화 되고, 없으면 콘솔에 경고가 기록됩니다 - "참고: web3.js가 제공자 없이 실행 중입니다. 네트워크와 상호 작용하려면 제공자를 전달해야 합니다!".

# 요약

* [rpc_methods](./rpc_methods.md)
* [trx_pb_kr.md](./trx_pb.md)

### 속성들

- `version` 현재 패키지의 버전입니다.
- `beatoz` `Web3MethodInterface`의 인스턴스입니다.

- `utils` `@beatoz/web3-utils`의 인스턴스입니다.  [utils_kr.md](../web3-utils/README.md)

### Web3MethodInterface

`Web3` 클래스의 `beatoz` 속성은 다음 속성들을 공개합니다 - `계정들`, `계약` 그리고 `abi`.

- `계정들` 컨텍스트를 위한 계정을 초기화합니다.
- `계약` 계약 컨텍스트를 시작하는 생성자입니다.
- `abi` 스마트 계약을 위한 응용 프로그램 바이너리 인터페이스를 제공합니다.
