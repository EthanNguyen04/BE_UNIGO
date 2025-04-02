const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    full_name: { type: String, required: true },
    addresses: { type: [String], default: [] },
    avatar_url: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin", "staff"], default: "user" },
    account_status: { 
        type: String, 
        enum: ["pending", "active", "disabled"], 
        default: "pending" 
    }, // Trạng thái tài khoản (biến độc lập, không phải mảng)
    otp: { type: String },
    otpExpiresAt: { type: Date },
    otp_verified: { type: Boolean, default: false },  // Thêm trạng thái OTP
    otp_type: { type: String, enum: ["register", "reset_password"], default: null },
    isActive: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
}); 

module.exports = mongoose.model("User", userSchema);
