const sequelize = require("../config/db");
const User = require("./User");
const Project = require("./Project");
const Milestone = require("./Milestone");
const Investment = require("./Investment");
const Vote = require("./Vote");
const Transaction = require("./Transaction");

// Associations
User.hasMany(Project, { foreignKey: "author_id", as: "projects" });
Project.belongsTo(User, { foreignKey: "author_id", as: "author" });

Project.hasMany(Milestone, { foreignKey: "project_id", as: "milestones" });
Milestone.belongsTo(Project, { foreignKey: "project_id" });

User.hasMany(Investment, { foreignKey: "user_id" });
Investment.belongsTo(User, { foreignKey: "user_id" });
Project.hasMany(Investment, { foreignKey: "project_id", as: "investments" });
Investment.belongsTo(Project, { foreignKey: "project_id" });

User.hasMany(Vote, { foreignKey: "user_id" });
Vote.belongsTo(User, { foreignKey: "user_id" });
Milestone.hasMany(Vote, { foreignKey: "milestone_id", as: "votes" });
Vote.belongsTo(Milestone, { foreignKey: "milestone_id" });

User.hasMany(Transaction, { foreignKey: "user_id" });
Transaction.belongsTo(User, { foreignKey: "user_id" });
Project.hasMany(Transaction, { foreignKey: "project_id", as: "transactions" });
Transaction.belongsTo(Project, { foreignKey: "project_id" });

module.exports = {
  sequelize,
  User,
  Project,
  Milestone,
  Investment,
  Vote,
  Transaction,
};
