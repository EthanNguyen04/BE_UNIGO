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
        subject: 'Xác thực đăng nhập Admin',
        text: `Mã OTP của bạn là: ${otp}`
    };

    await transporter.sendMail(mailOptions);
}

const adminController = {
    // Phương thức đăng nhập Admin
    async adminLogin(req, res) {
        try {
            const { email, password, otp } = req.body;
            let token = req.headers.authorization;

            // Kiểm tra token trong header
            if (token && token.startsWith('Bearer ')) {
                token = token.split(' ')[1];
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    return res.status(200).json({ message: 'Đăng nhập thành công', token });
                } catch (err) {
                    // Token không hợp lệ hoặc đã hết hạn
                    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
                }
            }

            // Kiểm tra xem email và mật khẩu có được cung cấp không
            if (!email || !password) {
                return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu.' });
            }

            // Tìm người dùng bằng email
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
            }

            // Kiểm tra xem người dùng có phải là admin không
            if (user.role !== 'admin') {
                return res.status(403).json({ message: 'Truy cập bị từ chối. Không phải là quản trị viên.' });
            }

            // Xác minh mật khẩu
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác.' });
            }

            // Nếu OTP chưa được gửi
            if (!otp) {
                const generatedOTP = generateOTP();
                user.otp = generatedOTP;
                user.otpExpiresAt = Date.now() + 5 * 60 * 1000; // OTP hết hạn sau 5 phút
                await user.save();
                await sendOTPEmail(user.email, generatedOTP);
                return res.status(200).json({ message: 'OTP đã được gửi đến email của bạn. Vui lòng nhập OTP để xác thực.' });
            }

            // Xác minh OTP
            if (otp !== user.otp || Date.now() > user.otpExpiresAt) {
                return res.status(401).json({ message: 'OTP không hợp lệ hoặc đã hết hạn.' });
            }

            // Tạo token JWT
            const newToken = jwt.sign(
                { userId: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Xóa OTP sau khi xác thực
            user.otp = null;
            user.otpExpiresAt = null;
            await user.save();

            return res.status(200).json({ message: 'Đăng nhập thành công', token: newToken });
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
        }
    }
};
module.exports = adminController;
