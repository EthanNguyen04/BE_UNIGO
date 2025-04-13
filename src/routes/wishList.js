const express = require("express");
const wishListController = require("../controllers/wishListController"); // Kiểm tra đường dẫn

const router = express.Router();

router.post('/change_like', wishListController.toggleWishlist);

router.post('/check_like', wishListController.checkIfProductInWishlist);

router.get('/getFavoriteProducts', wishListController.getFavoriteProducts);

module.exports = router;
