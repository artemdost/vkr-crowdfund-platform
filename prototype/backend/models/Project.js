const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Project = sequelize.define("Project", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  goal_amount: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  current_amount: {
    type: DataTypes.DECIMAL(18, 8),
    defaultValue: 0,
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: "draft",
    validate: {
      isIn: [["draft", "moderation", "active", "completed", "failed"]],
    },
  },
  contract_address: {
    type: DataTypes.STRING(42),
    allowNull: true,
  },
  token_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  author_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  duration_days: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
  },
  platform_fee_percent: {
    type: DataTypes.INTEGER,
    defaultValue: 2,
  },
}, {
  tableName: "projects",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Project;
