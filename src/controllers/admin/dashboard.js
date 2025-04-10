const User = require('../../models/userModel');
const Product = require('../../models/productModel');
const Order = require('../../models/orderModel');
const Category = require('../../models/categoryModel');


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
                    status: productStatus
                };
            });

            return res.status(200).json({ message: 'Danh sách sản phẩm', data: result });
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
        }
    }
};

// Xuất controller để sử dụng trong router
module.exports = {
    adminStatisticsController,
    productController
};
