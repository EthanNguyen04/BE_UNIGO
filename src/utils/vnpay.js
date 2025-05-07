// src/utils/vnpay.js
const crypto = require('crypto');
const qs     = require('qs');
require('dotenv').config();

const VNP_URL      = process.env.VNP_URL;
const RETURN_URL   = process.env.VNP_RETURN_URL;
const TMNCODE      = process.env.VNP_TMNCODE;
const HASHSECRET   = process.env.VNP_HASHSECRET;

function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  keys.forEach(key => {
    // encodeURIComponent rồi thay space thành '+'
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, '+');
  });
  return sorted;
}

function getDateTime() {
  const dt = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return dt.getFullYear() +
    pad(dt.getMonth()+1) +
    pad(dt.getDate()) +
    pad(dt.getHours()) +
    pad(dt.getMinutes()) +
    pad(dt.getSeconds());
}

function createPaymentUrl(params) {
  // 1. Chuẩn bị đối tượng params, ép IP về localhost, làm tròn số tiền
  let amount = Math.round(params.amount * 100); // đảm bảo integer
  let vnp_Params = {
    vnp_Version:   '2.1.0',
    vnp_Command:   'pay',
    vnp_TmnCode:   TMNCODE,
    vnp_Locale:    'vn',
    vnp_CurrCode:  'VND',
    vnp_TxnRef:    params.txnRef,
    vnp_OrderInfo: params.orderInfo,
    vnp_OrderType: params.orderType,
    vnp_Amount:    amount,
    vnp_ReturnUrl: RETURN_URL,
    vnp_IpAddr:    '127.0.0.1',  // mặc định localhost
    vnp_CreateDate: getDateTime()
  };

  // 2. Sort và encode
  const sorted = sortObject(vnp_Params);

  // 3. Sinh chữ ký trên chuỗi query chưa có vnp_SecureHash
  const signData = qs.stringify(sorted, { encode: false });
  const hmac = crypto.createHmac('sha512', HASHSECRET);
  const vnp_SecureHash = hmac.update(Buffer.from(signData, 'utf8')).digest('hex');

  // 4. Thêm vnp_SecureHash vào params và build URL
  sorted.vnp_SecureHash = vnp_SecureHash;
  const query = qs.stringify(sorted, { encode: false });
  return `${VNP_URL}?${query}`;
}

function validateSignature(query) {
  const receivedHash = query.vnp_SecureHash;
  delete query.vnp_SecureHash;
  delete query.vnp_SecureHashType;
  const sorted = sortObject(query);
  const signData = qs.stringify(sorted, { encode: false });
  const hmac = crypto.createHmac('sha512', HASHSECRET);
  const expectedHash = hmac.update(Buffer.from(signData, 'utf8')).digest('hex');
  return receivedHash === expectedHash;
}

module.exports = { createPaymentUrl, validateSignature };