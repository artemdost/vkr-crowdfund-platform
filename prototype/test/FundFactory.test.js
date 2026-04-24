const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("FundFactory", function () {
  async function deployFixture() {
    const [platform, author, investor1] = await ethers.getSigners();

    const InvestToken = await ethers.getContractFactory("InvestToken");
    const token = await InvestToken.deploy();
    await token.waitForDeployment();

    const FundFactory = await ethers.getContractFactory("FundFactory");
    const factory = await FundFactory.deploy(await token.getAddress());
    await factory.waitForDeployment();

    // Transfer token ownership to factory
    await token.transferOwnership(await factory.getAddress());

    return { factory, token, platform, author, investor1 };
  }

  it("should deploy a new CrowdFund contract", async function () {
    const { factory, author } = await loadFixture(deployFixture);

    const goal = ethers.parseEther("1");
    const tx = await factory.connect(author).createCampaign(
      goal,
      30,
      ["Milestone 1", "Milestone 2"],
      [ethers.parseEther("0.6"), ethers.parseEther("0.4")],
      [30, 60],
      2
    );

    const receipt = await tx.wait();
    const campaigns = await factory.getCampaigns();
    expect(campaigns.length).to.equal(1);
    expect(campaigns[0]).to.not.equal(ethers.ZeroAddress);
  });

  it("should register tokenId in InvestToken", async function () {
    const { factory, token, author } = await loadFixture(deployFixture);

    const goal = ethers.parseEther("1");
    await factory.connect(author).createCampaign(
      goal, 30,
      ["Milestone 1"],
      [ethers.parseEther("1")],
      [30],
      2
    );

    const campaigns = await factory.getCampaigns();
    const fundAddr = await token.fundContracts(0);
    expect(fundAddr).to.equal(campaigns[0]);
  });

  it("should track campaigns by user", async function () {
    const { factory, author } = await loadFixture(deployFixture);

    const goal = ethers.parseEther("1");
    await factory.connect(author).createCampaign(
      goal, 30,
      ["Milestone 1"],
      [goal],
      [30],
      2
    );

    const userCampaigns = await factory.getUserCampaigns(author.address);
    expect(userCampaigns.length).to.equal(1);
  });

  it("should reject if milestone budgets don't sum to goal", async function () {
    const { factory, author } = await loadFixture(deployFixture);

    const goal = ethers.parseEther("1");
    await expect(
      factory.connect(author).createCampaign(
        goal, 30,
        ["Milestone 1", "Milestone 2"],
        [ethers.parseEther("0.3"), ethers.parseEther("0.3")],
        [30, 60],
        2
      )
    ).to.be.revertedWith("Budgets must sum to goal");
  });

  it("should store campaign address in array", async function () {
    const { factory, author } = await loadFixture(deployFixture);

    const goal = ethers.parseEther("1");

    await factory.connect(author).createCampaign(
      goal, 30, ["M1"], [goal], [30], 2
    );
    await factory.connect(author).createCampaign(
      goal, 30, ["M1"], [goal], [30], 1
    );

    expect(await factory.getCampaignCount()).to.equal(2);
    const all = await factory.getCampaigns();
    expect(all.length).to.equal(2);
  });
});
