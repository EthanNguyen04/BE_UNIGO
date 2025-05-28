const jwt = require('jsonwebtoken');
const Order = require('../models/orderModel'); // đảm bảo  đã import đúng model Order
const User = require("../models/userModel");
const mongoose = require("mongoose");

const Product = require("../models/productModel");
const DiscountCode = require("../models/discountCodeModel");
const Evaluate = require("../models/productEvaluateModel");

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
      let totalPriceIn = 0;
      for (const item of products) {
        const { product_id, variants } = item;
        const product = await Product.findById(product_id).session(session);
        
        for (const v of variants) {
          const { color, size, quantity } = v.attributes;
          const variant = product.variants.find(
            variant => variant.color === color && variant.size === size
          );
          
          if (!variant || variant.quantity < quantity) {
            throw new Error(
              `Không đủ hàng cho sản phẩm ${product_id} (${color}/${size})`
            );
          }

          // Add priceIn to the variant data
          v.priceIn = variant.priceIn;
          totalPriceIn += variant.priceIn * quantity;

          const updateResult = await Product.updateOne(
            {
              _id: product_id,
              "variants.color": color,
              "variants.size": size,
              "variants.quantity": { $gte: quantity }
            },
            { $inc: { "variants.$.quantity": -quantity } }
          ).session(session);
          
          if (updateResult.matchedCount === 0) {
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
            payment_method: payment_method || "cod",
            totalPriceIn
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
      const { payment_status, vnp_TxnRef } = req.body;
  
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
        { payment_status , vnp_TxnRef},
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
        
        console.log('Raw orders:', JSON.stringify(orders, null, 2));

        // 4. Nếu không có đơn nào
        if (!orders.length) {
            return res.status(200).json({ orders: [] });
        }

        // 5. Kiểm tra và cập nhật các đơn chưa thanh toán có sản phẩm ngừng bán
        for (const order of orders) {
            if (order.payment_status === 'chua_thanh_toan') {
                const hasDiscontinuedProduct = order.products.some(item => 
                    item.product_id && item.product_id.status === 'het_hang'
                );
                
                if (hasDiscontinuedProduct) {
                    order.order_status = 'huy';
                    order.cancellation_reason = 'Hết hàng';
                    await order.save();
                }
            }
        }

        // 6. Build kết quả
        const result = await Promise.all(orders.map(async order => {
            // Tính tổng raw price = sum(price * quantity)
            let rawTotal = 0;
            const products = await Promise.all(order.products.map(async item => {
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

                // Kiểm tra đánh giá cho từng variant
                const evaluateStatuses = await Promise.all(variants.map(async variant => {
                    // Normalize the variant string by removing all spaces
                    const normalizedVariant = `${variant.size},${variant.color}`.replace(/\s+/g, '');
                    const evaluate = await Evaluate.findOne({
                        product_id: prodDoc._id,
                        order_id: order._id,
                        $expr: {
                            $eq: [
                                { $replaceAll: { input: "$product_variant", find: " ", replacement: "" } },
                                normalizedVariant
                            ]
                        }
                    });
                    console.log('Evaluate for variant:', {
                        product_id: prodDoc._id,
                        order_id: order._id,
                        variant: normalizedVariant,
                        evaluate: evaluate
                    });
                    return {
                        ...variant,
                        rating: !!evaluate
                    };
                }));

                return {
                    productId: prodDoc._id,
                    name: prodDoc.name,
                    firstImage: prodDoc.image_urls?.[0] || null,
                    variants: evaluateStatuses.map(v => ({
                        ...v,
                        variant: `${v.size},${v.color}`
                    }))
                };
            }));

            // Áp mã nếu có
            let purchasePrice = rawTotal;
            if (order.discount_code_id) {
                const dc = await DiscountCode.findById(order.discount_code_id);
                if (dc) {
                    purchasePrice = rawTotal * (1 - dc.discount_percent / 100);
                }
            }

            const orderResult = {
                orderId: order._id,
                order_number: order.order_number,
                products,
                rawTotal,
                purchasePrice,
                payment_status: order.payment_status,
                shipping_address: order.shipping_address,
                payment_method: order.payment_method,
                created_at: new Date(order.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }),
                updated_at: new Date(order.updatedAt).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }),
                order_status: order.order_status,
                cancellation_reason: order.cancellation_reason,
                createdAt: new Date(order.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }),
                updatedAt: new Date(order.updatedAt).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
            };
            return orderResult;
        }));

        const responseData = {
            success: true,
            message: 'Lấy danh sách đơn hàng thành công',
            data: {
                orders: result.map(order => ({
                    ...order,
                    cancellation_reason: order.cancellation_reason || null,
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt
                })),
                total: result.length,
                status: status
            }
        };
        console.log('Final response data:', JSON.stringify(responseData, null, 2));

        return res.status(200).json(responseData);
    } catch (err) {
        console.error("Lỗi getOrdersByStatus:", err);
        return res.status(500).json({ 
            success: false,
            error: "Lỗi máy chủ.", 
            details: err.message 
        });
    }
};

exports.cancelOrder = async (req, res) => {
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

        // 2. Lấy orderId và cancellation_reason từ body
        const { orderId, cancellation_reason } = req.body;
        if (!orderId) {
            return res.status(400).json({ error: "Vui lòng cung cấp orderId." });
        }
     

        // 3. Tìm đơn hàng và kiểm tra quyền sở hữu
        const order = await Order.findOne({ _id: orderId, user_id: userId });
        if (!order) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng hoặc bạn không có quyền hủy đơn này." });
        }

        // 4. Kiểm tra trạng thái đơn hàng
        const allowedStatuses = ['cho_xac_nhan', 'cho_lay_hang'];
        if (!allowedStatuses.includes(order.order_status)) {
            return res.status(400).json({ 
                error: "Không thể hủy đơn hàng ở trạng thái này. Chỉ có thể hủy đơn hàng ở trạng thái 'Chờ xác nhận' hoặc 'Chờ lấy hàng'." 
            });
        }

        // 5. Kiểm tra trạng thái thanh toán
        if (order.payment_status === 'da_thanh_toan') {
            return res.status(400).json({ 
                error: "Không thể hủy đơn hàng đã thanh toán. Vui lòng liên hệ với chúng tôi để được hỗ trợ." 
            });
        }

        // 6. Cập nhật trạng thái đơn hàng
        order.order_status = 'huy';
        order.cancellation_reason = cancellation_reason;
        await order.save();

        // 7. Hoàn trả số lượng sản phẩm
        for (const item of order.products) {
            const product = await Product.findById(item.product_id);
            if (product) {
                for (const variant of item.variants) {
                    const { color, size, quantity } = variant.attributes;
                    const productVariant = product.variants.find(
                        v => v.color === color && v.size === size
                    );
                    if (productVariant) {
                        // Chỉ cập nhật số lượng, giữ nguyên priceIn
                        await Product.updateOne(
                            {
                                _id: product._id,
                                "variants.color": color,
                                "variants.size": size
                            },
                            { $inc: { "variants.$.quantity": quantity } }
                        );
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: "Hủy đơn hàng thành công.",
            data: {
                orderId: order._id,
                order_status: order.order_status,
                cancellation_reason: order.cancellation_reason
            }
        });

    } catch (error) {
        console.error("Lỗi cancelOrder:", error);
        return res.status(500).json({ 
            success: false,
            error: "Lỗi máy chủ.", 
            details: error.message 
        });
    }
};