const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();
const connectDB = require("./config/db");

const app = express();
app.use(express.json());
app.use(cors());

// Kết nối MongoDB
connectDB();

// Định tuyến API
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/auth", require("./routes/authRouter"));



module.exports = app;
