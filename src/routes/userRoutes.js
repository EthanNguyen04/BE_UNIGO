const express = require("express");
const userController = require("../controllers/userController"); // Kiểm tra đường dẫn
const adminController = require("../controllers/adminController");
const multer = require("multer");
const path = require("path");
const upload = require("../config/userMulter"); // Đường dẫn đến file multer
const router = express.Router(); // Khởi tạo router từ Express


  
router.post("/register", userController.createUser);
router.post("/login", userController.loginUser);
router.post("/logout", userController.userLogout);
router.post("/send_otprs", userController.requestOTPOrToken);
router.post("/set_newpass", userController.resetPasswordWithToken);

router.put("/updateProfile", upload.single("avatar"), userController.updateUserProfile);
router.post("/addAddress", userController.addOrUpdateAddress); 


router.post("/login_admin", adminController.adminLogin); 


router.post("/logout_admin", adminController.adminLogout); 

router.get('/getInfoUser', userController.getInfoUser);
router.get('/getUserProfile', userController.getUserProfile);

router.get('/getAllAddresses', userController.getAllAddresses);


module.exports = router;
