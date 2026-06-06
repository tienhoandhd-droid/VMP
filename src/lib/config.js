/* =====================================================================
 *  config.js — Cấu hình kết nối & lưu trạng thái (localStorage)
 *  ---------------------------------------------------------------------
 *  - Đọc URL webhook n8n mặc định từ biến môi trường lúc build
 *    (đặt trong file .env hoặc trong GitHub Actions Secrets/Variables).
 *  - Lưu URL người dùng nhập trên web vào localStorage để lần sau
 *    mở lại trang không phải nhập lại (khác với bản xem trước artifact).
 * ===================================================================== */

// Biến môi trường Vite — phải có tiền tố VITE_ mới lộ ra phía client.
export const ENV_READ_URL = import.meta.env.VITE_VMP_READ_URL || "https://n8n.cpc1hn.com/webhook/vmp-read";
export const ENV_WRITE_URL = import.meta.env.VITE_VMP_WRITE_URL || "https://n8n.cpc1hn.com/webhook/vmp-write";

const LS_KEY = "vmp_monitor_conn_v1";
const LS_USER = "vmp_monitor_user_v1";

/* ---- Kết nối (URL đọc/ghi) ---- */
export function loadConn() {
  // Ưu tiên 1: URL đã lưu trong localStorage (người dùng tự nhập).
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && (o.readUrl || o.writeUrl)) return o;
    }
  } catch (e) { /* ignore */ }

  // Ưu tiên 2: URL từ biến môi trường lúc build (.env / GitHub Secrets).
  if (ENV_READ_URL || ENV_WRITE_URL) {
    return { readUrl: ENV_READ_URL, writeUrl: ENV_WRITE_URL };
  }
  return null;
}

export function saveConn(readUrl, writeUrl) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ readUrl: readUrl || "", writeUrl: writeUrl || "" }));
  } catch (e) { /* ignore */ }
}

export function clearConn() {
  try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
}

/* ---- Phiên đăng nhập (ghi nhớ user, KHÔNG lưu mật khẩu) ---- */
export function loadUser() {
  try {
    const raw = localStorage.getItem(LS_USER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function saveUser(user) {
  try {
    if (user) {
      // KHÔNG lưu mật khẩu vào localStorage — chỉ giữ key/name/role/perm.
      const { pass, ...safe } = user;
      localStorage.setItem(LS_USER, JSON.stringify(safe));
    } else {
      localStorage.removeItem(LS_USER);
    }
  } catch (e) { /* ignore */ }
}
