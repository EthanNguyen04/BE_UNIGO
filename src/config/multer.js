const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Không cần tạo trước thư mục images, vì sẽ tạo động theo productId
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Đảm bảo có req.productId được gán trước
        const productId = req.productId;
        const folderPath = path.join(__dirname, '..', 'public', 'images', productId);

        // Tạo thư mục nếu chưa tồn tại
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        cb(null, folderPath); // Lưu ảnh vào thư mục tương ứng
    },
    filename: function (req, file, cb) {
        const index = req.fileIndex = (req.fileIndex || 0) + 1;
        cb(null, `${index}.jpg`);
    }
});

const upload = multer({ storage });

module.exports = upload;
