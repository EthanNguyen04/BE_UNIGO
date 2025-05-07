// src/controllers/vnpayController.js
const { createPaymentUrl, validateSignature } = require('../utils/vnpay');
const Order = require('../models/orderModel');  // đường dẫn đúng tới file orderModel của bạn

exports.createPaymentUrl = async (req, res) => {
    try {
      const { orderId, amount, orderInfo, orderType } = req.body;
  
      // 1) Kiểm tra đơn hàng
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ code: '01', message: 'Order not found' });
      }
  
      // 2) Dùng orderId làm vnp_TxnRef
      const ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const txnRef = orderId;  // gắn thẳng
  
      // 3) Tạo URL
      const url = createPaymentUrl({ amount, orderInfo, orderType, ipAddr, txnRef });
  

      return res.json({ code: '00', data: url });
    } catch (err) {
      console.error('VNPAY createPaymentUrl error:', err);
      return res.status(500).json({ code: '99', message: err.message });
    }
  };
  
  exports.vnpayReturn = async (req, res) => {
    const query = req.query;
    // 1) Validate chữ ký
    if (!validateSignature(query)) {
      return res.status(400).send('Chữ ký không hợp lệ');
    }
  
    const { vnp_TxnRef, vnp_ResponseCode } = query;
    // 2) Tìm order theo txnRef
    const order = await Order.findById(vnp_TxnRef);
    if (!order) {
      return res.status(404).send('Không tìm thấy đơn hàng');
    }
  
    // 3) Cập nhật trạng thái
    if (vnp_ResponseCode === '00') {
      order.status = 'PAID';
      order.paidAt = new Date();
      await order.save();
      // redirect hoặc render trang success
      return res.send('Thanh toán thành công cho đơn #' + vnp_TxnRef);
    } else {
      order.status = 'FAILED';
      await order.save();
      return res.send(`Thanh toán thất bại (code=${vnp_ResponseCode}) cho đơn #${vnp_TxnRef}`);
    }
  };
  