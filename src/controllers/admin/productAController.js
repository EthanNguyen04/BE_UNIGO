const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');
const User = require('../../models/userModel');
const Order = require('../../models/orderModel');
const mongoose = require("mongoose");

const multer = require('multer');

// Cấu hình Multer dùng bộ nhớ tạm, chúng ta sẽ tự xử lý việc lưu ảnh
const storage = multer.memoryStorage();
const upload = multer({ storage }).array('images', 6); // tối đa 6 ảnh

exports.addProduct = (req, res) => {
  // Sử dụng multer để xử lý file upload
  upload(req, res, async function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ 
        message: 'Lỗi upload hình ảnh', 
        error: err.message 
      });
    }

    try {
      // 1. Xác thực token và quyền admin
      let token = req.headers.authorization;
      if (!token || !token.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Vui lòng cung cấp token!' });
      }
      token = token.split(' ')[1];
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
        return res.status(403).json({ message: 'Chỉ admin và staff mới có quyền thêm sản phẩm!' });
      }

      // 2. Lấy và validate dữ liệu từ body
      let { name, category_id, description, variants } = req.body;

      // Validate name
      if (!name || typeof name !== 'string' || name.trim().length < 5) {
        return res.status(400).json({ message: 'Tên sản phẩm phải có ít nhất 5 ký tự!' });
      }

      // Validate description
      if (!description || typeof description !== 'string' || description.trim().length < 10) {
        return res.status(400).json({ message: 'Mô tả sản phẩm phải có ít nhất 10 ký tự!' });
      }

      // Validate category_id nếu có
      if (category_id) {
        const categoryExists = await Category.findById(category_id);
        if (!categoryExists) {
          return res.status(400).json({ message: 'Danh mục không tồn tại!' });
        }
      }

      // 3. Kiểm tra tên sản phẩm trùng lặp
      const existing = await Product.findOne({
        name: { $regex: `^${name.trim()}$`, $options: 'i' }
      });
      if (existing) {
        return res.status(400).json({ message: 'Tên sản phẩm đã tồn tại!' });
      }

      // 4. Validate và parse variants
      if (typeof variants === 'string') {
        try {
          variants = JSON.parse(variants);
        } catch (parseError) {
          return res.status(400).json({ 
            message: 'Định dạng variants không hợp lệ!', 
            error: parseError.message 
          });
        }
      }

      if (!variants || !Array.isArray(variants) || variants.length === 0) {
        return res.status(400).json({ message: 'Vui lòng cung cấp ít nhất 1 phân loại sản phẩm!' });
      }

      // Validate từng variant
      for (const variant of variants) {
        if (!variant.size || !variant.color) {
          return res.status(400).json({ message: 'Mỗi phân loại phải có size và color!' });
        }
        if (typeof variant.quantity !== 'number' || variant.quantity < 0) {
          return res.status(400).json({ message: 'Số lượng phải là số >= 0!' });
        }
        if (typeof variant.priceIn !== 'number' || variant.priceIn < 0) {
          return res.status(400).json({ message: 'Giá nhập phải là số >= 0!' });
        }
        if (typeof variant.price !== 'number' || variant.price < 0) {
          return res.status(400).json({ message: 'Giá bán phải là số >= 0!' });
        }
        if (variant.price < variant.priceIn) {
          return res.status(400).json({ message: 'Giá bán không được nhỏ hơn giá nhập!' });
        }
      }

      // 5. Validate files
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Vui lòng upload ít nhất 1 ảnh!' });
      }

      if (req.files.length > 6) {
        return res.status(400).json({ message: 'Chỉ được upload tối đa 6 ảnh!' });
      }

      for (const file of req.files) {
        if (!file.mimetype.startsWith('image/')) {
          return res.status(400).json({ message: 'Chỉ chấp nhận file ảnh!' });
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB
          return res.status(400).json({ message: 'Mỗi ảnh phải nhỏ hơn 5MB!' });
        }
      }

      // 6. Tạo sản phẩm mới
      const newProduct = new Product({
        name: name.trim(),
        category_id: category_id || null,
        description: description.trim(),
        variants,
        image_urls: []
      });

      // 7. Lưu sản phẩm để có _id
      await newProduct.save();

      // 8. Tạo thư mục lưu ảnh
      const productImageFolder = path.join(__dirname, '../../public/images', newProduct._id.toString());
      if (!fs.existsSync(productImageFolder)) {
        fs.mkdirSync(productImageFolder, { recursive: true });
      }

      // 9. Lưu ảnh và cập nhật URLs
      const image_urls = [];
      for (const file of req.files) {
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e5)}.jpg`;
        const filePath = path.join(productImageFolder, fileName);
        
        try {
          await fs.promises.writeFile(filePath, file.buffer);
          image_urls.push(`/images/${newProduct._id}/${fileName}`);
        } catch (writeError) {
          console.error('Error writing file:', writeError);
          // Nếu lỗi khi lưu ảnh, xóa sản phẩm đã tạo
          await Product.findByIdAndDelete(newProduct._id);
          return res.status(500).json({ 
            message: 'Lỗi khi lưu ảnh sản phẩm', 
            error: writeError.message 
          });
        }
      }

      // 10. Cập nhật URLs ảnh cho sản phẩm
      newProduct.image_urls = image_urls;
      await newProduct.save();

      // 11. Trả về kết quả
      return res.status(201).json({ 
        message: 'Thêm sản phẩm thành công!', 
        product: newProduct 
      });

    } catch (error) {
      console.error('Server error:', error);
      
      // Xử lý các loại lỗi cụ thể
      if (error.name === 'ValidationError') {
        return res.status(400).json({ 
          message: 'Dữ liệu không hợp lệ', 
          error: error.message 
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          message: 'Token không hợp lệ' 
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: 'Token đã hết hạn' 
        });
      }

      // Lỗi không xác định
      return res.status(500).json({ 
        message: 'Lỗi máy chủ', 
        error: error.message 
      });
    }
  });
};

exports.editProduct = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: 'Lỗi upload hình ảnh', error: err.message });
    }

    try {
      // 1. Xác thực token & quyền admin
      let token = req.headers.authorization;
      if (!token || !token.startsWith('Bearer ')) {
        return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
      }
      token = token.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user || user.role !== 'admin' && user.role !== 'staff') {
        return res.status(403).json({ message: 'Chỉ admin mới có quyền sửa sản phẩm!' });
      }

      // 2. Lấy params & body
      const { id } = req.params;
      let { name, category_id, description, variants, imageIndex } = req.body;

      // 3. Parse variants nếu là chuỗi JSON
      if (typeof variants === 'string') {
        try {
          variants = JSON.parse(variants);
        } catch (parseErr) {
          return res.status(400).json({ message: 'Định dạng variants không hợp lệ!', error: parseErr.message });
        }
      }

      // 4. Tìm product
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ message: 'Không tìm thấy sản phẩm!' });
      }

      // 4.1 Kiểm tra trùng tên nếu có thay đổi tên
      if (name && name !== product.name) {
        const existingProduct = await Product.findOne({ 
          name: name,
          _id: { $ne: id } // Loại trừ sản phẩm hiện tại
        });
        if (existingProduct) {
          return res.status(400).json({ message: 'Tên sản phẩm đã tồn tại!' });
        }
      }

      // 5. Cập nhật các trường chung
      if (name) product.name = name;
      if (category_id) product.category_id = category_id;
      if (description) product.description = description;

      // 6. Merge variants
      if (Array.isArray(variants)) {
        variants.forEach(newVar => {
          const { size, color, price, quantity, priceIn } = newVar;
          const existing = product.variants.find(v => v.size === size && v.color === color);
          if (existing) {
            if (price != null) existing.price = Number(price);
            if (quantity != null) existing.quantity = Number(quantity);
            if (priceIn != null) existing.priceIn = Number(priceIn);
          } else {
            product.variants.push({
              size,
              color,
              price: Number(price),
              quantity: Number(quantity),
              priceIn: Number(priceIn)
            });
          }
        });
      }

      // 7. Xử lý ảnh: bắt buộc có imageIndex nếu có file
      if (req.files && req.files.length > 0) {
        // Nếu client không gửi imageIndex ⇒ lỗi
        if (imageIndex === undefined) {
          return res.status(400).json({
            message: 'Phải gửi imageIndex (hoặc mảng imageIndex) khi cập nhật ảnh!'
          });
        }

        // Thư mục lưu ảnh sản phẩm
        const folder = path.join(__dirname, '../../public/images', product._id.toString());
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

        // Chuyển imageIndex thành mảng
        const idxes = Array.isArray(imageIndex) ? imageIndex : [imageIndex];

        // Số index phải khớp số file
        if (idxes.length !== req.files.length) {
          return res.status(400).json({
            message: 'Số phần tử imageIndex phải bằng số file images gửi lên!'
          });
        }

        // Cập nhật từng vị trí
        req.files.forEach((file, i) => {
          const raw = parseInt(idxes[i], 10);
          const idx = raw; // nếu bạn đã gửi 0-based, hoặc raw-1 nếu gửi 1-based
          // Bỏ qua idx âm hoặc quá lớn (idx > length)
          if (!Number.isInteger(idx) || idx < 0 || idx > product.image_urls.length) {
            console.warn(`Bỏ qua imageIndex không hợp lệ: ${raw}`);
            return;
          }

          // Xây đường dẫn file mới
          const fname = `${Date.now()}-${Math.round(Math.random()*1e5)}.jpg`;
          const newPath = path.join(folder, fname);
          fs.writeFileSync(newPath, file.buffer);

          if (idx < product.image_urls.length) {
            // Thay thế ảnh cũ
            const oldUrl = product.image_urls[idx];
            const oldPath = path.join(__dirname, '../../public', oldUrl);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            product.image_urls[idx] = `/images/${product._id}/${fname}`;
          } else {
            // idx === length ⇒ thêm mới
            product.image_urls.push(`/images/${product._id}/${fname}`);
          }
        });
      }
      console.log(product)
      // 8. Lưu và trả về
      await product.save();
      return res.status(200).json({ message: 'Cập nhật sản phẩm thành công!', product });

    } catch (error) {
      console.error('Error in editProduct:', error);
      return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
  });
};

//lấy chi tiết 1 sản phẩm ADMIN
exports.getProductAD = async (req, res) => {
  try {
    const productId = req.params.id;

    // 1. Tìm sản phẩm
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại!" });
    }

    // 2. Tính tổng đã bán
    const orderAggregation = await Order.aggregate([
      { $unwind: "$products" },
      { $match: { "products.product_id": new mongoose.Types.ObjectId(productId) } },
      { $unwind: "$products.variants" },
      { $group: { _id: null, totalSold: { $sum: "$products.variants.quantity" } } }
    ]);
    const totalSold = orderAggregation[0]?.totalSold || 0;

    // 3. Tổng tồn kho
    const totalQuantity = product.variants.reduce((acc, v) => acc + v.quantity, 0);

    // 4. Cập nhật status nếu hết hàng
    if (totalQuantity === 0 && product.status !== 'het_hang') {
      product.status = 'het_hang';
      await product.save();
    }

    // 5. Lấy thông tin variants từ DB
    const variants = product.variants.map(v => ({
      price: v.price,
      priceIn: v.priceIn,
      quantity: v.quantity,
      size: v.size,
      color: v.color
    }));

    // 6. Response
    return res.json({
      id: product._id,
      images: product.image_urls,
      name: product.name,
      category: product.category_id,
      description: product.description,
      discount: product.discount,
      status: product.status,
      isOnSale: product.discount > 0,
      totalQuantity,
      totalSold,
      variants
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateProductDiscount = async (req, res) => {
  try {
    // 1. Xác thực token & quyền admin/staff
    let token = req.headers.authorization;
    if (!token || !token.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'Vui lòng cung cấp token!' 
      });
    }
    token = token.split(' ')[1];
    
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
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
      return res.status(403).json({ 
        success: false,
        message: 'Chỉ admin và staff mới có quyền cập nhật giảm giá!' 
      });
    }

    // 2. Lấy product ID và discount từ request
    const { id } = req.params;
    const { discount } = req.body;

    // 3. Validate discount
    if (discount === undefined || discount === null) {
      return res.status(400).json({ 
        success: false,
        message: 'Vui lòng cung cấp giá trị giảm giá!' 
      });
    }

    const discountValue = Number(discount);
    if (isNaN(discountValue)) {
      return res.status(400).json({ 
        success: false,
        message: 'Giá trị giảm giá phải là số!' 
      });
    }

    if (discountValue < 0 || discountValue > 100) {
      return res.status(400).json({ 
        success: false,
        message: 'Giá trị giảm giá phải từ 0 đến 100!' 
      });
    }

    // 4. Validate product ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'ID sản phẩm không hợp lệ!' 
      });
    }

    // 5. Cập nhật discount trực tiếp bằng findOneAndUpdate
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id },
      { $set: { discount: discountValue } },
      { 
        new: true,
        runValidators: true
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy sản phẩm!' 
      });
    }

    // 6. Trả về kết quả
    return res.status(200).json({
      success: true,
      message: 'Cập nhật giảm giá thành công!',
      data: {
        id: updatedProduct._id,
        name: updatedProduct.name,
        discount: updatedProduct.discount,
        isOnSale: updatedProduct.discount > 0
      }
    });

  } catch (error) {
    console.error('Error in updateProductDiscount:', error);
    
    // Xử lý các loại lỗi cụ thể
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Dữ liệu không hợp lệ', 
        error: error.message 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token không hợp lệ' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token đã hết hạn' 
      });
    }

    // Lỗi không xác định
    return res.status(500).json({ 
      success: false,
      message: 'Lỗi máy chủ', 
      error: error.message 
    });
  }
};