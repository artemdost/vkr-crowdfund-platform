const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { User } = require("../models");
const { authMiddleware, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/register
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("role").optional().isIn(["investor", "author"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password, role } = req.body;

      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const password_hash = await bcrypt.hash(password, 10);

      const user = await User.create({
        email,
        password_hash,
        role: role || "investor",
      });

      res.status(201).json({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          wallet_address: user.wallet_address,
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password_hash"] },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/auth/wallet - Bind wallet (requires signature)
router.put("/wallet", authMiddleware, async (req, res) => {
  try {
    const { wallet_address, signature } = req.body;

    if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    if (!signature) {
      return res.status(400).json({ error: "Signature required" });
    }

    // Verify signature proves wallet ownership
    const { ethers } = require("ethers");
    const message = `CrowdFund: привязать кошелёк к аккаунту ${req.user.email}`;
    let recovered;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      return res.status(400).json({ error: "Невалидная подпись" });
    }

    if (recovered.toLowerCase() !== wallet_address.toLowerCase()) {
      return res.status(400).json({ error: "Подпись не соответствует адресу кошелька" });
    }

    // Check if user already has a different wallet bound
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.wallet_address && currentUser.wallet_address !== wallet_address.toLowerCase()) {
      return res.status(400).json({ error: "Сначала отвяжите текущий кошелёк" });
    }

    // Check if wallet is already bound to another user
    const existing = await User.findOne({
      where: { wallet_address: wallet_address.toLowerCase() },
    });
    if (existing && existing.id !== req.user.id) {
      return res.status(400).json({ error: "Этот кошелёк привязан к другому аккаунту" });
    }

    await User.update(
      { wallet_address: wallet_address.toLowerCase() },
      { where: { id: req.user.id } }
    );

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password_hash"] },
    });
    res.json(user);
  } catch (err) {
    console.error("Update wallet error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/wallet/unbind - Unbind wallet (requires signature)
router.post("/wallet/unbind", authMiddleware, async (req, res) => {
  try {
    const { signature } = req.body || {};

    const currentUser = await User.findByPk(req.user.id);
    if (!currentUser.wallet_address) {
      return res.status(400).json({ error: "Кошелёк не привязан" });
    }

    if (!signature) {
      return res.status(400).json({ error: "Signature required" });
    }

    // Verify signature proves wallet ownership
    const { ethers } = require("ethers");
    const message = `CrowdFund: отвязать кошелёк от аккаунта ${req.user.email}`;
    let recovered;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      return res.status(400).json({ error: "Невалидная подпись" });
    }

    if (recovered.toLowerCase() !== currentUser.wallet_address.toLowerCase()) {
      return res.status(400).json({ error: "Подпись не соответствует привязанному кошельку" });
    }

    await User.update(
      { wallet_address: null },
      { where: { id: req.user.id } }
    );

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password_hash"] },
    });
    res.json(user);
  } catch (err) {
    console.error("Delete wallet error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
