const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Tên danh mục sản phẩm (duy nhất)
    status: { type: Boolean, default: true } // Trạng thái: true = hoạt động, false = vô hiệu hóa
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
