/* =====================================================================
 *  n8nAdapter.js — Cầu nối dữ liệu giữa WEBHOOK n8n và APP VMP Monitor
 *  ---------------------------------------------------------------------
 *  VẤN ĐỀ: App ban đầu chờ JSON dạng { objects:[...], activities:[...] }
 *          nhưng webhook n8n của bạn trả về { ok, count, rows:[...] }
 *          với tên trường khác hẳn (ma, ten, phan_loai, dl_vmp, ...).
 *
 *  GIẢI PHÁP: Module này NHẬN dữ liệu n8n và DỊCH sang mô hình app,
 *             đồng thời DỊCH ngược khi ghi (cập nhật trạng thái) về n8n.
 *
 *  => Nếu sau này bạn đổi giá trị cột trong Google Sheet, chỉ cần sửa
 *     các BẢNG ÁNH XẠ bên dưới (CLS_MAP, DEPT_MAP, normStatus...).
 * ===================================================================== */

/* ---------- Tiện ích ---------- */
const s = (v) => (v == null ? "" : String(v)).trim();
const lc = (v) => s(v).toLowerCase();

// Chuẩn hoá ngày -> "yyyy-mm-dd" (app dùng định dạng này).
// Hỗ trợ: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, và chuỗi ISO có giờ.
function toISO(v) {
  const t = s(v);
  if (!t) return "";
  // yyyy-mm-dd hoặc yyyy/mm/dd (đã đúng thứ tự năm trước)
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  // dd/mm/yyyy hoặc dd-mm-yyyy (kiểu Việt Nam)
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  // Thử Date() cho các định dạng khác
  const d = new Date(t);
  if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return "";
}

