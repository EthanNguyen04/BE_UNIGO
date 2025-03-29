const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

// Gửi OTP (dùng cho đăng ký hoặc quên mật khẩu)
router.post("/sendOtp", authController.sendOTP);

// Xác minh OTP (kích hoạt tài khoản hoặc đặt lại mật khẩu)
router.post("/verifyOtp", authController.verifyOTP);

// Đổi mật khẩu sau khi xác thực OTP
router.post("/changePassword", authController.changePassword);


module.exports = router;
