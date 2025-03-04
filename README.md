 
# BE_UNIGO

BE_UNIGO là backend API được xây dựng bằng Node.js và Express cho dự án UNIGO.

## 📌 Cấu trúc thư mục
```
BE_UNIGO/
│-- src/
│   ├── controllers/   # Chứa các controller xử lý logic
│   ├── models/        # Chứa các mô hình dữ liệu
│   ├── routes/        # Chứa định tuyến API
│   ├── middlewares/   # Chứa các middleware
│   ├── config/        # Chứa cấu hình ứng dụng
│   ├── utils/         # Chứa các hàm tiện ích
│   ├── app.js         # Khởi tạo ứng dụng Express
│   └── server.js      # Chạy server
│-- .env               # Biến môi trường
│-- .gitignore         # Các file bị bỏ qua khi đẩy lên Git
│-- package.json       # Thông tin và dependencies của dự án
│-- README.md          # Tài liệu hướng dẫn
```

## 🚀 Cài đặt & Chạy dự án
### 1️⃣ Cài đặt dependencies
```sh
yarn install
```
### 2️⃣ Tạo file .env
Tạo file `.env` và thêm các biến môi trường cần thiết:
```
PORT=3000
DB_URL=mongodb://localhost:27017/unigo 
```
### 3️⃣ Chạy server
```sh
yarn start
```
Server sẽ chạy tại `http://localhost:3000`

## 📌 Công nghệ sử dụng
- Node.js
- Express.js
- MongoDB (Mongoose)
- dotenv (Quản lý biến môi trường)

## 📌 API Endpoints
| Phương thức | Endpoint       | Mô tả                   |
|------------|---------------|-------------------------|
| GET        | /api/users    | Lấy danh sách người dùng |
| POST       | /api/users    | Tạo người dùng mới       |