function parseDate(v) {
  const iso = toISO(v);
  if (!iso) return null;
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

/* ---------- BẢNG ÁNH XẠ (sửa ở đây nếu Sheet của bạn dùng giá trị khác) ---------- */

// Phân loại đối tượng -> nhóm app: tb | qt | kho | ht | vc
function mapClass(phanLoai) {
  const x = lc(phanLoai);
  if (/thiết bị|thiet bi|equipment|máy|may/.test(x)) return "tb";
  if (/quy trình|quy trinh|process|sop|công đoạn|cong doan/.test(x)) return "qt";
  if (/kho|warehouse|storage|bảo quản|bao quan/.test(x)) return "kho";
  if (/hệ thống|he thong|phụ trợ|phu tro|hvac|utility|khí|khi|nước|nuoc|điều hòa|dieu hoa/.test(x)) return "ht";
  if (/vận chuyển|van chuyen|transport|logistics|cold chain|chuỗi lạnh|chuoi lanh/.test(x)) return "vc";
  return "tb"; // mặc định
}

// Bộ phận quản lý -> phòng app: sx | cd | kho | qc | qa
function mapDept(boPhan) {
  const x = lc(boPhan);
  if (/sản xuất|san xuat|xưởng|xuong|production|sx/.test(x)) return "sx";
  if (/cơ điện|co dien|mep|kỹ thuật|ky thuat|engineering|cđ|cd\b/.test(x)) return "cd";
  if (/kho|warehouse/.test(x)) return "kho";
  if (/qc|kiểm nghiệm|kiem nghiem|quality control|lab/.test(x)) return "qc";
  if (/qa|qlcl|đảm bảo|dam bao|quality assurance|chất lượng|chat luong/.test(x)) return "qa";
  return "qa"; // mặc định
}

// Mức độ tới hạn (GxP) -> Cao | TB | Thấp
function mapCrit(v) {
  const x = lc(v);
  if (/cao|high|critical|nghiêm trọng|nghiem trong/.test(x)) return "Cao";
  if (/thấp|thap|low/.test(x)) return "Thấp";
  return "TB";
}

// Chuẩn hoá trạng thái 1 cột -> done | prog | todo | "" (rỗng = chưa có)
function normStatus(v) {
  const x = lc(v);
  if (!x) return "";
  if (/hoàn thành|hoan thanh|done|đạt|dat|complete|✓|✔|100|xong|ok\b/.test(x)) return "done";
  if (/đang|dang|progress|thực hiện|thuc hien|in[-\s]?progress|wip|làm|lam/.test(x)) return "prog";
  if (/chưa|chua|not|todo|chờ|cho\b|pending|kế hoạch|ke hoach|plan/.test(x)) return "todo";
  return ""; // không nhận diện được -> coi như rỗng
}

/* ---------- Suy ra trạng thái tổng (st) của 1 hạng mục ----------
 *  Ưu tiên: trạng thái VMP > quá hạn theo ngày > đang thực hiện > kế hoạch/chưa.
 *  st ∈ done | prog | over | todo | plan  (khớp với STATUS trong App.jsx)
 */
function deriveSt(row, today) {
  const vmp = normStatus(row.tt_vmp);
  if (vmp === "done") return "done";

  const target = parseDate(row.dl_vmp);
  const stages = [normStatus(row.tt_de_cuong), normStatus(row.tt_tham_dinh), normStatus(row.tt_bao_cao)];
  const anyDone = stages.some((v) => v === "done");
  const anyProg = stages.some((v) => v === "prog") || vmp === "prog";

  // Quá hạn: đã tới/qua mốc Deadline VMP mà chưa hoàn thành.
  if (target && target < today) return "over";
  if (anyProg || anyDone) return "prog";

  // Chưa bắt đầu: nếu deadline đề cương còn xa (>30 ngày) coi là "kế hoạch".
  const proto = parseDate(row.dl_de_cuong);
  const SOON = 30 * 86400000;
  if (proto && proto - today > SOON) return "plan";
  return "todo";
}

/* =====================================================================
 *  ĐỌC: webhook n8n  ->  { objects, activities } cho app
 * ===================================================================== */
export function adaptFromN8n(payload) {
  // Tương thích ngược: nếu đã đúng định dạng app thì trả về luôn.
  if (payload && (Array.isArray(payload.objects) || Array.isArray(payload.activities))) {
    return {
      objects: payload.objects || [],
      activities: payload.activities || [],
      source: "native",
    };
  }

  const rows = (payload && Array.isArray(payload.rows)) ? payload.rows : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const objMap = new Map();   // ma -> object (gộp trùng)
  const activities = [];

  for (const r of rows) {
    const code = s(r.ma);
    if (!code) continue;

    // --- Object (gộp theo mã đối tượng) ---
    if (!objMap.has(code)) {
      objMap.set(code, {
        code,
        name: s(r.ten) || code,
        cls: mapClass(r.phan_loai),
        dept: mapDept(r.bo_phan),
        area: s(r.khu_vuc) || "—",
        line: s(r.line) || "—",
        grade: "—",
        gxp: "GxP",
        crit: mapCrit(r.phan_loai_bc),
        freq: parseInt(r.tan_suat, 10) || 12,
        need: normStatus(r.td) === "done" || lc(r.td) === "x" || lc(r.show) === "x" || !!s(r.dl_vmp),
        reason: "",
      });
    }

    // --- Activity (mỗi dòng Sheet = 1 hạng mục thẩm định) ---
    const id = s(r.id) || `${code}/${s(r.loai_td) || "TD"}`;
    activities.push({
      id,
      code,
      vtype: (s(r.loai_td) || "PQ").toUpperCase(),
      dep: s(r.phan_loai_bc) || "Độc lập", // dùng để tính mốc T-5-BC; mặc định "Độc lập"
      owner: s(r.qa) || s(r.ns_khac) || "—",
      target: toISO(r.dl_vmp) || toISO(r.dl_bao_cao) || "",
      st: deriveSt(r, today),
      docDone: normStatus(r.tt_bao_cao) === "done",
      // giữ lại dữ liệu gốc để ghi ngược chính xác:
      _raw: r,
    });
  }

  // Bỏ các hạng mục thiếu ngày đích (không vẽ được trên timeline).
  const acts = activities.filter((a) => a.target);

  return {
    objects: Array.from(objMap.values()),
    activities: acts,
    source: "n8n",
    count: rows.length,
  };
}

/* =====================================================================
 *  GHI: hành động trên app  ->  payload cho webhook n8n (vmp-write)
 *  n8n hiện hỗ trợ: action="ping" và action="updateRow" {id, patch:{...}}
 *  patch nhận: ngay_de_cuong, tt_de_cuong, lich_td, ngay_tham_dinh,
 *              tt_tham_dinh, ngay_bao_cao, tt_bao_cao, ngay_vmp, tt_vmp
 * ===================================================================== */
export function buildPing() {
  return { action: "ping", ts: Date.now() };
}

// Cập nhật trạng thái/ngày của 1 hạng mục theo ID (đúng chuẩn n8n updateRow).
export function buildUpdateRow(id, patch, user) {
  return {
    action: "updateRow",
    id,
    user: user || "",
    ts: new Date().toISOString(),
    patch: patch || {},
  };
}

/* ---------- Gọi mạng (fetch) có xử lý lỗi gọn ---------- */
export async function fetchVmpData(readUrl) {
  const res = await fetch(readUrl, { method: "GET" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  return adaptFromN8n(json);
}

// Dùng text/plain để tránh CORS preflight (OPTIONS) với webhook n8n.
export async function postToN8n(writeUrl, payload) {
  const res = await fetch(writeUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(payload),
  });
  return res;
}
