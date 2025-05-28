const Evaluate = require('../models/productEvaluateModel');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Order = require('../models/orderModel');

const evaluateController = {
    addEvaluate: async (req, res) => {
        try {
            // Kiểm tra token trước khi thực hiện thêm đánh giá
            let token = req.headers.authorization;
            if (token && token.startsWith('Bearer ')) {
                token = token.split(' ')[1];
            } else {
                return res.status(400).json({ 
                    success: false,
                    message: 'Vui lòng cung cấp token!' 
                });
            }

            // Xác thực token và lấy thông tin user
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (error) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Token không hợp lệ hoặc đã hết hạn' 
                });
            }

            const user = await User.findById(decoded.userId);
            if (!user || (user.role !== 'user')) {
                return res.status(403).json({ 
                    success: false,
                    message: 'Bạn cần đăng nhập để đánh giá sản phẩm' 
                });
            }

            const { product_id, order_id, star, content, product_variant } = req.body;

            // Kiểm tra các trường bắt buộc
            if (!product_id || !order_id || !star) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu thông tin bắt buộc: product_id, order_id và star là bắt buộc'
                });
            }

            // Kiểm tra số sao đánh giá (từ 1-5 sao)
            if (star < 1 || star > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Số sao đánh giá phải từ 1 đến 5'
                });
            }

            // Kiểm tra xem user đã đánh giá sản phẩm này chưa
            const existingEvaluate = await Evaluate.findOne({
                product_id,
                order_id,
                user_id: decoded.userId
            });

            if (existingEvaluate) {
                return res.status(400).json({
                    success: false,
                    message: 'Bạn đã đánh giá sản phẩm này rồi'
                });
            }

            // Tạo đánh giá mới
            const newEvaluate = new Evaluate({
                product_id,
                order_id,
                star,
                content: content || '', // Nội dung đánh giá là tùy chọn
                product_variant: product_variant || '' // Biến thể sản phẩm là tùy chọn
            });

            // Lưu vào cơ sở dữ liệu
            const savedEvaluate = await newEvaluate.save();

            return res.status(201).json({
                success: true,
                message: 'Thêm đánh giá thành công',
                data: savedEvaluate
            });

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi khi thêm đánh giá',
                error: error.message
            });
        }
    },

    getProductEvaluates: async (req, res) => {
        try {
            const { productId } = req.params;

            // Lấy tất cả đánh giá của sản phẩm
            const evaluates = await Evaluate.find({ product_id: productId })
                .sort({ createdAt: -1 }); // Sắp xếp mới nhất lên đầu

            // Lấy thông tin user cho từng đánh giá
            const formattedEvaluates = await Promise.all(evaluates.map(async (evaluate) => {
                // 1. Lấy order từ order_id
                const order = await Order.findById(evaluate.order_id);
                if (!order) {
                    return null;
                }

                // 2. Lấy thông tin user từ user_id trong order
                const user = await User.findById(order.user_id);
                if (!user) {
                    return null;
                }

                return {
                    user: {
                        name: user.full_name,
                        avatar: user.avatar_url
                    },
                    product_variant: evaluate.product_variant,
                    star: evaluate.star,
                    content: evaluate.content,
                    createdAt: new Date(evaluate.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
                };
            }));

            // Lọc bỏ các đánh giá không có thông tin user hoặc order
            const validEvaluates = formattedEvaluates.filter(evaluate => evaluate !== null);

            return res.status(200).json({
                success: true,
                message: 'Lấy danh sách đánh giá thành công',
                data: {
                    total: validEvaluates.length,
                    evaluates: validEvaluates
                }
            });

        } catch (error) {
            console.error('Lỗi getProductEvaluates:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy danh sách đánh giá',
                error: error.message
            });
        }
    }
};

module.exports = evaluateController; 