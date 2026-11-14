# HttpProvider


## Getting Started
```Typscript
import { HttpProvider } from '@beatoz/web3-types';
const provider = new HttpProvider('http://localhost:8545');

let web3 = new Web3(provider);

or

let web3 = new Web3();
web3.setProvider(provider);
```

### Abstract

This module provides an HTTP Provider which allows for communication using web3 API specifications. It comes equipped with request handling and streamlined client URL management.

### Import Statements

The `HttpProvider` class and `HttpProviderOptions` can be accessed via the import statement:

```javascript
import HttpProvider, { HttpProviderOptions } from '<module-path>';
```

### Class Definition: HttpProvider

The `HttpProvider` class takes in a `clientUrl` and optional `httpProviderOptions` during instantiation:

```javascript
let httpProviderInstance = new HttpProvider(clientUrl, httpProviderOptions);
```

### Member Variables

- `clientUrl`: A string representing the client URL.
- `httpProviderOptions`: A configuration object specified by the `HttpProviderOptions` type.

### Member Functions

1. `request(payload: Web3APIPayload, requestOptions?: RequestInit)`

   Sends an HTTP Request based on the provided Web3 API payload and optional request options. 

   If the node answers with a JSON-RPC error, it throws an `RpcRequestError` carrying the node's `code` and `data`. If the request fails without a JSON-RPC answer (no connection, or a non-2xx status with another body), it throws an `HttpRequestError` with the `status` and `url`. Both extend `BaseError` from `@beatoz/web3-errors`.

   Example Usage:

   ```javascript
    let response = await httpProviderInstance.request(payload, requestOptions);
   ```

2. `getClientUrl()`

   Returns the `clientUrl` string that the instance was initialized with.

   Example Usage:

   ```javascript
    let clientUrl = httpProviderInstance.getClientUrl();
   ```

### Exports

The `HttpProvider` class and `HttpProviderOptions` type are exported at the module level:

```javascript
export { HttpProvider, HttpProviderOptions };
```
