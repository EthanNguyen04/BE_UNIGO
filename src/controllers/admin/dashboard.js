const User = require('../../models/userModel');
const Product = require('../../models/productModel');
const Order = require('../../models/orderModel');
const Category = require('../../models/categoryModel');
const jwt = require('jsonwebtoken');


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
            const stoppedProducts = await Product.countDocuments({ status: 'ngung_ban' });

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
                outOfStockProducts,
                // Số lượng sản phẩm đã ngừng bán
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
            const result = products.map(product => {
                const prices = product.variants.map(variant => variant.price);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const totalQuantity = product.variants.reduce((sum, variant) => sum + variant.quantity, 0);
                const displayPrice = minPrice === maxPrice ? `${minPrice}` : `${minPrice} - ${maxPrice}`;
                const productStatus = totalQuantity === 0 ? 'het_hang' : product.status;

                return {
                    id: product._id,
                    name: product.name,
                    category: product.category_id?.name || 'Không xác định',
                    price: displayPrice,
                    totalQuantity,
                    status: productStatus,
                    discount: product.discount
                };
            });

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
                order.products.forEach(item => {
                    const productId = item.product_id._id.toString();
                    const productName = item.product_id.name;

                    // Nếu sản phẩm chưa có trong map, khởi tạo
                    if (!productStats.has(productId)) {
                        productStats.set(productId, {
                            productId,
                            productName,
                            totalQuantity: 0,
                            totalRevenue: 0,
                            averageRating: 3 // Giá trị mặc định
                        });
                    }

                    const stats = productStats.get(productId);

                    // Cộng dồn số lượng và doanh thu từ các variants
                    item.variants.forEach(variant => {
                        stats.totalQuantity += variant.attributes.quantity;
                        stats.totalRevenue += variant.price * variant.attributes.quantity;
                    });
                });
            });

            // Chuyển map thành array và sắp xếp theo totalQuantity giảm dần
            const sortedStats = Array.from(productStats.values())
                .sort((a, b) => b.totalQuantity - a.totalQuantity)
                .slice(0, 10); // Lấy top 10

            /*
            * Ví dụ dữ liệu trả về:
            * {
            *   "success": true,
            *   "data": [
            *     {
            *       "productId": "65f2e8b7c261e6001234abcd",
            *       "productName": "Áo thun nam",
            *       "totalQuantity": 150,
            *       "totalRevenue": 4500000,
            *       "averageRating": 3
            *     },
            *     {
            *       "productId": "65f2e8b7c261e6001234abce",
            *       "productName": "Quần jean nữ",
            *       "totalQuantity": 120,
            *       "totalRevenue": 3600000,
            *       "averageRating": 3
            *     },
            *     // ... các sản phẩm khác
            *   ]
            * }
            */

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
