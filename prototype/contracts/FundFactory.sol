// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./InvestToken.sol";
import "./CrowdFund.sol";

/**
 * @title FundFactory
 * @notice Factory contract that deploys new CrowdFund campaigns and registers tokens.
 */
contract FundFactory {
    InvestToken public token;
    address public platform;
    address[] public campaigns;
    mapping(address => address[]) public userCampaigns;

    event CampaignCreated(
        address indexed campaignAddress,
        address indexed author,
        uint256 tokenId,
        uint256 goalAmount
    );

    constructor(address _token) {
        token = InvestToken(_token);
        platform = msg.sender;
    }

    /**
     * @notice Create a new crowdfunding campaign.
     * @param goal Target amount in wei.
     * @param durationDays Funding period in days.
     * @param milestoneDescriptions Array of milestone descriptions.
     * @param milestoneBudgets Array of budgets per milestone (must sum to goal).
     * @param milestoneDurations Array of durations per milestone in days.
     * @param _platformFeePercent Platform fee percentage (1-3).
     */
    function createCampaign(
        uint256 goal,
        uint256 durationDays,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestoneBudgets,
        uint256[] calldata milestoneDurations,
        uint256 _platformFeePercent
    ) external returns (address) {
        require(milestoneDescriptions.length > 0, "Need milestones");
        require(
            milestoneDescriptions.length == milestoneBudgets.length &&
            milestoneBudgets.length == milestoneDurations.length,
            "Array length mismatch"
        );
        require(_platformFeePercent <= 5, "Fee too high");

        uint256 budgetSum;
        for (uint256 i = 0; i < milestoneBudgets.length; i++) {
            budgetSum += milestoneBudgets[i];
        }
        require(budgetSum == goal, "Budgets must sum to goal");

        // Allocate a new tokenId
        uint256 newTokenId = token.allocateTokenId();

        uint256 campaignDeadline = block.timestamp + (durationDays * 1 days);

        CrowdFund campaign = new CrowdFund(
            msg.sender,
            platform,
            address(token),
            newTokenId,
            goal,
            campaignDeadline,
            _platformFeePercent,
            milestoneDescriptions,
            milestoneBudgets,
            milestoneDurations
        );

        // Register fund contract for minting
        token.registerFund(newTokenId, address(campaign));

        campaigns.push(address(campaign));
        userCampaigns[msg.sender].push(address(campaign));

        emit CampaignCreated(address(campaign), msg.sender, newTokenId, goal);

        return address(campaign);
    }

    function getCampaigns() external view returns (address[] memory) {
        return campaigns;
    }

    function getUserCampaigns(address user) external view returns (address[] memory) {
        return userCampaigns[user];
    }

    function getCampaignCount() external view returns (uint256) {
        return campaigns.length;
    }
}
