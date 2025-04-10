const express = require("express");
const wishListController = require("../controllers/wishListController"); // Kiểm tra đường dẫn

const router = express.Router();

router.post('/wishlist/add', wishListController.toggleWishlist);

router.post('/wishlist/check', wishListController.checkIfProductInWishlist);
