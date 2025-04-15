const express = require("express");
const orderController = require("../controllers/orderController"); // Kiểm tra đường dẫn

const router = express.Router();


router.get("/get_oder_count", orderController.countOrders);

module.exports = router;
