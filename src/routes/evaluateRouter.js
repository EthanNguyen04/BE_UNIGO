const express = require('express');
const router = express.Router();
const evaluateController = require('../controllers/evaluateController');

// Route thêm đánh giá sản phẩm
router.post('/add_evaluate', evaluateController.addEvaluate);

// Route lấy danh sách đánh giá theo sản phẩm
router.get('/product/:productId', evaluateController.getProductEvaluates);

// // Route lấy danh sách đánh giá theo user
// router.get('/user', evaluateController.getEvaluatesByUser);

// // Route cập nhật đánh giá
// router.put('/:evaluateId', evaluateController.updateEvaluate);

// // Route xóa đánh giá
// router.delete('/:evaluateId', evaluateController.deleteEvaluate);

module.exports = router; 