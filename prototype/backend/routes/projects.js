const express = require("express");
const { body, validationResult } = require("express-validator");
const { Project, Milestone, User, Investment } = require("../models");
const { authMiddleware, optionalAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/projects
router.get("/", optionalAuth, async (req, res) => {
  try {
    const where = {};
    if (req.query.status) {
      where.status = req.query.status;
    }
    if (req.query.author === "me" && req.user) {
      where.author_id = req.user.id;
    }

    const projects = await Project.findAll({
      where,
      include: [
        { model: User, as: "author", attributes: ["id", "email"] },
        { model: Milestone, as: "milestones" },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json(projects);
  } catch (err) {
    console.error("Get projects error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        { model: User, as: "author", attributes: ["id", "email", "wallet_address"] },
        { model: Milestone, as: "milestones", order: [["milestone_index", "ASC"]] },
        { model: Investment, as: "investments" },
      ],
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(project);
  } catch (err) {
    console.error("Get project error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/projects
router.post(
  "/",
  authMiddleware,
  [
    body("title").notEmpty().trim(),
    body("description").notEmpty(),
    body("goal_amount").isFloat({ gt: 0 }),
    body("duration_days").isInt({ min: 1 }),
    body("milestones").isArray({ min: 1 }),
    body("milestones.*.description").notEmpty(),
    body("milestones.*.budget").isFloat({ gt: 0 }),
    body("milestones.*.duration_days").isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { title, description, goal_amount, duration_days, milestones, platform_fee_percent } = req.body;

      // Validate budgets sum to goal
      const budgetSum = milestones.reduce((s, m) => s + parseFloat(m.budget), 0);
      if (Math.abs(budgetSum - parseFloat(goal_amount)) > 0.0001) {
        return res.status(400).json({ error: "Milestone budgets must sum to goal amount" });
      }

      const project = await Project.create({
        title,
        description,
        goal_amount,
        duration_days,
        author_id: req.user.id,
        platform_fee_percent: platform_fee_percent || 2,
        status: "draft",
      });

      for (let i = 0; i < milestones.length; i++) {
        await Milestone.create({
          project_id: project.id,
          milestone_index: i,
          description: milestones[i].description,
          budget: milestones[i].budget,
          duration_days: milestones[i].duration_days,
        });
      }

      const result = await Project.findByPk(project.id, {
        include: [{ model: Milestone, as: "milestones" }],
      });

      res.status(201).json(result);
    } catch (err) {
      console.error("Create project error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PUT /api/projects/:id
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    if (project.author_id !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { title, description, status, contract_address, token_id, current_amount, deadline } = req.body;

    await project.update({
      ...(title && { title }),
      ...(description && { description }),
      ...(status && { status }),
      ...(contract_address && { contract_address }),
      ...(token_id !== undefined && { token_id }),
      ...(current_amount !== undefined && { current_amount }),
      ...(deadline && { deadline }),
    });

    res.json(project);
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/projects/:id/deploy - Mark project as deployed
router.post("/:id/deploy", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    if (project.author_id !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { contract_address, token_id } = req.body;

    await project.update({
      contract_address,
      token_id,
      status: "active",
      deadline: new Date(Date.now() + project.duration_days * 24 * 60 * 60 * 1000),
    });

    res.json(project);
  } catch (err) {
    console.error("Deploy project error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
