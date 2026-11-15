// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

// Takes coin through a payable function, so a test can see the value a
// transaction carries reach the contract.
contract Vault {
    mapping(address => uint256) public deposits;

    function deposit() external payable {
        deposits[msg.sender] += msg.value;
    }
}
