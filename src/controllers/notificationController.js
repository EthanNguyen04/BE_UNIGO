const fetch = require('node-fetch'); // Vẫn sử dụng require để gọi node-fetch

const jwt = require('jsonwebtoken');
const Extkn = require('../models/expoPush'); // Đảm bảo bạn đã import model đúng đường dẫn
const User = require('../models/userModel'); // Import model User để kiểm tra thông tin người dùng
const Notification = require('../models/notification'); // Import model User để kiểm tra thông tin người dùng
const moment = require('moment'); // Import moment vào file


// Controller để handle post request
exports.saveExpoToken = async (req, res) => {
    const { token } = req.headers;  // Lấy token từ header
    const { extkn } = req.body;     // Lấy extkn từ body
    
    // Kiểm tra nếu không có body.extkn
    if (!extkn) {
        return res.status(400).json({ message: "Thiếu body.extkn" });
    }

    let userId = null;
    let type = 'khach';  // Mặc định là 'khach'

    // Kiểm tra nếu có token
    if (token) {
        try {
            // Giải mã JWT token để lấy userId
            const decoded = jwt.verify(token, process.env.JWT_SECRET); // Thay `JWT_SECRET` bằng secret key của bạn
            userId = decoded.userId;

            // Kiểm tra xem userId có phải là người dùng hợp lệ hay không
            const user = await User.findById(userId);
            if (user) {
                type = 'user'; // Nếu là người dùng hợp lệ thì type là 'user'
            } else {
                type = 'khach'; // Nếu không phải user hợp lệ thì type vẫn là 'khach'
            }
        } catch (error) {
            // Nếu có lỗi khi giải mã token
            return res.status(500).json({ message: "Token không hợp lệ", error: error.message });
        }
    }

    try {
        // Kiểm tra xem có token extkn đã tồn tại trong DB hay không
        let extknRecord = await Extkn.findOne({ expoToken: extkn });

        if (extknRecord) {
            // Nếu đã tồn tại, kiểm tra xem type có thay đổi không
            if (extknRecord.type !== type) {
                // Nếu type thay đổi, cập nhật lại
                extknRecord.type = type;
                await extknRecord.save();
                return res.status(200).json({ type: type });
            } else {
                return res.status(200).json({ type: type  });
            }
        } else {
            // Nếu chưa có extkn, tạo mới
            const newExtkn = new Extkn({
                expoToken: extkn,
                userId: userId || null, // Nếu không có token thì userId có thể là null
                type: type,
            });

            await newExtkn.save();
            return res.status(201).json({ message: "Expo token saved successfully" });
        }

    } catch (error) {
        // Nếu có lỗi trong quá trình lưu vào MongoDB
        return res.status(500).json({ message: "Lỗi khi xử lý dữ liệu", error: error.message });
    }
};





// Function để gửi thông báo đến Expo Push Notification API
// Hàm gửi thông báo đẩy
// Function để gửi thông báo đến Expo Push Notification API
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
        to: token, // Token nhận thông báo
        sound: 'default',
        title: title,
        body: message,
      }),
    });

    const data = await response.json();
    return data; // Trả về dữ liệu phản hồi từ Expo API
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new Error('Không thể gửi thông báo đẩy');
  }
};

// Controller để xử lý yêu cầu gửi thông báo
exports.pushNotificationController = async (req, res) => {
  const { title, message, types } = req.body;

  if (!title || !message || !types || !Array.isArray(types) || types.length === 0) {
    return res.status(400).json({ error: 'Cần có title, message và mảng types người dùng để gửi thông báo.' });
  }

  try {
    // Tìm tất cả token của các loại người dùng cần gửi
    const tokens = await Extkn.find({ type: { $in: types } });

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy token người dùng phù hợp.' });
    }

    const tokenArray = tokens.map(token => token.expoToken);

    // Gửi thông báo đẩy
    const response = await sendPushNotification(tokenArray, message, title);

    // Lưu vào cơ sở dữ liệu
    // Lưu vào cơ sở dữ liệu
    const newNotification = new Notification({
      title: title,
      content: message,
      type: types,             // Lưu luôn mảng types
      sendAt: new Date(),
    });

    await newNotification.save();

    res.status(200).json({
      message: 'Thông báo đẩy đã được gửi thành công và lưu vào cơ sở dữ liệu!',
      response: response,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
;



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
