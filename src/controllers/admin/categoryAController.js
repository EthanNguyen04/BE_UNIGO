const Category = require('../../models/categoryModel');
const Product  = require('../../models/productModel');
const User = require('../../models/userModel');
const mongoose = require("mongoose");

const jwt = require('jsonwebtoken');
// Lấy tất cả danh mục và đồng bộ trường `status`
exports.getCategories = async (req, res) => {
    try {
      // 1. Lấy toàn bộ danh mục
      const categories = await Category.find();
  
      // 2. Duyệt từng danh mục, tính lại status & cập nhật DB nếu cần
      const categoriesSynced = await Promise.all(
        categories.map(async cat => {
          const active = !!(await Product.exists({ category_id: cat._id }));
          if (cat.status !== active) {
            cat.status = active;
            await cat.save();
          }
          return cat.toObject();
        })
      );
      
  
      // 3. Phản hồi
      return res.status(200).json({
        message: 'Danh sách danh mục (đã đồng bộ trạng thái)',
        categories: categoriesSynced,
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Lỗi máy chủ',
        error: error.message,
      });
    }
  };
  
  

// Tạo mới danh mục
exports.createCategory = async (req, res) => {
    try {
        // Lấy token từ header
        let token = req.headers.authorization;
        if (token && token.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        } else {
            return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
        }

        // Lấy và xử lý tên danh mục
        let { name } = req.body || '';
        
        // Kiểm tra tên danh mục không được để trống hoặc chỉ chứa khoảng trắng
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ message: 'Tên danh mục không được để trống hoặc chỉ chứa khoảng trắng!' });
        }

        // Chuyển tên danh mục về định dạng title case
        if (name && typeof name === 'string') {
            name = name
                .trim()                         // Xoá khoảng trắng đầu cuối
                .replace(/\s+/g, ' ')           // Loại bỏ khoảng trắng thừa giữa các từ
                .toLowerCase()                  // Chuyển về chữ thường hết
                .split(' ')                     // Tách từng từ
                .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Viết hoa chữ cái đầu
                .join(' ');                     // Ghép lại thành chuỗi
        }
        console.log('Tên danh mục nhận được từ req.body:', name);

        try {
            // Xác thực token
            console.log("Token nhận được:", token);
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log("Decoded token:", decoded);
            console.log("User từ token:", decoded.userId);

            const user = await User.findById(decoded.userId);
            console.log("User tìm được:", user.role);


            // Kiểm tra quyền admin
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ message: 'Chỉ có admin mới có quyền tạo danh mục!' });
            }

            // Kiểm tra xem danh mục đã tồn tại chưa (không phân biệt hoa thường)
            const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
            if (existingCategory) {
                return res.status(400).json({ message: 'Danh mục đã tồn tại!' });
            }
            console.log("đến đây :", user.role);
            // Tạo mới danh mục
            const newCategory = new Category({ name });
            console.log("đến đây 2 :", user.role);

            await newCategory.save();
            console.log("đến đây 3:", user.role);


            return res.status(201).json({ message: 'Tạo danh mục thành công!', category: newCategory });
        } catch (err) {
            return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};


exports.updateCategory = async (req, res) => {
    try {
      /* -------- 1. Xác thực token & quyền admin -------- */
      let token = req.headers.authorization;
      if (!token?.startsWith('Bearer '))
        return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
  
      token = token.split(' ')[1];
  
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ message: 'Token không hợp lệ hoặc hết hạn!' });
      }
  
      const user = await User.findById(decoded.userId);
      if (!user || user.role !== 'admin')
        return res.status(403).json({ message: 'Chỉ admin mới có quyền sửa danh mục!' });
  
      /* -------- 2. Lấy category & chỉ cho phép sửa khi status = false -------- */
      const { id }   = req.params;
      const category = await Category.findById(id);
      if (!category)
        return res.status(404).json({ message: 'Không tìm thấy danh mục!' });
  
      // Danh mục đang hoạt động → không cho sửa
      if (category.status === true)
        return res.status(400).json({ message: 'Danh mục đang hoạt động, không được sửa!' });
  
      /* -------- 3. Xử lý input -------- */
      let { name } = req.body;          // Không cho phép đổi status về true bằng API này
  
      // Chuẩn hoá & kiểm tra trùng tên
      if (typeof name === 'string' && name.trim().length > 0) {
        name = name
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase()
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
  
        if (name !== category.name) {
          const dup = await Category.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
          });
          if (dup)
            return res.status(400).json({ message: 'Tên danh mục đã tồn tại!' });
  
          category.name = name;
        }
      }
  
      await category.save();
      return res.status(200).json({
        message : 'Cập nhật danh mục thành công!',
        category,
      });
    } catch (err) {
      return res.status(500).json({ message: 'Lỗi máy chủ', error: err.message });
    }
  };
  