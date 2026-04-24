const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const NETWORK_URL = process.env.HARDHAT_NETWORK_URL || "http://127.0.0.1:8545";

function getProvider() {
  return new ethers.JsonRpcProvider(NETWORK_URL);
}

function getPlatformSigner() {
  const provider = getProvider();
  const privateKey = process.env.PLATFORM_PRIVATE_KEY;
  return new ethers.Wallet(privateKey, provider);
}

function loadABI(contractName) {
  const abiPath = path.join(__dirname, "../../deployed/abi", `${contractName}.json`);
  if (!fs.existsSync(abiPath)) {
    throw new Error(`ABI not found for ${contractName}. Run deploy first.`);
  }
  const data = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
  return data.abi;
}

function loadAddresses() {
  const addrPath = path.join(__dirname, "../../deployed/addresses.json");
  if (!fs.existsSync(addrPath)) {
    throw new Error("Deployment addresses not found. Run deploy first.");
  }
  return JSON.parse(fs.readFileSync(addrPath, "utf-8"));
}

function getFactoryContract(signerOrProvider) {
  const addresses = loadAddresses();
  const abi = loadABI("FundFactory");
  return new ethers.Contract(addresses.FundFactory, abi, signerOrProvider);
}

function getCrowdFundContract(address, signerOrProvider) {
  const abi = loadABI("CrowdFund");
  return new ethers.Contract(address, abi, signerOrProvider);
}

function getTokenContract(signerOrProvider) {
  const addresses = loadAddresses();
  const abi = loadABI("InvestToken");
  return new ethers.Contract(addresses.InvestToken, abi, signerOrProvider);
}

async function getCampaignInfo(campaignAddress) {
  const provider = getProvider();
  const campaign = getCrowdFundContract(campaignAddress, provider);
  const info = await campaign.getInfo();

  return {
    author: info._author,
    goalAmount: ethers.formatEther(info._goalAmount),
    totalRaised: ethers.formatEther(info._totalRaised),
    deadline: Number(info._deadline),
    state: Number(info._state),
    currentMilestone: Number(info._currentMilestone),
    milestoneCount: Number(info._milestoneCount),
    platformFeePercent: Number(info._platformFeePercent),
  };
}

async function listenToEvents(campaignAddress, callbacks) {
  const provider = getProvider();
  const campaign = getCrowdFundContract(campaignAddress, provider);

  if (callbacks.onInvested) {
    campaign.on("Invested", callbacks.onInvested);
  }
  if (callbacks.onMilestoneApproved) {
    campaign.on("MilestoneApproved", callbacks.onMilestoneApproved);
  }
  if (callbacks.onMilestoneRejected) {
    campaign.on("MilestoneRejected", callbacks.onMilestoneRejected);
  }
  if (callbacks.onRefunded) {
    campaign.on("Refunded", callbacks.onRefunded);
  }
  if (callbacks.onCompleted) {
    campaign.on("CampaignCompleted", callbacks.onCompleted);
  }
  if (callbacks.onFailed) {
    campaign.on("CampaignFailed", callbacks.onFailed);
  }

  return campaign;
}

module.exports = {
  getProvider,
  getPlatformSigner,
  loadABI,
  loadAddresses,
  getFactoryContract,
  getCrowdFundContract,
  getTokenContract,
  getCampaignInfo,
  listenToEvents,
};
