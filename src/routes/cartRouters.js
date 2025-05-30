const express = require("express");
const cartController = require("../controllers/cartController"); // Kiểm tra đường dẫn

const router = express.Router();

router.post("/add_cart", cartController.createOrUpdateCart);

router.get("/get_cart", cartController.getUserCartProducts);

router.get("/get_count_cart", cartController.getCountCart);

router.post("/delete-product_cart", cartController.removeProductsFromCart);

router.put("/update-quantity", cartController.updateCartQuantity);


module.exports = router;
