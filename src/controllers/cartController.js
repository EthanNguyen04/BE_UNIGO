const jwt = require('jsonwebtoken');
const Cart = require('../models/cartModel'); // Điều chỉnh đường dẫn tùy cấu trúc dự án

// Controller thêm mới hoặc cập nhật cart
exports.createOrUpdateCart = async (req, res) => {
    try {
      const { product_id, size, color, quantity } = req.body;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !product_id) {
        return res.status(400).json({ error: 'Token và product_id là bắt buộc' });
      }
      
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(400).json({ error: 'Token không hợp lệ' });
      }
      
      const quantityValue = quantity && quantity >= 1 ? quantity : 1;
      
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
      }
      
      // Debug: hiển thị payload của token để kiểm tra thuộc tính chứa user id
      console.log('Decoded token payload:', decoded);
      
      // Sử dụng decoded.id thay vì decoded._id nếu token payload chứa id
      const userId = decoded.userId;
      if (!userId) {
        return res.status(400).json({ error: 'Không lấy được thông tin user từ token' });
      }
      
      let cart = await Cart.findOne({ user_id: userId });
      
      if (cart) {
        cart.products.push({
          product_id,
          color: color || null,
          size: size || null,
          quantity: quantityValue,
        });
        await cart.save();
        return res.status(200).json({
          message: 'Cập nhật cart thành công - sản phẩm mới đã được thêm vào',
          cart,
        });
      } else {
        cart = new Cart({
          user_id: userId,
          products: [{
            product_id,
            color: color || null,
            size: size || null,
            quantity: quantityValue,
          }]
        });
        await cart.save();
        return res.status(201).json({
          message: 'Tạo cart mới thành công',
          cart,
        });
      }
    } catch (err) {
      console.error('Lỗi khi xử lý cart:', err);
      return res.status(500).json({ error: 'Lỗi server' });
    }
  };

  // Controller lấy danh sách product của user dựa trên token gửi từ header
// Controller GET danh sách sản phẩm trong cart của user dựa trên token gửi ở header Authorization
exports.getUserCartProducts = async (req, res) => {
    try {
      // Lấy token từ header Authorization (định dạng: "Bearer <token>")
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(400).json({ error: 'Token là bắt buộc' });
      }
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(400).json({ error: 'Token không hợp lệ' });
      }
      
      // Giải mã token để lấy thông tin user (payload chứa thuộc tính userId)
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
      }
      const userId = decoded.userId;
      if (!userId) {
        return res.status(400).json({ error: 'Không lấy được thông tin user từ token' });
      }
      
      // Tìm Cart của user và populate trường product_id để lấy thông tin chi tiết sản phẩm
      const cart = await Cart.findOne({ user_id: userId }).populate('products.product_id');
      if (!cart) {
        return res.status(200).json({ products: [] });
      }
      
      // Duyệt qua các mục trong cart để xây dựng dữ liệu trả về
      const products = cart.products.map(item => {
        // item.product_id đã được populate -> là document Product
        const productDoc = item.product_id;
        
        // Tìm variant của sản phẩm tương ứng với color và size của mục trong cart
        const matchedVariant = productDoc.variants.find(variant => {
          return variant.color === item.color && variant.size === item.size;
        });
        const originalPrice = matchedVariant ? matchedVariant.price : 0;
        
        // Tính effective price: áp dụng giảm giá (discount: phần trăm giảm giá)
        // Ví dụ: nếu discount là 20%, effectivePrice = variant.price * (1 - 20/100)
        const discountPercent = productDoc.discount || 0;
        const effectivePrice = originalPrice * (1 - discountPercent / 100);
        
        return {
          productId: productDoc._id,
          name: productDoc.name,
          firstImage: (productDoc.image_urls && productDoc.image_urls.length > 0)
                        ? productDoc.image_urls[0]
                        : null,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          price: effectivePrice
        };
      });
      
      return res.status(200).json({ products });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách sản phẩm của user từ cart:', error);
      return res.status(500).json({ error: 'Lỗi server' });
    }
  };


  //lấy số giỏ hàng

exports.getCountCart = async (req, res) => {
    try {
      // Lấy token từ header, format: "Bearer <token>"
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
      }
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Invalid token format' });
      }
  
      // Giải mã token để lấy userId (token được tạo với key userId)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
  
      // Tìm giỏ hàng của người dùng theo user_id
      const cart = await Cart.findOne({ user_id: userId });
      let totalProducts = 0;
      
      if (cart && Array.isArray(cart.products)) {
        // Tính tổng số sản phẩm (cộng dồn số lượng của từng sản phẩm)
        totalProducts = cart.products.reduce((total, item) => total + (item.quantity || 0), 0);
      }
      
      // Trả về tổng số sản phẩm trong giỏ hàng
      return res.json({ total_products: totalProducts });
    } catch (error) {
      console.error("Error in getCountCart:", error);
      return res.status(500).json({ error: error.message });
    }
  };