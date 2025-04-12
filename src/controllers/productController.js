const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Order = require("../models/orderModel"); // Đường dẫn đến model Order

const mongoose = require("mongoose");

const User = require('../models/userModel');
const multer = require('multer');
// Sử dụng hàm getFuseInstance từ file config
const { getFuseInstance } = require('../config/fuse');
// ...
//const fuse = getFuseInstance(processedProducts);

// Cấu hình Multer dùng bộ nhớ tạm, chúng ta sẽ tự xử lý việc lưu
const storage = multer.memoryStorage();
const upload = multer({ storage }).array('images', 6); // tối đa 6 ảnh


exports.getAllProductsDangBan = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // Lấy toàn bộ category có status true
        const activeCategories = await Category.find({ status: true }).lean();
        const activeCategoryIds = activeCategories.map(cat => cat._id.toString());

        // Đếm tổng số sản phẩm phù hợp (status = "dang_ban" và category hợp lệ)
        const totalCount = await Product.countDocuments({
            status: "dang_ban",
            category_id: { $in: activeCategoryIds }
        });

        const totalPages = Math.ceil(totalCount / limit);

        // Truy vấn sản phẩm có phân trang
        const products = await Product.find({
            status: "dang_ban",
            category_id: { $in: activeCategoryIds }
        })
        .skip(skip)
        .limit(limit)
        .lean();

        // Thêm tên category và saled
        const filteredProducts = products.map(prod => {
            const category = activeCategories.find(c => c._id.toString() === prod.category_id?.toString());
            return {
                ...prod,
                category_name: category?.name || null,
                saled: 3000
            };
        });

        return res.status(200).json({
            message: 'Lấy danh sách sản phẩm thành công!',
            page,
            perPage: limit,
            totalPages,
            totalCount,
            products: filteredProducts
        });

    } catch (error) {
        return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};


