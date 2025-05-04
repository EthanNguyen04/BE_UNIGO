const mongoose = require("mongoose");
const discountCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, // Mã giảm giá (duy nhất)
    discount_percent: { type: Number, required: true }, // Phần trăm giảm giá
    min_order_value: { type: Number, required: true }, // Giá trị đơn hàng tối thiểu để áp mã
    expiration_date: { type: Date, required: true }, // Ngày hết hạn mã giảm giá
    max_uses: { type: Number, default: 1 }, // Số lần sử dụng tối đa
    times_used: { type: Number, default: 0 } // Số lần đã sử dụng
}, {
    timestamps: true  // <-- ở đây  sẽ tự thêm createdAt & updatedAt
  });
  
const DiscountCode = mongoose.model('DiscountCode', discountCodeSchema);
module.exports = DiscountCode;
