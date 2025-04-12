const Fuse = require('fuse.js');

/**
 * Trả về một instance của Fuse với mảng sản phẩm đã được xử lý
 * @param {Array} products - Mảng sản phẩm
 * @param {Object} options - Các tùy chọn cho Fuse (mặc định: keys là 'nameNormalized', threshold là 0.6)
 * @returns {Fuse}
 */
const getFuseInstance = (products, options = { keys: ['nameNormalized'], threshold: 0.2 }) => {
    return new Fuse(products, options);
  };
  
  module.exports = { getFuseInstance };