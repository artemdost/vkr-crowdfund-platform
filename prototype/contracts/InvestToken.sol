// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InvestToken
 * @notice ERC-1155 token representing investor shares in crowdfunding campaigns.
 *         Each tokenId corresponds to a specific CrowdFund contract.
 */
contract InvestToken is ERC1155, Ownable {
    // tokenId => authorized CrowdFund contract address
    mapping(uint256 => address) public fundContracts;

    // next available tokenId
    uint256 public nextTokenId;

    event FundRegistered(uint256 indexed tokenId, address indexed fundContract);

    constructor() ERC1155("") Ownable(msg.sender) {}

    /**
     * @notice Register a CrowdFund contract for a given tokenId.
     * @param tokenId The token ID to associate.
     * @param fundContract The CrowdFund contract address.
     */
    function registerFund(uint256 tokenId, address fundContract) external onlyOwner {
        require(fundContracts[tokenId] == address(0), "Token already registered");
        require(fundContract != address(0), "Invalid fund address");
        fundContracts[tokenId] = fundContract;
        emit FundRegistered(tokenId, fundContract);
    }

    /**
     * @notice Allocate the next tokenId and return it.
     */
    function allocateTokenId() external onlyOwner returns (uint256) {
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        return tokenId;
    }

    /**
     * @notice Mint tokens. Only callable by the registered CrowdFund contract.
     */
    function mint(address to, uint256 tokenId, uint256 amount) external {
        require(fundContracts[tokenId] == msg.sender, "Caller is not the registered fund");
        _mint(to, tokenId, amount, "");
    }

    /**
     * @notice Burn tokens. Only callable by the registered CrowdFund contract.
     */
    function burn(address from, uint256 tokenId, uint256 amount) external {
        require(fundContracts[tokenId] == msg.sender, "Caller is not the registered fund");
        _burn(from, tokenId, amount);
    }
}
