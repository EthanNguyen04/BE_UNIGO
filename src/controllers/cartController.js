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
    
    // Sử dụng decoded.id thay vì decoded._id nếu token payload chứa id
    const userId = decoded.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Không lấy được thông tin user từ token' });
    }
    
    // Tìm giỏ hàng của người dùng
    let cart = await Cart.findOne({ user_id: userId });

    if (cart) {
      // Kiểm tra nếu sản phẩm đã có trong giỏ hàng với cùng product_id, size và color
      const existingProductIndex = cart.products.findIndex(
        (product) =>
          product.product_id.toString() === product_id &&
          product.size === size &&
          product.color === color
      );

      if (existingProductIndex !== -1) {
        // Nếu có, chỉ cập nhật số lượng
        cart.products[existingProductIndex].quantity += quantityValue;
      } else {
        // Nếu không có, thêm mới sản phẩm vào giỏ hàng
        cart.products.push({
          product_id,
          color: color || null,
          size: size || null,
          quantity: quantityValue,
        });
      }
      
      // Lưu lại giỏ hàng sau khi cập nhật
      await cart.save();
      return res.status(200).json({
        message: 'Cập nhật cart thành công',
        cart,
      });
    } else {
      // Nếu giỏ hàng chưa tồn tại, tạo mới giỏ hàng
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
      console.log(products)
      return res.status(200).json({
        products });
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


  
  exports.removeProductsFromCart = async (req, res) => {
    try {
      // 1. Xác thực token
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token không hợp lệ hoặc thiếu." });
      }
      let decoded;
      try {
        decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
      } catch {
        return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
      }
      const userId = decoded.userId;
  
      // 2. Lấy danh sách sản phẩm cần xoá
      const { products } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: "Vui lòng gửi danh sách sản phẩm cần xoá." });
      }
  
      // 3. Tìm cart
      const cart = await Cart.findOne({ user_id: userId });
      if (!cart) {
        return res.status(404).json({ error: "Không tìm thấy giỏ hàng của người dùng." });
      }
  
      // 4. Xóa từng sản phẩm
      let removedCount = 0;
      products.forEach(({ product_id, color, size }) => {
        const before = cart.products.length;
        cart.products = cart.products.filter(item =>
          !(
            item.product_id.toString() === product_id &&
            item.color === color &&
            item.size === size
          )
        );
        removedCount += (before - cart.products.length);
      });
  
      // 5. Nếu có xóa thì save, không thì bỏ qua
      if (removedCount > 0) {
        await cart.save();
        return res.status(200).json({
          message: `Đã xóa ${removedCount} mục khỏi giỏ hàng.`,
          cart
        });
      } else {
        return res.status(200).json({
          message: "Không tìm thấy mục nào trùng khớp, không có gì thay đổi.",
          cart
        });
      }
    } catch (error) {
      console.error("Lỗi khi xoá sản phẩm khỏi giỏ hàng:", error);
      return res.status(500).json({ error: "Lỗi máy chủ." });
    }
  };
  

  
exports.updateCartQuantity = async (req, res) => {
  try {
    // 1) Xác thực token và lấy userId
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token không hợp lệ hoặc thiếu." });
    }
    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch {
      return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
    }
    const userId = decoded.userId;

    // 2) Lấy data từ body
    const { product_id, color, size, quantity } = req.body;
    if (!product_id || !quantity || quantity < 1) {
      return res.status(400).json({ error: "Vui lòng gửi product_id và quantity ≥ 1." });
    }

    // 3) Tìm cart của user
    const cart = await Cart.findOne({ user_id: userId });
    if (!cart) {
      return res.status(404).json({ error: "Không tìm thấy giỏ hàng." });
    }

    // 4) Tìm item phù hợp và cập nhật quantity
    let found = false;
    cart.products = cart.products.map(item => {
      if (
        item.product_id.toString() === product_id &&
        item.color === color &&
        item.size === size
      ) {
        found = true;
        return {
          ...item.toObject(),
          quantity
        };
      }
      return item;
    });

    if (!found) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy sản phẩm/màu/kích thước tương ứng trong giỏ." });
    }

    // 5) Lưu lại và trả về cart mới
    await cart.save();
    res.status(200).json({ message: "Cập nhật số lượng thành công!", cart });
  } catch (err) {
    console.error("Lỗi updateCartQuantity:", err);
    res.status(500).json({ error: "Lỗi máy chủ.", details: err.message });
  }
};