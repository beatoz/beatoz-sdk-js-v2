# web3 rpc methods


## Overview
This documentation provides information on the functioning of various methods of the BEATOZ software system. Each function requires a `requestManager` which is an instance of `Web3RequestManager`. 

The following sections list the functions available, along with the necessary parameters and expected return types.

## Function list

1. `health`: Checks the health of the Web3 application. Returns a `HealthResponse` Promise.
example:
```js
const healthResponse: HealthResponse = await web3.beatoz.health();
```

response type:
```typescript
/**
 * Represents a health check response. A value of `null` typically indicates the node is healthy.
 */
export type HealthResponse = null;
```


2. `status`: Provides the status of the Web3 application. Returns a `StatusResponse` Promise.
example:
```js
const statusResponse: StatusResponse = await web3.beatoz.status();
```

response type:
```typescript

/**
 * Represents a response containing status information of the node.
 */
export interface StatusResponse {
  /** Information about the node */
  readonly node_info: NodeInfo;
  /** Information about the node's sync status */
  readonly sync_info: SyncInfo;
  /** Information about the node's validator */
  readonly validator_info: Validator;
}
```


3. `netInfo`: Provides information about the network. Returns a `NetInfoResponse` Promise.
example:
```js
const netInfoResponse: NetInfoResponse = await web3.beatoz.netInfo();
```

response type:
```typescript

/**
 * Provides information about the network state of a node.
 */
export interface NetInfoResponse {
  /** Indicates if the node is currently listening for connections */
  listening: boolean;
  /** List of addresses the node is listening on */
  listeners: [];
  /** Number of peers the node is currently connected to */
  n_peers: string;
  /** Detailed information about the peers the node is connected to */
  peers: [];
}
```


4. `blockchain`: Retrieves blockchain data. Accepts parameters `minHeight` and `maxHeight` for specifying the range of blocks to return. Returns a `BlockchainResponse` Promise.
example:
```js
const blockchainResponse: BlockchainResponse = await web3.beatoz.blockchain(1, 10);
```

response type:
```typescript
/**
 * Represents a response with information about the blockchain.
 */
export interface BlockchainResponse {
  /** The height of the last block in the blockchain */
  readonly last_height: number;
  /** Metadata for blocks in the blockchain */
  readonly block_metas: readonly BlockMeta[];
}
```




5. `block`: Fetches a specific block. The `height` parameter specifies the block in the chain to return. Returns a `BlockResponse` Promise.
example:
```js
const blockResponse: BlockResponse = await web3.beatoz.block(1);
```

response type:
```typescript
/**
 * Represents a response containing information about a block.
 */
export interface BlockResponse {
  /** The ID of the block */
  readonly block_id: BlockId;
  /** The actual block data */
  readonly block: Block;
}
```


6. `blockByHash`: Fetches block information by its hash. Accepts hash in either `string` or `Uint8Array` form.
example:
```js
const blockResponse: BlockResponse = await web3.beatoz.blockByHash("hash");
```

response type:
```typescript
/**
 * Represents a response containing information about a block.
 */
export interface BlockResponse {
  /** The ID of the block */
  readonly block_id: BlockId;
  /** The actual block data */
  readonly block: Block;
}
```

7. `blockResults`: Provides block results for a specific block height. The `height` parameter specifies the block to return.
example:
```js
const blockResultsResponse: BlockResultsResponse = await web3.beatoz.blockResults(height);
```

response type:
```typescript
/**
 * Represents a response containing results associated with a block.
 */
export interface BlockResultsResponse {
  /** The height of the block */
  readonly height: number;
  /** Results of the transactions in the block */
  readonly txs_results?: readonly TxData[];
  /** Events that occurred at the beginning of the block */
  readonly begin_block_events?: readonly Event[];
  /** Events that occurred at the end of the block */
  readonly end_block_events?: readonly Event[];
  /** Updates to the validator set */
  readonly validator_updates?: readonly ValidatorUpdate[];
  /** Potential updates to the consensus parameters */
  readonly consensus_params_updates?: ConsensusParams;
}
```

8. `commit`: Provides commit information for a specific block height.
example:
```js
const commitResponse: CommitResponse = await web3.beatoz.commit(height);
```

response type:
```typescript

/**
 * Represents a response containing the signed header.
 */
export interface CommitResponse {
  /** The signed header data */
  readonly signed_header: SignedHeader;
  /** The validator set at the height of the signed header */
  readonly canonical: boolean;
}
```


9. `validators`: Returns validators' data for a specific block height.
example:
```js
const validatorsResponse: ValidatorsResponse = await web3.beatoz.validators(height, page, perPage);
```

