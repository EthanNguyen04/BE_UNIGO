const jwt = require('jsonwebtoken');
const Order = require('../models/orderModel'); // đảm bảo  đã import đúng model Order
const User = require("../models/userModel");

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


exports.createOrder = async (req, res) => {
    try {
        // Lấy token từ header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Không có token hoặc token không hợp lệ." });
        }

        const token = authHeader.split(" ")[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
        }

        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({ message: "Người dùng không tồn tại." });
        }

        if (user.role !== "user") {
            return res.status(403).json({ message: "Chỉ user mới được phép đặt hàng." });
        }

        // Lấy dữ liệu từ body
        const { products, shipping_address, discount_code_id, payment_method } = req.body;

        // Validate dữ liệu cơ bản
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: "Danh sách sản phẩm không hợp lệ." });
        }

        if (!shipping_address || !shipping_address.address || !shipping_address.phone) {
            return res.status(400).json({ message: "Thông tin địa chỉ giao hàng không hợp lệ." });
        }

       

        // Tạo đơn hàng mới
        const newOrder = new Order({
            user_id: user._id,
            products,
            shipping_address,
            discount_code_id: discount_code_id || null,
        });

        await newOrder.save();

        res.status(201).json({
            message: "Đơn hàng đã được tạo thành công!",
            order: newOrder
        });

    } catch (error) {
        console.error("Lỗi tạo đơn hàng:", error);
        res.status(500).json({ message: "Lỗi máy chủ.", error: error.message });
    }
};
