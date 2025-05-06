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
    //console.log("đã gọi")
  // Sử dụng multer để xử lý file upload
  upload(req, res, async function (err) {
    if (err) {
      return res.status(400).json({ message: 'Lỗi upload hình ảnh', error: err.message });
    }

    try {
      // Xác thực token và quyền admin
      let token = req.headers.authorization;
      if (!token || !token.startsWith('Bearer ')) {
        return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
      }
      token = token.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user || user.role !== 'admin' && user.role !== 'staff' ) {
        return res.status(403).json({ message: 'Chỉ admin mới có quyền thêm sản phẩm!' });
      }

      // Lấy dữ liệu từ body (gửi theo JSON hoặc form-data)
      let { name, category_id, description, variants, priceIn } = req.body;

      // Kiểm tra các trường bắt buộc
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: 'Tên sản phẩm là bắt buộc!' });
      }
      if (!description || typeof description !== 'string' || description.trim() === '') {
        return res.status(400).json({ message: 'Mô tả sản phẩm là bắt buộc!' });
      }

      // Xử lý trường variants: nếu là string, parse nó thành mảng
      if (typeof variants === 'string') {
        try {
          variants = JSON.parse(variants);
        } catch (parseError) {
          return res.status(400).json({ message: 'Định dạng variants không hợp lệ!', error: parseError.message });
        }
      }

      if (!variants || !Array.isArray(variants) || variants.length === 0) {
        return res.status(400).json({ message: 'Vui lòng cung cấp thông tin variants theo định dạng JSON!' });
      }
      
      // Tạo sản phẩm mới với variants từ JSON
      const newProduct = new Product({
        name,
        category_id: category_id || null,
        description,
        variants,
        image_urls: [], // sẽ cập nhật sau khi lưu ảnh
        priceIn
      });

      await newProduct.save(); // Lưu để có _id

      // Tạo thư mục lưu ảnh dựa theo _id của sản phẩm
      const productImageFolder = path.join(__dirname, '../../public/images', newProduct._id.toString());
      if (!fs.existsSync(productImageFolder)) {
        fs.mkdirSync(productImageFolder, { recursive: true });
      }
      //console.log("đã gọi")

      // Lưu các file ảnh đã upload vào thư mục và tạo đường dẫn lưu trữ
      const image_urls = [];
      req.files.forEach(file => {
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e5)}.jpg`;
        const filePath = path.join(productImageFolder, fileName);
        fs.writeFileSync(filePath, file.buffer);
        image_urls.push(`/images/${newProduct._id}/${fileName}`);
      });

      // Cập nhật lại danh sách ảnh cho sản phẩm
      newProduct.image_urls = image_urls;
      await newProduct.save();

      return res.status(201).json({ message: 'Thêm sản phẩm thành công!', product: newProduct });
    } catch (error) {
      return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
  });
};

exports.editProduct = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: 'Lỗi upload hình ảnh', error: err.message });
    }

    // 📌 LOG TOÀN BỘ DỮ LIỆU NHẬN VỀ
    // console.log('--- editProduct called ---');
    // console.log('Params:', req.params);
    // console.log('Body:', req.body);
    // console.log('Files:', req.files);

    try {
      // 1. Xác thực token & quyền admin
      let token = req.headers.authorization;
      if (!token || !token.startsWith('Bearer ')) {
        return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
      }
      token = token.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.userId);
      if (!user || user.role !== 'admin' && user.role !== 'staff') {
        return res.status(403).json({ message: 'Chỉ admin mới có quyền sửa sản phẩm!' });
      }

      // 2. Lấy params & body
      const { id } = req.params;
      let { name, category_id, priceIn, description, variants, imageIndex } = req.body;

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

      // 5. Cập nhật các trường chung
      if (name)             product.name        = name;
      if (category_id)      product.category_id = category_id;
      if (priceIn != null) product.priceIn    = Number(priceIn);
      if (description)      product.description = description;

      // 6. Merge variants
      if (Array.isArray(variants)) {
        variants.forEach(newVar => {
          const { size, color, price, quantity } = newVar;
          const existing = product.variants.find(v => v.size === size && v.color === color);
          if (existing) {
            if (price    != null) existing.price    = Number(price);
            if (quantity != null) existing.quantity = Number(quantity);
          } else {
            product.variants.push({
              size,
              color,
              price:    Number(price),
              quantity: Number(quantity),
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
          const raw   = parseInt(idxes[i], 10);
          const idx   = raw; // nếu bạn đã gửi 0-based, hoặc raw-1 nếu gửi 1-based
          // Bỏ qua idx âm hoặc quá lớn (idx > length)
          if (!Number.isInteger(idx) || idx < 0 || idx > product.image_urls.length) {
            console.warn(`Bỏ qua imageIndex không hợp lệ: ${raw}`);
            return;
          }

          // Xây đường dẫn file mới
          const fname   = `${Date.now()}-${Math.round(Math.random()*1e5)}.jpg`;
          const newPath = path.join(folder, fname);
          fs.writeFileSync(newPath, file.buffer);

          if (idx < product.image_urls.length) {
            // Thay thế ảnh cũ
            const oldUrl  = product.image_urls[idx];
            const oldPath = path.join(__dirname, '../../public', oldUrl);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            product.image_urls[idx] = `/images/${product._id}/${fname}`;
          } else {
            // idx === length ⇒ thêm mới
            product.image_urls.push(`/images/${product._id}/${fname}`);
          }
        });
      }

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

    // 4. Chỉ lấy nguyên giá từ DB, không tính toán
    const variants = product.variants.map(v => ({
      price:    v.price,
      quantity: v.quantity,
      size:     v.size,
      color:    v.color
    }));

    // 5. Response
    return res.json({
      id:            product._id,
      images:        product.image_urls,
      name:          product.name,
      category:      product.category_id,
      priceIn:       product.priceIn,
      description:   product.description,
      discount:      product.discount,
      isOnSale:      product.discount > 0,
      totalQuantity,
      totalSold,
      variants
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
