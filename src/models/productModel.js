const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    }, // Tên sản phẩm
    category_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category', 
        required: false 
    }, // ID danh mục sản phẩm (có thể trống)
    image_urls: { 
        type: [String], 
        validate: v => Array.isArray(v) && v.length <= 6 
    }, // Danh sách URL ảnh (tối đa 6 ảnh)
    description: { 
        type: String, 
        default: '', 
        required: true 
    }, // Mô tả chi tiết sản phẩm
    status: {
        type: String,
        enum: ['dang_ban', 'het_hang', 'ngung_ban'],
        default: 'dang_ban'
    }, // Trạng thái: đang bán, hết hàng, ngừng bán
    discount: { 
        type: Number,  // Phần trăm giảm giá
        default: 0 
    },
    // Danh sách các phiên bản của sản phẩm
    variants: [
        {
            price: { 
                type: Number, 
                required: true 
            }, // Giá của phiên bản này
            quantity: { 
                type: Number, 
                default: 0 
            }, // Số lượng tồn kho của phiên bản này
            size: { 
                type: String, 
                required: true 
            }, // Kích thước của phiên bản
            color: { 
                type: String, 
                required: true 
            } // Màu sắc của phiên bản
        }
    ]
});


const Product = mongoose.model('Prosucttest', productSchema);
module.exports = Product;
