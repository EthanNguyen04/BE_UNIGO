const mongoose = require("mongoose");

const ExpotokenSchema = new mongoose.Schema({
    expoToken: { type: String }, // Tên danh mục sản phẩm (duy nhất)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ID người dùng
    type: {
        type: String,
        enum: ['khach', 'user'], 
        default: 'khach' 
    }, // Trạng thái gửi
});

const Extkn = mongoose.model('extkn', ExpotokenSchema);
module.exports = Extkn;
