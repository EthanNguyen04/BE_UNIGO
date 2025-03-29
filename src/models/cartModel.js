const cartSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ID người dùng sở hữu giỏ hàng
    products: [{ 
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // ID sản phẩm
        color: { type: String, default: null }, // Màu sản phẩm (có thể trống)
        size: { type: String, default: null }, // Kích thước sản phẩm (có thể trống)
        quantity: { type: Number, min: 1, default: 1 } // Số lượng sản phẩm (tối thiểu là 1)
    }]
});

const Cart = mongoose.model('Cart', cartSchema);
