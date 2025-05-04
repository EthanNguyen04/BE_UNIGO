const DiscountCode = require("../../models/discountCodeModel");
const jwt = require("jsonwebtoken");

exports.createDiscountCode = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Không có token." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ message: "Bạn không có quyền." });
    }

    const { code, discount_percent, min_order_value, expiration_date, max_uses } = req.body;

    if (!code || !discount_percent || !min_order_value || !expiration_date) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
    }

    const exists = await DiscountCode.findOne({ code });
    if (exists) {
      return res.status(400).json({ message: "Mã giảm giá đã tồn tại." });
    }

    // const expirationDateUTC = convertVNToUTC(expiration_date);

    const newCode = await DiscountCode.create({
      code,
      discount_percent,
      min_order_value,
      expiration_date: expiration_date,
      max_uses: max_uses || 1,
    });

    return res.status(201).json({
      message: "Tạo mã giảm giá thành công.",
      discountCode: newCode,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi máy chủ.",
      error: error.message,
    });
  }
};

exports.getAllDiscountCodes = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Không có token." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ message: "Bạn không có quyền truy cập." });
    }

    const discountCodes = await DiscountCode.find({}, {
      code: 1,
      discount_percent: 1,
      min_order_value: 1,
      expiration_date: 1,
      max_uses: 1,
      times_used: 1,
      createdAt: 1,
      updatedAt: 1,
      _id: 0
    });

    const formattedDiscounts = discountCodes.map(discount => {
      // Chuyển về Date object (nếu chưa)
      // const expirationDate = new Date(discount.expiration_date);
      // const createdAtDate = new Date(discount.createdAt);
      // const updatedAtDate = new Date(discount.updatedAt);

      return {
        code: discount.code,
        discount_percent: discount.discount_percent,
        min_order_value: discount.min_order_value,
        expiration_date: discount.expiration_date,
        max_uses: discount.max_uses,
        times_used: discount.times_used,
        expiration_date: discount.expiration_date,
        created_at: discount.createdAt,
        updated_at: discount.updatedAt,
      };
    });
    console.log(formattedDiscounts);
    return res.status(200).json({
      message: "Danh sách mã giảm giá",
      discounts: formattedDiscounts,
      
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi máy chủ.",
      error: error.message,
    });
  }
};


exports.updateDiscountCode = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Không có token." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ message: "Bạn không có quyền." });
    }

    const { old_code, new_code, discount_percent, min_order_value, max_uses } = req.body;

    if (!old_code || !new_code || !discount_percent || !min_order_value || !max_uses) {
      return res.status(400).json({ message: "Thiếu thông tin cập nhật." });
    }

    const discount = await DiscountCode.findOne({ code: old_code });
    if (!discount) {
      return res.status(404).json({ message: "Mã giảm giá không tồn tại." });
    }

    // Kiểm tra thời gian tạo + GMT+7
    const createdAt = new Date(discount.createdAt);
    const now = new Date();

    const createdAtGMT7 = new Date(createdAt.getTime() + 7 * 60 * 60 * 1000);
    const nextDayMidnightGMT7 = new Date(createdAtGMT7);
    nextDayMidnightGMT7.setDate(nextDayMidnightGMT7.getDate() + 1);
    nextDayMidnightGMT7.setHours(0, 0, 0, 0);

    const nowGMT7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);

    if (nowGMT7 >= nextDayMidnightGMT7) {
      return res.status(400).json({ message: "Mã này đã quá hạn chỉnh sửa." });
    }

    // Cho phép chỉnh sửa
    discount.code = new_code;
    discount.discount_percent = discount_percent;
    discount.min_order_value = min_order_value;
    discount.max_uses = max_uses;

    await discount.save();

    return res.status(200).json({
      message: "Cập nhật mã giảm giá thành công.",
      discount,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Lỗi máy chủ.",
      error: error.message,
    });
  }
};
