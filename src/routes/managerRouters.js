const express = require("express");
const { adminStatisticsController, productController } = require("../controllers/admin/dashboard");
const productAController = require("../controllers/admin/productAController"); // Kiểm tra đường dẫn

const router = express.Router();

router.get('/dashboard', adminStatisticsController.getStatistics);

router.get('/products_manager', productController.getProductList);

router.post('/add_product', productAController.addProduct);


module.exports = router;
