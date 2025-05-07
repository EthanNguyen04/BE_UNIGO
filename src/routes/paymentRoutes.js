// server/routes/vnpay.js
const express = require('express');
const { createPaymentUrl, vnpayReturn } = require('../controllers/paymentController');
const router = express.Router();

router.post('/create_payment_url', createPaymentUrl);

router.get('/vnpay_return', vnpayReturn);

module.exports = router;
