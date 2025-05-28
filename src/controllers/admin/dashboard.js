const User = require('../../models/userModel');
const Product = require('../../models/productModel');
const Order = require('../../models/orderModel');
const Category = require('../../models/categoryModel');
const Evaluate = require('../../models/productEvaluateModel');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');


// Controller chứa hàm lấy thống kê của admin
const adminStatisticsController = {
    // Hàm lấy thống kê hệ thống
    async getStatistics(req, res) {
        try {
            // Lấy tổng số lượng đơn hàng từ database
            const totalOrders = await Order.countDocuments();

            /*
             * Lấy tổng số lượng sản phẩm theo trạng thái
             * - 'dang_ban': sản phẩm đang được bày bán
             * - 'het_hang': sản phẩm đã hết hàng
             * - 'ngung_ban': sản phẩm đã ngừng bán
             */
            const sellingProducts = await Product.countDocuments({ status: 'dang_ban' });
            const outOfStockProducts = await Product.countDocuments({ status: 'het_hang' });

            /*
             * Lấy tổng số lượng người dùng theo trạng thái tài khoản
             * - 'pending': tài khoản đang chờ xác minh
             * - 'active': tài khoản đã xác minh và đang hoạt động
             * - 'disabled': tài khoản bị khóa hoặc vô hiệu hóa
             * Chỉ lấy các tài khoản có role là 'user', không lấy 'admin' và 'staff'
             */
            const pendingUsers = await User.countDocuments({ account_status: 'pending', role: 'user' });
            const activeUsers = await User.countDocuments({ account_status: 'active', role: 'user' });
            const disabledUsers = await User.countDocuments({ account_status: 'disabled', role: 'user' });

            // Doanh thu hệ thống (mặc định là 0)
            const revenue = 0;
            const pendingOrders = 0;

            // Trả về kết quả dưới dạng JSON
            return res.status(200).json({
                // Tổng số lượng đơn hàng trong hệ thống
                totalOrders,
                pendingOrders, //chờ giao
                // Số lượng sản phẩm đang được bày bán
                sellingProducts,
                // Số lượng sản phẩm đã hết hàng
                
                stoppedProducts,
                // Số lượng người dùng có trạng thái 'pending' (đang chờ xác minh)
                pendingUsers,
                // Số lượng người dùng có trạng thái 'active' (đã xác minh và hoạt động)
                activeUsers,
                // Số lượng người dùng có trạng thái 'disabled' (bị khóa hoặc vô hiệu hóa)
                disabledUsers,
                revenue
            });
        } catch (error) {
            // Xử lý lỗi và trả về thông báo lỗi
            return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
        }
    },
};



// Controller để lấy danh sách sản phẩm với thông tin chi tiết
const productController = {
    async getProductList(req, res) {
        try {
            const { status, category } = req.query;

            // Tạo bộ lọc tìm kiếm
            const filter = {};
            if (status) {
                filter.status = status;
            }
            if (category) {
                filter.category_id = category;
            }

            // Lấy danh sách sản phẩm từ database với thông tin chi tiết
            const products = await Product.find(filter).populate('category_id', 'name');

            // Xử lý và trả về danh sách sản phẩm
            const result = await Promise.all(products.map(async product => {
                const prices = product.variants.map(variant => variant.price);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const totalQuantity = product.variants.reduce((sum, variant) => sum + variant.quantity, 0);
                const displayPrice = minPrice === maxPrice ? `${minPrice}` : `${minPrice} - ${maxPrice}`;
                
                // Cập nhật status thành 'het_hang' nếu totalQuantity = 0
                if (totalQuantity === 0 && product.status !== 'het_hang') {
                    await Product.findByIdAndUpdate(product._id, { status: 'het_hang' });
                    product.status = 'het_hang';
                }

                return {
                    id: product._id,
                    name: product.name,
                    category: product.category_id?.name || 'Không xác định',
                    price: displayPrice,
                    totalQuantity,
                    status: product.status,
                    discount: product.discount
                };
            }));

            return res.status(200).json({ message: 'Danh sách sản phẩm', data: result });
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
        }
    }
};

