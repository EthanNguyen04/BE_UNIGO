const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

// Routes
app.get("/", (req, res) => {
    res.send("🚀 API is running...");
});

module.exports = app;
