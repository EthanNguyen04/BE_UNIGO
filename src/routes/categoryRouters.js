const express = require("express");
const categoryController = require("../controllers/categoryController"); // Kiểm tra đường dẫn

const router = express.Router();

router.put("/edit_category/:id", categoryController.updateCategoryById);
router.put('/toggle_category/:id', categoryController.toggleCategoryStatus);
router.get('/all_category', categoryController.getAllCategories);




module.exports = router;
