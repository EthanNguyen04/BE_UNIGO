const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController'); // Import các hàm từ controller

// Route gửi thông báo 
router.post('/send-notification', notificationController.pushNotificationController);
router.post('/save_extkn', notificationController.saveExpoToken);
router.get('/get_noti', notificationController.getNotificationsByType);

module.exports = router; // Xuất router để sử dụng trong ứng dụng chính
