const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    full_name: { type: String, required: true },
    addresses: { type: [String], default: [] },
    avatar_url: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    account_status: { 
        type: String, 
        enum: ["pending", "active", "disabled"], 
        default: "pending" 
    }, // Trạng thái tài khoản (biến độc lập, không phải mảng)
    otp: { type: String }, // Đổi từ Number -> String để lưu hash OTP
    otpExpiresAt: { type: Date, default: null }, // Thời gian hết hạn của OTP
    created_at: { type: Date, default: Date.now }
}); 

module.exports = mongoose.model("User", userSchema);
