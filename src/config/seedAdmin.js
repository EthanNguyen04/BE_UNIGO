require('dotenv').config({ path: '../../.env' }); // Đảm bảo nạp biến môi trường ngay đầu
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/userModel');
const connectDB = require('./db'); // Sử dụng tệp db.js

async function seedAdmin() {
    try {
        // Kết nối tới MongoDB
        await connectDB();

        const adminEmail = 'admin@example.com';
        const adminPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Kiểm tra nếu admin đã tồn tại
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) {
            console.log('Admin đã tồn tại:', existingAdmin.email);
            return;
        }

        // Tạo tài khoản admin mới
        const adminUser = new User({
            email: adminEmail,
            password: hashedPassword,
            full_name: 'Admin User',
            role: 'admin',
            account_status: 'active',
            isActive: true
        });

        await adminUser.save();
        console.log('Tài khoản admin đã được tạo thành công!');
    } catch (error) {
        console.error('Lỗi khi tạo admin:', error.message);
    } finally {
        mongoose.connection.close();
    }
}

seedAdmin();
