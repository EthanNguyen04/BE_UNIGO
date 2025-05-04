const fetch = require('node-fetch'); // Vẫn sử dụng require để gọi node-fetch

const jwt = require('jsonwebtoken');
const Extkn = require('../models/expoPush'); // Đảm bảo bạn đã import model đúng đường dẫn
const User = require('../models/userModel'); // Import model User để kiểm tra thông tin người dùng
const Notification = require('../models/notification'); // Import model User để kiểm tra thông tin người dùng
const moment = require('moment'); // Import moment vào file



// Hàm gửi push notification
const sendPushNotification = async (token, message, title) => {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Charset': 'UTF-8',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        title: title,
        body: message,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return { error: true, message: error.message };
  }
};

exports.pushNotificationController = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Không có token hoặc token không hợp lệ." });
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
  }

  if (!decoded || decoded.role !== "admin") {
    return res.status(403).json({ error: "Chỉ admin mới được phép gửi thông báo." });
  }

  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Cần có title và message.' });
  }

  try {
    // Lấy tất cả user có expo_tkn hợp lệ
    const users = await User.find({
      expo_tkn: { $ne: "" }
    });

    if (!users.length) {
      return res.status(404).json({ error: 'Không có người dùng nào có expo_tkn.' });
    }

    const tokenArray = users.map(user => user.expo_tkn);
    const results = [];

    // Gửi từng token
    for (const token of tokenArray) {
      const result = await sendPushNotification(token, message, title);

      // Nếu gửi thành công (không có error) → mới push vào results
      if (!result.error) {
        results.push(result);
      }
    }

    // Lưu vào Notification (type: user)
    const newNotification = new Notification({
      title,
      content: message,
      type: ["user"],
      sendAt: new Date(),
    });

    await newNotification.save();

    res.status(200).json({
      message: "Đã gửi thông báo đến tất cả người dùng và lưu vào DB!",
      resultCount: results.length,
      results
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


//get thông báo 
exports.getNotificationsByType = async (req, res) => {
  const { type } = req.query; // Lấy type từ query string

  if (!type || !['khach', 'user'].includes(type)) {
    return res.status(400).json({ error: 'Type phải là "khach" hoặc "user".' });
  }

  try {
    // Tìm tất cả thông báo có chứa type, sắp xếp theo thời gian giảm dần (mới nhất trước)
    const notifications = await Notification.find({ type: type })
      .sort({ sendAt: -1 });

    // Format lại kết quả trước khi trả về
    const formatted = notifications.map(n => ({
      title: n.title,
      content: n.content,
      time: moment(n.sendAt).format('HH:mm DD/MM/YYYY'),
    }));

    res.status(200).json({ notifications: formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.sendNotificationToGuest = async (req, res) => {

try {
  const { expo_tkn } = req.body;

  if (!expo_tkn) {
    return res.status(400).json({ message: "expo_tkn không được để trống." });
  }

  // Kiểm tra token có hợp lệ
  if (
    !expo_tkn.startsWith('ExpoPushToken[') &&
    !expo_tkn.startsWith('ExponentPushToken[')) {
    return res.status(400).json({ message: "expo_tkn không hợp lệ." });
  }

  // Lấy danh sách thông báo dành cho "khach"
  const notifications = await Notification.find({
    type: "khach"
  });

  if (!notifications.length) {
    return res.status(200).json({ message: "Không có thông báo nào dành cho khách." });
  }

  const results = [];

  // Gửi từng thông báo
  for (const noti of notifications) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Charset': 'UTF-8',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: expo_tkn,
          sound: 'default',
          title: noti.title,
          body: noti.content,
          data: { id: noti._id },
        }),
      });

      const data = await response.json();
      results.push(data);
    } catch (err) {
      console.error("Lỗi gửi notification:", err);
      results.push({ error: true, message: err.message });
    }
  }

  return res.status(200).json({
    message: "Đã gửi thông báo đến khách",
    results
  });

} catch (error) {
  return res.status(500).json({
    message: "Lỗi máy chủ.",
    error: error.message
  });
}
};