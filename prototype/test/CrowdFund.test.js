const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CrowdFund", function () {
  const GOAL = ethers.parseEther("1");
  const FEE_PERCENT = 2;
  const SEVEN_DAYS = 7 * 24 * 60 * 60;

  async function deployWithCampaignFixture() {
    const [platform, author, investor1, investor2, investor3, outsider] =
      await ethers.getSigners();

    // Deploy token
    const InvestToken = await ethers.getContractFactory("InvestToken");
    const token = await InvestToken.deploy();
    await token.waitForDeployment();

    // Deploy factory
    const FundFactory = await ethers.getContractFactory("FundFactory");
    const factory = await FundFactory.deploy(await token.getAddress());
    await factory.waitForDeployment();
    await token.transferOwnership(await factory.getAddress());

    // Create campaign: 3 milestones (0.3 + 0.3 + 0.4 = 1 ETH)
    const tx = await factory.connect(author).createCampaign(
      GOAL,
      30,
      ["Phase 1: Design", "Phase 2: Development", "Phase 3: Launch"],
      [
        ethers.parseEther("0.3"),
        ethers.parseEther("0.3"),
        ethers.parseEther("0.4"),
      ],
      [30, 60, 90],
      FEE_PERCENT
    );
    await tx.wait();

    const campaigns = await factory.getCampaigns();
    const campaignAddr = campaigns[0];

    const CrowdFund = await ethers.getContractFactory("CrowdFund");
    const campaign = CrowdFund.attach(campaignAddr);

    return {
      token,
      factory,
      campaign,
      platform,
      author,
      investor1,
      investor2,
      investor3,
      outsider,
    };
  }

  async function fundedCampaignFixture() {
    const fixture = await deployWithCampaignFixture();
    const { campaign, investor1, investor2, investor3 } = fixture;

    // Fund the campaign to reach goal
    await campaign.connect(investor1).invest({ value: ethers.parseEther("0.4") });
    await campaign.connect(investor2).invest({ value: ethers.parseEther("0.3") });
    await campaign.connect(investor3).invest({ value: ethers.parseEther("0.3") });

    return fixture;
  }

  // --- Investment tests ---

  it("should accept investments and mint tokens", async function () {
    const { campaign, token, investor1 } = await loadFixture(deployWithCampaignFixture);

    await campaign.connect(investor1).invest({ value: ethers.parseEther("0.5") });

    expect(await campaign.totalRaised()).to.equal(ethers.parseEther("0.5"));
    const tokenId = await campaign.tokenId();
    expect(await token.balanceOf(investor1.address, tokenId)).to.equal(
      ethers.parseEther("0.5")
    );
  });

  it("should reject investment after deadline", async function () {
    const { campaign, investor1 } = await loadFixture(deployWithCampaignFixture);

    await time.increase(31 * 24 * 60 * 60); // 31 days

    await expect(
      campaign.connect(investor1).invest({ value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Campaign deadline passed");
  });

  it("should transition to Active state when goal is met", async function () {
    const { campaign } = await loadFixture(fundedCampaignFixture);

    expect(await campaign.state()).to.equal(1); // Active
    expect(await campaign.totalRaised()).to.equal(GOAL);
  });

  // --- Milestone submission tests ---

  it("should allow author to submit milestone", async function () {
    const { campaign, author } = await loadFixture(fundedCampaignFixture);

    await expect(campaign.connect(author).submitMilestone(0, "ipfs://report1"))
      .to.emit(campaign, "MilestoneSubmitted")
      .withArgs(0, "ipfs://report1");

    const ms = await campaign.getMilestone(0);
    expect(ms.status).to.equal(1); // Voting
  });

  it("should reject milestone submission from non-author", async function () {
    const { campaign, investor1 } = await loadFixture(fundedCampaignFixture);

    await expect(
      campaign.connect(investor1).submitMilestone(0, "ipfs://report1")
    ).to.be.revertedWith("Only author");
  });

  // --- Voting tests ---

  it("should allow investors to vote", async function () {
    const { campaign, author, investor1 } = await loadFixture(fundedCampaignFixture);

    await campaign.connect(author).submitMilestone(0, "ipfs://report1");

    await expect(campaign.connect(investor1).vote(0, true))
      .to.emit(campaign, "Voted");

    const ms = await campaign.getMilestone(0);
    expect(ms.votesFor).to.equal(ethers.parseEther("0.4"));
  });

  it("should reject double voting", async function () {
    const { campaign, author, investor1 } = await loadFixture(fundedCampaignFixture);

    await campaign.connect(author).submitMilestone(0, "ipfs://report1");
    await campaign.connect(investor1).vote(0, true);

    await expect(
      campaign.connect(investor1).vote(0, true)
    ).to.be.revertedWith("Already voted");
  });

  it("should approve milestone if majority votes yes", async function () {
    const { campaign, author, investor1, investor2, investor3 } =
      await loadFixture(fundedCampaignFixture);

    await campaign.connect(author).submitMilestone(0, "ipfs://report1");
    await campaign.connect(investor1).vote(0, true); // 0.4 ETH
    await campaign.connect(investor2).vote(0, true); // 0.3 ETH
    await campaign.connect(investor3).vote(0, false); // 0.3 ETH

    await time.increase(SEVEN_DAYS);

    await expect(campaign.finishVoting(0))
      .to.emit(campaign, "MilestoneApproved")
      .withArgs(0);

    const ms = await campaign.getMilestone(0);
    expect(ms.status).to.equal(2); // Approved
    expect(await campaign.currentMilestone()).to.equal(1);
  });

  it("should reject milestone if majority votes no", async function () {
    const { campaign, author, investor1, investor2, investor3 } =
      await loadFixture(fundedCampaignFixture);

    await campaign.connect(author).submitMilestone(0, "ipfs://report1");
    await campaign.connect(investor1).vote(0, false); // 0.4 ETH
    await campaign.connect(investor2).vote(0, false); // 0.3 ETH
    await campaign.connect(investor3).vote(0, true);  // 0.3 ETH

    await time.increase(SEVEN_DAYS);
    await campaign.finishVoting(0);

    // First rejection resets to Pending (attempt 1)
    const ms = await campaign.getMilestone(0);
    expect(ms.status).to.equal(0); // Pending (reset for retry)
    expect(ms.attempts).to.equal(1);
  });

  it("should allow retry after first rejection", async function () {
    const { campaign, author, investor1, investor2, investor3 } =
      await loadFixture(fundedCampaignFixture);

    // First attempt - rejected
    await campaign.connect(author).submitMilestone(0, "ipfs://report1");
    await campaign.connect(investor1).vote(0, false);
    await campaign.connect(investor2).vote(0, false);
    await campaign.connect(investor3).vote(0, true);
    await time.increase(SEVEN_DAYS);
    await campaign.finishVoting(0);

    // Should be back to Pending
    let ms = await campaign.getMilestone(0);
    expect(ms.status).to.equal(0); // Pending

    // Author can submit again
    await campaign.connect(author).submitMilestone(0, "ipfs://report1-v2");
    ms = await campaign.getMilestone(0);
    expect(ms.status).to.equal(1); // Voting again
  });

  it("should permanently reject after two failed votes", async function () {
    const { campaign, author, investor1, investor2, investor3 } =
      await loadFixture(fundedCampaignFixture);

    // First attempt
    await campaign.connect(author).submitMilestone(0, "ipfs://report1");
    await campaign.connect(investor1).vote(0, false);
    await campaign.connect(investor2).vote(0, false);
    await campaign.connect(investor3).vote(0, true);
    await time.increase(SEVEN_DAYS);
    await campaign.finishVoting(0);

    // Second attempt
    await campaign.connect(author).submitMilestone(0, "ipfs://report1-v2");
    await campaign.connect(investor1).vote(0, false);
    await campaign.connect(investor2).vote(0, false);
    await campaign.connect(investor3).vote(0, true);
    await time.increase(SEVEN_DAYS);
    await campaign.finishVoting(0);

    const ms = await campaign.getMilestone(0);
    expect(ms.status).to.equal(3); // Rejected permanently
    expect(ms.attempts).to.equal(2);
  });

  it("should transfer budget to author on approval (minus fee)", async function () {
    const { campaign, author, investor1, investor2, investor3 } =
      await loadFixture(fundedCampaignFixture);

    await campaign.connect(author).submitMilestone(0, "ipfs://report1");
    await campaign.connect(investor1).vote(0, true);
    await campaign.connect(investor2).vote(0, true);
    await campaign.connect(investor3).vote(0, true);
    await time.increase(SEVEN_DAYS);

    const authorBalBefore = await ethers.provider.getBalance(author.address);
    await campaign.connect(investor1).finishVoting(0); // called by investor1 to avoid gas from author

    const authorBalAfter = await ethers.provider.getBalance(author.address);
    const milestoneBudget = ethers.parseEther("0.3");
    const fee = (milestoneBudget * BigInt(FEE_PERCENT)) / 100n;
    const expectedPayout = milestoneBudget - fee;

    expect(authorBalAfter - authorBalBefore).to.equal(expectedPayout);
  });

  it("should transfer fee to platform on approval", async function () {
    const { campaign, platform, author, investor1, investor2, investor3 } =
      await loadFixture(fundedCampaignFixture);

    await campaign.connect(author).submitMilestone(0, "ipfs://report1");
    await campaign.connect(investor1).vote(0, true);
    await campaign.connect(investor2).vote(0, true);
    await campaign.connect(investor3).vote(0, true);
    await time.increase(SEVEN_DAYS);

    const platformBalBefore = await ethers.provider.getBalance(platform.address);
    await campaign.connect(investor1).finishVoting(0);

    const platformBalAfter = await ethers.provider.getBalance(platform.address);
    const milestoneBudget = ethers.parseEther("0.3");
    const expectedFee = (milestoneBudget * BigInt(FEE_PERCENT)) / 100n;

    expect(platformBalAfter - platformBalBefore).to.equal(expectedFee);
  });

  // --- Refund tests ---

  it("should allow refund if campaign fails (deadline passed, goal not met)", async function () {
    const { campaign, token, investor1 } = await loadFixture(deployWithCampaignFixture);

    await campaign.connect(investor1).invest({ value: ethers.parseEther("0.3") });

    await time.increase(31 * 24 * 60 * 60); // past deadline

    const balBefore = await ethers.provider.getBalance(investor1.address);
    const tx = await campaign.connect(investor1).requestRefund();
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(investor1.address);

    expect(balAfter + gasCost - balBefore).to.be.closeTo(
      ethers.parseEther("0.3"),
      ethers.parseEther("0.001")
    );
  });

  it("should allow refund if milestone permanently rejected", async function () {
    const { campaign, author, investor1, investor2, investor3 } =
      await loadFixture(fundedCampaignFixture);

    // Reject milestone twice
    for (let i = 0; i < 2; i++) {
      await campaign.connect(author).submitMilestone(0, `ipfs://report-${i}`);
      await campaign.connect(investor1).vote(0, false);
      await campaign.connect(investor2).vote(0, false);
      await campaign.connect(investor3).vote(0, true);
      await time.increase(SEVEN_DAYS);
      await campaign.finishVoting(0);
    }

    // investor1 requests refund
    await expect(campaign.connect(investor1).requestRefund())
      .to.emit(campaign, "Refunded");
  });

  it("should calculate refund proportionally to token balance", async function () {
    const { campaign, investor1, investor2, investor3 } =
      await loadFixture(deployWithCampaignFixture);

    await campaign.connect(investor1).invest({ value: ethers.parseEther("0.3") });
    await campaign.connect(investor2).invest({ value: ethers.parseEther("0.2") });

    await time.increase(31 * 24 * 60 * 60);

    const contractBal = await ethers.provider.getBalance(await campaign.getAddress());
    const totalRaised = await campaign.totalRaised();

    // investor1 should get 0.3/0.5 of balance = 60%
    const balBefore = await ethers.provider.getBalance(investor1.address);
    const tx = await campaign.connect(investor1).requestRefund();
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(investor1.address);

    const refundReceived = balAfter + gasCost - balBefore;
    const expectedRefund = (ethers.parseEther("0.3") * contractBal) / totalRaised;

    expect(refundReceived).to.be.closeTo(expectedRefund, ethers.parseEther("0.001"));
  });

  it("should burn tokens after refund", async function () {
    const { campaign, token, investor1 } = await loadFixture(deployWithCampaignFixture);

    await campaign.connect(investor1).invest({ value: ethers.parseEther("0.3") });

    await time.increase(31 * 24 * 60 * 60);
    await campaign.connect(investor1).requestRefund();

    const tokenId = await campaign.tokenId();
    expect(await token.balanceOf(investor1.address, tokenId)).to.equal(0);
  });

  it("should complete campaign after all milestones approved", async function () {
    const { campaign, author, investor1, investor2, investor3 } =
      await loadFixture(fundedCampaignFixture);

    // Approve all 3 milestones
    for (let i = 0; i < 3; i++) {
      await campaign.connect(author).submitMilestone(i, `ipfs://report-${i}`);
      await campaign.connect(investor1).vote(i, true);
      await campaign.connect(investor2).vote(i, true);
      await campaign.connect(investor3).vote(i, true);
      await time.increase(SEVEN_DAYS);
      await campaign.finishVoting(i);
    }

    expect(await campaign.state()).to.equal(2); // Completed
  });

  it("should enforce quorum (10% minimum)", async function () {
    const { campaign, author, investor1 } =
      await loadFixture(fundedCampaignFixture);

    await campaign.connect(author).submitMilestone(0, "ipfs://report1");
    // Only investor1 votes with 0.4 ETH out of 1 ETH = 40% (passes quorum), but let's test no votes
    await time.increase(SEVEN_DAYS);

    // No one voted, quorum = 0
    await expect(campaign.finishVoting(0)).to.be.revertedWith(
      "Quorum not reached (min 10%)"
    );
  });

  it("should reject voting after voting period ends", async function () {
    const { campaign, author, investor1 } = await loadFixture(fundedCampaignFixture);

    await campaign.connect(author).submitMilestone(0, "ipfs://report1");
    await time.increase(SEVEN_DAYS + 1);

    await expect(
      campaign.connect(investor1).vote(0, true)
    ).to.be.revertedWith("Voting ended");
  });

  it("should reject voting from address with no tokens", async function () {
    const { campaign, author, outsider } = await loadFixture(fundedCampaignFixture);

    await campaign.connect(author).submitMilestone(0, "ipfs://report1");

    await expect(
      campaign.connect(outsider).vote(0, true)
    ).to.be.revertedWith("No tokens");
  });
});
