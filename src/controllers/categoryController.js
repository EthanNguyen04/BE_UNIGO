const jwt = require('jsonwebtoken');
const Category = require('../models/categoryModel');
const User = require('../models/userModel');

const Product  = require('../models/productModel'); // hoặc đường dẫn tương ứng


// Cập nhật tên danh mục theo ID (yêu cầu admin)
exports.updateCategoryById = async (req, res) => {
    try {
        // Lấy token từ header
        let token = req.headers.authorization;
        if (token && token.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        } else {
            return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
        }

        // Lấy id từ param và name từ body
        const { id } = req.params;
        let { name } = req.body;

        // Kiểm tra đầu vào
        if (!id || !name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ message: 'Vui lòng cung cấp ID và tên danh mục hợp lệ!' });
        }

        // Chuẩn hóa tên danh mục
        name = name
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        // Xác thực token và kiểm tra quyền
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
            return res.status(403).json({ message: 'Chỉ có admin mới có quyền chỉnh sửa danh mục!' });
        }

        // Kiểm tra trùng tên
        const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existing) {
            return res.status(400).json({ message: 'Tên danh mục đã tồn tại!' });
        }

        // Cập nhật danh mục
        const updated = await Category.findByIdAndUpdate(
            id,
            { name },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục!' });
        }

        return res.status(200).json({ message: 'Cập nhật danh mục thành công!', category: updated });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};


//đổi trạng thái danh mục

exports.toggleCategoryStatus = async (req, res) => {
    try {
        const { id } = req.params;

        // Lấy token từ header
        let token = req.headers.authorization;
        if (!token || !token.startsWith('Bearer ')) {
            return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
        }
        token = token.split(' ')[1];

        // Xác thực token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        // Kiểm tra quyền admin
        if (!user || user.role !== 'admin' && user.role !== 'staff') {
            return res.status(403).json({ message: 'Chỉ admin mới có quyền thay đổi trạng thái danh mục!' });
        }

        // Tìm danh mục
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục!' });
        }

        // Đảo trạng thái status
        category.status = !category.status;
        await category.save();

        return res.status(200).json({
            message: `Danh mục đã được ${category.status ? 'kích hoạt' : 'vô hiệu hóa'}.`,
            category
        });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};


// Lấy tất cả danh mục đang hoạt động
exports.getAllCategories = async (req, res) => {
    try {
      // 1. Lấy toàn bộ danh mục
      const categories = await Category.find();
  
      // 2. Kiểm tra với Product để set status động
      const updated = await Promise.all(categories.map(async cat => {
        const hasProduct = await Product.exists({ category_id: cat._id });
        // gán status mới (không lưu xuống DB, chỉ thay đổi object trả về)
        const obj = cat.toObject();
        obj.status = Boolean(hasProduct);
        return obj;
      }));
  
      // 3. Lọc chỉ lấy những danh mục đang hoạt động
      const activeCategories = updated.filter(cat => cat.status);
  
      return res.status(200).json({
        message: 'Danh sách danh mục đang hoạt động',
        categories: activeCategories
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Lỗi máy chủ',
        error: error.message
      });
    }
  };
  