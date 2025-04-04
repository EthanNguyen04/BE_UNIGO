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

exports.getAllProductsDangBan = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // Lấy toàn bộ category có status true
        const activeCategories = await Category.find({ status: true }).lean();
        const activeCategoryIds = activeCategories.map(cat => cat._id.toString());

        // Đếm tổng số sản phẩm phù hợp (status = "dang_ban" và category hợp lệ)
        const totalCount = await Product.countDocuments({
            status: "dang_ban",
            category_id: { $in: activeCategoryIds }
        });

        const totalPages = Math.ceil(totalCount / limit);

        // Truy vấn sản phẩm có phân trang
        const products = await Product.find({
            status: "dang_ban",
            category_id: { $in: activeCategoryIds }
        })
        .skip(skip)
        .limit(limit)
        .lean();

        // Thêm tên category và saled
        const filteredProducts = products.map(prod => {
            const category = activeCategories.find(c => c._id.toString() === prod.category_id?.toString());
            return {
                ...prod,
                category_name: category?.name || null,
                saled: 3000
            };
        });

        return res.status(200).json({
            message: 'Lấy danh sách sản phẩm thành công!',
            page,
            perPage: limit,
            totalPages,
            totalCount,
            products: filteredProducts
        });

    } catch (error) {
        return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};


exports.getProductsByCategoryId = async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit =  20;
        const skip = (page - 1) * limit;

        // Kiểm tra xem danh mục có tồn tại và đang hoạt động
        const category = await Category.findOne({ _id: id, status: true });
        if (!category) {
            return res.status(404).json({ message: 'Danh mục không tồn tại hoặc đã bị vô hiệu hóa!' });
        }

        // Đếm tổng số sản phẩm để phân trang
        const totalCount = await Product.countDocuments({ category_id: id, status: "dang_ban" });
        const totalPages = Math.ceil(totalCount / limit);

        // Lấy sản phẩm theo trang
        const products = await Product.find({ category_id: id, status: "dang_ban" })
            .skip(skip)
            .limit(limit)
            .lean();

        // Gắn thêm thông tin danh mục và saled
        const updatedProducts = products.map(p => ({
            ...p,
            category_name: category.name,
            saled: 3000
        }));

        return res.status(200).json({
            message: `Danh sách sản phẩm thuộc danh mục "${category.name}"`,
            products: updatedProducts,
            currentPage: page,
            totalPages,
            totalItems: totalCount
        });

    } catch (error) {
        return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};

// API getDeXuatProducts: Lấy danh sách 20 sản phẩm đề xuất
// Mô tả: Lấy danh sách sản phẩm có trạng thái 'dang_ban', ưu tiên các sản phẩm có tỷ lệ giảm giá nhiều nhất
// Trả về: Tên sản phẩm, giá gốc, giá giảm (nếu có), link ảnh đầu tiên
// Sắp xếp: Theo tỷ lệ giảm giá từ cao xuống thấp

exports.getDeXuatProducts = async (req, res) => {
    try {
        const products = await Product.find({ status: 'dang_ban' });

        const result = products
            .map(product => {
                const discountPercent = product.discount_price > 0 ? (product.price - product.discount_price) / product.price : 0;
                let price, original_price, discount_price;
                if (product.discount_price > 0) {
                    price = product.discount_price;
                    original_price = product.discount_price;
                    discount_price = product.price;
                } else {
                    price = product.price;
                    original_price = product.price;
                    discount_price = 0;
                }
                return {
                    id: product._id,
                    link: product.image_urls.length > 0 ? product.image_urls[0] : '',
                    name: product.name,
                    original_price: original_price,
                    discount_price: discount_price,
                };
            })
            .sort((a, b) => b.discountPercent - a.discountPercent)
            .slice(0, 20);

        return res.status(200).json({ products: result });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};




// Mô tả: Lấy 10 sản phẩm bất kỳ có trạng thái 'dang_ban', ưu tiên các sản phẩm có giá giảm

exports.getSaleProducts = async (req, res) => {
    try {
        const products = await Product.aggregate([
            { $match: { status: 'dang_ban', discount_price: { $gt: 0 } } },
            { $limit: 10 }
        ]);

        const result = products.map(product => {
            const discountPercent = product.discount_price > 0 ? Math.max(Math.ceil((1 - product.discount_price / product.price) * 100), 1) : 0;
            const salePrice = product.discount_price > 0 ? product.discount_price : product.price;
            return {
                id: product._id,
                name: product.name,
                price: product.price,
                sale_price: salePrice,
                discount_percent: discountPercent > 100 ? 100 : discountPercent,
                link: product.image_urls.length > 0 ? product.image_urls[0] : ''
            };
        });

        return res.status(200).json({ products: result });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};