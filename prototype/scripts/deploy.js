const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy InvestToken
  const InvestToken = await hre.ethers.getContractFactory("InvestToken");
  const investToken = await InvestToken.deploy();
  await investToken.waitForDeployment();
  const tokenAddress = await investToken.getAddress();
  console.log("InvestToken deployed to:", tokenAddress);

  // Deploy FundFactory
  const FundFactory = await hre.ethers.getContractFactory("FundFactory");
  const fundFactory = await FundFactory.deploy(tokenAddress);
  await fundFactory.waitForDeployment();
  const factoryAddress = await fundFactory.getAddress();
  console.log("FundFactory deployed to:", factoryAddress);

  // Transfer InvestToken ownership to FundFactory so it can register funds
  const tx = await investToken.transferOwnership(factoryAddress);
  await tx.wait();
  console.log("InvestToken ownership transferred to FundFactory");

  // Save deployment addresses for frontend/backend
  const addresses = {
    InvestToken: tokenAddress,
    FundFactory: factoryAddress,
    deployer: deployer.address,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  };

  const outputDir = path.join(__dirname, "..", "deployed");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outputDir, "addresses.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("Deployment addresses saved to deployed/addresses.json");

  // Copy ABIs for frontend/backend
  const abiDir = path.join(outputDir, "abi");
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  const contracts = ["InvestToken", "CrowdFund", "FundFactory"];
  for (const name of contracts) {
    const artifact = await hre.artifacts.readArtifact(name);
    fs.writeFileSync(
      path.join(abiDir, `${name}.json`),
      JSON.stringify({ abi: artifact.abi }, null, 2)
    );
  }
  console.log("ABIs saved to deployed/abi/");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
