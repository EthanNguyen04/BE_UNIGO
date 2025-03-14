const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/sendOtp", authController.sendOTP);

module.exports = router;
