const User = require("../models/userModel"); // Kiểm tra đường dẫn import
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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


exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Kiểm tra đầu vào
        if (!email || !password) {
            return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu!" });
        }

        // Tìm user theo email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "Tài khoản không tồn tại!" });
        }

        // Kiểm tra trạng thái tài khoản
        if (user.account_status === "pending") {
            return res.status(403).json({ message: "Tài khoản chưa được xác minh! Vui lòng kiểm tra email để xác minh tài khoản." });
        }

        if (user.account_status === "disabled") {
            return res.status(403).json({ message: "Tài khoản của bạn đã bị vô hiệu hóa. Liên hệ hỗ trợ để biết thêm chi tiết." });
        }

        // So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Mật khẩu không đúng!" });
        }

        // Tạo JWT token (nếu cần)
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || "your_jwt_secret",
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            message: "Đăng nhập thành công!",
            token,
            user: {
                id: user._id,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                role: user.role
            }
        });
    } catch (error) {
        return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
};
