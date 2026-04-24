const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const addresses = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed", "addresses.json"))
  );

  const [platform, author1, author2, author3, investor1, investor2, investor3] =
    await hre.ethers.getSigners();

  const factory = await hre.ethers.getContractAt(
    "FundFactory",
    addresses.FundFactory,
    platform
  );

  const parseEth = (v) => hre.ethers.parseEther(String(v));

  // === Campaign 1: Funding (in progress) ===
  console.log("Creating campaign 1: Эко-ферма 'Чистая земля'");
  let tx = await factory.connect(author1).createCampaign(
    parseEth("10"),
    30,
    ["Закупка оборудования", "Первый урожай", "Расширение площадей"],
    [parseEth("3"), parseEth("4"), parseEth("3")],
    [30, 60, 60],
    2
  );
  await tx.wait();

  // === Campaign 2: Active (goal reached, voting on milestone 1) ===
  console.log("Creating campaign 2: Инди-игра 'Последний миг'");
  tx = await factory.connect(author2).createCampaign(
    parseEth("5"),
    30,
    ["Прототип геймплея", "Альфа-версия", "Релиз в Steam"],
    [parseEth("1.5"), parseEth("2"), parseEth("1.5")],
    [30, 60, 90],
    3
  );
  await tx.wait();

  // === Campaign 3: Completed ===
  console.log("Creating campaign 3: Онлайн-курс по Solidity");
  tx = await factory.connect(author3).createCampaign(
    parseEth("2"),
    30,
    ["Запись уроков", "Монтаж и публикация"],
    [parseEth("1"), parseEth("1")],
    [30, 30],
    2
  );
  await tx.wait();

  const campaigns = await factory.getCampaigns();
  console.log("\nCreated campaigns:");
  campaigns.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));

  // Fund campaign 1 partially (Funding state)
  const cf1 = await hre.ethers.getContractAt("CrowdFund", campaigns[0]);
  console.log("\nFunding campaign 1 (partial)...");
  await cf1.connect(investor1).invest({ value: parseEth("1.5") });
  await cf1.connect(investor2).invest({ value: parseEth("2") });

  // Fund campaign 2 fully (reaches goal -> Active)
  const cf2 = await hre.ethers.getContractAt("CrowdFund", campaigns[1]);
  console.log("Funding campaign 2 (full -> Active)...");
  await cf2.connect(investor1).invest({ value: parseEth("2") });
  await cf2.connect(investor2).invest({ value: parseEth("2") });
  await cf2.connect(investor3).invest({ value: parseEth("1") });

  // Submit first milestone and start voting
  console.log("Submitting milestone 1 of campaign 2...");
  await cf2
    .connect(author2)
    .submitMilestone(
      0,
      "ipfs://QmExampleReportCIDForMilestone1AlphaBuild"
    );

  // Cast two votes for (majority)
  console.log("Investors voting on milestone 1...");
  await cf2.connect(investor1).vote(0, true);
  await cf2.connect(investor2).vote(0, true);

  // Fund and fully complete campaign 3
  const cf3 = await hre.ethers.getContractAt("CrowdFund", campaigns[2]);
  console.log("Funding campaign 3 (full)...");
  await cf3.connect(investor1).invest({ value: parseEth("1") });
  await cf3.connect(investor2).invest({ value: parseEth("1") });

  // Milestone 1 full cycle
  console.log("Completing milestone 1 of campaign 3...");
  await cf3
    .connect(author3)
    .submitMilestone(0, "ipfs://QmCourseLessonsReport");
  await cf3.connect(investor1).vote(0, true);
  await cf3.connect(investor2).vote(0, true);

  // Advance time by 8 days for voting to end
  await hre.network.provider.send("evm_increaseTime", [8 * 24 * 3600]);
  await hre.network.provider.send("evm_mine");
  await cf3.connect(platform).finishVoting(0);

  // Milestone 2 full cycle
  console.log("Completing milestone 2 of campaign 3...");
  await cf3
    .connect(author3)
    .submitMilestone(1, "ipfs://QmCourseEditingReport");
  await cf3.connect(investor1).vote(1, true);
  await cf3.connect(investor2).vote(1, true);
  await hre.network.provider.send("evm_increaseTime", [8 * 24 * 3600]);
  await hre.network.provider.send("evm_mine");
  await cf3.connect(platform).finishVoting(1);

  console.log("\nSeed complete!");
  console.log("Accounts (use these in MetaMask with Hardhat network):");
  console.log("  Author1:   ", author1.address);
  console.log("  Author2:   ", author2.address);
  console.log("  Author3:   ", author3.address);
  console.log("  Investor1: ", investor1.address);
  console.log("  Investor2: ", investor2.address);
  console.log("  Investor3: ", investor3.address);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
