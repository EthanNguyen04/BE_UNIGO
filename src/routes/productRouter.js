const express = require("express");
const productController = require("../controllers/productController"); // Kiểm tra đường dẫn
const router = express.Router();

router.post('/add_product', productController.addProduct);
router.get('/products', productController.getAllProductsDangBan);
router.get('/products/:id', productController.getProductsByCategoryId);

router.get('/products_dx', productController.getDeXuatProducts);


module.exports = router;