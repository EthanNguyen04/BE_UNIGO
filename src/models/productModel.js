const mongoose = require("mongoose");
const productSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Tên sản phẩm
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: false }, // ID danh mục sản phẩm (có thể trống).
    price: { type: Number, required: true }, // Giá sản phẩm
    discount_price: { type: Number, default: 0 }, // Giá sau khi giảm
    sizes: { type: [String], default: [] }, // Các kích thước có sẵn của sản phẩm
    colors: { type: [String], default: [] }, // Các màu có sẵn của sản phẩm
    quantity: { type: Number, default: 0 }, // Số lượng tồn kho
    image_urls: { type: [String], validate: v => Array.isArray(v) && v.length <= 6 }, // Danh sách URL ảnh (tối đa 6 ảnh)
    description: { type: String, default: '' }, // Mô tả chi tiết sản phẩm
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