// Controller lấy thống kê top sản phẩm
const getStats = {
    async getStat(req, res) {
        try {
            // Kiểm tra token xác thực
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).json({ message: "Không có token." });
            }

            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (!decoded || (decoded.role !== "admin")) {
                return res.status(403).json({ message: "Bạn không có quyền." });
            }

            // Xác định điều kiện tìm kiếm dựa vào query parameter
            let orderQuery = {};
            if (req.query.order_status === 'hoan_thanh') {
                // Chỉ lấy đơn hàng hoàn thành
                orderQuery = { order_status: 'hoan_thanh' };
            } else {
                // Lấy tất cả đơn hàng trừ đơn đã hủy
                orderQuery = { order_status: { $ne: 'da_huy' } };
            }

            // Lấy đơn hàng theo điều kiện
            const orders = await Order.find(orderQuery).populate('products.product_id');

            // Tạo map để lưu thống kê cho từng sản phẩm
            const productStats = new Map();

            // Duyệt qua từng đơn hàng
            orders.forEach(order => {
                if (!order.products || !Array.isArray(order.products)) return;

                order.products.forEach(item => {
                    // Kiểm tra nếu product_id tồn tại và hợp lệ
                    if (!item.product_id || !item.product_id._id) {
                        return; // Bỏ qua nếu không có product_id hoặc product_id._id
                    }

                    const productId = item.product_id._id.toString();
                    const productName = item.product_id.name || 'Sản phẩm không xác định';

                    // Nếu sản phẩm chưa có trong map, khởi tạo
                    if (!productStats.has(productId)) {
                        productStats.set(productId, {
                            productId,
                            productName,
                            totalQuantity: 0,
                            totalRevenue: 0,
                            averageRating: 0,
                            totalRatings: 0
                        });
                    }

                    const stats = productStats.get(productId);

                    // Kiểm tra variants tồn tại trước khi tính toán
                    if (item.variants && Array.isArray(item.variants)) {
                        item.variants.forEach(variant => {
                            if (variant && variant.attributes) {
                                stats.totalQuantity += variant.attributes.quantity || 0;
                                stats.totalRevenue += (variant.price || 0) * (variant.attributes.quantity || 0);
                            }
                        });
                    }
                });
            });

            // Tính toán đánh giá trung bình cho từng sản phẩm
            const productIds = Array.from(productStats.keys());
            const ratings = await Evaluate.aggregate([
                {
                    $match: {
                        product_id: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) }
                    }
                },
                {
                    $group: {
                        _id: "$product_id",
                        averageRating: { $avg: "$star" },
                        totalRatings: { $sum: 1 }
                    }
                }
            ]);

            // Cập nhật thông tin đánh giá vào productStats
            ratings.forEach(rating => {
                const productId = rating._id.toString();
                if (productStats.has(productId)) {
                    const stats = productStats.get(productId);
                    stats.averageRating = Number(rating.averageRating.toFixed(1));
                    stats.totalRatings = rating.totalRatings;
                }
            });

            // Chuyển map thành array và sắp xếp theo totalQuantity giảm dần
            const sortedStats = Array.from(productStats.values())
                .sort((a, b) => b.totalQuantity - a.totalQuantity)
                .slice(0, 10); // Lấy top 10

            return res.status(200).json({
                success: true,
                data: sortedStats
            });

        } catch (error) {
            console.error('Lỗi khi lấy thống kê:', error);
            return res.status(500).json({
                success: false,
                error: 'Lỗi máy chủ'
            });
        }
    }
};

// Xuất controller để sử dụng trong router
module.exports = {
    adminStatisticsController,
    productController,
    getStats
};
