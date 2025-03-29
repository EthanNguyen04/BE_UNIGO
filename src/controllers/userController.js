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

// Hàm đăng xuất User
exports.userLogout = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Vô hiệu hóa token bằng cách lưu vào danh sách invalidTokens
            const user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(404).json({ message: 'Người dùng không tồn tại!' });
            }

            if (!user.invalidTokens) {
                user.invalidTokens = [];
            }

            user.invalidTokens.push(token);
            await user.save();

            return res.status(200).json({ message: 'Đăng xuất thành công!' });
        } catch (err) {
            return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

// Hàm lấy thông tin người dùng từ token
exports.getUserInfo = async (req, res) => {
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

            return res.status(200).json({
                message: 'Thông tin người dùng',
                user: {
                    id: user._id,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role,
                    avatar_url: user.avatar_url,
                    account_status: user.account_status
                }
            });
        } catch (err) {
            return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        // Kiểm tra đầu vào
        if (!email || !password || !full_name) {
            return res.status(422).json({ message: 'Vui lòng nhập đầy đủ thông tin!' });
        }

        // Kiểm tra email đã tồn tại chưa
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email đã tồn tại!' });
        }

        // Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();

        // Tạo user mới
        const newUser = new User({
            email,
            password: hashedPassword,
            full_name,
            otp,
            otpExpiresAt: Date.now() + 5 * 60 * 1000,
            account_status: 'pending'
        });

        await newUser.save();
        await sendOTPEmail(email, otp);

        return res.status(201).json({ message: 'Đăng ký thành công! OTP đã được gửi đến email.' });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password, otp, token } = req.body;

        // Trường hợp đăng nhập bằng token
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                return res.status(200).json({ message: 'Đăng nhập thành công!', token });
            } catch (err) {
                return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
            }
        }

        // Kiểm tra đầu vào
        if (!email || !password) {
            return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu!' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Tài khoản không tồn tại!' });
        }

        // Kiểm tra mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Mật khẩu không đúng!' });
        }

        // Gửi OTP nếu chưa có
        if (!otp) {
            const generatedOTP = generateOTP();
            user.otp = generatedOTP;
            user.otpExpiresAt = Date.now() + 5 * 60 * 1000;
            await user.save();
            await sendOTPEmail(user.email, generatedOTP);
            return res.status(200).json({ message: 'OTP đã được gửi đến email.' });
        }

        // Xác minh OTP
        if (otp !== user.otp || Date.now() > user.otpExpiresAt) {
            return res.status(401).json({ message: 'OTP không hợp lệ hoặc đã hết hạn.' });
        }

        // Cập nhật trạng thái tài khoản
        user.account_status = 'active';
        user.otp = null;
        user.otpExpiresAt = null;
        await user.save();

        // Tạo JWT token
        const newToken = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({ message: 'Đăng nhập thành công!', token: newToken });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};
