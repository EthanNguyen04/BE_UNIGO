const express = require("express");
const orderController = require("../controllers/orderController"); // Kiểm tra đường dẫn

const router = express.Router();


router.get("/get_oder_count", orderController.countOrders);
router.post("/create_order", orderController.createOrder);
router.put("/payment-status/:orderId", orderController.updatePaymentStatus);

router.get("/get_oder_status", orderController.getOrdersByStatus);
router.post("/cancel_order", orderController.cancelOrder);

module.exports = router;
