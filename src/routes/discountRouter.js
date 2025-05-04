
const express = require("express");
const discountController = require("../controllers/discountController"); // Kiểm tra đường dẫn

const router = express.Router();
router.get('/discount_today', discountController.getDiscountCodesBeforeToday);

module.exports = router;
