const express = require("express");
const userController = require("../controllers/userController"); // Kiểm tra đường dẫn

const router = express.Router();

router.post("/register", userController.createUser);

module.exports = router;
