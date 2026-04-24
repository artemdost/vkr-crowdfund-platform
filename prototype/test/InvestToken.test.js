const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("InvestToken", function () {
  async function deployFixture() {
    const [owner, fundContract, user1, user2, unauthorized] = await ethers.getSigners();

    const InvestToken = await ethers.getContractFactory("InvestToken");
    const token = await InvestToken.deploy();
    await token.waitForDeployment();

    // Allocate tokenId 0 and register fundContract
    await token.allocateTokenId();
    await token.registerFund(0, fundContract.address);

    return { token, owner, fundContract, user1, user2, unauthorized };
  }

  it("should mint tokens only from registered fund contract", async function () {
    const { token, fundContract, user1 } = await loadFixture(deployFixture);

    await token.connect(fundContract).mint(user1.address, 0, ethers.parseEther("1"));
    const balance = await token.balanceOf(user1.address, 0);
    expect(balance).to.equal(ethers.parseEther("1"));
  });

  it("should burn tokens only from registered fund contract", async function () {
    const { token, fundContract, user1 } = await loadFixture(deployFixture);

    await token.connect(fundContract).mint(user1.address, 0, ethers.parseEther("2"));
    await token.connect(fundContract).burn(user1.address, 0, ethers.parseEther("1"));

    const balance = await token.balanceOf(user1.address, 0);
    expect(balance).to.equal(ethers.parseEther("1"));
  });

  it("should reject mint from unauthorized address", async function () {
    const { token, unauthorized, user1 } = await loadFixture(deployFixture);

    await expect(
      token.connect(unauthorized).mint(user1.address, 0, ethers.parseEther("1"))
    ).to.be.revertedWith("Caller is not the registered fund");
  });

  it("should reject burn from unauthorized address", async function () {
    const { token, fundContract, unauthorized, user1 } = await loadFixture(deployFixture);

    await token.connect(fundContract).mint(user1.address, 0, ethers.parseEther("1"));

    await expect(
      token.connect(unauthorized).burn(user1.address, 0, ethers.parseEther("1"))
    ).to.be.revertedWith("Caller is not the registered fund");
  });

  it("should track balances correctly", async function () {
    const { token, fundContract, user1, user2 } = await loadFixture(deployFixture);

    await token.connect(fundContract).mint(user1.address, 0, ethers.parseEther("3"));
    await token.connect(fundContract).mint(user2.address, 0, ethers.parseEther("5"));

    expect(await token.balanceOf(user1.address, 0)).to.equal(ethers.parseEther("3"));
    expect(await token.balanceOf(user2.address, 0)).to.equal(ethers.parseEther("5"));
  });

  it("should support transfers between users (secondary market)", async function () {
    const { token, fundContract, user1, user2 } = await loadFixture(deployFixture);

    await token.connect(fundContract).mint(user1.address, 0, ethers.parseEther("4"));

    // user1 transfers 1 ETH worth of tokens to user2
    await token.connect(user1).safeTransferFrom(
      user1.address, user2.address, 0, ethers.parseEther("1"), "0x"
    );

    expect(await token.balanceOf(user1.address, 0)).to.equal(ethers.parseEther("3"));
    expect(await token.balanceOf(user2.address, 0)).to.equal(ethers.parseEther("1"));
  });

  it("should not allow registering same tokenId twice", async function () {
    const { token, owner, fundContract } = await loadFixture(deployFixture);

    await expect(
      token.registerFund(0, fundContract.address)
    ).to.be.revertedWith("Token already registered");
  });

  it("should allocate sequential tokenIds", async function () {
    const { token } = await loadFixture(deployFixture);

    // tokenId 0 already allocated in fixture, next should be 1
    const tx = await token.allocateTokenId();
    const receipt = await tx.wait();
    expect(await token.nextTokenId()).to.equal(2);
  });
});
