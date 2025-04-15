// multerConfig.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Xác định đường dẫn lưu file: ../public/user (từ thư mục hiện tại của file này)
const folderPath = path.join(__dirname, "..", "public", "user");

// Kiểm tra xem folder đã tồn tại chưa, nếu chưa có thì tạo mới
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath, { recursive: true });
}

// Cấu hình storage cho multer với folderPath đã định nghĩa
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    // Tạo tên file duy nhất dựa trên thời gian và số ngẫu nhiên
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

module.exports = upload;
