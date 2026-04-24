// Creates DB projects in backend and links them to existing on-chain campaigns
const http = require("http");
const fs = require("fs");
const path = require("path");

const API_HOST = "localhost";
const API_PORT = 3001;

function request(method, pathStr, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: API_HOST,
        port: API_PORT,
        path: pathStr,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(out) });
          } catch {
            resolve({ status: res.statusCode, body: out });
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function login(email, password) {
  const r = await request("POST", "/api/auth/login", { email, password });
  if (r.status !== 200) throw new Error(`Login failed: ${JSON.stringify(r.body)}`);
  return r.body.token;
}

async function main() {
  // Authors already registered in prior API calls. Login them.
  const tokenA1 = await login("maria.petrova@greenworld.ru", "demo1234");
  const tokenA2 = await login("alex.ivanov@studio.ru", "demo1234");
  const tokenA3 = await login("tutor@blockchainlab.ru", "demo1234");

  // On-chain addresses from seed.js
  const campaigns = [
    {
      address: "0xCafac3dD18aC6c6e92c921884f9E4176737C052c",
      tokenId: 0,
      token: tokenA1,
      body: {
        title: "Эко-ферма «Чистая земля»",
        description: "Запускаем органическую ферму рядом с Нижним Новгородом: молочное производство, овощи открытого грунта и сыроварня. Все средства — с открытыми отчётами по этапам.",
        goal_amount: 10.0,
        duration_days: 30,
        platform_fee_percent: 2,
        milestones: [
          { description: "Закупка оборудования и земли", budget: 3.0, duration_days: 30 },
          { description: "Первый сельскохозяйственный цикл", budget: 4.0, duration_days: 60 },
          { description: "Расширение площадей и сыроварня", budget: 3.0, duration_days: 60 },
        ],
      },
    },
    {
      address: "0x9f1ac54BEF0DD2f6f3462EA0fa94fC62300d3a8e",
      tokenId: 1,
      token: tokenA2,
      body: {
        title: "Инди-игра «Последний миг»",
        description: "Сюжетно-ориентированный платформер от независимой студии из Санкт-Петербурга. Планируется релиз в Steam с русской и английской локализацией.",
        goal_amount: 5.0,
        duration_days: 30,
        platform_fee_percent: 3,
        milestones: [
          { description: "Прототип геймплея и технодемо", budget: 1.5, duration_days: 30 },
          { description: "Альфа-версия с первой главой", budget: 2.0, duration_days: 60 },
          { description: "Релиз в Steam", budget: 1.5, duration_days: 90 },
        ],
      },
    },
    {
      address: "0xbf9fBFf01664500A33080Da5d437028b07DFcC55",
      tokenId: 2,
      token: tokenA3,
      body: {
        title: "Онлайн-курс «Solidity с нуля»",
        description: "12 уроков по разработке смарт-контрактов для начинающих. Материалы включают видеоуроки, тесты и домашние задания с проверкой наставником.",
        goal_amount: 2.0,
        duration_days: 30,
        platform_fee_percent: 2,
        milestones: [
          { description: "Запись видеоуроков и материалов", budget: 1.0, duration_days: 30 },
          { description: "Монтаж, публикация на платформе", budget: 1.0, duration_days: 30 },
        ],
      },
    },
  ];

  for (const c of campaigns) {
    console.log(`\nCreating DB project: ${c.body.title}`);
    const created = await request("POST", "/api/projects", c.body, c.token);
    if (created.status !== 201) {
      console.error("Error:", created);
      continue;
    }
    console.log(`  DB id: ${created.body.id}`);

    const deploy = await request(
      "POST",
      `/api/projects/${created.body.id}/deploy`,
      { contract_address: c.address, token_id: c.tokenId },
      c.token
    );
    if (deploy.status !== 200) {
      console.error("Deploy link error:", deploy);
      continue;
    }
    console.log(`  Linked to ${c.address}`);
  }
  console.log("\nAll projects linked.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
