const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require('path');
const cookieParser = require('cookie-parser');

dotenv.config();
const connectDB = require("./config/db");

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// Kết nối MongoDB
connectDB();

// Định tuyến API
app.use("/api/noti", require("./routes/notificationRouter"));


app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/category", require("./routes/categoryRouters"));
app.use("/api/product", require("./routes/productRouter"));
app.use("/api/cart", require("./routes/cartRouters"));
app.use("/api/wishlist", require("./routes/wishList"));
app.use("/api/order", require("./routes/oderRouters"));

app.use("/api/discount", require("./routes/discountRouter"));



// Định tuyến ADMIN
app.use("/manager", require("./routes/managerRouters"));





module.exports = app;
