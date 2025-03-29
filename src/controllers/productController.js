const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const Product = require('../models/productModel');
const User = require('../models/userModel');
const multer = require('multer');

// Cấu hình lưu trữ file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../pubic/images');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        cb(null, fileName);
    }
});

const upload = multer({
    storage: storage,
    limits: { files: 6 } // Tối đa 6 ảnh
}).array('images', 6);

// Hàm thêm sản phẩm (chỉ admin)
exports.addProduct = (req, res) => {
    upload(req, res, async function (err) {
        if (err) return res.status(400).json({ message: 'Lỗi upload hình ảnh', error: err.message });

        try {
            // Lấy token từ header
            let token = req.headers.authorization;
            if (!token || !token.startsWith('Bearer ')) {
                return res.status(400).json({ message: 'Vui lòng cung cấp token!' });
            }
            token = token.split(' ')[1];

            // Xác thực token và kiểm tra quyền
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ message: 'Chỉ admin mới có quyền thêm sản phẩm!' });
            }

            // Lấy dữ liệu sản phẩm từ req.body
            const {
                name,
                category_id,
                price,
                discount_price,
                sizes,
                colors,
                quantity,
                description
            } = req.body;

            // Lấy đường dẫn ảnh
            const image_urls = req.files.map(file => `/images/${file.filename}`);

            // Tạo sản phẩm mới
            const newProduct = new Product({
                name,
                category_id: category_id || null,
                price,
                discount_price,
                sizes: sizes ? sizes.split(',') : [],
                colors: colors ? colors.split(',') : [],
                quantity,
                image_urls,
                description
            });

            await newProduct.save();

            return res.status(201).json({ message: 'Thêm sản phẩm thành công!', product: newProduct });
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
        }
    });
};