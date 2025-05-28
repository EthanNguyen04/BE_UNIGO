const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    // ID người dùng
    user_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // Danh sách sản phẩm trong đơn hàng
    products: [
        {
            // ID sản phẩm
            product_id: { 
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'product', 
                required: true 
            },
            // Các phiên bản (variant) của sản phẩm
            variants: [
                {
                    // Giá đặt cho phiên bản này
                    price: { 
                        type: Number, 
                        required: true 
                    },
                    // Thuộc tính của sản phẩm (màu sắc, kích thước,...)
                    attributes: {
                        color: { type: String },
                        size: { type: String },
                    // Số lượng đặt mua cho phiên bản này
                    quantity: { 
                        type: Number, 
                        required: true 
                    }
                },
                }
            ]
        }
    ],
    // Địa chỉ giao hàng cùng số điện thoại liên hệ
    shipping_address: {
        address: { 
            type: String, 
            required: true 
        },
        phone: { 
            type: String, 
            required: true 
        }
    },
    // ID mã giảm giá (nếu có)
    discount_code_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'DiscountCode' 
    },
    // Phương thức thanh toán (ví dụ: COD, chuyển khoản, v.v.)
    payment_method: { 
        type: String, 
        enum: ['payment', 'cod'], 
        default: 'payment' 
    },
    // Trạng thái thanh toán (ví dụ: Chưa thanh toán, Đã thanh toán)
    payment_status: { 
        type: String, 
        enum: ['chua_thanh_toan', 'da_thanh_toan'], 
        default: 'chua_thanh_toan' 
    },
    // Trạng thái đơn hàng
    order_status: {
        type: String,
        enum: ['cho_xac_nhan', 'cho_lay_hang', 'dang_giao', 'da_giao','hoan_thanh', 'huy'],
        default: 'cho_xac_nhan'
    },
    // Lí do hủy đơn hàng (chỉ có khi order_status là "Hủy")
    cancellation_reason: { 
        type: String 
    },
    vnp_TxnRef: {
        type: String //vnp_TxnRef=1746550585875
    },
    totalPriceIn:{
        type: Number
    }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
