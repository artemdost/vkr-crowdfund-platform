const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Milestone = sequelize.define("Milestone", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  milestone_index: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  budget: {
    type: DataTypes.DECIMAL(18, 8),
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
  status: {
    type: DataTypes.STRING(50),
    defaultValue: "pending",
    validate: {
      isIn: [["pending", "voting", "approved", "rejected"]],
    },
  },
  report_uri: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "milestones",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Milestone;
