const mongoose = require("mongoose");


const cartSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ID người dùng sở hữu giỏ hàng
    products: [{ 
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true }, // ID sản phẩm
        color: { type: String, default: null }, // Màu sản phẩm
        size: { type: String, default: null }, // Kích thước sản phẩm 
        quantity: { type: Number, min: 1, default: 1 } // Số lượng sản phẩm (tối thiểu là 1)
    }]
}, {
    timestamps: true  // <-- ở đây  sẽ tự thêm createdAt & updatedAt
  });

module.exports = mongoose.model('Cart', cartSchema);
