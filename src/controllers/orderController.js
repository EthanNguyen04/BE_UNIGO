const jwt = require('jsonwebtoken');
const Order = require('../models/orderModel'); // Đảm bảo bạn đã import đúng model Order

exports.countOrders = async (req, res) => {
    try {
        // lấy token từ header
        const token = req.header('Authorization').replace('Bearer ', '');

        // Giải mã token để lấy userId
        const decoded = jwt.verify(token, process.env.JWT_SECRET);  // Thay 'your_secret_key' bằng key của bạn
        const userId = decoded.userId;

        // Truy vấn số đơn hàng theo từng trạng thái
        const [choXacNhanCount, choLayHangCount, dangGiaoCount, daGiaoCount] = await Promise.all([
            Order.countDocuments({ user_id: userId, order_status: 'cho_xac_nhan' }),
            Order.countDocuments({ user_id: userId, order_status: 'cho_lay_hang' }),
            Order.countDocuments({ user_id: userId, order_status: 'dang_giao' }),
            Order.countDocuments({ user_id: userId, order_status: 'da_giao' })
        ]);

        // Trả về kết quả
        return res.status(200).json({
            cho_xac_nhan: choXacNhanCount,
            cho_lay_hang: choLayHangCount,
            dang_giao: dangGiaoCount,
            da_giao: daGiaoCount
        });

    } catch (error) {
        console.error(error);
        return res.status(400).json({ message: 'Đã có lỗi xảy ra, vui lòng thử lại.' });
    }
};

