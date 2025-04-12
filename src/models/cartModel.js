const mongoose = require("mongoose");


const cartSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ID người dùng sở hữu giỏ hàng
    products: [{ 
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prosucttest', required: true }, // ID sản phẩm
        color: { type: String, default: null }, // Màu sản phẩm (có thể trống)
        size: { type: String, default: null }, // Kích thước sản phẩm (có thể trống)
        quantity: { type: Number, min: 1, default: 1 } // Số lượng sản phẩm (tối thiểu là 1)
    }]
});

module.exports = mongoose.model('Cart', cartSchema);
