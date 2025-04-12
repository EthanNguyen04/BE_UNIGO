const jwt = require('jsonwebtoken');
const Wishlist = require('../models/wishListModel'); // Giả sử bạn đã có model Wishlist
const Product = require('../models/productModel'); // Giả sử bạn đã có model Product

// Controller toggle danh sách yêu thích của người dùng
exports.toggleWishlist = async (req, res) => {
  try {
    // Nhận productId từ request body (không nhận userId)
    const { productId } = req.body;

    // Lấy token từ header Authorization (định dạng: "Bearer <token>")
    const authHeader = req.headers.authorization;
    if (!authHeader || !productId) {
      return res.status(400).json({ error: 'Token và productId là bắt buộc' });
    }

    // Tách token từ chuỗi "Bearer <token>"
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(400).json({ error: 'Token không hợp lệ' });
    }

    // Giải mã token để lấy thông tin user
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // Lấy userId từ token payload (ở đây thuộc tính là userId)
    const userId = decoded.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Không lấy được thông tin user từ token' });
    }

    // Tìm danh sách yêu thích của người dùng theo userId
    let wishlist = await Wishlist.findOne({ user_id: userId });

    // Nếu không tìm thấy, tạo mới danh sách yêu thích với sản phẩm hiện tại
    if (!wishlist) {
      wishlist = new Wishlist({
        user_id: userId,
        product_ids: [productId]
      });
      await wishlist.save();
      return res.status(200).json({ message: 'Thêm sản phẩm vào danh sách yêu thích thành công!', wishlist });
    }

    // Kiểm tra xem sản phẩm có tồn tại trong danh sách hay không
    const productIndex = wishlist.product_ids.indexOf(productId);
    if (productIndex !== -1) {
      // Nếu sản phẩm đã có, xóa khỏi danh sách yêu thích
      wishlist.product_ids.splice(productIndex, 1);
      await wishlist.save();
      return res.status(200).json({ message: 'Xóa sản phẩm khỏi danh sách yêu thích thành công!', wishlist });
    } else {
      // Nếu chưa có, thêm sản phẩm vào danh sách yêu thích
      wishlist.product_ids.push(productId);
      await wishlist.save();
      return res.status(200).json({ message: 'Thêm sản phẩm vào danh sách yêu thích thành công!', wishlist });
    }
  } catch (error) {
    console.error('Lỗi khi xử lý wishlist:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
  }
};

// Controller kiểm tra sản phẩm có trong danh sách yêu thích của người dùng hay không
exports.checkIfProductInWishlist = async (req, res) => {
  try {
    // Nhận productId từ request body
    const { productId } = req.body;

    // Lấy token từ header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !productId) {
      return res.status(400).json({ error: 'Token và productId là bắt buộc' });
    }

    // Tách token
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(400).json({ error: 'Token không hợp lệ' });
    }

    // Giải mã token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // Lấy userId từ payload
    const userId = decoded.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Không lấy được thông tin user từ token' });
    }

    // Tìm danh sách yêu thích của người dùng theo userId
    const wishlist = await Wishlist.findOne({ user_id: userId });
    if (!wishlist) {
      return res.status(200).json({
        message: 'Danh sách yêu thích của người dùng không tồn tại.',
        inWishlist: false
      });
    }

    // Kiểm tra xem sản phẩm có trong danh sách không
    const productExists = wishlist.product_ids.includes(productId);
    return res.status(200).json({
      message: productExists ? 'Sản phẩm có trong danh sách yêu thích.' : 'Sản phẩm không có trong danh sách yêu thích.',
      inWishlist: productExists
    });
  } catch (error) {
    console.error('Lỗi khi kiểm tra wishlist:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
  }
};
