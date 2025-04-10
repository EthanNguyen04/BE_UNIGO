const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');
const User = require('../../models/userModel');
const multer = require('multer');

// Cấu hình Multer dùng bộ nhớ tạm, chúng ta sẽ tự xử lý việc lưu ảnh
const storage = multer.memoryStorage();
const upload = multer({ storage }).array('images', 6); // tối đa 6 ảnh

exports.addProduct = (req, res) => {
    console.log("đã gọi")
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
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Chỉ admin mới có quyền thêm sản phẩm!' });
      }

      // Lấy dữ liệu từ body (gửi theo JSON hoặc form-data)
      let { name, category_id, discount, description, variants } = req.body;

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
        discount: discount ? Number(discount) : 0,
        description,
        variants,
        image_urls: [] // sẽ cập nhật sau khi lưu ảnh
      });

      await newProduct.save(); // Lưu để có _id

      // Tạo thư mục lưu ảnh dựa theo _id của sản phẩm
      const productImageFolder = path.join(__dirname, '../../public/images', newProduct._id.toString());
      if (!fs.existsSync(productImageFolder)) {
        fs.mkdirSync(productImageFolder, { recursive: true });
      }
      console.log("đã gọi")

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
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Chỉ admin mới có quyền sửa sản phẩm!' });
      }

      const { id } = req.params;
      let { name, category_id, discount, description, variants } = req.body;

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ message: 'Không tìm thấy sản phẩm!' });
      }

      if (typeof variants === 'string') {
        try {
          variants = JSON.parse(variants);
        } catch (parseError) {
          return res.status(400).json({ message: 'Định dạng variants không hợp lệ!', error: parseError.message });
        }
      }

      product.name = name || product.name;
      product.category_id = category_id || product.category_id;
      product.discount = discount ? Number(discount) : product.discount;
      product.description = description || product.description;
      product.variants = variants && Array.isArray(variants) ? variants : product.variants;

      // Nếu có ảnh mới được upload
      if (req.files && req.files.length > 0) {
        const productImageFolder = path.join(__dirname, '../../public/images', product._id.toString());
        if (!fs.existsSync(productImageFolder)) {
          fs.mkdirSync(productImageFolder, { recursive: true });
        }

        const image_urls = [];
        req.files.forEach(file => {
          const fileName = `${Date.now()}-${Math.round(Math.random() * 1e5)}.jpg`;
          const filePath = path.join(productImageFolder, fileName);
          fs.writeFileSync(filePath, file.buffer);
          image_urls.push(`/images/${product._id}/${fileName}`);
        });

        product.image_urls = image_urls;
      }

      await product.save();

      return res.status(200).json({ message: 'Cập nhật sản phẩm thành công!', product });
    } catch (error) {
      return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
  });
};
