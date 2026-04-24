const express = require("express");
const { body, validationResult } = require("express-validator");
const { Milestone, Project, Vote } = require("../models");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// GET /api/projects/:id/milestones
router.get("/:id/milestones", async (req, res) => {
  try {
    const milestones = await Milestone.findAll({
      where: { project_id: req.params.id },
      include: [{ model: Vote, as: "votes" }],
      order: [["milestone_index", "ASC"]],
    });

    res.json(milestones);
  } catch (err) {
    console.error("Get milestones error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/projects/:id/milestones/:idx/submit
router.post(
  "/:id/milestones/:idx/submit",
  authMiddleware,
  [body("report_uri").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const project = await Project.findByPk(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.author_id !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const milestone = await Milestone.findOne({
        where: {
          project_id: req.params.id,
          milestone_index: parseInt(req.params.idx),
        },
      });

      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      await milestone.update({
        report_uri: req.body.report_uri,
        status: "voting",
      });

      res.json(milestone);
    } catch (err) {
      console.error("Submit milestone error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// POST /api/projects/:id/milestones/:idx/vote
router.post(
  "/:id/milestones/:idx/vote",
  authMiddleware,
  [
    body("approve").isBoolean(),
    body("weight").isFloat({ gt: 0 }),
    body("tx_hash").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const milestone = await Milestone.findOne({
        where: {
          project_id: req.params.id,
          milestone_index: parseInt(req.params.idx),
        },
      });

      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      // Check if user already voted
      const existingVote = await Vote.findOne({
        where: {
          user_id: req.user.id,
          milestone_id: milestone.id,
        },
      });

      if (existingVote) {
        return res.status(400).json({ error: "Already voted" });
      }

      const vote = await Vote.create({
        user_id: req.user.id,
        milestone_id: milestone.id,
        approve: req.body.approve,
        weight: req.body.weight,
        tx_hash: req.body.tx_hash,
      });

      res.status(201).json(vote);
    } catch (err) {
      console.error("Vote error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// POST /api/projects/:id/milestones/:idx/finish
router.post("/:id/milestones/:idx/finish", async (req, res) => {
  try {
    const milestone = await Milestone.findOne({
      where: {
        project_id: req.params.id,
        milestone_index: parseInt(req.params.idx),
      },
    });

    if (!milestone) {
      return res.status(404).json({ error: "Milestone not found" });
    }

    const { status } = req.body;
    await milestone.update({ status });

    res.json(milestone);
  } catch (err) {
    console.error("Finish voting error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
