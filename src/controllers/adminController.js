const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/userModel');

// Hàm tạo OTP ngẫu nhiên
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hàm gửi email OTP
async function sendOTPEmail(toEmail, otp) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: 'Xác thực tài khoản',
        text: `Mã OTP của bạn là: ${otp}`
    };

    await transporter.sendMail(mailOptions);
}

// Hàm đăng xuất Admin
const adminLogout = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);

            if (!user) {
                return res.status(404).json({ message: 'Người dùng không tồn tại!' });
            }

            if (!user.invalidTokens) {
                user.invalidTokens = [];
            }

            user.invalidTokens.push(token);
            await user.save();

            return res.status(200).json({ message: 'Đăng xuất admin thành công!' });
        } catch (err) {
            return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

const adminController = {
    async adminLogin(req, res) {
        try {
            let { email, password, otp } = req.body || {};
            if (email && typeof email === 'string') {
                email = email.toLowerCase(); // Chuyển email thành chữ thường
            }
            let token = req.headers.authorization;

            if (token && token.startsWith('Bearer ')) {
                token = token.split(' ')[1];
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    return res.status(200).json({ message: 'Đăng nhập thành công', token });
                } catch (err) {
                    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
                }
            }

            if (!email || !password) {
                return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu.' });
            }

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
            }

            if (user.role !== 'admin') {
                return res.status(403).json({ message: 'Truy cập bị từ chối. Không phải là quản trị viên.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác.' });
            }

            if (!otp) {
                const generatedOTP = generateOTP();
                user.otp = generatedOTP;
                user.otpExpiresAt = Date.now() + 5 * 60 * 1000;
                await user.save();
                await sendOTPEmail(user.email, generatedOTP);
                return res.status(200).json({ message: 'OTP đã được gửi đến email của bạn.' });
            }

            if (otp !== user.otp || Date.now() > user.otpExpiresAt) {
                return res.status(401).json({ message: 'OTP không hợp lệ hoặc đã hết hạn.' });
            }

            const newToken = jwt.sign(
                { userId: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '10h' }
            );

            user.otp = null;
            user.otpExpiresAt = null;
            await user.save();

            return res.status(200).json({ message: 'Đăng nhập thành công', token: newToken });
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
        }
    }
};

adminController.adminLogout = adminLogout;
module.exports = adminController;
