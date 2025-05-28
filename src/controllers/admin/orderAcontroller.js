// controllers/adminOrderController.js
const mongoose      = require("mongoose");
const jwt           = require("jsonwebtoken");
const Order         = require("../../models/orderModel");
const DiscountCode  = require("../../models/discountCodeModel");

exports.getAllOrders = async (req, res) => {
  try {
    // 1. Xác thực token & chỉ admin
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
    if (decoded.role !== "admin" && decoded.role !== "staff") {
      return res.status(403).json({ error: "Chỉ admin mới có quyền truy xuất." });
    }

    // 2. Lọc theo order_status nếu có
    const { status } = req.query;
    const validStatuses = ['cho_xac_nhan','cho_lay_hang','dang_giao','da_giao','hoan_thanh','huy'];
    const filter = {};
    if (status) {
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "order_status không hợp lệ." });
      }
      filter.order_status = status;
    }

    // 3. Lấy tất cả đơn, sort mới nhất, populate product info
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate("products.product_id", "name image_urls");

    // 4. Nếu ko có đơn
    if (!orders.length) {
      return res.status(200).json({ orders: [] });
    }

    // 5. Build kết quả
    const result = await Promise.all(orders.map(async order => {
      let rawTotal = 0;

      const products = order.products.map(item => {
        // Tính tổng giá của product này
        const productTotal = item.variants.reduce((sum, v) => {
          const qty = v.attributes.quantity;
          sum += v.price * qty;
          return sum;
        }, 0);

        rawTotal += productTotal;

        return {
          firstImage: item.product_id.image_urls?.[0] || null,
          name:       item.product_id.name,
          variants:   item.variants.map(v => ({
            color:    v.attributes.color,
            size:     v.attributes.size,
            quantity: v.attributes.quantity,
            price:    v.price
          })),
          price: productTotal    // giá từng sản phẩm
        };
      });

      // Áp dụng mã giảm giá nếu có
      let purchaseTotal = rawTotal;
      if (order.discount_code_id) {
        const dc = await DiscountCode.findById(order.discount_code_id);
        if (dc) {
          purchaseTotal = rawTotal * (1 - dc.discount_percent / 100);
        }
      }

      return {
        orderId:        order._id,
        user_id:        order.user_id,
        shipping_address: {
          address: order.shipping_address.address,
          phone:   order.shipping_address.phone
        },
        order_status:   order.order_status,
        payment_status: order.payment_status,
        products,
        rawTotal,       // tổng giá trước giảm
        purchaseTotal   // tổng giá sau giảm
      };
    }));

    return res.status(200).json({ orders: result });
  } catch (err) {
    console.error("Lỗi getAllOrders:", err);
    return res.status(500).json({ error: "Lỗi máy chủ.", details: err.message });
  }
};


