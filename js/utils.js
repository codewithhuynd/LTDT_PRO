/**
 * ============================================================================
 * 📁 FILE: utils.js
 * 🛠️ CHỨC NĂNG: CÁC HÀM TIỆN ÍCH DÙNG CHUNG (UTILITIES)
 * 📝 Mô tả: Chứa các hàm xử lý chuỗi, chuẩn hóa dữ liệu, định dạng thời gian.
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
    1. Xử lý Chuỗi & Header Excel
   ---------------------------------------------------------------------------- */
/* Utility: loại bỏ dấu/chuẩn hóa chuỗi để so sánh header */
function normalizeHeader(str) {
    if (str === undefined || str === null) return '';

    return String(str)
        .trim()
        .toLowerCase()
        .replace(/đ/g, 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}
/* ----------------------------------------------------------------------------
    2. Xử lý Thời gian (Time Parsing & Formatting)
   ---------------------------------------------------------------------------- */
function parseTimeHM(value) {
    if (value === undefined || value === null || value === '') return null;

    const str = String(value).trim();
    const match = str.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour < 0 || hour > 24) return null;
    if (minute < 0 || minute > 59) return null;
    if (hour === 24 && minute !== 0) return null;

    return { hour, minute };
}
function formatTime(timeObj) {
    if (!timeObj) return '<i>Không có</i>';
    const h = String(timeObj.hour).padStart(2, '0');
    const m = String(timeObj.minute).padStart(2, '0');
    return `${h}:${m}`;
}
/* ----------------------------------------------------------------------------
    3. Chuẩn hóa text địa chỉ
   ---------------------------------------------------------------------------- */
// =====================================================
// 1️⃣ NORMALIZE TEXT
function normalizeText(str) {
    return str
        .toLowerCase()
        .replace(/đ/g, 'd')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}