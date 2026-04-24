const express = require("express");
const { Investment, Transaction, Project } = require("../models");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// POST /api/projects/:id/invest - Record investment in DB
router.post("/:id/invest", authMiddleware, async (req, res) => {
  try {
    const { amount, tokens_received, tx_hash } = req.body;

    const project = await Project.findByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const investment = await Investment.create({
      user_id: req.user.id,
      project_id: project.id,
      amount,
      tokens_received,
      tx_hash,
    });

    // Update project current_amount
    const newAmount = parseFloat(project.current_amount) + parseFloat(amount);
    await project.update({ current_amount: newAmount });

    // Record transaction
    await Transaction.create({
      user_id: req.user.id,
      project_id: project.id,
      type: "investment",
      amount,
      tx_hash,
    });

    res.status(201).json(investment);
  } catch (err) {
    console.error("Invest error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/projects/:id/refund - Record refund in DB
router.post("/:id/refund", authMiddleware, async (req, res) => {
  try {
    const { amount, tx_hash } = req.body;

    await Transaction.create({
      user_id: req.user.id,
      project_id: parseInt(req.params.id),
      type: "refund",
      amount,
      tx_hash,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Refund error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/transactions - User's transactions
router.get("/", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { user_id: req.user.id },
      order: [["created_at", "DESC"]],
    });
    res.json(transactions);
  } catch (err) {
    console.error("Get transactions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/projects/:id/transactions
router.get("/:id/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { project_id: req.params.id },
      order: [["created_at", "DESC"]],
    });
    res.json(transactions);
  } catch (err) {
    console.error("Get project transactions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
