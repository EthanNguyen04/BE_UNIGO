const express = require("express");
const productController = require("../controllers/productController"); // Kiểm tra đường dẫn
const productAController = require("../controllers/admin/productAController"); // Kiểm tra đường dẫn

const router = express.Router();

router.post('/add_product', productAController.addProduct);
router.get('/products', productController.getAllProductsDangBan);
router.get('/products/:id', productController.getProductsByCategoryId);

router.get('/products_dx', productController.getDeXuatProducts);
router.get('/products_sale', productController.getSaleProducts);


module.exports = router;