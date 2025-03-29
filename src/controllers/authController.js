const nodemailer = require("nodemailer");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const crypto = require("crypto"); // Dùng để sinh OTP bảo mật hơn
require("dotenv").config();

// Cấu hình SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,  // Đúng biến môi trường
        pass: process.env.EMAIL_PASS
    },
    tls: { rejectUnauthorized: false }
});

// Hàm tạo OTP ngẫu nhiên 4 số
const generateOTP = () => crypto.randomInt(1000, 9999).toString();

// Hàm gửi OTP qua email
exports.sendOtpEmail = async (toEmail, otp) => {
    const mailOptions = {
        from: process.env.MAIL,
        to: toEmail,
        subject: 'Mã OTP xác nhận của bạn',
        text: `Mã OTP của bạn là: ${otp}. Mã này có hiệu lực trong 60 giây.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP đã được gửi tới email: ${toEmail}`);
    } catch (error) {
        console.error(`Lỗi khi gửi email OTP: ${error}`);
        throw new Error('Không thể gửi OTP qua email');
    }
};

// Gửi OTP
exports.sendOTP = async (req, res) => {
    try {
        const { email, type } = req.body; // 🆕 Nhận type từ request
        if (!email || !type) {
            return res.status(400).json({ message: "Thiếu email hoặc loại OTP" });
        }
        if (!["register", "reset_password"].includes(type)) {
            return res.status(400).json({ message: "Loại OTP không hợp lệ!" });
        }

        let user = await User.findOne({ email });
        if (type === "register" && user) {
            return res.status(400).json({ message: "Email đã được đăng ký!" });
        }
        if (type === "reset_password" && !user) {
            return res.status(404).json({ message: "Người dùng không tồn tại!" });
        }

        // Nếu là đăng ký, tạo tài khoản nhưng chưa kích hoạt
        if (!user) {
            user = new User({ email, isActive: false });
        }

        const otp = generateOTP();
        const hashedOTP = await bcrypt.hash(otp, 10);

        // Cập nhật OTP vào DB
        user.otp = hashedOTP;
        user.otpExpiresAt = new Date(Date.now() + 60000);
        user.otp_type = type;
        await user.save();

        await exports.sendOtpEmail(email, otp);
        res.status(200).json({ message: "OTP đã được gửi thành công!" });

    } catch (error) {
        res.status(500).json({ message: "Lỗi server khi gửi OTP!" });
    }
};


// Xác thực OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otpInput, type } = req.body;
        if (!email || !otpInput || !type) {
            return res.status(400).json({ message: "Thiếu thông tin" });
        }

        const user = await User.findOne({ email });
        if (!user || !user.otp || !user.otpExpiresAt || user.otp_type !== type) {
            return res.status(400).json({ message: "OTP không hợp lệ hoặc không đúng loại!" });
        }

        if (Date.now() > user.otpExpiresAt) {
            await User.findByIdAndUpdate(user._id, { otp: null, otpExpiresAt: null, otp_verified: false });
            return res.status(400).json({ message: "OTP đã hết hạn!" });
        }

        const isMatch = await bcrypt.compare(otpInput.toString(), user.otp);
        if (!isMatch) {
            return res.status(400).json({ message: "Mã OTP không đúng!" });
        }

        // Nếu là đăng ký, kích hoạt tài khoản
        if (type === "register") {
            user.isActive = true;
        }

        //  Nếu là quên mật khẩu, chỉ đánh dấu xác thực
        user.otp = null;
        user.otpExpiresAt = null;
        user.otp_verified = true;
        await user.save();

        res.status(200).json({ message: "Xác thực OTP thành công!" });

    } catch (error) {
        res.status(500).json({ message: "Lỗi server khi xác thực OTP!" });
    }
};



exports.changePassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) {
            return res.status(400).json({ message: "Thiếu email hoặc mật khẩu mới" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "Người dùng không tồn tại!" });
        }

        //  Kiểm tra chỉ cho đổi mật khẩu nếu đã xác minh OTP và OTP là loại "reset_password"
        if (!user.otp_verified || user.otp_type !== "reset_password") {
            return res.status(403).json({ message: "Bạn chưa xác thực OTP hoặc OTP không hợp lệ!" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        //  Cập nhật mật khẩu & reset trạng thái OTP
        user.password = hashedPassword;
        user.otp_verified = false;
        user.otp_type = null;
        await user.save();

        res.status(200).json({ message: "Đổi mật khẩu thành công!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server khi đổi mật khẩu!" });
    }
};
