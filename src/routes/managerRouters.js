const express = require("express");
const { adminStatisticsController, productController } = require("../controllers/admin/dashboard");
const productAController = require("../controllers/admin/productAController"); // Kiểm tra đường dẫn
const categoryAController = require("../controllers/admin/categoryAController"); // Kiểm tra đường dẫn
const discountAController = require("../controllers/admin/discountAController"); // Kiểm tra đường dẫn
const notiAController = require("../controllers/admin/notiAController"); // Kiểm tra đường dẫn
const userAController = require("../controllers/admin/userAController"); // Kiểm tra đường dẫn
const orderAcontroller = require("../controllers/admin/orderAcontroller"); // Kiểm tra đường dẫn


const router = express.Router();

router.get('/dashboard', adminStatisticsController.getStatistics);

router.get('/products_manager', productController.getProductList);

router.post('/add_product', productAController.addProduct);

router.put('/edit_product/:id', productAController.editProduct);

router.get('/categories', categoryAController.getCategories);

router.post("/add_category", categoryAController.createCategory);

router.get('/get_product/:id', productAController.getProductAD);
router.put('/edit_category/:id', categoryAController.updateCategory);  
router.post('/add_discount', discountAController.createDiscountCode);   
router.get('/get_all_discounts', discountAController.getAllDiscountCodes);  

router.put('/update_discount', discountAController.updateDiscountCode);  
router.post('/send-notification', notiAController.pushNotificationController);
router.get('/getAllUsers', userAController.getAllUsers);

router.post('/add_staff', userAController.addStaff);
router.delete('/delete_staff/:userId', userAController.deleteStaff);

router.get("/orders", orderAcontroller.getAllOrders);

router.put("/orders/status", orderAcontroller.batchUpdateOrderStatus);
router.get("/stats/daily-sales", orderAcontroller.getDailySalesStats);

module.exports = router;
