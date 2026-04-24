const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Vote = sequelize.define("Vote", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  milestone_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  approve: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  weight: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  tx_hash: {
    type: DataTypes.STRING(66),
    allowNull: true,
  },
}, {
  tableName: "votes",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Vote;
