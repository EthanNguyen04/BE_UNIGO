const mongoose = require("mongoose");

const EvaluateSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prosucttest', required: true }, // ID sản phẩm
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }, // ID Đơn hàng
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ID người đánh giá
    star: { type: Number, required: true },    
    product_variant: { type: String }, // mẫu "size,màu"
    content: { type: String },
}, {
    timestamps: true  // <-- ở đây sẽ tự thêm createdAt & updatedAt
});

module.exports = mongoose.model('Evaluate', EvaluateSchema);
