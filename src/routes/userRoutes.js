const express = require("express");
const userController = require("../controllers/userController"); // Kiểm tra đường dẫn
const adminController = require("../controllers/adminController");

const router = express.Router();

router.post("/register", userController.createUser);
router.post("/login", userController.loginUser);
router.get("/info_user", userController.getUserInfo);


router.post("/login_admin", adminController.adminLogin); 

module.exports = router;
