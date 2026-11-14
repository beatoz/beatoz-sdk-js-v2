# WebsocketProvider

## Getting Started
```Typscript
import { WebsocketProvider } from '@beatoz/web3-types';
const provider = new WebsocketProvider('ws://localhost:8546');


let web3 = new Web3(provider);

or

let web3 = new Web3();
web3.setProvider(provider);
```

## Description

The **WebsocketProvider** is a class in the `@beatoz/web3-types` package used to manage queues and streams, orchestrate requests and responses, as well as handle error events over Websockets. Major operations including sending requests, establishing connections, creating listeners, validating and parsing messages are implemented in this class.

### RpcEventProducer Class

The **RpcEventProducer** is a sub-class of WebsocketProvider, with a specific role to produce `SubscriptionEvent`. 

For methods:

- `start(listener: Listener<SubscriptionEvent>)`: Starts the producer, throwing an error if the producer is already running. It also queues a request to the socket.
   
- `stop()`: Stops the producer and sends an end request to the server to free resources. In situations where the socket connection is not open, it will handle the error.
   
- `connectToClient(listener: Listener<SubscriptionEvent>)`: This function sets up the connections and subscriptions for listening to responses from the client.

- `closeSubscriptions()`: Unsubscribes all subscriptions and clears the subscription array.

### WebsocketProvider Class

For methods: 

- `constructor(baseUrl: string)`: Connects to the socket URL, and reconnects when the connection drops. A request waiting for its answer when the connection drops, or queued and not yet sent, fails with `SocketClosedError`, and a subscription ends with it; queued requests are not sent on the next connection. A request after `disconnect()` fails with it too. A JSON-RPC error answer is an `RpcRequestError`, for requests and subscriptions.
   
- `request(payload: Web3APIPayload<API, Method>)` & `execute(payload: Web3APIPayload<API, Method>)`: Sends a request to the server, queuing the request, and awaiting the respective response.

- `listen(request: JsonRpcRequest)`: Set up a stream for listening to the specified events and establishes a new `RpcEventProducer`.
   
- `connected()`: Returns a promise that resolves when the websocket is connected.

- `disconnect()`: Disconnects the socket.

- `responseForRequestId(id: JsonRpcId)`: Returns the response for a given request id.

- `getClientUrl()`: Returns the URL of the client the websocket is connected to.

Structurally, a **WebsocketProvider** instance manages a `ReconnectingSocket` connection and contains a map of `subscriptionStreams`, and exposes APIs to control connection status, request processing, and error handling.

## Utility Functions

- `hasProtocol(url: string)`: Checks if a URL has protocol.

- `defaultErrorHandler(error: any)`: The default error handler which throws any received error.

- `toJsonRpcResponse(message: SocketWrapperMessageEvent)`: Converts a message to JsonRpcResponse.

- `parseJsonRpcResponse(data: any)`: Parses data into either a JsonRpcErrorResponse or a JsonRpcResponseWithResult.

- `parseJsonRpcErrorResponse(data: any)`: Parses data into a JsonRpcErrorResponse.

- `parseJsonRpcSuccessResponse(data: any)`: Parses data into a JsonRpcResponseWithResult.

- `isJsonRpcErrorResponse(response: JsonRpcResponse)`: Checks if a response is a JsonRpcErrorResponse.
