const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/userModel');
const path = require('path');

// Hàm tạo OTP ngẫu nhiên
function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// // Hàm gửi email OTP
// async function sendOTPEmail(toEmail, otp) {
//     const transporter = nodemailer.createTransport({
//         service: 'gmail',
//         auth: {
//             user: process.env.EMAIL_USER,
//             pass: process.env.EMAIL_PASS
//         }
//     });

//     const mailOptions = {
//         from: process.env.EMAIL_USER,
//         to: toEmail,
//         subject: 'Xác thực tài khoản',
//         text: `Mã OTP của bạn là: ${otp}`
//     };

//     await transporter.sendMail(mailOptions);
// }
// Hàm gửi email OTP
async function sendOTPEmail(toEmail, otp, customSubject = 'Xác thực tài khoản', customText = '') {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        const logoPath = path.resolve(__dirname, '../public/logo/Unigo.png');
        // Tạo nội dung HTML đẹp với logo và text tùy chỉnh
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="cid:logo" alt="Logo" style="width: 100px; height: auto;"/>
                </div>
                <h2 style="text-align: center; color: #0056b3;">${customSubject}</h2>
                <p style="text-align: center; font-size: 16px; color: #333;">${customText || 'Mã OTP của bạn là:'}</p>
                <div style="text-align: center; margin: 20px 0;">
                    <span style="display: inline-block; background-color: #0056b3; color: #fff; padding: 10px 20px; border-radius: 5px; font-size: 24px; letter-spacing: 3px;">${otp}</span>
                </div>
                <p style="font-size: 14px; color: #555; text-align: center;">Vui lòng không chia sẻ mã này với bất kỳ ai để đảm bảo an toàn.</p>
                <hr style="margin: 20px 0;"/>
                <p style="font-size: 12px; color: #777; text-align: center;">Email được gửi từ hệ thống. Vui lòng không trả lời email này.</p>
            </div>
        `;

        // Nội dung email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: customSubject,
            html: htmlContent,
            attachments: [
                {
                    filename: 'Unigo.png',
                    path: logoPath,
                    cid: 'logo' // Content ID để nhúng vào HTML
                }
            ]
        };

        // Gửi email
        await transporter.sendMail(mailOptions);
        console.log('Email OTP đã được gửi thành công!');
    } catch (error) {
        console.error('Lỗi khi gửi email OTP:', error);
    }
}
// Hàm đăng xuất User
exports.userLogout = async (req, res) => {
    try {
        const token = req.headers['authorization'];

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
        const token = req.headers['authorization'];

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
        let { email, password, full_name } = req.body;
        email = email.toLowerCase();

        if (!email || !password || !full_name) {
            return res.status(422).json({ message: 'Vui lòng nhập đầy đủ thông tin!' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email đã tồn tại!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();

        const newUser = new User({
            email,
            password: hashedPassword,
            full_name,
            otp,
            otpExpiresAt: Date.now() + 5 * 60 * 1000,
            account_status: 'pending',
            otp_type: 'login' 
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
        let { email, password, otp, token } = req.body;
        email = email.toLowerCase();

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                return res.status(200).json({ message: 'Đăng nhập thành công!', token });
            } catch (err) {
                return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
            }
        }

        if (!email || !password) {
            return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu!' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Tài khoản không tồn tại!' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Mật khẩu không đúng!' });
        }

        // Nếu chưa gửi OTP, gửi OTP về email của người dùng
        if (!otp) {
            const generatedOTP = generateOTP();
            user.otp = generatedOTP;
            user.otpExpiresAt = Date.now() + 5 * 60 * 1000;
            // Đảm bảo otp_type được đặt là "login"
            user.otp_type = 'login';
            await user.save();
            await sendOTPEmail(user.email, generatedOTP);
            return res.status(200).json({ message: 'OTP đã được gửi đến email.' });
        }

        // Kiểm tra OTP, thời gian hết hạn và otp_type
        if (otp !== user.otp || Date.now() > user.otpExpiresAt || user.otp_type !== 'login') {
            return res.status(401).json({ message: 'OTP không hợp lệ hoặc đã hết hạn.' });
        }

        // Xác thực OTP thành công, chuyển trạng thái tài khoản sang active
        user.account_status = 'active';
        user.otp = null;
        user.otpExpiresAt = null;
        user.otp_type = null;  // Reset otp_type sau khi đã sử dụng
        await user.save();

        const newToken = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.status(200).json({ message: 'Đăng nhập thành công!', token: newToken });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.requestOTPOrToken = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Vui lòng nhập email!' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: 'Email không tồn tại!' });
        }

        // Nếu chỉ có email => gửi OTP về email
        if (!otp) {
            const generatedOTP = generateOTP();
            user.otp = generatedOTP;
            // Thiết lập thời hạn OTP là 60 giây
            user.otpExpiresAt = Date.now() + 60 * 1000;
            user.otp_type = 'reset_password';
            await user.save();

            await sendOTPEmail(user.email, generatedOTP);
            return res.status(200).json({ message: 'OTP đã được gửi đến email của bạn!' });
        }

        // Nếu có email và otp => kiểm tra OTP
        if (otp !== user.otp || Date.now() > user.otpExpiresAt || user.otp_type !== 'reset_password') {
            return res.status(401).json({ message: 'OTP không hợp lệ hoặc đã hết hạn.' });
        }

        // OTP hợp lệ, tạo token (ví dụ dùng JWT) và trả về
        const token = jwt.sign(
            { userId: user._id, email: user.email, otpPurpose: 'reset_password' },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }  // Token có thời hạn ngắn, ví dụ 10 phút
        );

        // Reset lại các trường OTP sau khi sử dụng
        user.otp = null;
        user.otpExpiresAt = null;
        user.otp_type = null;
        await user.save();

        return res.status(200).json({ message: 'Xác thực OTP thành công!', token });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.resetPasswordWithToken = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Vui lòng nhập đầy đủ token và mật khẩu mới!' });
        }

        // Xác minh token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
        }

        // Kiểm tra mục đích của token (otpPurpose) để đảm bảo token được tạo cho reset password
        if (decoded.otpPurpose !== 'reset_password') {
            return res.status(401).json({ message: 'Token không hợp lệ cho thao tác đặt lại mật khẩu.' });
        }

        // Tìm user dựa vào email hoặc userId trong token
        const user = await User.findOne({ _id: decoded.userId });
        if (!user) {
            return res.status(404).json({ message: 'Tài khoản không tồn tại!' });
        }

        // Hash mật khẩu mới và cập nhật vào user
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        return res.status(200).json({ message: 'Mật khẩu đã được cập nhật thành công!' });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};
