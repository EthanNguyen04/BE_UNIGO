const express = require("express");
const productController = require("../controllers/productController"); // Kiểm tra đường dẫn

const router = express.Router();

router.get('/products', productController.getAllProductsDangBan);
router.get('/products/:id', productController.getProductsByCategoryId);

router.get('/products_dx', productController.getDeXuatProducts);
router.get('/products_sale', productController.getSaleProducts);
router.get('/allproducts_sale', productController.getAllSaleProducts);



router.get('/searchProducts', productController.searchProducts);

router.get('/:id', productController.getProduct);





module.exports = router;