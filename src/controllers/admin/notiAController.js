const Notification = require("../../models/notification");
const User = require("../../models/userModel");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");

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
        title,
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
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Không có token hoặc token không hợp lệ." });
  }

  const adminToken = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
  }

  if (decoded.role !== "admin"&& decoded.role !== "staff") {
    return res.status(403).json({ error: "Chỉ admin mới được phép gửi thông báo." });
  }

  const { title, message } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Cần có title và message.' });
  }

  try {
    // Chỉ lấy user có expo_tkn tồn tại và khác null, khác empty string
    const users = await User.find({
      expo_tkn: { $exists: true, $nin: [null, ""] }
    });

    if (!users.length) {
      return res.status(404).json({ error: 'Không có người dùng nào có expo_tkn.' });
    }

    const results = [];

    // Gửi từng notification
    for (const user of users) {
      const expoToken = user.expo_tkn;
      // Bảo vệ thêm: bỏ qua nếu token falsy
      if (!expoToken) continue;

      const result = await sendPushNotification(expoToken, message, title);
      if (!result.error) {
        results.push({ token: expoToken, ...result });
      }
      console.log('-> Sent Notification to:', expoToken);
    }

    // Lưu thông báo vào collection Notification
    const newNotification = new Notification({
      title,
      content: message,
      type: ["user"],
      sendAt: new Date(),
    });
    await newNotification.save();

    return res.status(200).json({
      message: "Đã gửi thông báo đến tất cả người dùng và lưu vào DB!",
      resultCount: results.length,
      results
    });
  } catch (error) {
    console.error('pushNotificationController error:', error);
    return res.status(500).json({ error: error.message });
  }
};
