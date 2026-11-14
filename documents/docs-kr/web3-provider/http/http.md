# HttpProvider

## 시작하기
```Typscript
import { HttpProvider } from '@beatoz/web3-types';
const provider = new HttpProvider('http://localhost:8545');

let web3 = new Web3(provider);

또는

let web3 = new Web3();
web3.setProvider(provider);
```

### 개요

이 모듈은 웹3 API 명세를 사용한 통신을 허용하는 HTTP Provider를 제공합니다. 요청 처리와 간편한 클라이언트 URL 관리 기능이 포함되어 있습니다.

### Import 문

`HttpProvider` 클래스와 `HttpProviderOptions`은 import 문을 통해 접근할 수 있습니다:

```javascript
import HttpProvider, { HttpProviderOptions } from '<module-path>';
```

### 클래스 정의: HttpProvider

`HttpProvider` 클래스는 인스턴스 생성 시 `clientUrl`과 선택적으로 `httpProviderOptions`을 입력받습니다:

```javascript
let httpProviderInstance = new HttpProvider(clientUrl, httpProviderOptions);
```

### 멤버 변수

- `clientUrl`: 클라이언트 URL을 나타내는 문자열입니다.
- `httpProviderOptions`: `HttpProviderOptions` 타입으로 지정된 설정 객체입니다.

### 멤버 함수

1. `request(payload: Web3APIPayload, requestOptions?: RequestInit)`

   제공된 Web3 API 페이로드 및 선택적 요청 옵션을 기반으로 HTTP 요청을 보냅니다.

   노드가 JSON-RPC 에러로 답하면 노드의 `code` 와 `data` 를 담은 `RpcRequestError` 를 던집니다. JSON-RPC 답 없이 요청이 실패하면 (연결 실패, 또는 다른 본문의 2xx 가 아닌 상태) `status` 와 `url` 을 담은 `HttpRequestError` 를 던집니다. 둘 다 `@beatoz/web3-errors` 의 `BaseError` 를 상속합니다.

   사용 예:

   ```javascript
    let response = await httpProviderInstance.request(payload, requestOptions);
   ```

2. `getClientUrl()`

   초기화된 `clientUrl` 문자열을 반환합니다.

   사용 예:

   ```javascript
    let clientUrl = httpProviderInstance.getClientUrl();
   ```

### Exports

`HttpProvider` 클래스와 `HttpProviderOptions` 타입은 모듈 수준에서 내보내집니다:

```javascript
export { HttpProvider, HttpProviderOptions };
```