response type:
```typescript
/**
 * Represents a response containing validator details for a specific block height.
 */
export interface ValidatorsResponse {
  /** The height of the block for which validators are provided */
  readonly block_height: number;
  /** List of validators for the given block height */
  readonly validators: readonly Validator[];
  /** Number of validators listed in the response */
  readonly count: number;
  /** Total number of validators */
  readonly total: number;
}
```

10. `genesis`: Returns the genesis block of the blockchain.
example:
```js
const genesisResponse: GenesisResponse = await web3.beatoz.genesis();
```

response type:
```typescript
/**
 * Represents a response containing genesis information.
 */
export interface GenesisResponse {
  /** The genesis time */
  readonly genesis_time: ReadonlyDate;
  /** The chain ID */
  readonly chain_id: string;
  /** The initial height */
  readonly initial_height: number;
  /** Consensus parameters at genesis */
  readonly consensus_params: ConsensusParams;
  /** List of validators at genesis */
  readonly validators: readonly Validator[];
  /** App hash at genesis */
  readonly app_hash: HexString;
  /** The state of the app at genesis */
  readonly app_state: Record<string, unknown> | undefined;
}
```


11. `genesisChunked`: Provides the genesis block in chunks.
example:
```js
const genesisChunkedResponse: GenesisChunkedResponse = await web3.beatoz.genesisChunked(chunk);
```

response type:
```typescript
/**
 * Represents a response containing a chunk of the genesis data.
 */
export interface GenesisChunkedResponse {
  /** Current chunk of the genesis data */
  chunk: string;
  /** Total number of chunks for the genesis data */
  total: string;
  /** Actual data for the current chunk */
  data: string;
}
```

12. `dumpConsensusState`: Provides the current consensus state.
example:

```js
const dumpConsensusStateResponse: DumpConsensusStateResponse = await web3.beatoz.dumpConsensusState();
```

response type:
```typescript
/**
 * Represents the current consensus state of a node.
 */
export interface DumpConsensusStateResponse {
  /** Detailed state information about the current round of consensus */
  round_state: RoundState;
  /** Detailed information about the peers the node is connected to in the context of consensus */
  peers: PeerInfo[];
}
```

13. `consensusState`: Fetches consensus state information.
example:
```js
const consensusStateResponse: ConsensusStateResponse = await web3.beatoz.consensusState();
```

response type:
```typescript
/**
 * Represents the consensus state of a blockchain node.
 */
export interface ConsensusStateResponse {
  readonly round_state: ConsensusRoundState;
}
```


14. `consensusParams`: Retrieves the consensus parameters at a specific block height.
example:
```js
const consensusParamsResponse: ConsensusParamsResponse = await web3.beatoz.consensusParams(height);
```

response type:
```typescript
export interface ConsensusParamsResponse {
  block_height: number;
  consensus_params: ConsensusParams;
}
```


15. `unconfirmedTxs`: Provides a list of unconfirmed transactions upto a specified limit.
example:
```js
const unconfirmedTxsResponse: UnconfirmedTxsResponse = await web3.beatoz.unconfirmedTxs(limit);
```

response type:
```typescript
/**
 * Represents the unconfirmed transactions in the mempool of a node.
 */
export interface UnconfirmedTxsResponse {
  /** Number of unconfirmed transactions */
  n_txs: string;
  /** Total number of unconfirmed transactions */
  total: string;
  /** Total size (in bytes) of unconfirmed transactions */
  total_bytes: string;
  /** List of unconfirmed transactions */
  txs: [];
}
```

16. `txSearch`: Searches and returns transactions based on a specified query string.
example:
```js
const txSearchResponse: TxSearchResponse = await web3.beatoz.txSearch(query, parent, page, perPage, orderBy);
```

response type:
```typescript
/**
 * Represents a response containing a list of transactions that match a search query.
 */
export interface TxSearchResponse {
  /** List of transactions that match the search criteria */
  readonly txs: readonly TxResponse[];
  /** Total number of transactions that match the search criteria */
  readonly total_count: number;
}
```



17. `tx`: Fetches a transaction based on its hash.
example:
```js
const txResponse: TxResponse = await web3.beatoz.tx("hash");
```

response type:
```typescript
/**
 * Represents a response containing transaction details.
 */
export interface TxResponse {
  /** The transaction data */
  readonly tx: HexString;
  /** The hash of the transaction */
  readonly hash: HexString;
  /** The height of the block containing the transaction */
  readonly height: number;
  /** Index of the transaction within the block */
  readonly index: number;
  /** Result data associated with the transaction */
  readonly result: TxData;
  /** Proof of the transaction (if available) */
  readonly proof?: TxProof;
  /** Result of the transaction execution */
  readonly tx_result: TxData;
}
```


18. `abciInfo`: Provides information on the Application Blockchain Interface (ABCI).
example:
```js
const abciInfoResponse: AbciInfoResponse = await web3.beatoz.abciInfo();
```

