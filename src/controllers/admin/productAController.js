const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const User = require('../models/userModel');
const multer = require('multer');

// Cấu hình Multer dùng bộ nhớ tạm, chúng ta sẽ tự xử lý việc lưu
const storage = multer.memoryStorage();
const upload = multer({ storage }).array('images', 6); // tối đa 6 ảnh
a


exports.addProduct = (req, res) => {
    upload(req, res, async function (err) {
        if (err) return res.status(400).json({ message: 'Lỗi upload hình ảnh', error: err.message });

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

            // Lấy dữ liệu từ form
            const {
                name, category_id, price, discount_price,
                sizes, colors, quantity, description
            } = req.body;
            // VALIDATE
            if (!name || typeof name !== 'string' || name.trim() === '') {
                return res.status(400).json({ message: 'Tên sản phẩm là bắt buộc!' });
            }
            if (!description || typeof description !== 'string' || description.trim() === '') {
                return res.status(400).json({ message: 'Mô tả sản phẩm là bắt buộc!' });
            }
            if (!price || isNaN(Number(price))) {
                return res.status(400).json({ message: 'Giá sản phẩm không hợp lệ!' });
            }
            if (!quantity || isNaN(Number(quantity))) {
                return res.status(400).json({ message: 'Số lượng sản phẩm không hợp lệ!' });
            }
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: 'Vui lòng tải lên ít nhất một ảnh sản phẩm!' });
            }
            //Tạo sản phẩm trước để có ID
            const newProduct = new Product({
                name,
                category_id: category_id || null,
                price,
                discount_price,
                sizes: sizes ? sizes.split(',') : [],
                colors: colors ? colors.split(',') : [],
                quantity,
                description,
                image_urls: [] // sẽ cập nhật sau
            });

            await newProduct.save(); // Lưu để lấy _id

            // Tạo thư mục ảnh theo ID sản phẩm
            const productImageFolder = path.join(__dirname, '../public/images', newProduct._id.toString());
            if (!fs.existsSync(productImageFolder)) {
                fs.mkdirSync(productImageFolder, { recursive: true });
            }

            // Ghi từng file ảnh vào thư mục
            const image_urls = [];
            req.files.forEach((file, index) => {
                const fileName = `${Date.now()}-${Math.round(Math.random() * 1e5)}.jpg`;
                const filePath = path.join(productImageFolder, fileName);
                fs.writeFileSync(filePath, file.buffer); // Ghi file
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