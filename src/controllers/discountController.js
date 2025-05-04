const DiscountCode = require("../models/discountCodeModel");


exports.getDiscountCodesBeforeToday = async (req, res) => {
    try {
      // Lấy thời điểm hiện tại UTC
      const now = new Date();
  
      // 1. Mốc 00:00 hôm nay theo GMT+7
      const gmt7Today = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      gmt7Today.setHours(0, 0, 0, 0);
      const utcBoundary = new Date(gmt7Today.getTime() - 7 * 60 * 60 * 1000); // chuyển về UTC
  
      // 2. Mốc thời gian hiện tại GMT+7 (dùng để so với expiration_date)
      const gmt7Now = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  
      // Tìm mã giảm giá
      const discountCodes = await DiscountCode.find({
        createdAt: { $lt: utcBoundary },               // Được tạo trước 00h hôm nay (GMT+7)
        times_used: { $lt: mongoose.Schema.Types.Mixed.cast('number', '$max_uses') }, // times_used < max_uses
        expiration_date: { $gt: gmt7Now }              // expiration_date > hiện tại GMT+7
      });
  
      res.status(200).json({
        message: "Danh sách mã giảm giá hợp lệ",
        discounts: discountCodes,
      });
  
    } catch (error) {
      res.status(500).json({
        message: "Lỗi máy chủ.",
        error: error.message,
      });
    }
  };