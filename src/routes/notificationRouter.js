const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController'); // Import các hàm từ controller

// Route gửi thông báo 
router.get('/get_noti', notificationController.getNotificationsByType);

router.post("/send_notification_guest", notificationController.sendNotificationToGuest);

module.exports = router; // Xuất router để sử dụng trong ứng dụng chính
