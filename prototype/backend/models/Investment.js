const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Investment = sequelize.define("Investment", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  tokens_received: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  tx_hash: {
    type: DataTypes.STRING(66),
    allowNull: true,
  },
}, {
  tableName: "investments",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Investment;
