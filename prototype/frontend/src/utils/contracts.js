import { ethers } from "ethers";

// ABI definitions matching the deployed contracts
const FACTORY_ABI = [
  "function createCampaign(uint256 goal, uint256 durationDays, string[] calldata milestoneDescriptions, uint256[] calldata milestoneBudgets, uint256[] calldata milestoneDurations, uint256 _platformFeePercent) external returns (address)",
  "function getCampaigns() external view returns (address[])",
  "function getUserCampaigns(address user) external view returns (address[])",
  "function getCampaignCount() external view returns (uint256)",
  "function token() external view returns (address)",
  "function platform() external view returns (address)",
  "event CampaignCreated(address indexed campaignAddress, address indexed author, uint256 tokenId, uint256 goalAmount)",
];

const CROWDFUND_ABI = [
  "function author() external view returns (address)",
  "function platform() external view returns (address)",
  "function token() external view returns (address)",
  "function tokenId() external view returns (uint256)",
  "function goalAmount() external view returns (uint256)",
  "function totalRaised() external view returns (uint256)",
  "function deadline() external view returns (uint256)",
  "function platformFeePercent() external view returns (uint256)",
  "function state() external view returns (uint8)",
  "function currentMilestone() external view returns (uint256)",
  "function investments(address) external view returns (uint256)",
  "function hasVoted(uint256, address) external view returns (bool)",
  "function invest() external payable",
  "function submitMilestone(uint256 milestoneIndex, string calldata _reportURI) external",
  "function vote(uint256 milestoneIndex, bool approve) external",
  "function finishVoting(uint256 milestoneIndex) external",
  "function requestRefund() external",
  "function getMilestoneCount() external view returns (uint256)",
  "function getMilestone(uint256 index) external view returns (tuple(string description, uint256 budget, uint256 milestoneDeadline, uint8 status, uint256 votesFor, uint256 votesAgainst, uint256 votingEnd, uint8 attempts, string reportURI))",
  "function getInfo() external view returns (address _author, uint256 _goalAmount, uint256 _totalRaised, uint256 _deadline, uint8 _state, uint256 _currentMilestone, uint256 _milestoneCount, uint256 _platformFeePercent)",
  "event Invested(address indexed investor, uint256 amount)",
  "event MilestoneSubmitted(uint256 indexed index, string reportURI)",
  "event Voted(address indexed voter, uint256 indexed milestoneIndex, bool approve, uint256 weight)",
  "event MilestoneApproved(uint256 indexed index)",
  "event MilestoneRejected(uint256 indexed index)",
  "event Refunded(address indexed investor, uint256 amount)",
  "event CampaignCompleted()",
  "event CampaignFailed()",
];

const TOKEN_ABI = [
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function fundContracts(uint256) external view returns (address)",
  "function nextTokenId() external view returns (uint256)",
];

// Load deployed addresses dynamically from deploy output
let addressCache = null;

async function loadAddresses() {
  if (addressCache) return addressCache;
  try {
    const res = await fetch("/deployed/addresses.json");
    if (res.ok) {
      addressCache = await res.json();
      return addressCache;
    }
  } catch {}
  // Fallback: hardcoded
  return {
    FundFactory: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    InvestToken: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  };
}

/**
 * Get a FundFactory contract instance connected to the given signer.
 */
export async function getFactoryContract(signerOrProvider) {
  const addresses = await loadAddresses();
  if (!addresses.FundFactory) {
    throw new Error("FundFactory address not configured");
  }
  return new ethers.Contract(addresses.FundFactory, FACTORY_ABI, signerOrProvider);
}

/**
 * Get a CrowdFund contract instance at a specific address.
 */
export function getCrowdFundContract(address, signerOrProvider) {
  return new ethers.Contract(address, CROWDFUND_ABI, signerOrProvider);
}

/**
 * Get the InvestToken contract instance.
 */
export async function getTokenContract(signerOrProvider) {
  const addresses = await loadAddresses();
  if (!addresses.InvestToken) {
    throw new Error("InvestToken address not configured");
  }
  return new ethers.Contract(addresses.InvestToken, TOKEN_ABI, signerOrProvider);
}

/**
 * Reset the address cache (useful after a new deployment).
 */
export function resetAddressCache() {
  addressCache = null;
}
