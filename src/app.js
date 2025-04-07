const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require('path');
const cookieParser = require('cookie-parser');

dotenv.config();
const connectDB = require("./config/db");

const app = express();
app.use(express.json());
app.use(cors());
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// Kết nối MongoDB
connectDB();

// Định tuyến API
app.use("/api/user", require("./routes/userRoutes"));



app.use("/api/admin", require("./routes/categoryRouters"));

app.use("/api/product", require("./routes/productRouter"));




module.exports = app;
