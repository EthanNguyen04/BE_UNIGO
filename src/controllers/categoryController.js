const jwt = require('jsonwebtoken');
const Category = require('../models/categoryModel');
const User = require('../models/userModel');

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
        if (!user || user.role !== 'admin') {
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
        if (!user || user.role !== 'admin') {
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
        const categories = await Category.find({ status: true });

        return res.status(200).json({
            message: 'Danh sách danh mục đang hoạt động',
            categories
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Lỗi máy chủ',
            error: error.message
        });
    }
};
