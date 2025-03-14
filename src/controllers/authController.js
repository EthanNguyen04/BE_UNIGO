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
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "Vui lòng cung cấp userId" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Người dùng không tồn tại!" });
        }

        const otp = generateOTP();
        const hashedOTP = await bcrypt.hash(otp, 10); // Mã hóa OTP

        // Cập nhật OTP + thời gian hết hạn
        await User.findByIdAndUpdate(userId, { 
            otp: hashedOTP, 
            otpExpiresAt: new Date(Date.now() + 60000) // Hết hạn sau 60s
        });

        await exports.sendOtpEmail(user.email, otp);

        console.log(`OTP đã gửi đến email: ${user.email}`);
        res.status(200).json({ message: "OTP đã được gửi thành công!" });

    } catch (error) {
        console.error("Lỗi gửi OTP:", error.message);
        res.status(500).json({ message: "Lỗi server khi gửi OTP!" });
    }
};

// Xác thực OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { userId, otpInput } = req.body;
        if (!userId || !otpInput) {
            return res.status(400).json({ message: "Thiếu userId hoặc OTP" });
        }

        const user = await User.findById(userId);
        if (!user || !user.otp || !user.otpExpiresAt) {
            return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn!" });
        }

        // Kiểm tra OTP hết hạn
        if (Date.now() > user.otpExpiresAt) {
            await User.findByIdAndUpdate(userId, { otp: null, otpExpiresAt: null });
            return res.status(400).json({ message: "OTP đã hết hạn!" });
        }

        // Kiểm tra OTP nhập vào với OTP đã lưu
        const isMatch = await bcrypt.compare(otpInput.toString(), user.otp);
        if (!isMatch) {
            return res.status(400).json({ message: "Mã OTP không đúng!" });
        }

        // Xác thực thành công -> Xóa OTP để tránh dùng lại
        await User.findByIdAndUpdate(userId, { otp: null, otpExpiresAt: null });

        res.status(200).json({ message: "Xác thực OTP thành công!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server khi xác thực OTP!" });
    }
};
