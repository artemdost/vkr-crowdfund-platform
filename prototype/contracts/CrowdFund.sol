// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./InvestToken.sol";

/**
 * @title CrowdFund
 * @notice A single crowdfunding campaign with milestone-based escrow and investor voting.
 */
contract CrowdFund is ReentrancyGuard {
    // --- State ---
    address public author;
    address public platform;
    InvestToken public token;
    uint256 public tokenId;
    uint256 public goalAmount;
    uint256 public totalRaised;
    uint256 public deadline;
    uint256 public platformFeePercent;

    enum CampaignState { Funding, Active, Completed, Failed }
    CampaignState public state;

    enum MilestoneState { Pending, Voting, Approved, Rejected }

    struct MilestoneData {
        string description;
        uint256 budget;
        uint256 milestoneDeadline;
        MilestoneState status;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 votingEnd;
        uint8 attempts;
        string reportURI;
    }

    MilestoneData[] public milestones;
    uint256 public currentMilestone;

    mapping(address => uint256) public investments;
    // hasVoted[voteKey][voter] where voteKey = milestoneIndex * 10 + attempts
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // --- Events ---
    event Invested(address indexed investor, uint256 amount);
    event MilestoneSubmitted(uint256 indexed index, string reportURI);
    event Voted(address indexed voter, uint256 indexed milestoneIndex, bool approve, uint256 weight);
    event MilestoneApproved(uint256 indexed index);
    event MilestoneRejected(uint256 indexed index);
    event Refunded(address indexed investor, uint256 amount);
    event CampaignCompleted();
    event CampaignFailed();

    // --- Modifiers ---
    modifier onlyAuthor() {
        require(msg.sender == author, "Only author");
        _;
    }

    modifier inState(CampaignState _state) {
        require(state == _state, "Invalid campaign state");
        _;
    }

    // --- Constructor ---
    constructor(
        address _author,
        address _platform,
        address _token,
        uint256 _tokenId,
        uint256 _goalAmount,
        uint256 _deadline,
        uint256 _platformFeePercent,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneBudgets,
        uint256[] memory _milestoneDurations
    ) {
        require(_author != address(0), "Invalid author");
        require(_goalAmount > 0, "Goal must be > 0");
        require(_milestoneDescriptions.length > 0, "Need at least 1 milestone");
        require(
            _milestoneDescriptions.length == _milestoneBudgets.length &&
            _milestoneBudgets.length == _milestoneDurations.length,
            "Milestone arrays length mismatch"
        );

        uint256 budgetSum;
        for (uint256 i = 0; i < _milestoneBudgets.length; i++) {
            budgetSum += _milestoneBudgets[i];
        }
        require(budgetSum == _goalAmount, "Budgets must sum to goal");

        author = _author;
        platform = _platform;
        token = InvestToken(_token);
        tokenId = _tokenId;
        goalAmount = _goalAmount;
        deadline = _deadline;
        platformFeePercent = _platformFeePercent;
        state = CampaignState.Funding;

        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            milestones.push(MilestoneData({
                description: _milestoneDescriptions[i],
                budget: _milestoneBudgets[i],
                milestoneDeadline: _milestoneDurations[i],
                status: MilestoneState.Pending,
                votesFor: 0,
                votesAgainst: 0,
                votingEnd: 0,
                attempts: 0,
                reportURI: ""
            }));
        }
    }

    // --- Functions ---

    /**
     * @notice Invest ETH into the campaign. Tokens are minted proportionally.
     */
    function invest() external payable inState(CampaignState.Funding) nonReentrant {
        require(block.timestamp < deadline, "Campaign deadline passed");
        require(msg.value > 0, "Must send ETH");

        investments[msg.sender] += msg.value;
        totalRaised += msg.value;

        token.mint(msg.sender, tokenId, msg.value);
        emit Invested(msg.sender, msg.value);

        if (totalRaised >= goalAmount) {
            state = CampaignState.Active;
        }
    }

    /**
     * @notice Author submits a milestone report to start voting.
     */
    function submitMilestone(uint256 milestoneIndex, string calldata _reportURI) external onlyAuthor inState(CampaignState.Active) {
        require(milestoneIndex == currentMilestone, "Not current milestone");
        require(milestones[milestoneIndex].status == MilestoneState.Pending, "Milestone not pending");

        milestones[milestoneIndex].reportURI = _reportURI;
        milestones[milestoneIndex].status = MilestoneState.Voting;
        milestones[milestoneIndex].votingEnd = block.timestamp + 7 days;

        emit MilestoneSubmitted(milestoneIndex, _reportURI);
    }

    /**
     * @notice Investors vote on a milestone. Weight = token balance.
     */
    function vote(uint256 milestoneIndex, bool approve) external inState(CampaignState.Active) {
        MilestoneData storage ms = milestones[milestoneIndex];
        require(ms.status == MilestoneState.Voting, "Not in voting");
        require(block.timestamp < ms.votingEnd, "Voting ended");
        uint256 voteKey = milestoneIndex * 10 + ms.attempts;
        require(!hasVoted[voteKey][msg.sender], "Already voted");

        uint256 weight = token.balanceOf(msg.sender, tokenId);
        require(weight > 0, "No tokens");

        if (approve) {
            ms.votesFor += weight;
        } else {
            ms.votesAgainst += weight;
        }
        hasVoted[voteKey][msg.sender] = true;

        emit Voted(msg.sender, milestoneIndex, approve, weight);
    }

    /**
     * @notice Finalize voting after the voting period ends.
     */
    function finishVoting(uint256 milestoneIndex) external nonReentrant {
        MilestoneData storage ms = milestones[milestoneIndex];
        require(ms.status == MilestoneState.Voting, "Not in voting");
        require(block.timestamp >= ms.votingEnd, "Voting not ended yet");

        uint256 totalVotes = ms.votesFor + ms.votesAgainst;
        uint256 quorum = (totalVotes * 100) / totalRaised;
        require(quorum >= 10, "Quorum not reached (min 10%)");

        if (ms.votesFor > ms.votesAgainst) {
            // Approved: transfer budget to author minus platform fee
            ms.status = MilestoneState.Approved;

            uint256 fee = (ms.budget * platformFeePercent) / 100;
            uint256 payout = ms.budget - fee;

            (bool sentAuthor, ) = payable(author).call{value: payout}("");
            require(sentAuthor, "Author payout failed");

            if (fee > 0) {
                (bool sentPlatform, ) = payable(platform).call{value: fee}("");
                require(sentPlatform, "Platform fee transfer failed");
            }

            emit MilestoneApproved(milestoneIndex);

            currentMilestone++;
            if (currentMilestone >= milestones.length) {
                state = CampaignState.Completed;
                emit CampaignCompleted();
            }
        } else {
            ms.attempts++;
            if (ms.attempts >= 2) {
                ms.status = MilestoneState.Rejected;
                emit MilestoneRejected(milestoneIndex);
            } else {
                // Reset for retry
                ms.votesFor = 0;
                ms.votesAgainst = 0;
                ms.votingEnd = 0;
                ms.status = MilestoneState.Pending;
                ms.reportURI = "";
                // hasVoted uses voteKey = milestoneIndex * 10 + attempts,
                // so after incrementing attempts, voters can vote again.
            }
        }
    }

    /**
     * @notice Request a refund if the campaign failed or a milestone was permanently rejected.
     */
    function requestRefund() external nonReentrant {
        require(
            (state == CampaignState.Funding && block.timestamp > deadline && totalRaised < goalAmount) ||
            (state == CampaignState.Active && milestones[currentMilestone].status == MilestoneState.Rejected),
            "Refund not available"
        );

        uint256 userTokens = token.balanceOf(msg.sender, tokenId);
        require(userTokens > 0, "No tokens to refund");

        uint256 contractBalance = address(this).balance;
        uint256 refundAmount = (userTokens * contractBalance) / totalRaised;

        token.burn(msg.sender, tokenId, userTokens);

        (bool sent, ) = payable(msg.sender).call{value: refundAmount}("");
        require(sent, "Refund transfer failed");

        emit Refunded(msg.sender, refundAmount);

        if (address(this).balance == 0) {
            state = CampaignState.Failed;
            emit CampaignFailed();
        }
    }

    // --- View Functions ---

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function getMilestone(uint256 index) external view returns (MilestoneData memory) {
        return milestones[index];
    }

    function getInfo() external view returns (
        address _author,
        uint256 _goalAmount,
        uint256 _totalRaised,
        uint256 _deadline,
        CampaignState _state,
        uint256 _currentMilestone,
        uint256 _milestoneCount,
        uint256 _platformFeePercent
    ) {
        return (
            author,
            goalAmount,
            totalRaised,
            deadline,
            state,
            currentMilestone,
            milestones.length,
            platformFeePercent
        );
    }

    receive() external payable {}
}