exports.getProductsByCategoryId = async (req, res) => { // can sua lai
    try {
        const { id } = req.params; // can sua lai
        const page = parseInt(req.query.page) || 1;
        const limit =  20;
        const skip = (page - 1) * limit;

        // Kiểm tra xem danh mục có tồn tại và đang hoạt động
        const category = await Category.findOne({ _id: id, status: true });
        if (!category) {
            return res.status(404).json({ message: 'Danh mục không tồn tại hoặc đã bị vô hiệu hóa!' });
        }

        // Đếm tổng số sản phẩm để phân trang
        const totalCount = await Product.countDocuments({ category_id: id, status: "dang_ban" });
        const totalPages = Math.ceil(totalCount / limit);

        // Lấy sản phẩm theo trang
        const products = await Product.find({ category_id: id, status: "dang_ban" })
            .skip(skip)
            .limit(limit)
            .lean();

        // Gắn thêm thông tin danh mục và saled
        const updatedProducts = products.map(p => ({
            ...p,
            category_name: category.name,
            saled: 3000
        }));

        return res.status(200).json({
            message: `Danh sách sản phẩm thuộc danh mục "${category.name}"`,
            products: updatedProducts,
            currentPage: page,
            totalPages,
            totalItems: totalCount
        });

    } catch (error) {
        return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};

// API getDeXuatProducts: Lấy danh sách 20 sản phẩm đề xuất
// Mô tả: Lấy danh sách sản phẩm có trạng thái 'dang_ban', ưu tiên các sản phẩm có tỷ lệ giảm giá nhiều nhất
// Trả về: Tên sản phẩm, giá gốc, giá giảm (nếu có), link ảnh đầu tiên
// Sắp xếp: Theo tỷ lệ giảm giá từ cao xuống thấp

exports.getDeXuatProducts = async (req, res) => {
    try {
        // Lấy tất cả sản phẩm đang bán
        const products = await Product.find({ status: 'dang_ban' });

        const result = products.map(product => {
            // Tính giá gốc thấp nhất từ các variant
            const lowestVariantPrice = product.variants.length > 0 
                ? Math.min(...product.variants.map(v => v.price))
                : 0;
                
            let original_price, discount_price;
            if (product.discount > 0) {
                original_price = lowestVariantPrice * (100 - product.discount) / 100;
                discount_price = lowestVariantPrice;
            } else {
                original_price = lowestVariantPrice;
                discount_price = 0;
            }
            return {
                id: product._id,
                link: product.image_urls.length > 0 ? product.image_urls[0] : '',
                name: product.name,
                original_price,
                discount_price,
            };
        })
        // Sắp xếp theo phần trăm giảm giá giảm dần
        .sort((a, b) => a.original_price - b.original_price)
        // Lấy 20 sản phẩm đầu tiên
        .slice(0, 20);

        return res.status(200).json({ products: result });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};



// Mô tả: Lấy 10 sản phẩm bất kỳ có trạng thái 'dang_ban', ưu tiên các sản phẩm có giá giảm

exports.getSaleProducts = async (req, res) => {
    try {
        // Lấy tối đa 10 sản phẩm có trạng thái 'dang_ban' và có discount > 0
        const products = await Product.aggregate([
            { $match: { status: 'dang_ban', discount: { $gt: 0 } } },
            { $limit: 10 }
        ]);

        const result = products.map(product => {
            // Tính giá gốc thấp nhất từ các variant
            const lowestVariantPrice = product.variants && product.variants.length > 0 
                ? Math.min(...product.variants.map(v => v.price))
                : 0;
            let original_price, discount_price;
            if (product.discount > 0) {
                // original_price là giá sau giảm, discount_price là giá gốc
                original_price = lowestVariantPrice * (100 - product.discount) / 100;
                discount_price = lowestVariantPrice;
            } else {
                original_price = lowestVariantPrice;
                discount_price = 0;
            }
            return {
                id: product._id,
                link: product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : '',
                name: product.name,
                original_price: original_price,
                discount_price: discount_price,
                discount: product.discount
            };
        });

        // Sắp xếp giảm dần theo phần trăm giảm (discount)
        result.sort((a, b) => b.discount - a.discount);

        return res.status(200).json({ products: result });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};


//lấy chi tiết 1 sản phẩm

exports.getProduct = async (req, res) => {
    try {
      const productId = req.params.id;
  
      // Tìm sản phẩm theo id
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Sản phẩm không tồn tại!" });
      }
  
      // Tính tổng số lượng đã bán dựa vào tất cả các variant trong các đơn hàng có sản phẩm này
      const orderAggregation = await Order.aggregate([
        { $unwind: "$products" },
        { $match: { "products.product_id": new mongoose.Types.ObjectId(productId) } },
        { $unwind: "$products.variants" },
        { $group: { _id: null, totalSold: { $sum: "$products.variants.quantity" } } }
      ]);
  
      const totalSold = orderAggregation.length > 0 ? orderAggregation[0].totalSold : 0;
  
      // Tính tổng số lượng tồn kho của tất cả các variants
      const totalQuantity = product.variants.reduce((acc, variant) => acc + variant.quantity, 0);
  
      // Xử lý variants, áp dụng discount vào giá từng variant
      const variants = product.variants.map(variant => {
        const discountedPrice = variant.price * (1 - product.discount / 100); // Áp dụng phần trăm giảm giá
        return {
          price: discountedPrice,
          quantity: variant.quantity,
          size: variant.size,
          color: variant.color
        };
      });
  
      return res.json({
        id: product._id,
        images: product.image_urls,
        name: product.name,
        salePrice: variants[0]?.price, // Lấy giá giảm (nếu có), nếu không lấy giá gốc
        discountPrice: product.variants[0]?.price, // Giá sau khi giảm
        quantity: totalQuantity,  // Tổng số lượng tồn kho của tất cả variants
        sold: totalSold,
        description: product.description,
        variants: variants
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

 // lấy sản phẩm theo tên, giá (sắp xếp từ cao xuống thấp) và phân loại (category)
 // Hàm tìm kiếm sản phẩm theo tên gần đúng, có thể lọc theo danh mục (idCategory) và sắp xếp giá
 /**
 * Hàm loại bỏ dấu tiếng Việt
 * @param {string} str - Chuỗi cần chuẩn hóa
 * @returns {string} - Chuỗi không dấu
 */
function removeDiacritics(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  
  /**
 * Hàm loại bỏ dấu tiếng Việt (chuyển sang dạng không dấu)
 * @param {string} str - Chuỗi cần chuẩn hóa
 * @returns {string} - Chuỗi không dấu
 */
function removeDiacritics(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  
  /**
   * Hàm tính giá của sản phẩm dựa trên các variants và discount.
   * @param {object} product - Đối tượng sản phẩm
   * @returns {object} - Chứa các trường original_price và discount_price
   */
  function calculatePrices(product) {
    const lowestVariantPrice = (product.variants && product.variants.length > 0)
      ? Math.min(...product.variants.map(v => v.price))
      : 0;
    let original_price, discount_price;
    if (product.discount > 0) {
      original_price = lowestVariantPrice * (100 - product.discount) / 100;
      discount_price = lowestVariantPrice;
    } else {
      original_price = lowestVariantPrice;
      discount_price = 0;
    }
    return { original_price, discount_price };
  }
  
  /**
   * Hàm tìm kiếm sản phẩm theo tên gần đúng, có lọc theo danh mục và sắp xếp giá.
   * Nếu từ khóa tìm kiếm rỗng hoặc không truyền thì trả về toàn bộ kết quả theo filter mặc định.
   */
  exports.searchProducts = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const skip = (page - 1) * limit;
      const { name, idCategory, sortByPrice } = req.query;
      
      // Loại bỏ khoảng trắng thừa nếu có
      const trimmedName = name ? name.trim() : "";
  
      let filterConditions = { status: "dang_ban" };
      if (idCategory) {
        filterConditions.category_id = idCategory;
      }
  
      let products = [];
  
      if (trimmedName) {
        // Nếu có từ khóa, lấy toàn bộ sản phẩm thoả filter cơ bản (không phân trang ngay lúc này)
        const allProducts = await Product.find(filterConditions).lean();
  
        // Thêm trường nameNormalized cho mỗi sản phẩm (chuẩn hóa về không dấu và chữ thường)
        const processedProducts = allProducts.map(product => ({
          ...product,
          nameNormalized: removeDiacritics(product.name.toLowerCase())
        }));
  
        // Chuẩn hóa từ khóa tìm kiếm
        const normalizedQuery = removeDiacritics(trimmedName.toLowerCase());
  
        // Cấu hình Fuse.js để hỗ trợ fuzzy search, bao gồm score
        const fuseOptions = { keys: ['nameNormalized'], threshold: 0.6, includeScore: true };
        const fuse = getFuseInstance(processedProducts, fuseOptions);
        const fuzzyResults = fuse.search(normalizedQuery);
  
        // Tính toán giá cho từng kết quả
        const computedResults = fuzzyResults.map(result => {
          const { original_price, discount_price } = calculatePrices(result.item);
          return {
            item: result.item,
            score: result.score, // score càng thấp thì mức tương đồng càng cao
            original_price,
            discount_price,
            discount: result.item.discount
          };
        });
        
        // Nếu muốn kết hợp ưu tiên theo giá khi hai kết quả có score gần nhau, định nghĩa epsilon:
        const epsilon = 0.05;
        computedResults.sort((a, b) => {
          const scoreDiff = a.score - b.score;
          if (Math.abs(scoreDiff) < epsilon && sortByPrice) {
            if (sortByPrice.toLowerCase() === 'desc') {
              return b.original_price - a.original_price;
            } else { // 'asc' //"asc" viết tắt của "ascending", có nghĩa là tăng dần (sắp xếp từ giá thấp nhất đến cao nhất), còn "desc" (descending) có nghĩa là giảm dần (sắp xếp từ giá cao nhất đến thấp nhất).
              return a.original_price - b.original_price;
            }
          }
          return scoreDiff;
        });
        
        products = computedResults.map(result => ({
          ...result.item,
          original_price: result.original_price,
          discount_price: result.discount_price,
          discount: result.discount
        }));
      } else {
        // Nếu từ khóa rỗng thì truy vấn trực tiếp với phân trang
        products = await Product.find(filterConditions)
                          .skip(skip)
                          .limit(limit)
                          .lean();
        // Tính giá cho mỗi sản phẩm trong trường hợp không dùng fuzzy
        products = products.map(product => {
          const { original_price, discount_price } = calculatePrices(product);
          return {
            ...product,
            original_price,
            discount_price,
            discount: product.discount
          };
        });
      }
  
      // Nếu có sortByPrice và không dùng fuzzy (không có tên) thì sắp xếp theo giá trực tiếp
      if (!trimmedName && sortByPrice) {
        products.sort((a, b) => {
          const priceA = calculatePrices(a).original_price;
          const priceB = calculatePrices(b).original_price;
          if (sortByPrice.toLowerCase() === 'desc') {
            return priceB - priceA;
          }
          return priceA - priceB;
        });
      }
  
      // Đảm bảo kết quả trả về bao gồm các trường như yêu cầu
      const result = products.map(product => {
        return {
          id: product._id,
          link: (product.image_urls && product.image_urls.length > 0) ? product.image_urls[0] : '',
          name: product.name,
          original_price: product.original_price,
          discount_price: product.discount_price,
          discount: product.discount
        };
      });
  
      // Phân trang kết quả trên mảng
      const totalCount = result.length;
      const totalPages = Math.ceil(totalCount / limit);
      const paginatedResult = result.slice(skip, skip + limit);
  
      return res.status(200).json({
        message: "Lấy danh sách sản phẩm thành công!",
        page,
        perPage: limit,
        totalPages,
        totalCount,
        products: paginatedResult
      });
    } catch (error) {
      return res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
  };