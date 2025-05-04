// Chuyển date từ GMT+7 sang GMT+0 (UTC)
function convertVNToUTC(dateString) {
    const dateGMT7 = new Date(dateString);
    return new Date(dateGMT7.getTime() - 7 * 60 * 60 * 1000);
  }
  
  // Chuyển date từ UTC sang GMT+7 và format 24h + DD-MM-YYYY
function formatUTCToVN(dateUTC) {
    const date = new Date(dateUTC.getTime() + 7 * 60 * 60 * 1000);
  
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
  
    return `${hours}:${minutes} ${day}-${month}-${year}`;
  }
  
module.exports = {
    convertVNToUTC,
    formatUTCToVN,
  };
  