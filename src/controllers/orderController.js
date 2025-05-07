const jwt = require('jsonwebtoken');
const Order = require('../models/orderModel'); // đảm bảo  đã import đúng model Order
const User = require("../models/userModel");
const mongoose = require("mongoose");

const Product = require("../models/productModel");
const DiscountCode = require("../models/discountCodeModel");

exports.countOrders = async (req, res) => {
    try {
        // lấy token từ header
        const token = req.header('Authorization').replace('Bearer ', '');

        // Giải mã token để lấy userId
        const decoded = jwt.verify(token, process.env.JWT_SECRET);  // Thay 'your_secret_key' bằng key của bạn
        const userId = decoded.userId;

        // Truy vấn số đơn hàng theo từng trạng thái
        const [choXacNhanCount, choLayHangCount, dangGiaoCount, daGiaoCount] = await Promise.all([
            Order.countDocuments({ user_id: userId, order_status: 'cho_xac_nhan' }),
            Order.countDocuments({ user_id: userId, order_status: 'cho_lay_hang' }),
            Order.countDocuments({ user_id: userId, order_status: 'dang_giao' }),
            Order.countDocuments({ user_id: userId, order_status: 'da_giao' })
        ]);

        // Trả về kết quả
        return res.status(200).json({
            cho_xac_nhan: choXacNhanCount,
            cho_lay_hang: choLayHangCount,
            dang_giao: dangGiaoCount,
            da_giao: daGiaoCount
        });

    } catch (error) {
        console.error(error);
        return res.status(400).json({ message: 'Đã có lỗi xảy ra, vui lòng thử lại.' });
    }
};



exports.createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // 1. Auth user
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Token không hợp lệ hoặc thiếu." });
      }
      let decoded;
      try {
        decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
      } catch {
        return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
      }
      const userId = decoded.userId;
      const user = await User.findById(userId).session(session);
      if (!user || user.role !== "user") {
        return res.status(403).json({ message: "Chỉ user mới được phép đặt hàng." });
      }
  
      // 2. Validate payload
      const { products, shipping_address, discount_code_id, payment_method } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: "Danh sách sản phẩm không hợp lệ." });
      }
      if (!shipping_address?.address || !shipping_address?.phone) {
        return res.status(400).json({ message: "Thông tin địa chỉ giao hàng không hợp lệ." });
      }
  
      // 3. Deduct stock for each variant
      for (const item of products) {
        const { product_id, variants } = item;
        for (const v of variants) {
          const { color, size, quantity } = v.attributes;
          const updateResult = await Product.updateOne(
            {
              _id: product_id,
              "variants.color": color,
              "variants.size": size,
              "variants.quantity": { $gte: quantity }  // ensure enough stock
            },
            { $inc: { "variants.$.quantity": -quantity } }
          ).session(session);
          if (updateResult.matchedCount === 0) {
            // either product/variant not found or insufficient stock
            throw new Error(
              `Không đủ hàng cho sản phẩm ${product_id} (${color}/${size})`
            );
          }
        }
      }
  
      // 4. Create order
      const newOrder = await Order.create(
        [
          {
            user_id: userId,
            products,
            shipping_address,
            discount_code_id: discount_code_id || null,
            payment_method: payment_method || "cod"
          }
        ],
        { session }
      );
  
      await session.commitTransaction();
      session.endSession();
  
      return res.status(201).json({
        message: "Đơn hàng đã được tạo thành công!",
        order: newOrder[0]
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Lỗi tạo đơn hàng:", error);
      return res.status(500).json({
        message: "Lỗi tạo đơn hàng.",
        error: error.message
      });
    }
  };


exports.updatePaymentStatus = async (req, res) => {
    try {
      const { orderId } = req.params;
      const { payment_status } = req.body;
  
      // Validate orderId
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ error: "ID đơn hàng không hợp lệ." });
      }
  
      // Validate payment_status
      const validStatuses = ['chua_thanh_toan', 'da_thanh_toan'];
      if (!payment_status || !validStatuses.includes(payment_status)) {
        return res.status(400).json({ error: "payment_status không hợp lệ (chua_thanh_toan hoặc da_thanh_toan)." });
      }
  
      // Tìm và cập nhật
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { payment_status },
        { new: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).json({ error: "Không tìm thấy đơn hàng." });
      }
  
      res.status(200).json({
        message: "Cập nhật trạng thái thanh toán thành công!",
        order: updatedOrder
      });
  
    } catch (error) {
      res.status(500).json({ error: "Lỗi máy chủ", details: error.message });
    }
  };
  



  exports.getOrdersByStatus = async (req, res) => {
    try {
      // 1. Xác thực token và lấy userId
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token không hợp lệ hoặc thiếu." });
      }
      let decoded;
      try {
        decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
      } catch {
        return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
      }
      const userId = decoded.userId;
  
      // 2. Lấy order_status từ query
      const { status } = req.query;
      const validStatuses = ['cho_xac_nhan','cho_lay_hang','dang_giao','da_giao','hoan_thanh','huy'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: "status không hợp lệ." });
      }
  
      // 3. Tìm các đơn hàng của user theo status, sắp xếp mới nhất đến cũ nhất
      const orders = await Order.find({
        user_id: userId,
        order_status: status
      })
      .sort({ createdAt: -1 })
      .populate('products.product_id');
  
      // 4. Nếu không có đơn nào
      if (!orders.length) {
        return res.status(200).json({ orders: [] });
      }
  
      // 5. Build kết quả
      const result = await Promise.all(orders.map(async order => {
        // Tính tổng raw price = sum(price * quantity)
        let rawTotal = 0;
        const products = order.products.map(item => {
          const prodDoc = item.product_id;
          // Mỗi variant trong order lưu sẵn price và attributes&quantity
          const variants = item.variants.map(v => {
            rawTotal += v.price * v.attributes.quantity;
            return {
              color: v.attributes.color,
              size: v.attributes.size,
              quantity: v.attributes.quantity,
              price: v.price
            };
          });
  
          return {
            productId: prodDoc._id,
            name: prodDoc.name,
            firstImage: prodDoc.image_urls?.[0] || null,
            variants
          };
        });
  
        // Áp mã nếu có
        let purchasePrice = rawTotal;
        if (order.discount_code_id) {
          const dc = await DiscountCode.findById(order.discount_code_id);
          if (dc) {
            purchasePrice = rawTotal * (1 - dc.discount_percent / 100);
          }
        }
  
        return {
          orderId: order._id,
          products,
          rawTotal,
          purchasePrice,
          payment_status: order.payment_status,   
        };
      }));
  
      return res.status(200).json({ orders: result });
    } catch (err) {
      console.error("Lỗi getOrdersByStatus:", err);
      return res.status(500).json({ error: "Lỗi máy chủ.", details: err.message });
    }
  };