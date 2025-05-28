const mongoose = require("mongoose");
const wishlistSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ID người dùng sở hữu danh sách yêu thích
    product_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'product' }] // Danh sách ID sản phẩm yêu thích
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);
module.exports = Wishlist;
