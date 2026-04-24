const { Sequelize } = require("sequelize");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const dbPath = path.join(__dirname, "../data/crowdfund.sqlite");

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      logging: false,
    })
  : new Sequelize({
      dialect: "sqlite",
      storage: dbPath,
      logging: false,
    });

module.exports = sequelize;