exports.batchUpdateOrderStatus = async (req, res) => {
    try {
      // 1. Xác thực token & kiểm tra admin
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
      if (decoded.role !== "admin" && decoded.role !== "staff") {
        return res.status(403).json({ error: "Chỉ admin mới có quyền thao tác." });
      }
  
      // 2. Nhận order_ids và order_status từ body
      const { order_ids, order_status } = req.body;
      if (!Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({ error: "Vui lòng gửi mảng order_ids." });
      }
      const validStatuses = ['cho_xac_nhan','cho_lay_hang','dang_giao','da_giao','hoan_thanh','huy'];
      if (!order_status || !validStatuses.includes(order_status)) {
        return res.status(400).json({ error: "order_status không hợp lệ." });
      }
  
      // 3. Chuyển order_ids thành ObjectId hợp lệ
      const objectIds = order_ids
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
  
      if (objectIds.length === 0) {
        return res.status(400).json({ error: "Không có order_id hợp lệ." });
      }
  
      // 4. Cập nhật nhiều đơn
      const result = await Order.updateMany(
        { _id: { $in: objectIds } },
        { order_status },
      );
  
      return res.status(200).json({
        message: "Cập nhật order_status thành công cho các đơn hàng.",
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      });
    } catch (err) {
      console.error("Lỗi batchUpdateOrderStatus:", err);
      return res.status(500).json({ error: "Lỗi máy chủ.", details: err.message });
    }
  };

  

  exports.getDailySalesStats = async (req, res) => {
    try {
      // 1. Auth admin
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
      if (decoded.role !== "admin") {
        return res.status(403).json({ error: "Chỉ admin mới có quyền truy xuất." });
      }
  
      // 2. Lấy year, month từ query
      const year  = parseInt(req.query.year, 10);
      const month = parseInt(req.query.month, 10); // 1–12
      if (
        isNaN(year) ||
        isNaN(month) ||
        month < 1 ||
        month > 12
      ) {
        return res.status(400).json({ error: "Vui lòng truyền year và month hợp lệ." });
      }
  
      // 3. Tính ranh giới UTC tương ứng với 00:00 GMT+7
      const offset = 7 * 60 * 60 * 1000; // 7 giờ in ms
      // 00:00 ngày đầu tháng theo GMT+7 → UTC = dateUTC - offset
      const startUtc = new Date(Date.UTC(year, month-1, 1, 0, 0, 0) - offset);
      // 00:00 ngày đầu tháng sau theo GMT+7 → UTC = dateUTC - offset
      const endUtc   = new Date(Date.UTC(year, month,   1, 0, 0, 0) - offset);
  
      // 4. Aggregation pipeline
      const stats = await Order.aggregate([
        // chỉ lấy order đã thanh toán và hoàn thành trong khoảng UTC
        { $match: {
            createdAt:      { $gte: startUtc, $lt: endUtc },
            payment_status: "da_thanh_toan",
            order_status:   "hoan_thanh"
        }},
        // lookup mã giảm giá
        { $lookup: {
            from:         "discountcodes",
            localField:   "discount_code_id",
            foreignField: "_id",
            as:           "dc"
        }},
        { $unwind: {
            path:            "$dc",
            preserveNullAndEmptyArrays: true
        }},
        { $addFields: {
            discount_percent: { $ifNull: ["$dc.discount_percent", 0] }
        }},
        // tách products và variants
        { $unwind: "$products" },
        { $unwind: "$products.variants" },
        // tính ngày theo GMT+7: add 7h rồi lấy $dayOfMonth
        { $addFields: {
            localCreated: { $add: ["$createdAt", offset] }
        }},
        // nhóm theo ngày và order để gom variants
        { $group: {
            _id: {
              orderId: "$_id",
              day:     { $dayOfMonth: "$localCreated" }
            },
            sumQty:   { $sum: "$products.variants.attributes.quantity" },
            rawTotal: { $sum: {
              $multiply: [
                "$products.variants.price",
                "$products.variants.attributes.quantity"
              ]
            }},
            totalPriceIn: { $first: "$totalPriceIn" },
            discount_percent: { $first: "$discount_percent" }
        }},
        // tính doanh thu đã giảm cho mỗi order
        { $addFields: {
            revenue: {
              $multiply: [
                "$rawTotal",
                { $subtract: [1, { $divide: ["$discount_percent", 100] }] }
              ]
            }
        }},
        // nhóm theo ngày (tính tổng của tất cả order trong ngày)
        { $group: {
            _id: "$_id.day",
            totalQuantity: { $sum: "$sumQty" },
            totalRevenue:  { $sum: "$revenue" },
            totalImportPrice: { $sum: "$totalPriceIn" }
        }},
        // định dạng output
        { $project: {
            _id:           0,
            day:           "$_id",
            totalQuantity: 1,
            totalRevenue: 1,
            totalImportPrice: 1
        }},
        { $sort: { day: 1 } }
      ]);

      console.log('Daily Sales Stats:', JSON.stringify(stats, null, 2));
      
      return res.status(200).json({ year, month, stats });
    } catch (err) {
      console.error("Lỗi getDailySalesStats:", err);
      return res.status(500).json({ error: "Lỗi máy chủ.", details: err.message });
    }
  };