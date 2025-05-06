const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Wishlist = require('../models/wishListModel');
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
        console.log('---> Email OTP đã được gửi thành công!');
    } catch (error) {
        console.error('Lỗi khi gửi email OTP:', error);
    }
}
// Hàm đăng xuất User
exports.userLogout = async (req, res) => {
    try {
        const token = req.headers['authorization'];
        //console.log(token)

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
             // RESET expo_tkn khi user logout
             user.expo_tkn = "";

             await user.save();

            return res.status(200).json({ message: 'Đăng xuất thành công!' });
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
        
        // Nếu token được gửi, xác thực token và trả về kết quả
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                return res.status(200).json({ message: 'Đăng nhập thành công!', token });
            } catch (err) {
                return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
            }
        }

        // Nếu không có token, yêu cầu email và mật khẩu phải được cung cấp
        if (!email || !password) {
            return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu!' });
        }
        
        email = email.toLowerCase();

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



//hàm để lấy tên, ảnh, số mua, số thích
// Hàm này sẽ lấy thông tin của người dùng theo token gửi lên trong header
exports.getInfoUser = async (req, res) => {
    try {
      // Lấy token từ header: format "Bearer <token>"
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Invalid token format' });
      }
      
      // Giải mã token để lấy thông tin người dùng, sử dụng key là "userId" theo token được tạo lúc đăng nhập
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;  // Sử dụng trường userId thay vì id
  
      // Lấy thông tin người dùng: tên (full_name) và avatar_url
      const user = await User.findById(userId).select('full_name avatar_url');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Đếm số sản phẩm có trong Wishlist của người dùng
      const wishlist = await Wishlist.findOne({ user_id: userId });
      const wishlistCount = wishlist ? wishlist.product_ids.length : 0;
  
      // Đếm số đơn hàng của người dùng
      const orderCount = await Order.countDocuments({ user_id: userId });
  
      // Trả về dữ liệu theo định dạng
      return res.json({
        name: user.full_name,
        avatar_url: user.avatar_url,
        wishlist_count: wishlistCount,
        order_count: orderCount
      });
    } catch (error) {
      console.error('Error in getInfoUser:', error);
      return res.status(500).json({ error: error.message });
    }
  };

  
exports.getUserProfile = async (req, res) => {
    try {
      // Lấy token từ header Authorization
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Không tìm thấy token" });
      }
      const token = authHeader.split(' ')[1];
      
      // Giải mã token để lấy userId
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      
      // Tìm người dùng dựa trên userId, chỉ lấy các trường avatar_url, full_name, email
      const user = await User.findById(userId).select('avatar_url full_name email');
      if (!user) {
        return res.status(404).json({ message: "Người dùng không tồn tại" });
      }
      
      // Trả về thông tin người dùng cần lấy
      return res.status(200).json({
        avatar: user.avatar_url,
        name: user.full_name,
        email: user.email
      });
    } catch (error) {
      console.error("Lỗi khi lấy thông tin người dùng:", error);
      return res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại sau" });
    }
  };


  // Controller PUT update thông tin người dùng
  exports.updateUserProfile = async (req, res) => {
    try {
      // Lấy token từ header Authorization dạng "Bearer token"
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "Không có token, truy cập không được phép" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({ message: "Token không hợp lệ" });
      }
  
      // Giải mã token để lấy userId (giả sử payload chứa field "userId")
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      if (!userId) {
        return res.status(401).json({ message: "Không xác thực được người dùng" });
      }
  
      // Tìm user theo userId
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Không tìm thấy người dùng" });
      }
  
      // Cập nhật tên nếu có
      if (req.body.full_name) {
        user.full_name = req.body.full_name;
      }
  
      // Cập nhật mật khẩu: nếu người dùng muốn đổi mật khẩu phải gửi kèm currentPassword và newPassword
      if (req.body.newPassword) {
        if (!req.body.currentPassword) {
          return res.status(400).json({ message: "Yêu cầu nhập mật khẩu hiện tại để thay đổi mật khẩu" });
        }
        // Kiểm tra mật khẩu hiện tại có khớp không
        const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ message: "Mật khẩu hiện tại không chính xác" });
        }
        // Mã hoá mật khẩu mới và cập nhật
        const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
        user.password = hashedPassword;
      }
  
      // Cập nhật ảnh đại diện: nếu có file upload được xử lý bởi multer
      if (req.file) {
        user.avatar_url = `/public/user/${req.file.filename}`;
      }
  
      // Lưu các thay đổi
      await user.save();
      return res.status(200).json({ message: "Cập nhật thông tin thành công" });
    } catch (error) {
      console.error("Lỗi update profile:", error);
      return res.status(500).json({ message: "Lỗi server, vui lòng thử lại sau" });
    }
  };

  // Controller GET lấy tất cả các địa chỉ của người dùng
