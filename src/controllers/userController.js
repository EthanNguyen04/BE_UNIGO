const User = require("../models/userModel"); // Kiểm tra đường dẫn import
const bcrypt = require("bcrypt");

exports.createUser = async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        // Kiểm tra đầu vào
        if (!email || !password || !full_name) {
            return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin!" });
        }

        // Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);

        // Tạo user mới
        const newUser = new User({
            email,
            password: hashedPassword,
            full_name,
        });

        // Lưu vào database
        await newUser.save();

        return res.status(201).json({ user_id: newUser._id, message: "Tạo tài khoản thành công!" });
    } catch (error) {
        return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
};
