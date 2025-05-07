const User = require("../../models/userModel");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcrypt');

exports.getAllUsers = async (req, res) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Không có token hoặc token không hợp lệ." });
    }

    const token = authHeader.split(" ")[1];

    // Giải mã token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
    }

    // Kiểm tra quyền
    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ error: "Chỉ admin mới có quyền xem danh sách người dùng." });
    }

    // Lấy danh sách user (thêm created_at + sort mới nhất)
    const users = await User.find({}, "_id email account_status role created_at").sort({ created_at: -1 });

    res.status(200).json({
      message: "Danh sách người dùng",
      users
    });

  } catch (error) {
    res.status(500).json({
      error: error.message || "Lỗi máy chủ"
    });
  }
};



exports.addStaff = async (req, res) => {
    try {
      // Lấy token từ header
      const authHeader = req.headers.authorization;
  
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Không có token hoặc token không hợp lệ." });
      }
  
      const token = authHeader.split(" ")[1];
  
      // Giải mã token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
      }
  
      // Kiểm tra quyền
      if (!decoded || decoded.role !== "admin") {
        return res.status(403).json({ error: "Chỉ admin mới có quyền thêm nhân viên." });
      }
  
      const { email, full_name } = req.body;
  
      // Kiểm tra dữ liệu
      if (!email || !full_name) {
        return res.status(400).json({ error: "Vui lòng nhập đầy đủ email, password và full_name." });
      }
  
      // Kiểm tra email đã tồn tại
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "Email đã tồn tại." });
      }
      const plainPassword = email;
      const hashPassword = await bcrypt.hash(plainPassword, 10);
      // Tạo mới nhân viên (role = staff)
      const newUser = new User({
        email,
        password: hashPassword, // Lưu ý: Trong thực tế nên hash mật khẩu
        full_name,
        role: "staff",
      });
  
      await newUser.save();
  
      res.status(201).json({
        message: "Tạo nhân viên thành công!",
        staff: {
          id: newUser._id,
          email: newUser.email,
          full_name: newUser.full_name,
          role: newUser.role,
        }
      });
  
    } catch (error) {
      res.status(500).json({
        error: error.message || "Lỗi máy chủ"
      });
    }
  };

  exports.deleteStaff = async (req, res) => {
    try {
      // 1. Xác thực token & kiểm tra admin
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token không hợp lệ hoặc thiếu." });
      }
      let decoded;
      try {
        decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
      } catch {
        return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
      }
      if (decoded.role !== "admin") {
        return res.status(403).json({ error: "Chỉ admin mới có quyền xóa nhân viên." });
      }
  
      // 2. Lấy userId cần xóa từ params
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: "userId không hợp lệ." });
      }
  
      // 3. Tìm user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "Không tìm thấy người dùng." });
      }
      if (user.role !== "staff") {
        return res.status(400).json({ error: "Chỉ có thể xóa nhân viên (role = staff)." });
      }
  
      // 4. Xóa user
      await User.findByIdAndDelete(userId);
  
      return res.status(200).json({ message: "Xóa nhân viên thành công." });
    } catch (err) {
      console.error("Lỗi deleteStaff:", err);
      return res.status(500).json({ error: "Lỗi máy chủ.", details: err.message });
    }
  };
  