const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/userModel');
const path = require('path');

// Hàm tạo OTP ngẫu nhiên
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hàm gửi email OTP
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
async function sendOTPEmail(toEmail, otp, customSubject = 'Xác thực tài khoản quản trị', customText = '', logoUrl = '') {
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
// Hàm đăng xuất Admin
const adminLogout = async (req, res) => {
    try {
        const token = req.headers['authorization'];

        if (!token) {
            return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
        }

        try {
            // Loại bỏ tiền tố "Bearer " nếu có
            const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);

            if (!user) {
                return res.status(404).json({ message: 'Người dùng không tồn tại!' });
            }

            if (!user.invalidTokens) {
                user.invalidTokens = [];
            }

            user.invalidTokens.push(actualToken);
            await user.save();
            //console.log("Dăng xuất")
            return res.status(200).json({ message: 'Đăng xuất admin thành công!' });
        } catch (err) {
            return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};
// Hàm đăng nhập Admin

const adminController = {
    async adminLogin(req, res) {
        try {
            
            let token = req.headers.authorization;

            if (token && token.startsWith('Bearer ')) {
                token = token.split(' ')[1];
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    // Lấy thông tin người dùng từ database dựa vào decoded.userId
                    const user = await User.findById(decoded.userId);
                    if (!user) {
                        return res.status(404).json({ message: "Không tìm thấy người dùng." });
                    }
                    return res.status(200).json({ message: 'Đăng nhập thành công', token, fullname: user.full_name  });
                } catch (err) {
                    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
                }
            }
            let { email, otp } = req.body || {};
            if (email && typeof email === 'string') {
                email = email.toLowerCase(); // Chuyển email thành chữ thường
            }
            if (!email) {
                return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu.' });
            }

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
            }

            if (user.role !== 'admin' && user.role !== 'staff') {
                return res.status(403).json({ message: 'Truy cập bị từ chối. Không phải là quản trị viên.' });
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
                { expiresIn: '7d' }
            );

            user.otp = null;
            user.otpExpiresAt = null;
            await user.save();

            return res.status(200).json({ message: 'Đăng nhập thành công', token: newToken, fullname: user.full_name, role: user.role });
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
        }
    }
};
  
adminController.adminLogout = adminLogout;
module.exports = adminController;