response type:
```typescript
/**
 * Represents a response containing general information about the ABCI application.
 */
export interface AbciInfoResponse {
  response: {
    version: string;
    app_version: string;
    last_block_height?: number;
    last_block_app_hash?: HexString;
  };
}
```



19. `abciQuery`: Makes an ABCI query.
example:
```js
const abciQueryResponse: AbciQueryResponse = await web3.beatoz.abciQuery(path, data, height, prove);
```
```

response type:
```typescript
/**
 * Represents a response to an ABCI query.
 */
export interface AbciQueryResponse {
  readonly key: HexString;
  readonly value: HexString;
  readonly proof?: QueryProof;
  readonly height?: number;
  readonly index?: number;
  readonly code?: number;
  readonly codespace: string;
  readonly log?: string;
  readonly info: string;
}
```



20. `checkTx`: Checks a specified transaction.
example:
```js
const checkTxResponse: CheckTxResponse = await web3.beatoz.checkTx("TrxProto");
```

response type:
```typescript
/**
 * Represents the response after checking a transaction.
 */
export interface CheckTxResponse {
  code: number;
  data?: string;
  log: string;
  info: string;
  gas_wanted: string;
  gas_used: string;
  events: [];
  codespace: string;
  mempoolError?: string;
}
```


21. `numUnconfirmedTxs`: Returns the number of unconfirmed transactions.
example:
```js
const numUnconfirmedTxsResponse: NumUnconfirmedTxsResponse = await web3.beatoz.numUnconfirmedTxs();
```

response type
```typescript
/**
 * Represents a response containing information about unconfirmed transactions.
 */
export interface NumUnconfirmedTxsResponse {
  readonly n_txs: number;
  /** Total number of unconfirmed transactions */
  readonly total: number;
  /** Total size (in bytes) of all unconfirmed transactions */
  readonly total_bytes: number;
  readonly txs: TxData[];
}
```


22. `broadcastTxAsync`: Asynchronously broadcasts a transaction on the network.
example:
```js
const broadcastTxAsyncResponse: BroadcastTxAsyncResponse = await web3.beatoz.broadcastTxAsync("TrxProto");
```

response type:
```typescript

/**
 * Represents a response after broadcasting a transaction asynchronously.
 */
export interface BroadcastTxAsyncResponse {
  /** The hash of the broadcasted transaction */
  readonly hash: HexString;
}

```


23. `broadcastTxSync`: Synchronously broadcasts a transaction on the network.
example:
```js
const broadcastTxSyncResponse: BroadcastTxSyncResponse = await web3.beatoz.broadcastTxSync("TrxProto");
```

response type:
```typescript
/**
 * Represents a response after broadcasting a transaction synchronously.
 */
export interface BroadcastTxSyncResponse extends TxData {
  /** The hash of the broadcasted transaction */
  readonly hash: HexString;
}
```



24. `broadcastTxCommit`: Broadcasts a transaction and waits for the transaction to commit.
example:
```js
const broadcastTxCommitResponse: BroadcastTxCommitResponse = await web3.beatoz.broadcastTxCommit("TrxProto");
```

response type:
```typescript
/**
 * Represents a response after broadcasting a transaction and waiting for it to commit.
 */
export interface BroadcastTxCommitResponse {
  /** The height of the block containing the transaction */
  readonly height: number;
  /** The hash of the broadcasted transaction */
  readonly hash: HexString;
  /** Result of the check transaction */
  readonly check_tx: TxData;
  /** Result of the delivery transaction */
  readonly deliver_tx?: TxData;
}
```



25. `delegatee`: Fetches the delegatee of an address.
example:
```js
const delegateeResponse: DelegateeResponse = await web3.beatoz.delegatee("address");
```

response type:
```typescript
/**
 * Represents the response related to a delegatee.
 */
export interface DelegateeResponse {
  key: string;
  log?: string;
  code?: number;
  value?: DelegateeValue;
}
```


26. `rule`: Fetches a set of rules.
example:
```js
const ruleResponse: RuleResponse = await web3.beatoz.rule();
```

response type:
```typescript
/**
 * The chain's governance parameters, as beatoz-go's `rule` query returns them
 * (`ctrlers/types/gov_params.go`).
 *
 * Each field keeps the JSON type the node sends: int64 parameters come as
 * decimal strings, int32 ones as numbers. The node leaves a zero parameter out
 * of the response, and the SDK puts it back as `'0'` or `0`.
 *
 * Only the rules a caller acts on are listed. The node also sends internal
 * values - its fee and reward pool addresses, its empty block interval, the
 * parameter set's version, the proposal timing, and two parameters it defines
 * but does not apply (`minBondingBlocks`, `maxIndividualPowerRate`) - which
 * stay in `value` at runtime but are not typed.
 */