exports.getAllAddresses = async (req, res) => {
    try {
      // Lấy token từ header Authorization (dạng "Bearer token")
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "Không có token, truy cập không được phép" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({ message: "Token không hợp lệ" });
      }
  
      // Giải mã token để lấy userId (giả sử payload chứa field "userId" hoặc "id")
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      if (!userId) {
        return res.status(401).json({ message: "Không xác thực được người dùng" });
      }
  
      // Tìm user theo userId, chỉ select trường addresses để tối ưu truy vấn
      const user = await User.findById(userId).select("addresses");
      if (!user) {
        return res.status(404).json({ message: "Không tìm thấy người dùng" });
      }
  
      // Trả về danh sách địa chỉ
      return res.status(200).json({ addresses: user.addresses });
    } catch (error) {
      console.error("Lỗi getAllAddresses:", error);
      return res.status(500).json({ message: "Lỗi server, vui lòng thử lại sau" });
    }
  };



  // Controller thêm hoặc cập nhật địa chỉ người dùng theo token
  exports.addOrUpdateAddress = async (req, res) => {
    try {
      // Lấy token từ header Authorization dạng "Bearer token"
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "Không có token, truy cập không được phép" });
      }
      
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({ message: "Token không hợp lệ" });
      }
      
      // Giải mã token và lấy userId (giả sử payload chứa "userId" hoặc "id")
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId || decoded.id;
      if (!userId) {
        return res.status(401).json({ message: "Không xác thực được người dùng" });
      }
      
      // Lấy thông tin địa chỉ từ req.body
      // oldAddress: địa chỉ cũ (để sửa nếu có), address: địa chỉ mới, phone: số điện thoại mới
      const { oldAddress, address, phone } = req.body;
      if (!address || !phone) {
        return res.status(400).json({ message: "Yêu cầu nhập đầy đủ thông tin địa chỉ mới và số điện thoại" });
      }
      
      // Tìm người dùng theo userId
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Không tìm thấy người dùng" });
      }
      
      // Nếu có oldAddress (không rỗng) thì tìm trong danh sách addresses để update
      if (oldAddress && oldAddress.trim() !== "") {
        let found = false;
        // Duyệt qua các phần tử trong addresses để tìm địa chỉ cần sửa
        user.addresses = user.addresses.map(item => {
          if (item.address === oldAddress) {
            found = true;
            return { address, phone };
          }
          return item;
        });
        if (!found) {
          // Nếu không tìm thấy địa chỉ cũ phù hợp, thông báo lỗi (hoặc có thể chọn thêm mới)
          return res.status(404).json({ message: "Địa chỉ cũ không tồn tại, không thể cập nhật" });
        }
      } else {
        // Nếu oldAddress trống hoặc không có thì thêm địa chỉ mới
        user.addresses.push({ address, phone });
      }
      
      // Lưu các thay đổi
      await user.save();
      return res.status(200).json({ 
        message: "Cập nhật địa chỉ thành công", 
        addresses: user.addresses 
      });
    } catch (error) {
      console.error("Lỗi cập nhật địa chỉ:", error);
      return res.status(500).json({ message: "Lỗi server, vui lòng thử lại sau" });
    }
  };
  


  exports.updateExpoToken = async (req, res) => {
    try {
      // Lấy token từ header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Không có token." });
      }
  
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
      // Lấy user từ userId
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: "Người dùng không tồn tại." });
      }
  
      const { expo_tkn } = req.body;
  
      if (!expo_tkn) {
        return res.status(400).json({ message: "expo_tkn không được để trống." });
      }
  
      // Cập nhật expo_tkn
      user.expo_tkn = expo_tkn;
      await user.save();
  
      return res.status(200).json({
        message: "Cập nhật expo token thành công.",
        expo_tkn: user.expo_tkn
      });
    } catch (error) {
      return res.status(500).json({
        message: "Lỗi máy chủ.",
        error: error.message,
      });
    }
  };
  