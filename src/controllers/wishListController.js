const Wishlist = require('../models/wishListModel'); // Giả sử bạn đã có model Wishlist
const Product = require('../models/productModel'); // Giả sử bạn đã có model Product

exports.toggleWishlist = async (req, res) => {
    try {
        const { userId, productId } = req.body; // Nhận ID người dùng và ID sản phẩm từ request body

        // Kiểm tra nếu có danh sách yêu thích của người dùng
        let wishlist = await Wishlist.findOne({ user_id: userId });

        // Nếu không có danh sách yêu thích, tạo mới
        if (!wishlist) {
            wishlist = new Wishlist({
                user_id: userId,
                product_ids: [productId]
            });
            await wishlist.save();
            return res.status(200).json({ message: 'Thêm sản phẩm vào danh sách yêu thích thành công!', wishlist });
        }

        // Kiểm tra xem sản phẩm có trong danh sách yêu thích không
        const productIndex = wishlist.product_ids.indexOf(productId);

        if (productIndex !== -1) {
            // Nếu sản phẩm đã có, xóa khỏi danh sách yêu thích
            wishlist.product_ids.splice(productIndex, 1);
            await wishlist.save();
            return res.status(200).json({ message: 'Xóa sản phẩm khỏi danh sách yêu thích thành công!', wishlist });
        } else {
            // Nếu sản phẩm chưa có, thêm vào danh sách yêu thích
            wishlist.product_ids.push(productId);
            await wishlist.save();
            return res.status(200).json({ message: 'Thêm sản phẩm vào danh sách yêu thích thành công!', wishlist });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};



// Hàm kiểm tra xem sản phẩm có trong danh sách yêu thích của người dùng hay không
exports.checkIfProductInWishlist = async (req, res) => {
    try {
        const { userId, productId } = req.body; // Nhận ID người dùng và ID sản phẩm từ request body

        // Tìm danh sách yêu thích của người dùng
        const wishlist = await Wishlist.findOne({ user_id: userId });

        if (!wishlist) {
            return res.status(200).json({ message: 'Danh sách yêu thích của người dùng không tồn tại.', inWishlist: false });
        }

        // Kiểm tra xem sản phẩm có trong danh sách yêu thích không
        const productExists = wishlist.product_ids.includes(productId);

        // Trả về kết quả kiểm tra
        return res.status(200).json({
            message: productExists ? 'Sản phẩm có trong danh sách yêu thích.' : 'Sản phẩm không có trong danh sách yêu thích.',
            inWishlist: productExists
        });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};