export interface RuleResponse {
    /** Block height the parameters were read at. */
    height: string;
    value: {
        // Gas and blocks
        /** Price of one unit of gas, in the smallest unit. */
        gasPrice: string;
        /** Least gas a transaction must offer. */
        minTrxGas: string;
        /** Most gas one block may use. */
        blockGasLimit: string;
        /** Largest block, in bytes. */
        blockSizeLimit: string;

        // Validators and delegation
        /** Most validators the chain keeps. */
        maxValidatorCnt: number;
        /** Least power a validator needs. */
        minValidatorPower: string;
        /** Least power a delegation needs. */
        minDelegatorPower: string;
        /** Most validators one delegator may delegate to. */
        maxValidatorsOfDelegator: number;
        /** Most delegators one validator may have. */
        maxDelegatorsOfValidator: number;
        /** Least share of its power a validator must stake itself, in percent. */
        minSelfPowerRate: number;
        /** Most the total validator power may change per block, in percent. */
        maxUpdatablePowerRate: number;
        /** Blocks between unstaking and the refund. */
        lazyUnbondingBlocks: string;

        // Rewards, slashing and supply
        /** Validators' share of a reward, in percent. */
        validatorRewardRate: number;
        /** Block proposer's share of the fees, in percent. */
        txFeeRewardRate: number;
        /** Share of a validator's power slashed, in percent. */
        slashRate: number;
        /** Least blocks a validator must sign in an inflation cycle. */
        minSignedBlocks: string;
        /** Blocks between two inflation reward issues. */
        inflationCycleBlocks: string;
        /** Inflation weight, in permil. */
        inflationWeightPermil: number;
        /** Weight of staking duration in rewards, in permil. */
        bondingBlocksWeightPermil: number;
        /** Blocks a stake takes to earn its full reward weight. */
        ripeningBlocks: string;
        /** Most coins that may ever exist, in the smallest unit. */
        maxTotalSupply: string;
    };
}
```


27. `account`: Fetches account details of an address.
example:
```js
const getAccountResponse: AccountResponse = await web3.beatoz.account("address");
```

response type:
```typescript

/**
 * Represents the details of an account on the blockchain.
 */
export interface AccountResponse {
  key: HexString;
  value: {
    address: HexString;
    nonce: number;
    balance: string;
    name?: string;
    docURL?: string;
  };
}
```


28. `proposals`: Fetches proposals related to a transaction hash.
example:
```js
const proposalsResponse: ProposalsResponse = await web3.beatoz.proposals("txHash");
```


29. `stakes`: Fetches the stake of an address.
example:
```js
const stakesResponse: StakesResponse = await web3.beatoz.stakes("address");
```

response type:
```typescript
/**
 * Represents the stakes related response.
 */
export interface StakesResponse {
  key: string;
  value?: StakesValue[];
}
```

30. `vmCall`: Makes a call to the VM.
example:
```js
// from, to (contract), height (0 for the latest block), call data: 'name()'
const vmCallResponse: VmCallResponse = await web3.beatoz.vmCall(
    '03ba93fdc3e164cd4e57370a828f6e5b05d4817d',
    '15633e505d01691a71f40049e15ba1340c0eea29',
    0,
    '0x06fdde03',
);
// vmCallResponse.value.returnData is hex, such as
// '0000...0020' + '0000...0007' + '4d79546f6b656e00...' for the string 'MyToken'
```

response type:
```typescript
/**
 * The result of the node's `vm_call` query (beatoz-go `ctrlers/types/vm.go`),
 * which runs a contract call without a transaction.
 */
export interface VmCallResponse {
    key: string;
    /** Block height the call ran at. */
    height: string;
    value: {
        /**
         * What the call returned, as hex without `0x`; `''` when it returned
         * nothing. The node sends it as base64, and the SDK converts it.
         */
        returnData: HexString;
        /** Gas the call used, as a decimal string. */
        usedGas: string;
        /** The VM's error, present only when the call failed (for example a revert). */
        vmErr?: string;
    };
}
```


**Note:** The following methods are only use websocket connection.

31. `subscribe`: Subscribes to a specified event.

example:
```typescript
const web3 = new Web3("ws://localhost:26657");

const query = "tm.event='NewBlockHeader'";
const headers = web3.beatoz.subscribe(query);

const events: SubscriptionEvent[] = [];

const subscription = headers.subscribe({
  error: done.fail,
  complete: () => done.fail('subscription should not complete'),
  next: (event: SubscriptionEvent) => {
    events.push(event);
    expect(event.query).toEqual(query);

    if (events.length === 2) {
      // make sure they are consecutive heights
      subscription.unsubscribe();
    }
  },
});
```
32. `subscribeNewBlock`: Subscribes to new block events.
33. `subscribeNewBlockHeader`: Subscribes to new block header events.
34. `subscribeTx`: Subscribes to new transaction events.

**Note:** Please refer to the actual code to understand thoroughly the various parameters inputs and outputs.