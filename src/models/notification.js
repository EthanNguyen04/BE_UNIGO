const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },       // Tiêu đề thông báo
  content: { type: String, required: true },     // Nội dung thông báo
  type: [{
    type: String,
    enum: ['khach', 'user'],                     // Chỉ cho phép hai loại này
    required: true
  }], // Cho phép lưu 1 hoặc nhiều loại người dùng
  sendAt: { type: Date, required: true },        // Thời gian gửi
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;