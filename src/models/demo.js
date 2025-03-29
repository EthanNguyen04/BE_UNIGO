// User Model
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true }, // Địa chỉ email của người dùng (duy nhất)
    password: { type: String, required: true }, // Mật khẩu đã được mã hóa
    full_name: { type: String, required: true }, // Họ và tên đầy đủ của người dùng
    addresses: { type: [String], default: [] }, // Danh sách địa chỉ của người dùng
    avatar_url: { type: String, default: '' }, // Đường dẫn đến ảnh đại diện
    role: { type: String, enum: ['user', 'admin'], default: 'user' }, // Vai trò của người dùng (user/admin)
    account_status: { 
        type: String, 
        enum: ['pending', 'active', 'disabled'], 
        default: 'pending' 
    }, // Trạng thái tài khoản
    otp: { type: String }, // Mã OTP để xác thực
    otpExpiresAt: { type: Date }, // Thời gian hết hạn OTP
    otp_verified: { type: Boolean, default: false }, // Trạng thái xác thực OTP
    otp_type: { type: String, enum: ['register', 'reset_password'], default: null }, // Loại OTP
    isActive: { type: Boolean, default: false }, // Trạng thái kích hoạt tài khoản
    created_at: { type: Date, default: Date.now } // Ngày tạo tài khoản
});

const User = mongoose.model('User', userSchema);

// Product Model
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

// Category Model
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Tên danh mục sản phẩm (duy nhất)
});

const Category = mongoose.model('Category', categorySchema);

// Discount Code Model
const discountCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, // Mã giảm giá (duy nhất)
    discount_percent: { type: Number, required: true }, // Phần trăm giảm giá
    min_order_value: { type: Number, required: true }, // Giá trị đơn hàng tối thiểu để áp mã
    expiration_date: { type: Date, required: true }, // Ngày hết hạn mã giảm giá
    max_uses: { type: Number, default: 1 }, // Số lần sử dụng tối đa
    times_used: { type: Number, default: 0 } // Số lần đã sử dụng
});
const DiscountCode = mongoose.model('DiscountCode', discountCodeSchema);

// Cart Model
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

// Wishlist Model
const wishlistSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ID người dùng sở hữu danh sách yêu thích
    product_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }] // Danh sách ID sản phẩm yêu thích
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = { User, Product, Category, DiscountCode, Cart, Wishlist };
