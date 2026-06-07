import { useState, useEffect, useMemo, useRef } from "react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, ReferenceLine } from "recharts";
import {
  LayoutDashboard, Boxes, FlaskConical, Cpu, CalendarClock, FileBarChart,
  ShieldAlert, BarChart3, Search, Bell, ChevronRight, Clock, AlertCircle, CheckCircle2,
  TrendingUp, ShieldCheck, Sparkles as SparkIcon, Download, Activity, Filter, LogOut,
  KeyRound, Lock, Eye, EyeOff, RefreshCw, XCircle, Plus, Printer, Trophy, Crown, Flag,
  GanttChartSquare, Radar, Cloud, Link2, Pencil, Trash2, Save, Warehouse, Wind, Truck, FileText,
} from "lucide-react";
import { loadConn, saveConn, clearConn, loadUser, saveUser } from "./lib/config.js";
import { fetchVmpData, postToN8n, buildPing, buildUpdateRow, toISO, deriveActivityFields } from "./lib/n8nAdapter.js";

/* ===================== Palette — Magical Pastel · Hồng (đã tăng tương phản) ===================== */
const C = {
  bg1: "#FFF5FA", bg2: "#FBEFFB",
  pink: "#EE7BA9", pinkDeep: "#D85F92", pinkText: "#B43A6E",
  pinkSoft: "#FCE3EF", pinkMist: "#FDEEF6",
  lav: "#8E6FD0", lavText: "#6B4DB3", lavSoft: "#EDE7FC",
  mint: "#2FA98A", mintText: "#1A7058", mintSoft: "#DBF3EA",
  sky: "#4FA3D9", skyText: "#256F9F", skySoft: "#E2F1FA",
  rasp: "#DB4F73", raspText: "#BE3357", raspSoft: "#FCE2E9",
  marigold: "#E69A2E", marigoldText: "#985E0E", marigoldSoft: "#FBEFD6",
  gold: "#F4B838", silver: "#AEB7C4", bronze: "#C98A55",
  plum: "#4E2A4E", plumSoft: "#6E4869",
  white: "#FFFFFF", line: "rgba(78,42,78,.13)",
};
const TEXT = "'Quicksand', system-ui, -apple-system, sans-serif";
const NUM = "'Baloo 2', 'Quicksand', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #C2497A, #6E54C0)";
const GRAD_SOFT = "linear-gradient(135deg, #EE7BA9, #8E6FD0)";

const cardDefault = { background: "#fff", border: `1.5px solid ${C.pinkSoft}`, borderRadius: 24, boxShadow: "0 10px 30px rgba(238,123,169,.10)" };
const cardStrong = { background: "#fff", border: `1.5px solid ${C.pink}3a`, borderRadius: 26, boxShadow: "0 14px 34px rgba(238,123,169,.16)" };
const cardSoft = { background: C.pinkMist, border: `1px solid ${C.pinkSoft}`, borderRadius: 22, boxShadow: "none" };
const glass = { background: "rgba(255,255,255,0.86)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1.5px solid ${C.pinkSoft}`, borderRadius: 16, boxShadow: "0 4px 16px rgba(238,123,169,.10)" };

const STATUS = {
  done: { label: "Hoàn thành", color: C.mint, text: C.mintText, bg: C.mintSoft },
  prog: { label: "Đang thực hiện", color: C.marigold, text: C.marigoldText, bg: C.marigoldSoft },
  todo: { label: "Chưa thực hiện", color: C.sky, text: C.skyText, bg: C.skySoft },
  plan: { label: "Kế hoạch", color: C.lav, text: C.lavText, bg: C.lavSoft },
  over: { label: "Quá hạn", color: C.rasp, text: C.raspText, bg: C.raspSoft },
};
const MST = {
  done: { label: "Hoàn thành", color: C.mint, text: C.mintText },
  over: { label: "Quá hạn", color: C.rasp, text: C.raspText },
  todo: { label: "Chưa hoàn thành", color: C.marigold, text: C.marigoldText },
};

/* ===================== Cấu trúc VMP — theo Google Sheet của bạn ===================== */
const VMP_TODAY = new Date(2026, 5, 5);
const YS = new Date(2026, 0, 1), YE = new Date(2026, 11, 31);
const SOON_DAYS = 30;

const CLS = {
  tb:  { label: "Thiết bị", icon: Boxes, color: C.pink, text: C.pinkText, soft: C.pinkSoft },
  qt:  { label: "Quy trình", icon: FlaskConical, color: C.lav, text: C.lavText, soft: C.lavSoft },
  kho: { label: "Kho", icon: Warehouse, color: C.marigold, text: C.marigoldText, soft: C.marigoldSoft },
  ht:  { label: "Hệ thống phụ trợ", icon: Wind, color: C.sky, text: C.skyText, soft: C.skySoft },
  vc:  { label: "Vận chuyển", icon: Truck, color: C.mint, text: C.mintText, soft: C.mintSoft },
};
const DEPTS = [
  { id: "sx", name: "Xưởng sản xuất", short: "SX" },
  { id: "cd", name: "Cơ điện", short: "CĐ" },
  { id: "kho", name: "Kho", short: "Kho" },
  { id: "qc", name: "QC – Kiểm nghiệm", short: "QC" },
  { id: "qa", name: "QA – QLCL", short: "QA" },
];
const DEPT_DEEP = { sx: C.pinkText, cd: C.skyText, kho: C.marigoldText, qc: C.mintText, qa: C.lavText };
const DEPT_COLOR = { sx: C.pink, cd: C.sky, kho: C.marigold, qc: C.mint, qa: C.lav };
const DEPT_CODE = { sx: "SX", cd: "CĐ", kho: "Kho", qc: "QC", qa: "QA" };
const DEP_DAYS = { "Độc lập": 2, "Hóa lý": 2, "Nhiễm khuẩn": 7, "Vô khuẩn": 16 };

const SEED_OBJ = [
  { code: "PCTB501", name: "LAF cân", cls: "tb", dept: "sx", area: "C1", line: "BFS", grade: "B", gxp: "GxP", crit: "Cao", freq: 6, need: true, reason: "Cấp khí sạch bảo vệ khu vực cân — thẩm định tốc độ gió, chênh áp, đếm tiểu phân." },
  { code: "PCTB503", name: "Tủ truyền NL vào phòng pha chế (Passbox)", cls: "tb", dept: "sx", area: "C1", line: "BFS", grade: "B", gxp: "GxP", crit: "Cao", freq: 12, need: true, reason: "Passbox kiểm soát áp suất & interlock chống nhiễm chéo." },
  { code: "PCTB504", name: "Tủ hấp tiệt trùng dụng cụ 2 cửa", cls: "tb", dept: "sx", area: "C1", line: "BFS", grade: "D/B", gxp: "GxP", crit: "Cao", freq: 12, need: true, reason: "Tiệt trùng nhiệt ẩm — bắt buộc phân bố/xâm nhập nhiệt (heat mapping)." },
  { code: "PCTB505", name: "Tank pha chế 700L", cls: "tb", dept: "sx", area: "C1", line: "BFS", grade: "B", gxp: "GxP", crit: "Cao", freq: 12, need: true, reason: "Tiếp xúc trực tiếp sản phẩm, khuấy/gia nhiệt — kèm thẩm định vệ sinh." },
  { code: "PCTB507", name: "Tank pha 1000L", cls: "tb", dept: "sx", area: "C1", line: "BFS", grade: "B", gxp: "GxP", crit: "Cao", freq: 12, need: true, reason: "Thiết bị sản xuất chính — IQ/OQ/PQ kết hợp thẩm định vệ sinh." },
  { code: "PCTB502", name: "Cân kỹ thuật điện (2 số)", cls: "tb", dept: "sx", area: "C1", line: "BFS", grade: "B", gxp: "GxP", crit: "Thấp", freq: 0, need: false, reason: "Thiết bị đo độc lập — chỉ hiệu chuẩn & daily check." },
  { code: "X4-QT-001", name: "Quy trình vệ sinh sản phẩm A", cls: "qt", dept: "sx", area: "All", line: "—", grade: "—", gxp: "GxP", crit: "Cao", freq: 12, need: true, reason: "Cleaning validation — MAC/HBEL, dư lượng & vi sinh." },
  { code: "X4-QT-002", name: "Quy trình sản xuất sản phẩm A", cls: "qt", dept: "sx", area: "All", line: "—", grade: "—", gxp: "GxP", crit: "Cao", freq: 12, need: true, reason: "Process validation — 3 lô liên tiếp, thông số tới hạn (CPP/CQA)." },
  { code: "X4-QT-003", name: "SOP thay trang phục & vệ sinh cá nhân", cls: "qt", dept: "qa", area: "All", line: "—", grade: "—", gxp: "GxP", crit: "TB", freq: 12, need: true, reason: "Đánh giá tuân thủ thao tác — gowning qualification." },
  { code: "S1.01", name: "Kho thành phẩm thường", cls: "kho", dept: "kho", area: "S1", line: "—", grade: "—", gxp: "GxP", crit: "TB", freq: 6, need: true, reason: "Lập bản đồ nhiệt độ/độ ẩm (temperature mapping)." },
  { code: "S1.02", name: "Kho lạnh thành phẩm", cls: "kho", dept: "kho", area: "S1", line: "—", grade: "—", gxp: "GxP", crit: "Cao", freq: 6, need: true, reason: "Chuỗi lạnh 2–8°C — mapping + đánh giá mất điện." },
  { code: "S2.01", name: "Kho nguyên liệu thường", cls: "kho", dept: "kho", area: "S2", line: "—", grade: "—", gxp: "GxP", crit: "TB", freq: 6, need: true, reason: "Temperature mapping kho nguyên liệu." },
  { code: "S4.01", name: "Kho lạnh hóa dược", cls: "kho", dept: "kho", area: "S4", line: "—", grade: "—", gxp: "GxP", crit: "Cao", freq: 6, need: true, reason: "Chuỗi lạnh hóa dược — mapping định kỳ." },
  { code: "S4.02", name: "Kho lạnh sinh phẩm", cls: "kho", dept: "kho", area: "S4", line: "—", grade: "—", gxp: "GxP", crit: "Cao", freq: 6, need: true, reason: "Sinh phẩm nhạy nhiệt — mapping & cảnh báo nghiêm ngặt." },
  { code: "HT-01", name: "HVAC khu vực BFS", cls: "ht", dept: "cd", area: "C1", line: "—", grade: "B", gxp: "GxP", crit: "Cao", freq: 6, need: true, reason: "Tái thẩm định HVAC — chênh áp, ACH, phục hồi, tiểu phân." },
  { code: "HT-02", name: "HVAC khu vực FFS", cls: "ht", dept: "cd", area: "C2", line: "—", grade: "C", gxp: "GxP", crit: "TB", freq: 12, need: true, reason: "Tái thẩm định HVAC định kỳ." },
  { code: "HT-04", name: "HVAC khu vực SB-SR", cls: "ht", dept: "cd", area: "C4", line: "—", grade: "B", gxp: "GxP", crit: "Cao", freq: 6, need: true, reason: "HVAC vùng vô trùng — chênh áp & tiểu phân Grade A/B." },
  { code: "HT-11", name: "HVAC khu vực QC vi sinh", cls: "ht", dept: "cd", area: "Q2", line: "—", grade: "B", gxp: "GxP", crit: "Cao", freq: 6, need: true, reason: "HVAC phòng vi sinh — kiểm soát nhiễm khuẩn." },
  { code: "VC-01", name: "Vận chuyển lạnh nội bộ (mẫu)", cls: "vc", dept: "qa", area: "—", line: "—", grade: "—", gxp: "GxP", crit: "TB", freq: 12, need: true, reason: "Transport validation — duy trì nhiệt độ trong vận chuyển." },
];

const SEED_ACT = [
  { id: "PCTB501/26.01-OQ", code: "PCTB501", vtype: "OQ", dep: "Nhiễm khuẩn", owner: "Nhi", target: "2026-02-15", st: "done", docDone: true },
  { id: "PCTB501/26.02-PQ", code: "PCTB501", vtype: "PQ", dep: "Nhiễm khuẩn", owner: "Nhi", target: "2026-08-15", st: "todo" },
  { id: "PCTB503/26.01-OQ", code: "PCTB503", vtype: "OQ", dep: "Nhiễm khuẩn", owner: "Minh", target: "2026-03-10", st: "done", docDone: true },
  { id: "PCTB504/26.01-OQ", code: "PCTB504", vtype: "OQ", dep: "Vô khuẩn", owner: "Nhi", target: "2026-04-05", st: "done", docDone: false },
  { id: "PCTB504/26.01-PQ", code: "PCTB504", vtype: "PQ", dep: "Vô khuẩn", owner: "Nhi", target: "2026-06-20", st: "prog" },
  { id: "PCTB505/26.01-IQ", code: "PCTB505", vtype: "IQ", dep: "Hóa lý", owner: "Minh", target: "2026-01-20", st: "done", docDone: true },
  { id: "PCTB505/26.01-OQ", code: "PCTB505", vtype: "OQ", dep: "Hóa lý", owner: "Minh", target: "2026-05-25", st: "over" },
  { id: "PCTB505/26.01-VS", code: "PCTB505", vtype: "VS", dep: "Hóa lý", owner: "Lan", target: "2026-09-10", st: "plan" },
  { id: "PCTB507/26.01-OQ", code: "PCTB507", vtype: "OQ", dep: "Hóa lý", owner: "Minh", target: "2026-07-05", st: "prog" },
  { id: "PCTB507/26.01-PQ", code: "PCTB507", vtype: "PQ", dep: "Hóa lý", owner: "Minh", target: "2026-11-15", st: "plan" },
  { id: "X4-QT-001/26.01-VS", code: "X4-QT-001", vtype: "VS", dep: "Hóa lý", owner: "Lan", target: "2026-06-30", st: "prog" },
  { id: "X4-QT-002/26.01-PV", code: "X4-QT-002", vtype: "PV", dep: "Hóa lý", owner: "Lan", target: "2026-10-20", st: "plan" },
  { id: "X4-QT-003/26.01-ĐG", code: "X4-QT-003", vtype: "PV", dep: "Độc lập", owner: "Hoàn", target: "2026-05-15", st: "done", docDone: true },
  { id: "S1.01/26.01-BĐ", code: "S1.01", vtype: "BĐ", dep: "Độc lập", owner: "Tú", target: "2026-02-28", st: "done", docDone: true },
  { id: "S1.02/26.01-BĐ", code: "S1.02", vtype: "BĐ", dep: "Độc lập", owner: "Tú", target: "2026-05-30", st: "over" },
  { id: "S2.01/26.01-BĐ", code: "S2.01", vtype: "BĐ", dep: "Độc lập", owner: "Tú", target: "2026-08-25", st: "todo" },
  { id: "S4.01/26.01-BĐ", code: "S4.01", vtype: "BĐ", dep: "Độc lập", owner: "Tú", target: "2026-07-20", st: "todo" },
  { id: "S4.02/26.01-BĐ", code: "S4.02", vtype: "BĐ", dep: "Nhiễm khuẩn", owner: "Tú", target: "2026-06-18", st: "prog" },
  { id: "HT-01/26.01-PQ", code: "HT-01", vtype: "PQ", dep: "Nhiễm khuẩn", owner: "Minh", target: "2026-03-25", st: "done", docDone: true },
  { id: "HT-01/26.02-PQ", code: "HT-01", vtype: "PQ", dep: "Nhiễm khuẩn", owner: "Minh", target: "2026-09-25", st: "todo" },
  { id: "HT-04/26.01-PQ", code: "HT-04", vtype: "PQ", dep: "Nhiễm khuẩn", owner: "Minh", target: "2026-06-10", st: "prog" },
  { id: "HT-11/26.01-PQ", code: "HT-11", vtype: "PQ", dep: "Nhiễm khuẩn", owner: "Minh", target: "2026-05-20", st: "over" },
  { id: "HT-02/26.01-PQ", code: "HT-02", vtype: "PQ", dep: "Nhiễm khuẩn", owner: "Minh", target: "2026-12-05", st: "plan" },
  { id: "VC-01/26.01-VC", code: "VC-01", vtype: "VC", dep: "Độc lập", owner: "Hoàn", target: "2026-10-30", st: "plan" },
];

const USERS = {
  admin: { pass: "admin@123", name: "Quản trị hệ thống", role: "Admin", perm: "admin" },
  hoan: { pass: "hoan@123", name: "Hoàn", role: "V/Q Team — QLCL", perm: "admin" },
  my: { pass: "my@123", name: "My", role: "V/Q Team — QLCL", perm: "admin" },
  nhi: { pass: "nhi@123", name: "Nhi", role: "V/Q Team — QLCL", perm: "admin" },
  bophan: { pass: "bp@123", name: "NV Bộ phận", role: "XSX / Kho / RD / Cơ điện", perm: "edit" },
};
const PERM_LABEL = { admin: "Quản trị", edit: "Chỉnh sửa", view: "Chỉ xem" };

/* ===================== Helpers ===================== */
const parseD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (date, n) => { const x = new Date(date); x.setDate(x.getDate() + n); return x; };
const addMonths = (date, n) => { const x = new Date(date); x.setMonth(x.getMonth() + n); return x; };
const fmtVN = (date) => `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
const daysBetween = (a, b) => Math.round((a - b) / 86400000);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pctYear = (date) => clamp(((date - YS) / (YE - YS)) * 100, 0, 100);
const PROG = { done: 100, prog: 55, over: 75, todo: 20, plan: 8 };

function milestones(act) {
  const T = parseD(act.target);
  const dep = DEP_DAYS[act.dep] != null ? DEP_DAYS[act.dep] : 2;
  return { protocol: addDays(T, -60), validation: addDays(T, -5 - dep), report: addDays(T, -5), target: T };
}
function phaseStates(act) {
  const m = milestones(act);
  const past = (d) => d < VMP_TODAY;
  if (act.st === "done") return { p: "done", v: "done", r: "done", m };
  if (act.st === "over") return { p: "done", v: "over", r: past(m.report) ? "over" : "future", m };
  if (act.st === "prog") return { p: "done", v: past(m.validation) ? "over" : "current", r: "future", m };
  if (act.st === "todo") return { p: past(m.protocol) ? "over" : (past(addDays(m.protocol, -SOON_DAYS)) ? "current" : "future"), v: "future", r: "future", m };
  return { p: "future", v: "future", r: "future", m };
}
function nextAlert(act) {
  const m = milestones(act);
  if (act.st === "done") return null;
  let stage, date;
  if (act.st === "over" || act.st === "prog") { stage = "Thẩm định"; date = m.validation; }
  else { stage = "Đề cương"; date = m.protocol; }
  const dleft = daysBetween(date, VMP_TODAY);
  let kind = null; if (dleft < 0) kind = "over"; else if (dleft <= SOON_DAYS) kind = "soon";
  return { stage, date, dleft, kind };
}
function enrich(objects, acts) {
  const map = Object.fromEntries(objects.map((o) => [o.code, o]));
  return acts.map((a) => {
    const o = map[a.code] || {};
    return { ...a, name: o.name || a.code, cls: o.cls || "tb", dept: o.dept || "qa", area: o.area || "—", crit: o.crit || "TB", freq: o.freq || 12, m: milestones(a), alert: nextAlert(a), prog: PROG[a.st] };
  });
}
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
function tally(acts) {
  const done = acts.filter((a) => a.st === "done").length;
  const over = acts.filter((a) => a.st === "over").length;
  return { done, over, todo: acts.length - done - over, total: acts.length, rate: acts.length ? Math.round((done / acts.length) * 100) : 0 };
}
function docTally(acts) {
  const done = acts.filter((a) => a.st === "done" && a.docDone).length;
  const over = acts.filter((a) => a.st === "over").length;
  const total = acts.length;
  return { done, over, todo: total - done - over, total, rate: total ? Math.round((done / total) * 100) : 0 };
}

/* ===================== Sparkle & Mascot ===================== */
function Sparkle({ size = 18, color = C.gold, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" style={style}><path d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z" fill={color} /></svg>;
}
function Mascot({ mood, size = 130 }) {
  const happy = mood === "happy";
  const hair = "#E3A9D6", hairDark = "#C77FBE", skin = "#FFE0CD";
  return (
    <svg width={size} height={size} viewBox="0 0 150 150" className="bob" style={{ overflow: "visible" }}>
      <ellipse cx="75" cy="74" rx="46" ry="48" fill={hair} />
      <ellipse cx="42" cy="92" rx="13" ry="22" fill={hairDark} opacity="0.8" />
      <ellipse cx="108" cy="92" rx="13" ry="22" fill={hairDark} opacity="0.8" />
      {!happy && (<g fill={hairDark}><path d="M52 30 L46 14 L58 28 Z" /><path d="M70 24 L70 8 L78 24 Z" /><path d="M92 30 L102 16 L96 31 Z" /><path d="M34 52 L18 46 L33 56 Z" /><path d="M116 52 L132 48 L117 58 Z" /></g>)}
      <circle cx="75" cy="76" r="31" fill={skin} />
      <path d="M44 74 C46 48 104 48 106 74 C96 60 54 60 44 74 Z" fill={hair} />
      <ellipse cx="57" cy="84" rx="6.5" ry="4.5" fill="#F7A8C4" opacity="0.85" />
      <ellipse cx="93" cy="84" rx="6.5" ry="4.5" fill="#F7A8C4" opacity="0.85" />
      <g transform={happy ? "" : "rotate(-14 75 46)"}><path d="M60 48 L64 33 L72 44 L80 33 L84 48 Z" fill={C.gold} stroke="#E0A21F" strokeWidth="1" /><circle cx="72" cy="35" r="3" fill={C.pink} /></g>
      {happy ? (
        <>
          <path d="M60 76 Q65 71 70 76" fill="none" stroke={C.plum} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M80 76 Q85 71 90 76" fill="none" stroke={C.plum} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M66 90 Q75 100 84 90 Q75 95 66 90 Z" fill="#D8607E" />
          <path d="M118 40 C119 44 121 46 125 47 C121 48 119 50 118 54 C117 50 115 48 111 47 C115 46 117 44 118 40 Z" fill={C.gold} />
          <path d="M30 60 C31 63 32 64 35 65 C32 66 31 67 30 70 C29 67 28 66 25 65 C28 64 29 63 30 60 Z" fill={C.pink} />
        </>
      ) : (
        <>
          <path d="M56 67 L65 64" stroke={C.plum} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M94 67 L85 64" stroke={C.plum} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="64" cy="76" r="5" fill="#fff" stroke={C.plum} strokeWidth="1.4" /><circle cx="65" cy="77" r="2.4" fill={C.plum} />
          <circle cx="86" cy="76" r="5" fill="#fff" stroke={C.plum} strokeWidth="1.4" /><circle cx="85" cy="77" r="2.4" fill={C.plum} />
          <path d="M68 92 Q72 88 75 92 Q78 96 82 92" fill="none" stroke="#C0506E" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M104 64 C100 70 108 70 104 64 Z" fill="#8FC4EC" /><ellipse cx="103" cy="67" rx="1.2" ry="1.6" fill="#fff" opacity="0.7" />
        </>
      )}
    </svg>
  );
}

/* ===================== Primitives ===================== */
function Donut({ segments, size = 152, stroke = 18 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.pinkSoft} strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const node = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${Math.max(len - 3, 0)} ${circ - Math.max(len - 3, 0)}`} strokeDashoffset={-acc} style={{ transition: "stroke-dasharray .9s ease" }} />;
          acc += len; return node;
        })}
      </g>
    </svg>
  );
}
function Card({ children, style, variant = "default", cls = "" }) {
  const base = variant === "strong" ? cardStrong : variant === "soft" ? cardSoft : cardDefault;
  return <div className={"card fade " + cls} style={{ ...base, padding: 24, ...style }}>{children}</div>;
}
function CardTitle({ icon: Icon, children, right, sub }) {
  return <div style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>{Icon && <Icon size={18} color={C.pink} strokeWidth={2.4} />}<span style={{ fontFamily: TEXT, fontSize: 17, fontWeight: 700, color: C.plum }}>{children}</span></div>{right}
    </div>
    {sub && <div style={{ fontSize: 12.5, color: C.plumSoft, fontWeight: 600, marginTop: 4 }}>{sub}</div>}
  </div>;
}
function Pill({ s, small }) { const m = STATUS[s]; return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: small ? "3px 9px" : "5px 12px", borderRadius: 999, fontSize: small ? 11 : 12, fontWeight: 700, color: m.text, background: m.bg, fontFamily: TEXT, whiteSpace: "nowrap" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: m.text }} />{m.label}</span>; }
function Tag({ children, color, bg }) { return <span style={{ fontSize: 11.5, fontWeight: 700, color, background: bg, padding: "3px 10px", borderRadius: 999, fontFamily: TEXT, whiteSpace: "nowrap" }}>{children}</span>; }
function ChartTip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return <div style={{ background: "#fff", padding: "10px 14px", borderRadius: 14, border: `1.5px solid ${C.pinkSoft}`, boxShadow: "0 8px 24px rgba(238,123,169,.18)", fontFamily: TEXT, fontSize: 13 }}>{label && <div style={{ fontWeight: 700, color: C.plum, marginBottom: 5 }}>{label}</div>}{payload.map((p, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, color: C.plum, fontWeight: 700 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: p.color }} />{p.name}: {p.value}</div>)}</div>;
}
function CrownLogo() {
  return <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 46, height: 46, borderRadius: 15, background: GRAD_SOFT, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(238,123,169,.32)", flexShrink: 0 }}><span style={{ fontSize: 24 }}>👑</span></div><div style={{ lineHeight: 1.15 }}><div style={{ fontFamily: TEXT, fontWeight: 800, fontSize: 18, color: C.plum }}>CPC1 HN</div><div style={{ fontSize: 10, color: C.pinkText, letterSpacing: 1.2, fontWeight: 800, marginTop: 1 }}>V/Q TEAM — QLCL</div></div></div>;
}
const btnPrimary = { border: "none", cursor: "pointer", background: GRAD, color: "#fff", fontFamily: TEXT, fontWeight: 800 };

function Modal({ onClose, title, icon: Icon, children, wide }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(78,42,78,.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="vmp-scroll" style={{ background: C.pinkMist, borderRadius: 24, padding: 28, width: "100%", maxWidth: wide ? 620 : 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 54px rgba(78,42,78,.32)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 40, height: 40, borderRadius: 13, background: C.lavSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={20} color={C.lavText} /></div><span style={{ fontFamily: TEXT, fontSize: 19, fontWeight: 800, color: C.plum }}>{title}</span></div><button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}><XCircle size={22} color={C.plumSoft} /></button></div>
        {children}
      </div>
    </div>
  );
}

/* ===================== Login ===================== */
function LoginScreen({ users, onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [show, setShow] = useState(false);
  const submit = () => { const rec = users[u.trim().toLowerCase()]; if (rec && rec.pass === p) onLogin({ key: u.trim().toLowerCase(), ...rec }); else setErr("Sai tài khoản hoặc mật khẩu."); };
  const field = (icon, props, right) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 16, background: "#fff", border: `1.5px solid ${C.pinkSoft}` }}>
      {icon}<input {...props} onKeyDown={(e) => e.key === "Enter" && submit()} style={{ border: "none", outline: "none", background: "transparent", fontFamily: TEXT, fontSize: 14.5, color: C.plum, width: "100%", fontWeight: 600 }} />{right}
    </div>
  );
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: TEXT, padding: 20, background: `radial-gradient(720px 520px at 86% -5%, ${C.pinkMist}, transparent 60%), radial-gradient(640px 520px at -6% 104%, ${C.lavSoft}, transparent 55%), linear-gradient(160deg, ${C.bg1}, ${C.bg2})` }}>
      {[{ t: "10%", l: "18%", s: 16, c: C.gold }, { t: "20%", l: "82%", s: 13, c: C.pink }, { t: "76%", l: "12%", s: 14, c: C.lav }, { t: "70%", l: "88%", s: 12, c: C.sky }].map((x, i) => <div key={i} className="tw" style={{ position: "fixed", top: x.t, left: x.l }}><Sparkle size={x.s} color={x.c} /></div>)}
      <div style={{ width: "100%", maxWidth: 900, display: "grid", gridTemplateColumns: "1fr 1fr", borderRadius: 30, overflow: "hidden", boxShadow: "0 24px 60px rgba(238,123,169,.28)" }} className="login-grid">
        <div style={{ background: GRAD, padding: "44px 40px", color: "#fff", position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", textAlign: "center" }}>
          <div style={{ position: "absolute", top: 20, right: 26 }}><Sparkle size={20} color="#fff" style={{ opacity: .85 }} /></div>
          <div style={{ position: "absolute", bottom: 30, left: 26 }}><Sparkle size={14} color="#fff" style={{ opacity: .75 }} /></div>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,.24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>👑</div>
          <Mascot mood="happy" size={170} />
          <div>
            <div style={{ fontFamily: TEXT, fontSize: 26, fontWeight: 800 }}>VMP Monitor</div>
            <div style={{ fontSize: 13.5, marginTop: 6, opacity: .95, lineHeight: 1.6 }}>Hệ Giám sát Thẩm định<br />CPC1 HN · V/Q Team — QLCL</div>
          </div>
        </div>
        <div style={{ background: C.pinkMist, padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: TEXT, fontSize: 24, fontWeight: 800, color: C.plum }}>Xin chào! ✨</div>
          <div style={{ fontSize: 13.5, color: C.plumSoft, marginTop: 5, marginBottom: 22, fontWeight: 700 }}>Đăng nhập để bắt đầu nào</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {field(<Boxes size={18} color={C.pink} />, { placeholder: "Tài khoản", value: u, onChange: (e) => { setU(e.target.value); setErr(""); } })}
            {field(<Lock size={18} color={C.pink} />, { placeholder: "Mật khẩu", type: show ? "text" : "password", value: p, onChange: (e) => { setP(e.target.value); setErr(""); } }, <button onClick={() => setShow(!show)} style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>{show ? <EyeOff size={17} color={C.plumSoft} /> : <Eye size={17} color={C.plumSoft} />}</button>)}
            {err && <div style={{ color: C.raspText, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}><XCircle size={15} /> {err}</div>}
            <button onClick={submit} style={{ ...btnPrimary, marginTop: 4, padding: "14px", borderRadius: 16, fontSize: 15, boxShadow: "0 8px 20px rgba(190,69,116,.35)" }}>Đăng nhập</button>
          </div>
          <div style={{ marginTop: 22, padding: "13px 15px", borderRadius: 14, background: "#fff", border: `1.5px solid ${C.pinkSoft}`, fontSize: 11.5, color: C.plumSoft, lineHeight: 1.7, fontWeight: 600 }}><b style={{ color: C.pinkText }}>Tài khoản demo:</b><br /><code>hoan / hoan@123</code> (admin — sửa được mục gốc)<br /><code>bophan / bp@123</code> (chỉ nhập tiến độ dashboard)</div>
        </div>
      </div>
    </div>
  );
}
function ChangePwModal({ user, users, setUsers, onClose }) {
  const [oldp, setOld] = useState(""); const [np, setNp] = useState(""); const [cf, setCf] = useState(""); const [msg, setMsg] = useState({ type: "", text: "" });
  const submit = () => {
    const cur = users[user.key].pass;
    if (oldp !== cur) return setMsg({ type: "err", text: "Mật khẩu cũ không đúng." });
    if (np.length < 6) return setMsg({ type: "err", text: "Mật khẩu mới tối thiểu 6 ký tự." });
    if (np !== cf) return setMsg({ type: "err", text: "Xác nhận mật khẩu không khớp." });
    if (np === oldp) return setMsg({ type: "err", text: "Mật khẩu mới phải khác mật khẩu cũ." });
    setUsers({ ...users, [user.key]: { ...users[user.key], pass: np } }); setMsg({ type: "ok", text: "Đổi mật khẩu thành công!" }); setOld(""); setNp(""); setCf("");
  };
  const inp = (ph, val, set) => <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", borderRadius: 14, background: "#fff", border: `1.5px solid ${C.pinkSoft}` }}><KeyRound size={16} color={C.pink} /><input type="password" placeholder={ph} value={val} onChange={(e) => { set(e.target.value); setMsg({ type: "", text: "" }); }} style={{ border: "none", outline: "none", background: "transparent", fontFamily: TEXT, fontSize: 14, color: C.plum, width: "100%", fontWeight: 600 }} /></div>;
  return (
    <Modal onClose={onClose} title="Đổi mật khẩu" icon={KeyRound}>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {inp("Mật khẩu cũ", oldp, setOld)}{inp("Mật khẩu mới (≥ 6 ký tự)", np, setNp)}{inp("Xác nhận mật khẩu mới", cf, setCf)}
        {msg.text && <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, color: msg.type === "ok" ? C.mintText : C.raspText }}>{msg.type === "ok" ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {msg.text}</div>}
        <button onClick={submit} style={{ ...btnPrimary, marginTop: 4, padding: "13px", borderRadius: 14, fontSize: 14.5 }}>Xác nhận</button>
      </div>
    </Modal>
  );
}

/* ===================== Sidebar & Topbar ===================== */
const NAV = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "timeline", label: "Timeline VMP", icon: GanttChartSquare },
  { id: "inventory", label: "Danh mục đối tượng", icon: Boxes },
  { id: "update", label: "Cập nhật tiến độ", icon: Pencil },
  { id: "alerts", label: "Cảnh báo & Tái thẩm định", icon: Radar },
  { id: "risk", label: "Đánh giá rủi ro (QRM)", icon: ShieldAlert },
  { id: "reports", label: "Báo cáo & AI", icon: FileBarChart },
];
function Sidebar({ view, setView, user, onLogout, onChangePw, connected }) {
  return (
    <aside style={{ width: 266, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column", background: `linear-gradient(180deg, #FFFFFF, ${C.pinkMist})`, borderRight: `1.5px solid ${C.pinkSoft}`, padding: "26px 16px", position: "relative", overflow: "hidden" }}>
      <div className="tw" style={{ position: "absolute", top: 90, right: 18 }}><Sparkle size={13} color={C.pink} /></div>
      <div className="tw" style={{ position: "absolute", bottom: 140, left: 16 }}><Sparkle size={11} color={C.lav} /></div>
      <div style={{ padding: "0 6px 22px" }}><CrownLogo /></div>
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, marginTop: 4, overflowY: "auto" }} className="vmp-scroll">
        <div style={{ fontSize: 10.5, color: C.plumSoft, letterSpacing: 1.4, fontWeight: 800, padding: "8px 12px 6px" }}>GIÁM SÁT</div>
        {NAV.map((n) => {
          const active = view === n.id; const Icon = n.icon;
          return <button key={n.id} onClick={() => setView(n.id)} className="vmp-nav" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderRadius: 14, border: "none", cursor: "pointer", textAlign: "left", fontFamily: TEXT, fontSize: 13.5, fontWeight: active ? 800 : 600, color: active ? C.plum : C.plumSoft, background: active ? C.pinkSoft : "transparent", boxShadow: active ? `inset 3px 0 0 ${C.pink}` : "none" }}><Icon size={19} color={active ? C.pink : C.plumSoft} strokeWidth={2.2} />{n.label}{n.id === "connect" && <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: 999, background: connected ? C.mint : C.marigold }} />}</button>;
        })}
      </nav>
      <div style={{ marginTop: 14, padding: "13px", borderRadius: 18, background: "#fff", border: `1.5px solid ${C.pinkSoft}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}><div style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0, background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontFamily: NUM, fontSize: 17 }}>{user.name[0]}</div><div style={{ lineHeight: 1.3, overflow: "hidden", flex: 1 }}><div style={{ color: C.plum, fontSize: 14, fontWeight: 800 }}>{user.name}</div><div style={{ color: C.plumSoft, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.role}</div></div></div>
        <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
          <button onClick={onChangePw} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 11, border: "none", cursor: "pointer", background: C.lavSoft, color: C.lavText, fontFamily: TEXT, fontSize: 12, fontWeight: 800 }}><KeyRound size={14} /> Mật khẩu</button>
          <button onClick={onLogout} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 11, border: "none", cursor: "pointer", background: C.raspSoft, color: C.raspText, fontFamily: TEXT, fontSize: 12, fontWeight: 800 }}><LogOut size={14} /> Thoát</button>
        </div>
      </div>
    </aside>
  );
}
function Topbar({ title, user, sub }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 34px", gap: 20, flexWrap: "wrap" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}><Sparkle size={14} color={C.pink} /><span style={{ fontSize: 10.5, color: C.pinkText, fontWeight: 800, letterSpacing: 1.6 }}>VMP MONITOR · HỆ GIÁM SÁT THẨM ĐỊNH</span></div>
        <div style={{ fontFamily: TEXT, fontSize: 25, fontWeight: 800, color: C.plum }}>{title}</div>
        <div style={{ fontSize: 13, color: C.plumSoft, marginTop: 3, fontWeight: 600 }}>{sub || "Theo dõi Kế hoạch Thẩm định Gốc (VMP) — CPC1 HN"}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ ...glass, borderRadius: 16, padding: "9px 15px", display: "flex", alignItems: "center", gap: 9 }}><span style={{ position: "relative", display: "flex", width: 8, height: 8 }}><span className="live-dot" style={{ position: "absolute", inset: 0, borderRadius: 999, background: C.mint }} /><span style={{ position: "relative", width: 8, height: 8, borderRadius: 999, background: C.mint }} /></span><span style={{ fontSize: 11, fontWeight: 800, color: C.mintText, letterSpacing: 0.5 }}>TRỰC TIẾP</span><span style={{ fontFamily: NUM, fontSize: 13, color: C.plum, fontWeight: 700 }}>{now.toLocaleTimeString("vi-VN")}</span></div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, color: user.perm === "view" ? C.skyText : C.pinkText, background: user.perm === "view" ? C.skySoft : C.pinkSoft }}><ShieldCheck size={14} /> {PERM_LABEL[user.perm]}</span>
        <button style={{ position: "relative", width: 42, height: 42, borderRadius: 999, border: "none", cursor: "pointer", ...glass, display: "flex", alignItems: "center", justifyContent: "center" }}><Bell size={18} color={C.pink} /><span style={{ position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: 999, background: C.rasp, border: "2px solid #fff" }} /></button>
      </div>
    </div>
  );
}

/* ===================== Track Card ===================== */
function TrackCard({ label, desc, tColor, tText, m, note, noteColor, noteBg, NoteIcon }) {
  const segs = [{ value: m.done, color: MST.done.color }, { value: m.over, color: MST.over.color }, { value: m.todo, color: MST.todo.color }];
  const rows = [{ k: "done", n: m.done }, { k: "over", n: m.over }, { k: "todo", n: m.todo }];
  return (
    <Card variant="strong">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}><div><div style={{ fontFamily: TEXT, fontSize: 17, fontWeight: 800, color: C.plum }}>{label}</div><div style={{ fontFamily: TEXT, fontSize: 12.5, color: C.plumSoft, marginTop: 2, fontWeight: 600 }}>{desc}</div></div><Tag color={tText} bg={tColor + "1f"}>{m.total} hạng mục</Tag></div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 8 }}>
        <div style={{ position: "relative", flexShrink: 0 }}><Donut segments={segs} /><div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><div style={{ fontFamily: NUM, fontSize: 34, fontWeight: 800, color: C.plum, lineHeight: 1 }}>{m.rate}%</div><div style={{ fontFamily: TEXT, fontSize: 11.5, color: C.plumSoft, fontWeight: 700 }}>hoàn thành</div></div></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r) => { const meta = MST[r.k]; const pct = m.total ? Math.round((r.n / m.total) * 100) : 0; return (
            <div key={r.k}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: TEXT, fontSize: 12.5, color: C.plum, fontWeight: 700 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: meta.color }} />{meta.label}</span><span style={{ fontFamily: TEXT, fontSize: 13, color: C.plum, fontWeight: 700 }}><b style={{ fontFamily: NUM, fontSize: 15 }}>{r.n}</b> · {pct}%</span></div>
              <div style={{ height: 7, borderRadius: 999, background: C.pinkSoft, overflow: "hidden" }}><div style={{ height: "100%", width: pct + "%", background: meta.color, borderRadius: 999, transition: "width .9s ease" }} /></div>
            </div>
          ); })}
        </div>
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 14, fontFamily: TEXT, fontSize: 13, fontWeight: 800, background: noteBg, color: noteColor }}><NoteIcon size={15} />{note}</div>
    </Card>
  );
}

/* ===================== Dept race ===================== */
function rankRing(rank) { return rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : "#D9A9CC"; }
function RankBadge({ rank }) {
  const medals = ["🥇", "🥈", "🥉"];
  if (rank <= 3) return <span style={{ fontSize: 21, width: 28, textAlign: "center" }}>{medals[rank - 1]}</span>;
  return <span style={{ width: 28, textAlign: "center", fontFamily: NUM, fontWeight: 800, fontSize: 15, color: C.plumSoft }}>{rank}</span>;
}
function DeptRace({ acts }) {
  const rows = DEPTS.map((dp) => ({ id: dp.id, name: dp.name, ...tally(acts.filter((a) => a.dept === dp.id)) }))
    .filter((r) => r.total > 0).sort((a, b) => b.rate - a.rate || b.done - a.done);
  if (!rows.length) return null;
  const leader = rows[0], laggard = rows[rows.length - 1], totalOver = sum(rows.map((r) => r.over));
  return (
    <Card variant="strong">
      <CardTitle icon={Trophy} sub="🏁 Về đích = 100% hoàn thành các hạng mục VMP 2026 của bộ phận">Đường đua tiến độ theo bộ phận</CardTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((r, idx) => {
          const rank = idx + 1, ring = rankRing(rank), deep = DEPT_DEEP[r.id], col = DEPT_COLOR[r.id];
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <RankBadge rank={rank} />
              <div style={{ width: 92, flexShrink: 0 }}><div style={{ fontFamily: TEXT, fontSize: 13, fontWeight: 800, color: C.plum, lineHeight: 1.15 }}>{r.name}</div></div>
              <div style={{ flex: 1, position: "relative", height: 44, minWidth: 130 }}>
                <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: 0, right: 0, height: 13, borderRadius: 999, background: C.pinkSoft, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: r.rate + "%", background: col, borderRadius: 999, transition: "width 1s cubic-bezier(.22,1,.36,1)" }} />
                </div>
                <div style={{ position: "absolute", top: "50%", left: `${r.rate}%`, transform: "translate(-50%,-50%)", transition: "left 1s cubic-bezier(.22,1,.36,1)", zIndex: 2 }}>
                  {rank === 1 && <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: 15 }}>👑</div>}
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: deep, border: `3px solid ${ring}`, boxShadow: "0 3px 8px rgba(78,42,78,.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontFamily: NUM, fontSize: 12 }}>{DEPT_CODE[r.id]}</div>
                </div>
              </div>
              <span style={{ fontSize: 17, flexShrink: 0 }}>🏁</span>
              <div style={{ width: 132, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                {r.over > 0 && <Tag color={C.raspText} bg={C.raspSoft}>{r.over} trễ</Tag>}
                <span style={{ fontSize: 12, color: C.plumSoft, fontWeight: 700 }}>{r.done}/{r.total}</span>
                <span style={{ fontFamily: NUM, fontSize: 16, fontWeight: 800, color: deep, minWidth: 44, textAlign: "right" }}>{r.rate}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: TEXT, fontSize: 13, fontWeight: 800, color: C.mintText, background: C.mintSoft, padding: "9px 15px", borderRadius: 999 }}><TrendingUp size={15} /> Dẫn đầu: {leader.name} ({leader.rate}%)</span>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: TEXT, fontSize: 13, fontWeight: 800, color: C.raspText, background: C.raspSoft, padding: "9px 15px", borderRadius: 999 }}><AlertCircle size={15} /> Cần chú ý: {laggard.name} ({laggard.rate}%)</span>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: TEXT, fontSize: 13, fontWeight: 800, color: C.plumSoft, background: C.pinkMist, padding: "9px 15px", borderRadius: 999 }}>Tổng quá hạn: {totalOver} hạng mục</span>
      </div>
    </Card>
  );
}

/* ===================== Individual podium ===================== */
function IndividualLeaderboard({ acts }) {
  const map = {};
  acts.forEach((a) => { const o = map[a.owner] || (map[a.owner] = { name: a.owner, items: 0, psum: 0, done: 0, over: 0 }); o.items++; o.psum += PROG[a.st]; if (a.st === "done") o.done++; if (a.st === "over") o.over++; });
  const people = Object.values(map).map((p) => ({ ...p, avg: Math.round(p.psum / p.items) })).sort((a, b) => b.avg - a.avg || b.done - a.done || b.items - a.items);
  const top3 = people.slice(0, 3), rest = people.slice(3);
  const podium = [{ p: top3[1], place: 2 }, { p: top3[0], place: 1 }, { p: top3[2], place: 3 }].filter((x) => x.p);
  const PCFG = {
    1: { h: 102, av: 60, ring: C.gold, base: "linear-gradient(180deg,#FBD66A,#E3A41E)", crown: true },
    2: { h: 76, av: 50, ring: C.silver, base: "linear-gradient(180deg,#D6DCE5,#A7B0BD)" },
    3: { h: 58, av: 46, ring: C.bronze, base: "linear-gradient(180deg,#E2B184,#C2854F)" },
  };
  return (
    <Card variant="strong" style={{ background: `linear-gradient(150deg,#fff,${C.pinkMist})` }}>
      <CardTitle icon={Crown} sub="Xếp theo tiến độ trung bình các hạng mục thẩm định phụ trách">Bảng vinh danh cá nhân</CardTitle>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 14, padding: "10px 0 4px", flexWrap: "wrap" }}>
        {podium.map(({ p, place }) => { const cf = PCFG[place]; return (
          <div key={p.name} className="rise" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 116 }}>
            <div style={{ position: "relative" }}>
              {cf.crown && <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", fontSize: 22 }}>👑</div>}
              {cf.crown && [["-26px", "-6px", C.gold, 12], ["108%", "2px", C.pink, 11], ["50%", "-30px", C.lav, 10]].map((s, i) => <div key={i} className="tw" style={{ position: "absolute", left: s[0], top: s[1] }}><Sparkle size={s[3]} color={s[2]} /></div>)}
              <div style={{ width: cf.av, height: cf.av, borderRadius: 999, background: GRAD, border: `3px solid ${cf.ring}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontFamily: NUM, fontSize: cf.av / 2.4, boxShadow: "0 6px 16px rgba(78,42,78,.2)" }}>{p.name[0]}</div>
            </div>
            <div style={{ textAlign: "center" }}><div style={{ fontFamily: TEXT, fontWeight: 800, fontSize: 14, color: C.plum }}>{p.name}</div><div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 18, color: C.plum }}>{p.avg}%</div><div style={{ fontSize: 11, color: C.plumSoft, fontWeight: 600 }}>{p.items} hạng mục · {p.done} xong</div></div>
            <div style={{ width: "100%", height: cf.h, borderRadius: "14px 14px 0 0", background: cf.base, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 8, boxShadow: "inset 0 2px 6px rgba(255,255,255,.5)" }}><span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 26, color: C.plum }}>{place}</span></div>
          </div>
        ); })}
      </div>
      {rest.length > 0 && <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        {rest.map((p, i) => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 8px", borderRadius: 999, background: "#fff", border: `1.5px solid ${C.pinkSoft}` }}>
            <div style={{ width: 30, height: 30, borderRadius: 999, background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontFamily: NUM, fontSize: 13 }}>{p.name[0]}</div>
            <span style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 13, color: C.plum }}>#{top3.length + i + 1} {p.name}</span>
            <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 14, color: C.plumSoft }}>{p.avg}%</span>
          </div>
        ))}
      </div>}
    </Card>
  );
}

/* ===================== Monthly cumulative ===================== */
const TREND = [
  { m: "T1", exec: 1, doc: 0 }, { m: "T2", exec: 3, doc: 2 }, { m: "T3", exec: 5, doc: 3 },
  { m: "T4", exec: 6, doc: 4 }, { m: "T5", exec: 7, doc: 5 }, { m: "T6", exec: 7, doc: 5 },
];
function MonthlyClimb({ total, gap }) {
  const ExecDot = (p) => { const { cx, cy, index, value } = p; if (cx == null) return null; const last = index === TREND.length - 1; return (
    <g><circle cx={cx} cy={cy} r={last ? 6 : 4.5} fill="#fff" stroke={C.mint} strokeWidth={last ? 3.5 : 2.6} /><text x={cx} y={cy - 12} textAnchor="middle" fontSize="11.5" fontWeight="800" fill={C.mintText} fontFamily={NUM}>{value}</text>{last && <text x={cx} y={cy - 29} textAnchor="middle" fontSize="18">🚩</text>}</g>
  ); };
  const DocDot = (p) => { const { cx, cy, value } = p; if (cx == null) return null; return (
    <g><circle cx={cx} cy={cy} r="4.5" fill="#fff" stroke={C.sky} strokeWidth="2.6" /><text x={cx} y={cy + 19} textAnchor="middle" fontSize="11.5" fontWeight="800" fill={C.skyText} fontFamily={NUM}>{value}</text></g>
  ); };
  const legend = <div style={{ display: "flex", gap: 16, fontSize: 12 }}><span style={{ display: "flex", alignItems: "center", gap: 6, color: C.plum, fontWeight: 700 }}><span style={{ width: 12, height: 4, borderRadius: 9, background: C.mint }} />Thực tế</span><span style={{ display: "flex", alignItems: "center", gap: 6, color: C.plum, fontWeight: 700 }}><span style={{ width: 12, height: 4, borderRadius: 9, background: C.sky }} />Hồ sơ</span></div>;
  return (
    <Card>
      <CardTitle icon={TrendingUp} right={legend} sub="Số hạng mục cộng dồn đã hoàn thành theo tháng (trên tổng kế hoạch năm)">Hành trình lũy kế theo tháng</CardTitle>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={TREND} margin={{ top: 40, right: 18, left: -8, bottom: 4 }}>
            <defs><linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.mint} stopOpacity={0.32} /><stop offset="100%" stopColor={C.mint} stopOpacity={0} /></linearGradient><linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.sky} stopOpacity={0.26} /><stop offset="100%" stopColor={C.sky} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke={C.line} />
            <XAxis dataKey="m" tick={{ fontSize: 13, fill: C.plum, fontFamily: TEXT, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, total]} tick={{ fontSize: 12, fill: C.plumSoft, fontFamily: TEXT, fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTip />} />
            <ReferenceLine y={total} stroke={C.pink} strokeDasharray="5 5" strokeOpacity={0.55} />
            <Area type="monotone" dataKey="doc" name="Hồ sơ" stroke={C.sky} strokeWidth={2.8} fill="url(#gD)" dot={DocDot} activeDot={{ r: 6 }} />
            <Area type="monotone" dataKey="exec" name="Thực tế" stroke={C.mint} strokeWidth={3.2} fill="url(#gE)" dot={ExecDot} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontFamily: TEXT, fontSize: 13, color: C.plum, fontWeight: 700, padding: "10px 13px", borderRadius: 12, background: C.marigoldSoft }}><Clock size={15} color={C.marigoldText} /><span>Hồ sơ chậm hơn thực tế <b>{gap} hạng mục</b>. Nét đứt = tổng KH năm ({total}); phần lớn lịch dồn vào nửa cuối năm.</span></div>
    </Card>
  );
}

/* ===================== KPI ===================== */
function KpiCard({ emoji, bg, color, value, label, sub, subColor, rate }) {
  return (
    <Card>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 13 }}>{emoji}</div>
      <div style={{ fontFamily: NUM, fontSize: 38, fontWeight: 800, color, lineHeight: 1.05 }}>{value}</div>
      {rate != null && <div style={{ height: 7, borderRadius: 999, background: C.pinkSoft, overflow: "hidden", margin: "11px 0 4px" }}><div style={{ height: "100%", width: rate + "%", background: color, borderRadius: 999, transition: "width .9s ease" }} /></div>}
      <div style={{ fontFamily: TEXT, fontSize: 13, color: C.plum, fontWeight: 800, marginTop: rate != null ? 6 : 8 }}>{label}</div>
      {sub && <div style={{ fontFamily: TEXT, fontSize: 12, color: subColor || C.plumSoft, marginTop: 2, fontWeight: 700 }}>{sub}</div>}
    </Card>
  );
}

/* ===================== Gantt Timeline VMP ===================== */
const MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
const PHASE_COLOR = { done: C.mint, current: C.marigold, over: C.rasp, future: "#D9C3D5" };
function GanttRow({ a }) {
  const ps = phaseStates(a), m = ps.m;
  const x0 = pctYear(m.protocol), xV = pctYear(m.validation), xR = pctYear(m.report), xT = pctYear(m.target);
  const span = (xT - x0) || 1;
  const seg = (lp, rp, status) => (rp - lp) > 0.4 ? <div title={status} style={{ position: "absolute", left: lp + "%", width: (rp - lp) + "%", top: 0, bottom: 0, background: PHASE_COLOR[status], opacity: status === "future" ? 0.55 : 0.92, borderRadius: 4 }} /> : null;
  const cls = CLS[a.cls];
  const a1 = ((xV - x0) / span) * 100, a2 = ((xR - x0) / span) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
      <div style={{ width: 188, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Tag color={cls.text} bg={cls.soft}>{a.vtype}</Tag><span style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 700, color: C.plumSoft }}>{a.code}</span></div>
        <div style={{ fontSize: 11.5, color: C.plum, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{a.name}</div>
      </div>
      <div style={{ flex: 1, position: "relative", height: 22, minWidth: 220 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: "rgba(78,42,78,.04)" }} />
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <div key={i} style={{ position: "absolute", left: (i / 12) * 100 + "%", top: 0, bottom: 0, width: 1, background: C.line }} />)}
        <div style={{ position: "absolute", left: x0 + "%", width: span + "%", top: 3, bottom: 3 }}>
          {seg(0, a1, ps.p)}
          {seg(a1, a2, ps.v)}
          {seg(a2, 100, ps.r)}
        </div>
        <div style={{ position: "absolute", left: xT + "%", top: "50%", transform: "translate(-50%,-50%)", fontSize: 12 }}>🎯</div>
      </div>
      <div style={{ width: 96, flexShrink: 0, textAlign: "right" }}><div style={{ fontFamily: NUM, fontSize: 12.5, fontWeight: 800, color: a.st === "over" ? C.raspText : C.plum }}>{fmtVN(m.target)}</div><div style={{ fontSize: 10.5, color: C.plumSoft, fontWeight: 600 }}>đích VMP</div></div>
    </div>
  );
}
function TimelineView({ acts }) {
  const [cls, setCls] = useState("all"); const [dept, setDept] = useState("all");
  const filtered = acts.filter((a) => (cls === "all" || a.cls === cls) && (dept === "all" || a.dept === dept)).sort((x, y) => parseD(x.target) - parseD(y.target));
  const todayX = pctYear(VMP_TODAY);
  const Sel = ({ val, set, opts }) => <select value={val} onChange={(e) => set(e.target.value)} style={{ ...glass, borderRadius: 12, padding: "9px 14px", fontFamily: TEXT, fontSize: 13, color: C.plum, fontWeight: 700, cursor: "pointer", outline: "none" }}>{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>;
  const legend = [["done", "Hoàn thành"], ["current", "Đang/tới hạn"], ["over", "Quá hạn"], ["future", "Kế hoạch"]];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: C.plumSoft }}><Filter size={15} /> <span style={{ fontSize: 13, fontWeight: 800 }}>Lọc:</span></div>
          <Sel val={cls} set={setCls} opts={[{ v: "all", l: "Tất cả nhóm" }].concat(Object.keys(CLS).map((k) => ({ v: k, l: CLS[k].label })))} />
          <Sel val={dept} set={setDept} opts={[{ v: "all", l: "Tất cả bộ phận" }].concat(DEPTS.map((d) => ({ v: d.id, l: d.name })))} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 14, flexWrap: "wrap" }}>{legend.map(([k, l]) => <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.plum, fontWeight: 700 }}><span style={{ width: 12, height: 8, borderRadius: 3, background: PHASE_COLOR[k], opacity: k === "future" ? .55 : .92 }} />{l}</span>)}</div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12.5, color: C.plumSoft, fontWeight: 600 }}>Mỗi thanh gồm 3 pha theo quy tắc của bạn: <b style={{ color: C.plum }}>Đề cương (T‑60)</b> → <b style={{ color: C.plum }}>Thẩm định thực tế</b> → <b style={{ color: C.plum }}>Báo cáo (T‑5, + QC)</b> → 🎯 <b style={{ color: C.plum }}>Đích VMP (T)</b>.</div>
      </Card>
      <Card variant="strong">
        <CardTitle icon={GanttChartSquare} sub={`${filtered.length} hạng mục thẩm định · Năm 2026`}>Lịch tổng thể thẩm định (Gantt)</CardTitle>
        <div style={{ overflowX: "auto" }} className="vmp-scroll">
          <div style={{ minWidth: 760 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 188, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", minWidth: 220 }}>{MONTHS.map((mm) => <div key={mm} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 800, color: C.plumSoft }}>{mm}</div>)}</div>
              <div style={{ width: 96, flexShrink: 0 }} />
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: `calc(198px + (100% - 304px) * ${todayX / 100})`, top: -2, bottom: 0, width: 2, background: C.raspText, zIndex: 5 }}>
                <span style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9.5, fontWeight: 800, color: "#fff", background: C.raspText, padding: "1px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>Hôm nay</span>
              </div>
              {filtered.map((a) => <GanttRow key={a.id} a={a} />)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ===================== Alerts & Re-validation ===================== */
function AlertsView({ acts }) {
  const withAlert = acts.map((a) => ({ a, al: a.alert })).filter((x) => x.al && x.al.kind);
  const overdue = withAlert.filter((x) => x.al.kind === "over").sort((a, b) => a.al.dleft - b.al.dleft);
  const soon = withAlert.filter((x) => x.al.kind === "soon").sort((a, b) => a.al.dleft - b.al.dleft);
  const requal = acts.filter((a) => a.st === "done" && a.freq > 0).map((a) => { const next = addMonths(parseD(a.target), a.freq); return { a, next, dleft: daysBetween(next, VMP_TODAY) }; }).filter((x) => x.dleft >= -30).sort((a, b) => a.dleft - b.dleft).slice(0, 8);
  const Row = ({ a, al }) => {
    const cls = CLS[a.cls];
    return (
      <div className="vmp-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderRadius: 16, background: "#fff", border: `1px solid ${al.kind === "over" ? C.raspSoft : C.marigoldSoft}` }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: al.kind === "over" ? C.raspSoft : C.marigoldSoft, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 17, color: al.kind === "over" ? C.raspText : C.marigoldText, lineHeight: 1 }}>{Math.abs(al.dleft)}</span><span style={{ fontSize: 9, color: C.plumSoft, fontWeight: 700 }}>ngày {al.kind === "over" ? "trễ" : "nữa"}</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}><Tag color={cls.text} bg={cls.soft}>{a.vtype}</Tag><span style={{ fontFamily: TEXT, fontSize: 13.5, fontWeight: 800, color: C.plum }}>{a.name}</span></div>
          <div style={{ fontSize: 12, color: C.plumSoft, fontWeight: 600, marginTop: 2 }}>{a.id} · Mốc <b style={{ color: al.kind === "over" ? C.raspText : C.marigoldText }}>{al.stage}</b> · hạn {fmtVN(al.date)} · BC: {a.dep}</div>
        </div>
        <Tag color={al.kind === "over" ? C.raspText : C.marigoldText} bg={al.kind === "over" ? C.raspSoft : C.marigoldSoft}>{al.kind === "over" ? "Quá hạn" : "Tới hạn"}</Tag>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 24 }}>
        <KpiCard emoji="🚨" bg={C.raspSoft} color={C.raspText} value={overdue.length} label="Hạng mục quá hạn" sub="Cần xử lý ngay" subColor={C.raspText} />
        <KpiCard emoji="⏰" bg={C.marigoldSoft} color={C.marigoldText} value={soon.length} label={`Tới hạn (≤ ${SOON_DAYS} ngày)`} sub="Theo dõi sát" subColor={C.marigoldText} />
        <KpiCard emoji="🔁" bg={C.lavSoft} color={C.lavText} value={requal.length} label="Tái thẩm định sắp tới" sub="Theo tần suất" subColor={C.lavText} />
      </div>
      <Card variant="strong">
        <CardTitle icon={AlertCircle} sub="Tính theo quy tắc: Đề cương T‑60 ngày · Báo cáo T‑5 ngày (+QC: hóa lý 2 / nhiễm khuẩn 7 / vô khuẩn 16)">Cảnh báo Quá hạn &amp; Tới hạn</CardTitle>
        {overdue.length === 0 && soon.length === 0 && <div style={{ textAlign: "center", padding: 30, color: C.mintText, fontWeight: 700 }}>🎉 Không có hạng mục quá hạn hay tới hạn!</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {overdue.map((x) => <Row key={x.a.id} {...x} />)}
          {soon.map((x) => <Row key={x.a.id} {...x} />)}
        </div>
      </Card>
      <Card variant="soft">
        <CardTitle icon={CalendarClock} sub="Dự báo từ ngày hoàn thành gần nhất + tần suất thẩm định (tháng)">Lịch tái thẩm định định kỳ</CardTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {requal.map((x) => { const cls = CLS[x.a.cls]; return (
            <div key={x.a.id} className="vmp-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 16, background: "#fff", border: `1px solid ${C.pinkSoft}` }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: x.dleft <= 30 ? C.raspSoft : C.skySoft, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 16, color: x.dleft <= 30 ? C.raspText : C.skyText }}>{x.dleft < 0 ? "!" : x.dleft}</span><span style={{ fontSize: 9, color: C.plumSoft, fontWeight: 700 }}>ngày</span></div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><Tag color={cls.text} bg={cls.soft}>{x.a.vtype}</Tag><span style={{ fontFamily: TEXT, fontSize: 13.5, fontWeight: 800, color: C.plum }}>{x.a.name}</span></div><div style={{ fontSize: 12, color: C.plumSoft, fontWeight: 600, marginTop: 2 }}>Tái thẩm định dự kiến {fmtVN(x.next)} · chu kỳ {x.a.freq} tháng</div></div>
            </div>
          ); })}
          {requal.length === 0 && <div style={{ textAlign: "center", padding: 20, color: C.plumSoft, fontWeight: 600 }}>Chưa có lịch tái thẩm định trong tầm dự báo.</div>}
        </div>
      </Card>
    </div>
  );
}

/* ===================== QRM Risk ===================== */
const CRIT = { Cao: { color: C.rasp, text: C.raspText, soft: C.raspSoft, w: 3 }, TB: { color: C.marigold, text: C.marigoldText, soft: C.marigoldSoft, w: 2 }, Thấp: { color: C.mint, text: C.mintText, soft: C.mintSoft, w: 1 } };
function valStatus(a) { return a.st === "over" ? "Quá hạn" : a.st === "done" ? "Đạt" : "Chưa/Đang"; }
function QrmView({ acts }) {
  const cols = ["Đạt", "Chưa/Đang", "Quá hạn"];
  const rowsC = ["Cao", "TB", "Thấp"];
  const grid = {}; rowsC.forEach((r) => { grid[r] = {}; cols.forEach((c) => grid[r][c] = []); });
  acts.forEach((a) => { if (grid[a.crit]) grid[a.crit][valStatus(a)].push(a); });
  const cellRisk = (crit, col) => { const base = CRIT[crit].w; const sc = col === "Quá hạn" ? 3 : col === "Chưa/Đang" ? 2 : 1; const r = base * sc; return r >= 7 ? C.rasp : r >= 4 ? C.marigold : C.mint; };
  const cellText = (col) => col === C.mint ? C.mintText : col === C.marigold ? C.marigoldText : C.raspText;
  const critCount = rowsC.map((r) => ({ k: r, n: acts.filter((a) => a.crit === r).length }));
  // RPN = Mức nghiêm trọng × Khả năng. Ưu tiên dùng "Điểm trọng yếu" 1–9 thực
  // từ Sheet (chính xác hơn), nếu không có thì suy từ băng rủi ro Cao/TB/Thấp.
  const sevOf = (a) => (a.score != null ? a.score : (CRIT[a.crit] ? CRIT[a.crit].w * 3 : 5));
  const occOf = (a) => (a.st === "over" ? 3 : a.st === "done" ? 0 : a.st === "plan" ? 1 : 2);
  const top = acts.filter((a) => a.st !== "done").map((a) => ({ a, score: sevOf(a) * occOf(a) })).sort((x, y) => y.score - x.score).slice(0, 8);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card>
        <CardTitle icon={ShieldAlert} sub="Theo nguyên tắc quản lý rủi ro chất lượng (ICH Q9 / EU GMP Annex 15) — ưu tiên đối tượng ảnh hưởng GxP cao chưa được thẩm định">Ma trận rủi ro thẩm định (QRM)</CardTitle>
        <div style={{ overflowX: "auto" }} className="vmp-scroll">
          <table style={{ borderCollapse: "separate", borderSpacing: 8, margin: "0 auto" }}>
            <thead><tr><th></th>{cols.map((c) => <th key={c} style={{ fontFamily: TEXT, fontSize: 12.5, fontWeight: 800, color: C.plumSoft, padding: "0 8px" }}>{c}</th>)}</tr></thead>
            <tbody>
              {rowsC.map((rc) => (
                <tr key={rc}>
                  <td style={{ fontFamily: TEXT, fontSize: 12.5, fontWeight: 800, color: CRIT[rc].text, paddingRight: 8, whiteSpace: "nowrap" }}>Ảnh hưởng {rc}</td>
                  {cols.map((c) => { const items = grid[rc][c]; const col = cellRisk(rc, c); return (
                    <td key={c}><div style={{ width: 100, height: 74, borderRadius: 16, background: col + "26", border: `2px solid ${col}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: NUM, fontSize: 26, fontWeight: 800, color: cellText(col) }}>{items.length}</span>
                      <span style={{ fontSize: 10, color: C.plumSoft, fontWeight: 700 }}>hạng mục</span>
                    </div></td>
                  ); })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
          {[[C.mint, "Rủi ro thấp"], [C.marigold, "Rủi ro trung bình"], [C.rasp, "Rủi ro cao — ưu tiên"]].map(([c, l]) => <span key={l} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: C.plum }}><span style={{ width: 14, height: 14, borderRadius: 5, background: c }} />{l}</span>)}
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
        <Card variant="soft">
          <CardTitle icon={Trophy}>Phân bố mức độ tới hạn (criticality)</CardTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Donut size={140} segments={critCount.map((x) => ({ value: x.n, color: CRIT[x.k].color }))} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              {critCount.map((x) => <div key={x.k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: C.plum }}><span style={{ width: 11, height: 11, borderRadius: 999, background: CRIT[x.k].color }} />Ảnh hưởng {x.k}</span><span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 16, color: CRIT[x.k].text }}>{x.n}</span></div>)}
            </div>
          </div>
        </Card>
        <Card variant="strong">
          <CardTitle icon={AlertCircle} sub="Đối tượng ảnh hưởng GxP cao nhưng chưa hoàn thành thẩm định">Rủi ro ưu tiên xử lý</CardTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {top.map((x) => { const cls = CLS[x.a.cls]; return (
              <div key={x.a.id} className="vmp-row" style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 14, background: "#fff", border: `1px solid ${C.raspSoft}` }}>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999, color: "#fff", background: x.score >= 7 ? C.raspText : C.marigoldText }}>RPN {x.score}</span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}><Tag color={cls.text} bg={cls.soft}>{x.a.vtype}</Tag><span style={{ fontFamily: TEXT, fontSize: 13, fontWeight: 800, color: C.plum }}>{x.a.name}</span></div><div style={{ fontSize: 11.5, color: C.plumSoft, fontWeight: 600, marginTop: 1 }}>{x.a.id} · {x.a.dep}</div></div>
                <Pill s={x.a.st} small />
              </div>
            ); })}
            {top.length === 0 && <div style={{ textAlign: "center", padding: 20, color: C.mintText, fontWeight: 700 }}>Không còn rủi ro cao tồn đọng 🎉</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ===================== Inventory (Danh mục 5 nhóm) + sửa/ghi ngược ===================== */
function objStatus(code, acts) {
  const list = acts.filter((a) => a.code === code);
  if (!list.length) return "plan";
  if (list.some((a) => a.st === "over")) return "over";
  if (list.every((a) => a.st === "done")) return "done";
  if (list.some((a) => a.st === "prog")) return "prog";
  return "todo";
}
const FIELD = { display: "flex", flexDirection: "column", gap: 6 };
const LBL = { fontSize: 12, fontWeight: 800, color: C.plumSoft };
const INP = { padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${C.pinkSoft}`, background: "#fff", fontFamily: TEXT, fontSize: 14, color: C.plum, fontWeight: 600, outline: "none", width: "100%" };
function EditObjModal({ obj, isNew, onClose, onSave }) {
  const [f, setF] = useState(obj);
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const sel = (k, opts) => <select value={f[k]} onChange={(e) => up(k, e.target.value)} style={INP}>{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>;
  return (
    <Modal onClose={onClose} title={isNew ? "Thêm đối tượng" : "Sửa đối tượng"} icon={Pencil} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={FIELD}><span style={LBL}>Mã đối tượng</span><input style={{ ...INP, background: isNew ? "#fff" : C.pinkSoft }} value={f.code} disabled={!isNew} onChange={(e) => up("code", e.target.value)} /></div>
        <div style={FIELD}><span style={LBL}>Nhóm</span>{sel("cls", Object.keys(CLS).map((k) => ({ v: k, l: CLS[k].label })))}</div>
        <div style={{ ...FIELD, gridColumn: "1 / -1" }}><span style={LBL}>Tên đối tượng</span><input style={INP} value={f.name} onChange={(e) => up("name", e.target.value)} /></div>
        <div style={FIELD}><span style={LBL}>Bộ phận quản lý</span>{sel("dept", DEPTS.map((d) => ({ v: d.id, l: d.name })))}</div>
        <div style={FIELD}><span style={LBL}>Khu vực</span><input style={INP} value={f.area} onChange={(e) => up("area", e.target.value)} /></div>
        <div style={FIELD}><span style={LBL}>Mức ảnh hưởng (criticality)</span>{sel("crit", [{ v: "Cao", l: "Cao" }, { v: "TB", l: "Trung bình" }, { v: "Thấp", l: "Thấp" }])}</div>
        <div style={FIELD}><span style={LBL}>Tần suất thẩm định (tháng)</span><input type="number" style={INP} value={f.freq} onChange={(e) => up("freq", Number(e.target.value))} /></div>
        <div style={FIELD}><span style={LBL}>Phân loại GxP</span>{sel("gxp", [{ v: "GxP", l: "GxP" }, { v: "Non-GxP", l: "Non-GxP" }])}</div>
        <div style={FIELD}><span style={LBL}>Cần thẩm định?</span>{sel("need", [{ v: true, l: "Có (Y)" }, { v: false, l: "Không (N)" }])}</div>
        <div style={{ ...FIELD, gridColumn: "1 / -1" }}><span style={LBL}>Lý do / ghi chú thẩm định</span><textarea rows={3} style={{ ...INP, resize: "vertical", fontWeight: 500 }} value={f.reason} onChange={(e) => up("reason", e.target.value)} /></div>
      </div>
      <button onClick={() => { if (!f.code || !f.name) return; onSave({ ...f, need: f.need === true || f.need === "true" }, isNew); }} style={{ ...btnPrimary, marginTop: 18, padding: "13px", borderRadius: 14, fontSize: 14.5, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Save size={17} /> Lưu &amp; đồng bộ Google Sheet</button>
    </Modal>
  );
}
/* ===== DASHBOARD tier: nhập tiến độ thực tế (mọi tài khoản) ===== */
const TT_OPTS = ["", "Chưa thực hiện", "Đang thực hiện", "Hoàn thành"];
function ROField({ label, value }) {
  return <div style={FIELD}><span style={LBL}>{label}</span><div style={{ ...INP, background: C.lavSoft, color: C.plumSoft, borderColor: C.lavSoft, display: "flex", alignItems: "center", minHeight: 20 }}>{value || "—"}</div></div>;
}
function ProgressEditModal({ act, onClose, onSave }) {
  const raw = act._raw || {};
  const init = {
    ngay_de_cuong: toISO(raw.ngay_de_cuong), tt_de_cuong: raw.tt_de_cuong || "",
    lich_td: raw.lich_td || "",
    ngay_tham_dinh: toISO(raw.ngay_tham_dinh), tt_tham_dinh: raw.tt_tham_dinh || "",
    ngay_bao_cao: toISO(raw.ngay_bao_cao), tt_bao_cao: raw.tt_bao_cao || "",
    ngay_vmp: toISO(raw.ngay_vmp), tt_vmp: raw.tt_vmp || "",
  };
  const [f, setF] = useState(init);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const sel = (k) => <select value={f[k]} onChange={set(k)} style={{ ...INP, cursor: "pointer" }}>{TT_OPTS.map((o) => <option key={o} value={o}>{o || "— Chưa nhập —"}</option>)}</select>;
  const dt = (k) => <input type="date" value={f[k]} onChange={set(k)} style={INP} />;
  const stage = (title, dl, dCol, tCol) => (
    <div style={{ background: "#fff", borderRadius: 14, padding: 14, border: `1.5px solid ${C.pinkSoft}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 800, color: C.plum, fontSize: 14 }}>{title}</span>
        {dl && <Tag color={C.lavText} bg={C.lavSoft}>Deadline: {dl}</Tag>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={FIELD}><span style={LBL}>Ngày hoàn thành thực tế</span>{dt(dCol)}</div>
        <div style={FIELD}><span style={LBL}>Trạng thái</span>{sel(tCol)}</div>
      </div>
    </div>
  );
  return (
    <Modal onClose={onClose} title="Cập nhật tiến độ" icon={Pencil} wide>
      <div style={{ background: C.lavSoft, borderRadius: 14, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, color: C.plum, fontSize: 15 }}>{act.code} · {act.name}</div>
        <div style={{ fontSize: 12.5, color: C.plumSoft, fontWeight: 600, marginTop: 3 }}>{act.vtype} · ID: {act.id} · QA: {act.owner}{act.score != null ? ` · Trọng yếu: ${act.score}/9` : ""}{act.effort != null ? ` · ${act.effort} ngày công` : ""}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <ROField label="Deadline VMP (T) · gốc" value={toISO(raw.dl_vmp) || act.target} />
        <div style={FIELD}><span style={LBL}>Lịch thẩm định (bộ phận xếp)</span><input value={f.lich_td} onChange={set("lich_td")} placeholder="dd/mm/yyyy hh:mm" style={INP} /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {stage("1. Đề cương", toISO(raw.dl_de_cuong), "ngay_de_cuong", "tt_de_cuong")}
        {stage("2. Thẩm định thực tế", toISO(raw.dl_tham_dinh), "ngay_tham_dinh", "tt_tham_dinh")}
        {stage("3. Báo cáo", toISO(raw.dl_bao_cao), "ngay_bao_cao", "tt_bao_cao")}
        {stage("4. Tổng kết VMP", "", "ngay_vmp", "tt_vmp")}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 13, border: `1.5px solid ${C.pinkSoft}`, background: "#fff", color: C.plumSoft, fontFamily: TEXT, fontWeight: 800, cursor: "pointer" }}>Hủy</button>
        <button onClick={() => { onSave(act.id, f); onClose(); }} style={{ ...btnPrimary, flex: 2, padding: "12px", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Save size={17} /> Lưu & ghi vào Sheet</button>
      </div>
    </Modal>
  );
}
function UpdateView({ acts, conn, isAdmin, onUpdate }) {
  const [q, setQ] = useState("");
  const [fst, setFst] = useState("all");
  const [edit, setEdit] = useState(null);
  const list = acts.filter((a) => {
    if (fst !== "all" && a.st !== fst) return false;
    if (!q) return true;
    const s = (q || "").toLowerCase();
    return [a.code, a.name, a.owner, a.id, a.vtype].some((x) => String(x || "").toLowerCase().includes(s));
  });
  const linked = conn.status === "ok" && conn.writeUrl;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: C.mintSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><Pencil size={22} color={C.mintText} /></div>
            <div>
              <div style={{ fontFamily: TEXT, fontWeight: 800, fontSize: 17, color: C.plum }}>Nhập tiến độ thực tế</div>
              <div style={{ fontSize: 12.5, color: C.plumSoft, fontWeight: 600 }}>Mọi tài khoản đều cập nhật được ngày &amp; trạng thái · ghi thẳng vào Google Sheet</div>
            </div>
          </div>
          <Tag color={linked ? C.mintText : C.marigoldText} bg={linked ? C.mintSoft : C.marigoldSoft}>{linked ? "● Đã nối Sheet (ghi trực tiếp)" : "○ Chưa nối — lưu tạm tại chỗ"}</Tag>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={16} color={C.plumSoft} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo mã, tên, QA, ID…" style={{ ...INP, paddingLeft: 36 }} />
          </div>
          <select value={fst} onChange={(e) => setFst(e.target.value)} style={{ ...INP, cursor: "pointer", maxWidth: 200 }}>
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        {conn.msg && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 12, background: C.lavSoft, color: C.plum, fontSize: 12.5, fontWeight: 700 }}>{conn.msg}</div>}
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div className="vmp-scroll" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: TEXT, minWidth: 720 }}>
            <thead><tr style={{ background: C.pinkMist }}>
              {["Mã", "Tên đối tượng", "Loại", "QA", "Deadline VMP", "Trạng thái", ""].map((h, i) => <th key={i} style={{ textAlign: i > 4 ? "center" : "left", padding: "13px 16px", fontSize: 12, fontWeight: 800, color: C.plumSoft, whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map((a, i) => (
                <tr key={a.id} style={{ borderTop: `1px solid ${C.pinkSoft}`, background: i % 2 ? "rgba(255,255,255,.4)" : "transparent" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 800, color: C.plum, fontSize: 13 }}>{a.code}</td>
                  <td style={{ padding: "12px 16px", color: C.plum, fontSize: 13 }}>{a.name}</td>
                  <td style={{ padding: "12px 16px" }}><Tag color={C.lavText} bg={C.lavSoft}>{a.vtype}</Tag></td>
                  <td style={{ padding: "12px 16px", color: C.plumSoft, fontSize: 13, fontWeight: 600 }}>{a.owner}</td>
                  <td style={{ padding: "12px 16px", color: C.plumSoft, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{a.target ? a.target.split("-").reverse().join("/") : "—"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}><Pill s={a.st} small /></td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <button onClick={() => setEdit(a)} style={{ ...btnPrimary, padding: "7px 14px", borderRadius: 10, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}><Pencil size={13} /> Cập nhật</button>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: C.plumSoft, fontWeight: 600 }}>Không có hạng mục phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <div style={{ fontSize: 12, color: C.plumSoft, fontWeight: 600, padding: "0 4px", lineHeight: 1.6 }}>
        Chỉ sửa được <b style={{ color: C.mintText }}>ngày &amp; trạng thái thực tế</b> (tầng Dashboard). Các <b style={{ color: C.lavText }}>Deadline tự tính</b> (T-60 / T-5-BC / T-5) chỉ hiển thị để tham chiếu. Sửa danh mục gốc (mã, tên, phân công…) {isAdmin ? "ở mục Danh mục đối tượng (bạn là admin)." : "cần quyền admin."}
      </div>
      {edit && <ProgressEditModal act={edit} onClose={() => setEdit(null)} onSave={onUpdate} />}
    </div>
  );
}


function InventoryView({ objects, acts, canEdit, onSave, onDelete, conn }) {
  const [q, setQ] = useState(""); const [cls, setCls] = useState("all"); const [edit, setEdit] = useState(null);
  const filtered = useMemo(() => objects.filter((o) => (o.name + o.code).toLowerCase().includes(q.toLowerCase()) && (cls === "all" || o.cls === cls)), [objects, q, cls]);
  const counts = Object.keys(CLS).reduce((m, k) => { m[k] = objects.filter((o) => o.cls === k).length; return m; }, {});
  const head = ["Mã", "Tên / Lý do thẩm định", "Nhóm", "Bộ phận", "Khu vực", "Ảnh hưởng", "Chu kỳ", "TĐ?", "Trạng thái", ""];
  const ClsTab = ({ id, label, n }) => <button onClick={() => setCls(id)} style={{ padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: TEXT, fontSize: 12.5, fontWeight: 800, background: cls === id ? GRAD : C.pinkSoft, color: cls === id ? "#fff" : C.plumSoft, display: "flex", alignItems: "center", gap: 7 }}>{label}<span style={{ fontFamily: NUM, fontSize: 12, padding: "0 6px", borderRadius: 999, background: cls === id ? "rgba(255,255,255,.25)" : "#fff", color: cls === id ? "#fff" : C.plumSoft }}>{n}</span></button>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {edit && <EditObjModal {...edit} onClose={() => setEdit(null)} onSave={(o, isNew) => { onSave(o, isNew); setEdit(null); }} />}
      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <ClsTab id="all" label="Tất cả" n={objects.length} />
          {Object.keys(CLS).map((k) => <ClsTab key={k} id={k} label={CLS[k].label} n={counts[k]} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 15px", borderRadius: 12, border: `1.5px solid ${C.pinkSoft}`, flex: 1, minWidth: 220, background: "#fff" }}><Search size={16} color={C.pink} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc mã đối tượng…" style={{ border: "none", outline: "none", background: "transparent", fontFamily: TEXT, fontSize: 14, color: C.plum, width: "100%", fontWeight: 600 }} /></div>
          {!conn.readUrl && <Tag color={C.marigoldText} bg={C.marigoldSoft}>● Dữ liệu demo</Tag>}
          {conn.readUrl && <Tag color={C.mintText} bg={C.mintSoft}>● Đã kết nối Sheet</Tag>}
          <button disabled={!canEdit} onClick={() => setEdit({ obj: { code: "", name: "", cls: "tb", dept: "sx", area: "", grade: "—", gxp: "GxP", crit: "TB", freq: 12, need: true, reason: "" }, isNew: true })} title={canEdit ? "" : "Bạn chỉ có quyền xem"} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, border: "none", cursor: canEdit ? "pointer" : "not-allowed", background: canEdit ? GRAD : C.pinkSoft, color: canEdit ? "#fff" : C.plumSoft, fontFamily: TEXT, fontWeight: 800, fontSize: 13, marginLeft: "auto", opacity: canEdit ? 1 : .8 }}><Plus size={15} /> Thêm đối tượng</button>
        </div>
      </Card>
      <Card variant="strong">
        <CardTitle icon={Boxes} sub="Lấy từ các sheet Danh sách của bạn — chỉnh sửa tại đây sẽ ghi ngược lên Google Sheet">Danh mục đối tượng thẩm định ({filtered.length})</CardTitle>
        <div style={{ overflowX: "auto" }} className="vmp-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: TEXT, minWidth: 880 }}>
            <thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: i >= 2 && i <= 8 ? "center" : "left", fontSize: 11, color: C.plumSoft, fontWeight: 800, letterSpacing: 0.5, padding: "0 12px 13px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map((o, i) => { const cl = CLS[o.cls]; const dp = DEPTS.find((d) => d.id === o.dept); const st = objStatus(o.code, acts); const ct = CRIT[o.crit] || CRIT.TB; return (
              <tr key={o.code} className="vmp-row" style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "13px 12px" }}><span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: cl.text, background: cl.soft, padding: "3px 8px", borderRadius: 8 }}>{o.code}</span></td>
                <td style={{ padding: "13px 12px", maxWidth: 280 }}><div style={{ fontSize: 13.5, color: C.plum, fontWeight: 700 }}>{o.name}</div><div style={{ fontSize: 11.5, color: C.plumSoft, marginTop: 2, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{o.reason}</div></td>
                <td style={{ padding: "13px 12px", textAlign: "center" }}><Tag color={cl.text} bg={cl.soft}>{cl.label}</Tag></td>
                <td style={{ padding: "13px 12px", textAlign: "center", fontSize: 13, color: C.plumSoft, fontWeight: 700 }}>{dp ? dp.short : "—"}</td>
                <td style={{ padding: "13px 12px", textAlign: "center", fontSize: 13, color: C.plumSoft, fontWeight: 700 }}>{o.area}</td>
                <td style={{ padding: "13px 12px", textAlign: "center" }}><Tag color={ct.text} bg={ct.soft}>{o.crit}</Tag></td>
                <td style={{ padding: "13px 12px", textAlign: "center", fontFamily: NUM, fontSize: 14, fontWeight: 800, color: C.plum }}>{o.freq > 0 ? o.freq + "th" : "—"}</td>
                <td style={{ padding: "13px 12px", textAlign: "center" }}>{o.need ? <CheckCircle2 size={17} color={C.mintText} /> : <span style={{ color: "#C9B6C7", fontWeight: 700 }}>—</span>}</td>
                <td style={{ padding: "13px 12px", textAlign: "center" }}><Pill s={st} small /></td>
                <td style={{ padding: "13px 12px" }}><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button disabled={!canEdit} onClick={() => setEdit({ obj: o, isNew: false })} style={{ width: 32, height: 32, borderRadius: 9, border: "none", cursor: canEdit ? "pointer" : "not-allowed", background: C.lavSoft, display: "flex", alignItems: "center", justifyContent: "center", opacity: canEdit ? 1 : .5 }}><Pencil size={15} color={C.lavText} /></button>
                  <button disabled={!canEdit} onClick={() => { if (window.confirm(`Xoá đối tượng ${o.code}?`)) onDelete(o.code); }} style={{ width: 32, height: 32, borderRadius: 9, border: "none", cursor: canEdit ? "pointer" : "not-allowed", background: C.raspSoft, display: "flex", alignItems: "center", justifyContent: "center", opacity: canEdit ? 1 : .5 }}><Trash2 size={15} color={C.raspText} /></button>
                </div></td>
              </tr>
            ); })}</tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.plumSoft, fontWeight: 600 }}>Không tìm thấy đối tượng phù hợp.</div>}
        </div>
      </Card>
    </div>
  );
}

/* ===================== Reports + AI ===================== */
const PLABEL = { tuan: { t: "BÁO CÁO TUẦN", p: "Tuần 23/2026 (02/06 – 08/06/2026)" }, thang: { t: "BÁO CÁO THÁNG", p: "Tháng 5/2026" }, quy: { t: "BÁO CÁO QUÝ", p: "Quý II/2026" } };
function download(filename, content, mime) { const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); }
function buildReportHTML(period, scopeLabel, e, d, deptRows, overdueList, ai) {
  const pl = PLABEL[period];
  const row = (lbl, x) => `<tr><td>${lbl}</td><td style="text-align:center;color:#1A7058;font-weight:700">${x.done}</td><td style="text-align:center;color:#BE3357;font-weight:700">${x.over}</td><td style="text-align:center;color:#985E0E;font-weight:700">${x.todo}</td><td style="text-align:center;font-weight:700">${x.total}</td><td style="text-align:center;font-weight:700">${x.rate}%</td></tr>`;
  const dRows = deptRows.length ? `<h3>Chi tiết theo bộ phận (thẩm định thực tế)</h3><table><thead><tr><th>Bộ phận</th><th>Hoàn thành</th><th>Quá hạn</th><th>Chưa HT</th><th>Tổng</th><th>Tỷ lệ</th></tr></thead><tbody>${deptRows.map((r) => row(r.name, r)).join("")}</tbody></table>` : "";
  const ov = overdueList.length ? `<h3>Hạng mục quá hạn cần xử lý</h3><ul>${overdueList.map((o) => `<li><b>${o.id}</b> — ${o.name} (mốc ${o.stage}, trễ ${Math.abs(o.dleft)} ngày)</li>`).join("")}</ul>` : "";
  const aiBlock = ai ? `<div class="ai"><h2>NHẬN XÉT & ĐÁNH GIÁ (AI)</h2><div class="warn">⚠ Nội dung do AI khởi tạo — cần QA/Validation xác nhận trước khi dùng chính thức.</div><div style="white-space:pre-wrap">${ai.replace(/</g, "&lt;")}</div></div>` : `<p style="color:#888"><i>(Chưa tạo nhận xét AI)</i></p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${pl.t} — CPC1 HN</title><style>body{font-family:'Segoe UI',Arial,sans-serif;color:#4E2A4E;max-width:820px;margin:24px auto;padding:0 28px;line-height:1.6}h1{font-size:22px;margin-bottom:2px}h2{font-size:15px;color:#B43A6E;border-bottom:2px solid #C2497A;padding-bottom:6px;margin-top:26px}h3{font-size:13.5px;color:#6B4DB3;margin-top:20px}.sub{color:#6E4869;font-size:13px;margin-bottom:18px}table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}th,td{border:1px solid #f0dbe7;padding:8px 10px}th{background:#FCE3EF;text-align:left}.ai{background:#FDEEF6;border-left:4px solid #C2497A;padding:14px 18px;border-radius:8px;margin-top:16px}.warn{color:#BE3357;font-size:12px;font-weight:700;margin-bottom:10px}.head{display:flex;align-items:center;gap:14px;border-bottom:3px solid #C2497A;padding-bottom:14px}.badge{display:inline-block;background:#B43A6E;color:#fff;font-weight:700;border-radius:8px;padding:8px 12px;font-size:13px}.foot{margin-top:30px;border-top:1px solid #f0dbe7;padding-top:12px;color:#999;font-size:11.5px}ul{margin:8px 0}</style></head><body><div class="head"><span class="badge">CPC1 HN</span><div><h1>${pl.t} — TIẾN ĐỘ THẨM ĐỊNH</h1><div class="sub">${pl.p} · Phạm vi: ${scopeLabel} · V/Q Team — QLCL</div></div></div><h2>SỐ LIỆU TỔNG HỢP</h2><table><thead><tr><th>Nhóm theo dõi</th><th>Hoàn thành</th><th>Quá hạn</th><th>Chưa HT</th><th>Tổng</th><th>Tỷ lệ HT</th></tr></thead><tbody>${row("Thẩm định thực tế", e)}${row("Hoàn thiện hồ sơ", d)}</tbody></table>${dRows}${ov}${aiBlock}<div class="foot">Tạo bởi VMP Monitor · CPC1 HN · ${new Date().toLocaleString("vi-VN")} · Tài liệu nội bộ, tuân thủ EU GMP Annex 15 / WHO / PIC/S.</div></body></html>`;
}
function ReportsView({ acts }) {
  const [period, setPeriod] = useState("thang"); const [scope, setScope] = useState("all"); const [ai, setAi] = useState(""); const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const scoped = scope === "all" ? acts : acts.filter((a) => a.dept === scope);
  const e = tally(scoped), d = docTally(scoped);
  const scopeLabel = scope === "all" ? "Toàn nhà máy" : DEPTS.find((x) => x.id === scope).name;
  const deptRows = scope === "all" ? DEPTS.map((dp) => ({ name: dp.name, ...tally(acts.filter((a) => a.dept === dp.id)) })).filter((r) => r.total > 0) : [];
  const overdueList = scoped.map((a) => a.alert && a.alert.kind === "over" ? { id: a.id, name: a.name, stage: a.alert.stage, dleft: a.alert.dleft } : null).filter(Boolean);
  // Phân bổ tải theo người phụ trách (dùng cột "Số ngày công")
  const owners = [...new Set(scoped.map((a) => a.owner).filter((o) => o && o !== "—"))];
  const workload = owners.map((o) => { const list = scoped.filter((a) => a.owner === o); const md = list.reduce((s2, a) => s2 + (a.effort || 0), 0); const tw = tally(list); return { owner: o, n: list.length, md, rate: tw.rate, over: tw.over }; }).sort((a, b) => b.md - a.md);
  const maxMd = Math.max(1, ...workload.map((w) => w.md));
  const pl = PLABEL[period];
  const html = () => buildReportHTML(period, scopeLabel, e, d, deptRows, overdueList, ai);
  const generate = async () => {
    setLoading(true); setErr(""); setAi("");
    const deptStr = deptRows.length ? "Theo bộ phận: " + deptRows.map((r) => `${r.name} (HT ${r.done}, quá hạn ${r.over}, tỷ lệ ${r.rate}%)`).join("; ") : "";
    const ovStr = overdueList.length ? "Quá hạn: " + overdueList.map((o) => `${o.id} (mốc ${o.stage}, trễ ${Math.abs(o.dleft)} ngày)`).join("; ") : "Không có hạng mục quá hạn.";
    const prompt = `Bạn là chuyên gia QA/GMP dược phẩm. Viết phần "NHẬN XÉT & ĐÁNH GIÁ" cho ${pl.t} (${pl.p}) về tiến độ thẩm định tại nhà máy CPC1 HN, bằng tiếng Việt, văn phong chuyên nghiệp, súc tích, DỰA CHÍNH XÁC số liệu bên dưới (không bịa thêm). Trình bày 4 mục, mỗi mục tiêu đề IN HOA: 1. TÓM TẮT TỔNG QUAN 2. ĐIỂM TÍCH CỰC 3. VẤN ĐỀ & RỦI RO (nhấn mạnh hạng mục quá hạn; lưu ý hồ sơ thường chậm hơn thẩm định thực tế) 4. KHUYẾN NGHỊ HÀNH ĐỘNG. Chỉ trả về nội dung văn bản.

SỐ LIỆU (phạm vi: ${scopeLabel}):
THẨM ĐỊNH THỰC TẾ: Hoàn thành ${e.done}, Quá hạn ${e.over}, Chưa HT ${e.todo}, Tổng ${e.total}, Tỷ lệ ${e.rate}%.
HOÀN THIỆN HỒ SƠ: Hoàn thành ${d.done}, Quá hạn ${d.over}, Chưa HT ${d.todo}, Tổng ${d.total}, Tỷ lệ ${d.rate}%.
${deptStr}
${ovStr}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
      const json = await res.json(); const text = (json.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (text) setAi(text); else setErr("Không nhận được phản hồi từ AI. Vui lòng thử lại.");
    } catch (ex) { setErr("Lỗi kết nối AI: " + (ex && ex.message ? ex.message : "không xác định")); } finally { setLoading(false); }
  };
  const printPDF = () => { const ifr = document.createElement("iframe"); ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(ifr); const dd = ifr.contentWindow.document; dd.open(); dd.write(html()); dd.close(); setTimeout(() => { try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (ex) {} setTimeout(() => document.body.removeChild(ifr), 1500); }, 400); };
  const Seg = ({ id, label }) => <button onClick={() => setPeriod(id)} style={{ padding: "10px 17px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: TEXT, fontSize: 13, fontWeight: 800, background: period === id ? GRAD : C.pinkSoft, color: period === id ? "#fff" : C.plumSoft }}>{label}</button>;
  const ExpBtn = ({ icon: Icon, label, onClick, bg, color }) => <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 12, border: "none", cursor: "pointer", background: bg, color, fontFamily: TEXT, fontWeight: 800, fontSize: 13 }}><Icon size={16} /> {label}</button>;
  const statRow = (lbl, x, dotc) => <tr style={{ borderTop: `1px solid ${C.line}` }}><td style={{ padding: "13px", fontSize: 13.5, fontWeight: 800, color: C.plum }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 999, background: dotc, marginRight: 8 }} />{lbl}</td><td style={{ padding: "13px", textAlign: "center", color: C.mintText, fontWeight: 800 }}>{x.done}</td><td style={{ padding: "13px", textAlign: "center", color: C.raspText, fontWeight: 800 }}>{x.over}</td><td style={{ padding: "13px", textAlign: "center", color: C.marigoldText, fontWeight: 800 }}>{x.todo}</td><td style={{ padding: "13px", textAlign: "center", fontWeight: 800, color: C.plum, fontFamily: NUM }}>{x.total}</td><td style={{ padding: "13px", textAlign: "center" }}><span style={{ fontFamily: NUM, fontWeight: 800, color: "#fff", background: C.mintText, padding: "4px 11px", borderRadius: 999, fontSize: 12.5 }}>{x.rate}%</span></td></tr>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card>
        <CardTitle icon={FileBarChart}>Thiết lập báo cáo</CardTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-end" }}>
          <div><div style={{ fontSize: 12.5, color: C.plumSoft, fontWeight: 800, marginBottom: 9 }}>Kỳ báo cáo</div><div style={{ display: "flex", gap: 8 }}><Seg id="tuan" label="Tuần" /><Seg id="thang" label="Tháng" /><Seg id="quy" label="Quý" /></div></div>
          <div><div style={{ fontSize: 12.5, color: C.plumSoft, fontWeight: 800, marginBottom: 9 }}>Phạm vi</div><select value={scope} onChange={(e2) => { setScope(e2.target.value); setAi(""); }} style={{ ...glass, borderRadius: 12, padding: "11px 16px", fontFamily: TEXT, fontSize: 14, color: C.plum, fontWeight: 700, cursor: "pointer", outline: "none" }}><option value="all">Toàn nhà máy</option>{DEPTS.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}</select></div>
          <button onClick={generate} disabled={loading} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 9, padding: "13px 24px", borderRadius: 14, cursor: loading ? "wait" : "pointer", fontSize: 14.5, boxShadow: "0 8px 20px rgba(190,69,116,.3)" }}>{loading ? <RefreshCw size={17} className="spin" /> : <SparkIcon size={17} />} {loading ? "AI đang phân tích…" : "Tạo nhận xét AI"}</button>
        </div>
      </Card>
      <Card variant="strong">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ background: C.pinkText, color: "#fff", fontWeight: 800, borderRadius: 10, padding: "8px 12px", fontSize: 12.5 }}>CPC1 HN</span><div><div style={{ fontFamily: TEXT, fontSize: 19, fontWeight: 800, color: C.plum }}>{pl.t} — Tiến độ Thẩm định</div><div style={{ fontSize: 12.5, color: C.plumSoft, fontWeight: 700 }}>{pl.p} · {scopeLabel}</div></div></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><ExpBtn icon={Printer} label="Xuất PDF" onClick={printPDF} bg={GRAD} color="#fff" /><ExpBtn icon={Download} label="Tải .DOC" onClick={() => download(`BaoCao_${period}_CPC1HN.doc`, html(), "application/msword")} bg={C.lavSoft} color={C.lavText} /><ExpBtn icon={Download} label="Tải .HTML" onClick={() => download(`BaoCao_${period}_CPC1HN.html`, html(), "text/html")} bg={C.mintSoft} color={C.mintText} /></div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: TEXT, marginBottom: 6 }}><thead><tr>{["Nhóm theo dõi", "Hoàn thành", "Quá hạn", "Chưa HT", "Tổng", "Tỷ lệ"].map((h, i) => <th key={i} style={{ textAlign: i === 0 ? "left" : "center", fontSize: 11, color: C.plumSoft, fontWeight: 800, letterSpacing: 0.5, padding: "0 13px 13px", textTransform: "uppercase" }}>{h}</th>)}</tr></thead><tbody>{statRow("Thẩm định thực tế", e, C.mint)}{statRow("Hoàn thiện hồ sơ", d, C.sky)}</tbody></table>
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, flexWrap: "wrap" }}><SparkIcon size={18} color={C.pink} /><span style={{ fontFamily: TEXT, fontSize: 17, fontWeight: 800, color: C.plum }}>Nhận xét &amp; Đánh giá (AI)</span><Tag color={C.raspText} bg={C.raspSoft}>Cần QA xác nhận</Tag></div>
          {err && <div style={{ color: C.raspText, fontSize: 13.5, fontWeight: 800, padding: "13px 15px", borderRadius: 12, background: C.raspSoft, display: "flex", alignItems: "center", gap: 8 }}><AlertCircle size={16} /> {err}</div>}
          {loading && <div style={{ padding: "32px", textAlign: "center", color: C.plumSoft, fontSize: 14, fontWeight: 700 }}><RefreshCw size={22} className="spin" color={C.pink} /><div style={{ marginTop: 10 }}>Công chúa đang nhờ Claude phân tích số liệu…</div></div>}
          {!loading && !err && ai && <div style={{ whiteSpace: "pre-wrap", fontFamily: TEXT, fontSize: 14, color: C.plum, lineHeight: 1.8, fontWeight: 500, background: C.pinkMist, borderLeft: `4px solid ${C.pink}`, borderRadius: "0 14px 14px 0", padding: "18px 22px" }}>{ai}</div>}
          {!loading && !err && !ai && <div style={{ padding: "28px", textAlign: "center", color: C.plumSoft, fontSize: 14, fontWeight: 700, border: `2px dashed ${C.pinkSoft}`, borderRadius: 16 }}>Bấm <b style={{ color: C.pinkText }}>"Tạo nhận xét AI"</b> để Claude tự động phân tích và viết nhận xét cho báo cáo.</div>}
        </div>
      </Card>
      {workload.length > 0 && (
        <Card>
          <CardTitle icon={Trophy} sub="Tổng ngày công & tiến độ theo người phụ trách — cân đối lịch VMP">Phân bổ tải nhân sự</CardTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workload.map((w) => (
              <div key={w.owner} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 64, fontWeight: 800, color: C.plum, fontSize: 13.5, flexShrink: 0 }}>{w.owner}</div>
                <div style={{ flex: 1, background: C.pinkSoft, borderRadius: 999, height: 26, position: "relative", overflow: "hidden", minWidth: 120 }}>
                  <div style={{ width: `${(w.md / maxMd) * 100}%`, height: "100%", background: GRAD, borderRadius: 999, transition: "width .4s" }} />
                  <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 11.5, fontWeight: 800, color: C.plum, whiteSpace: "nowrap" }}>{w.md} ngày công · {w.n} hạng mục</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  <Tag color={C.mintText} bg={C.mintSoft}>HT {w.rate}%</Tag>
                  {w.over > 0 && <Tag color={C.raspText} bg={C.raspSoft}>Trễ {w.over}</Tag>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 11.5, color: C.plumSoft, fontWeight: 600, lineHeight: 1.6 }}>Nguồn: cột <b style={{ color: C.plum }}>Số ngày công</b> × người phụ trách. Thanh dài nhất = gánh nhiều nhất; nếu lệch nhiều, cân nhắc dời Deadline VMP hoặc đổi người để cân tải.</div>
        </Card>
      )}
    </div>
  );
}

/* ===================== Kết nối Google Sheet ===================== */
function ConnectView({ conn, onConnect, onTestWrite, onReset }) {
  const [rUrl, setRUrl] = useState(conn.readUrl); const [wUrl, setWUrl] = useState(conn.writeUrl);
  const inp = (val, set, ph) => <input value={val} onChange={(e) => set(e.target.value)} placeholder={ph} style={{ ...INP, fontFamily: "monospace", fontSize: 12.5 }} />;
  const sc = conn.status === "ok" ? C.mintText : conn.status === "err" ? C.raspText : conn.status === "loading" ? C.skyText : C.marigoldText;
  const sb = conn.status === "ok" ? C.mintSoft : conn.status === "err" ? C.raspSoft : conn.status === "loading" ? C.skySoft : C.marigoldSoft;
  const sl = conn.status === "ok" ? "Đã kết nối" : conn.status === "err" ? "Lỗi kết nối" : conn.status === "loading" ? "Đang tải…" : "Chế độ demo (chưa kết nối)";
  const Step = ({ n, children }) => <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}><div style={{ width: 26, height: 26, borderRadius: 999, background: GRAD, color: "#fff", fontFamily: NUM, fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div><div style={{ fontSize: 13, color: C.plum, fontWeight: 600, lineHeight: 1.6 }}>{children}</div></div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card variant="strong">
        <CardTitle icon={Cloud} sub="Đọc dữ liệu từ Google Sheet và ghi ngược lại khi chỉnh sửa trên web (2 chiều)">Kết nối dữ liệu Google Sheet</CardTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 14, background: sb, marginBottom: 18, flexWrap: "wrap" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: sc }} /><span style={{ fontFamily: TEXT, fontWeight: 800, fontSize: 14, color: sc }}>{sl}</span>
          {conn.msg && <span style={{ fontSize: 12.5, color: C.plum, fontWeight: 600, marginLeft: "auto" }}>{conn.msg}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={FIELD}><span style={LBL}>① URL ĐỌC dữ liệu (GET) — webhook n8n hoặc Apps Script Web App</span>{inp(rUrl, setRUrl, "https://…/exec  hoặc  https://…/webhook/vmp-read")}</div>
          <div style={FIELD}><span style={LBL}>② URL GHI dữ liệu (POST) — có thể trùng URL trên nếu dùng Apps Script</span>{inp(wUrl, setWUrl, "https://…/exec  hoặc  https://…/webhook/vmp-write")}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => onConnect(rUrl.trim(), wUrl.trim())} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 13, fontSize: 14 }}><Link2 size={16} /> Kết nối &amp; tải dữ liệu</button>
            <button onClick={() => onTestWrite(wUrl.trim())} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 13, border: "none", cursor: "pointer", background: C.lavSoft, color: C.lavText, fontFamily: TEXT, fontWeight: 800, fontSize: 14 }}><Save size={16} /> Kiểm tra ghi</button>
            <button onClick={onReset} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 13, border: "none", cursor: "pointer", background: C.pinkSoft, color: C.pinkText, fontFamily: TEXT, fontWeight: 800, fontSize: 14 }}><RefreshCw size={16} /> Khôi phục demo</button>
          </div>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
        <Card variant="soft">
          <CardTitle icon={Link2}>Cách hoạt động (kiến trúc đồng bộ)</CardTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap", padding: "14px", borderRadius: 14, background: "#fff", fontFamily: TEXT, fontWeight: 800, fontSize: 13, color: C.plum }}><span>📊 Google Sheet</span><ChevronRight size={16} color={C.pink} /><span>🔁 n8n / Apps Script</span><ChevronRight size={16} color={C.pink} /><span>🖥️ VMP Monitor</span></div>
            <Step n="1">App gọi <b>GET</b> tới URL ① → nhận JSON <code>{`{objects, activities}`}</code> và hiển thị.</Step>
            <Step n="2">Khi Thêm/Sửa/Xoá đối tượng → app gửi <b>POST</b> tới URL ② → ghi ngược vào Google Sheet.</Step>
            <Step n="3">n8n lập lịch đồng bộ + gửi cảnh báo (Telegram/email) theo quy tắc T‑60/T‑5.</Step>
          </div>
        </Card>
        <Card variant="soft">
          <CardTitle icon={FileText}>Định dạng dữ liệu &amp; lưu ý</CardTitle>
          <div style={{ fontFamily: "monospace", fontSize: 12, background: "#fff", border: `1.5px solid ${C.pinkSoft}`, borderRadius: 12, padding: "12px 14px", color: C.plum, lineHeight: 1.6, overflowX: "auto" }}>
            {`GET (n8n) → { ok, count,`}<br />{`  rows:[{ ma, ten, phan_loai,`}<br />{`  bo_phan, qa, dl_vmp, tt_vmp… }] }`}<br /><br />{`POST (n8n) → { action:"updateRow",`}<br />{`  id, patch:{ tt_vmp, ngay_vmp… } }`}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: C.plumSoft, fontWeight: 600, lineHeight: 1.7 }}>• App <b style={{ color: C.mintText }}>tự dịch</b> dữ liệu n8n sang đối tượng/hạng mục — không cần sửa Sheet.<br />• Cũng nhận định dạng cũ <code>{`{objects, activities}`}</code> (Apps Script).<br />• POST dùng <b style={{ color: C.plum }}>text/plain</b> để tránh CORS preflight.<br />• URL <b style={{ color: C.mintText }}>được lưu</b> &amp; tự kết nối lại khi mở trang.</div>
        </Card>
        <Card variant="soft">
          <CardTitle icon={Cloud}>Trạng thái nguồn</CardTitle>
          <div style={{ fontSize: 12.5, color: C.plumSoft, fontWeight: 600, lineHeight: 1.8 }}>
            • Nguồn hiện tại: <b style={{ color: C.plum }}>{conn.source === "n8n" ? "Webhook n8n" : conn.source === "native" ? "Apps Script (objects/activities)" : "— (demo)"}</b><br />
            • Ghi trạng thái/ngày: <b style={{ color: C.mintText }}>updateRow theo ID</b> (n8n hỗ trợ).<br />
            • Thêm/sửa/xoá đối tượng trên Sheet: cần bổ sung nhánh <code>upsertObject</code>/<code>deleteObject</code> trong n8n (xem README).
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ===================== Overview ===================== */
function MiniAlert({ a }) {
  const al = a.alert;
  return (
    <div className="vmp-row" style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 14, background: "#fff", border: `1px solid ${al.kind === "over" ? C.raspSoft : C.marigoldSoft}` }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: al.kind === "over" ? C.raspSoft : C.marigoldSoft, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 15, color: al.kind === "over" ? C.raspText : C.marigoldText }}>{Math.abs(al.dleft)}</span><span style={{ fontSize: 8.5, color: C.plumSoft, fontWeight: 700 }}>ngày</span></div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: TEXT, fontSize: 13, fontWeight: 800, color: C.plum, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div><div style={{ fontSize: 11.5, color: C.plumSoft, fontWeight: 600 }}>{a.vtype} · mốc {al.stage}</div></div>
      <Tag color={al.kind === "over" ? C.raspText : C.marigoldText} bg={al.kind === "over" ? C.raspSoft : C.marigoldSoft}>{al.kind === "over" ? "Quá hạn" : "Tới hạn"}</Tag>
    </div>
  );
}
function Overview({ acts, setView }) {
  const e = tally(acts), d = docTally(acts);
  const overdue = acts.filter((a) => a.alert && a.alert.kind === "over");
  const soon = acts.filter((a) => a.alert && a.alert.kind === "soon");
  const alertList = overdue.concat(soon).slice(0, 4);
  const gap = e.done - d.done, gapPts = e.rate - d.rate;
  const deptStats = DEPTS.map((dp) => ({ name: dp.name, ...tally(acts.filter((a) => a.dept === dp.id)) })).filter((r) => r.total > 0);
  const leader = [...deptStats].sort((a, b) => b.rate - a.rate)[0] || { name: "—", rate: 0 };
  const laggard = [...deptStats].sort((a, b) => a.rate - b.rate)[0] || { name: "—", rate: 0 };
  const overByDept = DEPTS.map((dp) => ({ name: dp.name, n: acts.filter((a) => a.dept === dp.id && a.alert && a.alert.kind === "over").length }));
  const topOver = [...overByDept].sort((a, b) => b.n - a.n)[0] || { name: "—", n: 0 };
  const [mood, setMood] = useState(overdue.length > 2 ? "stressed" : "happy"); const [cheer, setCheer] = useState(0);
  const cheerUp = () => { setMood((m) => (m === "happy" ? "stressed" : "happy")); setCheer((c) => c + 1); };
  const bubble = mood === "happy" ? "Tuyệt vời! Mọi việc đang trong tầm tay. Cùng cố lên nha! ✨👑" : `Ôi, có ${overdue.length} việc quá hạn lận... tóc mình rối hết rồi nè! 😵‍💫 Bấm vào mình để được vỗ về nhé~`;
  const insights = [
    { icon: Clock, color: C.marigoldText, bg: C.marigoldSoft, title: "KHOẢNG CÁCH HỒ SƠ", text: `Hồ sơ chậm hơn thực tế ${gap} hạng mục (≈${gapPts} điểm %).` },
    { icon: AlertCircle, color: C.raspText, bg: C.raspSoft, title: "ĐIỂM RỦI RO QUÁ HẠN", text: `Quá hạn tập trung tại ${topOver.name} — ${topOver.n}/${overdue.length || 0} hạng mục.` },
    { icon: TrendingUp, color: C.mintText, bg: C.mintSoft, title: "HIỆU SUẤT BỘ PHẬN", text: `${leader.name} dẫn đầu (${leader.rate}%); ${laggard.name} thấp nhất (${laggard.rate}%).` },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card variant="strong" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", background: `linear-gradient(120deg, #fff, ${C.pinkMist})`, position: "relative", overflow: "hidden" }}>
        <div onClick={cheerUp} style={{ cursor: "pointer", position: "relative", flexShrink: 0 }} title="Bấm để vỗ về công chúa">
          <Mascot mood={mood} size={120} />
          {[...Array(6)].map((_, i) => { const ang = (i / 6) * Math.PI * 2; return <div key={cheer + "-" + i} className="bstar" style={{ "--bx": `${Math.cos(ang) * 56}px`, "--by": `${Math.sin(ang) * 56}px`, animationDelay: `${i * 0.03}s` }}><Sparkle size={13} color={i % 2 ? C.gold : C.pink} /></div>; })}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="pop" key={mood} style={{ background: "#fff", border: `1.5px solid ${C.pinkSoft}`, borderRadius: 18, padding: "14px 18px", fontFamily: TEXT, fontSize: 15, color: C.plum, fontWeight: 700, lineHeight: 1.5, boxShadow: "0 4px 14px rgba(238,123,169,.10)" }}>{bubble}</div>
          <div style={{ fontFamily: TEXT, fontSize: 12.5, color: C.plumSoft, marginTop: 10, marginLeft: 4, fontWeight: 700 }}>Thực tế đạt <b style={{ color: C.mintText }}>{e.rate}%</b> · Hồ sơ <b style={{ color: C.skyText }}>{d.rate}%</b> · còn <b style={{ color: C.raspText }}>{overdue.length} việc quá hạn</b></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 17px", borderRadius: 999, background: C.mintSoft, alignSelf: "flex-start" }}><ShieldCheck size={18} color={C.mintText} /><span style={{ fontWeight: 800, color: C.mintText, fontSize: 14 }}>Tuân thủ GMP: Tốt</span></div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
        <KpiCard emoji="🌸" bg={C.pinkMist} color={C.plum} value={e.total} label="Tổng hạng mục VMP 2026" sub="Trên 5 nhóm đối tượng" />
        <KpiCard emoji="✨" bg={C.mintSoft} color={C.mintText} value={e.rate + "%"} rate={e.rate} label="Tỷ lệ thẩm định thực tế" sub={`${e.done}/${e.total} hoàn thành`} />
        <KpiCard emoji="📋" bg={C.skySoft} color={C.skyText} value={d.rate + "%"} rate={d.rate} label="Tỷ lệ hoàn thiện hồ sơ" sub={`Chậm hơn ${gapPts} điểm %`} subColor={C.marigoldText} />
        <KpiCard emoji="⏰" bg={C.raspSoft} color={C.raspText} value={overdue.length} label="Hạng mục quá hạn" sub={`Tới hạn ≤30 ngày: ${soon.length}`} subColor={C.raspText} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        {insights.map((it, i) => { const Icon = it.icon; return (
          <Card key={i} variant="soft" style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: 20, background: "#fff" }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: it.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={20} color={it.color} strokeWidth={2.4} /></div>
            <div><div style={{ fontFamily: TEXT, fontSize: 11, color: C.plumSoft, fontWeight: 800, letterSpacing: 0.8 }}>{it.title}</div><div style={{ fontFamily: TEXT, fontSize: 13.5, color: C.plum, fontWeight: 700, marginTop: 4, lineHeight: 1.55 }}>{it.text}</div></div>
          </Card>
        ); })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        <TrackCard label="Thẩm định thực tế" desc="Tiến độ thực hiện IQ / OQ / PQ / PV" tColor={C.mint} tText={C.mintText} m={e} NoteIcon={overdue.length ? AlertCircle : CheckCircle2} note={overdue.length ? `${overdue.length} hạng mục quá hạn — ưu tiên xử lý ngay` : "Đang bám sát tiến độ kế hoạch"} noteColor={overdue.length ? C.raspText : C.mintText} noteBg={overdue.length ? C.raspSoft : C.mintSoft} />
        <TrackCard label="Hoàn thiện hồ sơ" desc="Protocol & Báo cáo thẩm định" tColor={C.sky} tText={C.skyText} m={d} NoteIcon={Clock} note={`Đang chậm hơn thực tế ${gap} hạng mục`} noteColor={C.marigoldText} noteBg={C.marigoldSoft} />
      </div>

      <DeptRace acts={acts} />
      <IndividualLeaderboard acts={acts} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        <MonthlyClimb total={e.total} gap={gap} />
        <Card variant="soft">
          <CardTitle icon={Radar} right={<button onClick={() => setView("alerts")} style={{ fontSize: 12.5, color: C.pinkText, fontWeight: 800, cursor: "pointer", border: "none", background: "transparent", display: "flex", alignItems: "center", gap: 4 }}>Xem tất cả <ChevronRight size={14} /></button>}>Cảnh báo cần xử lý</CardTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alertList.length ? alertList.map((a) => <MiniAlert key={a.id} a={a} />) : <div style={{ textAlign: "center", padding: 24, color: C.mintText, fontWeight: 700 }}>🎉 Không có cảnh báo nào!</div>}
          </div>
        </Card>
      </div>

      <div style={{ textAlign: "center", padding: "8px 0 4px", fontFamily: TEXT, fontSize: 12, color: C.plumSoft, fontWeight: 700 }}>✨ VMP Monitor · CPC1 HN · V/Q Team — QLCL · EU GMP Annex 15 · WHO · PIC/S ✨</div>
    </div>
  );
}

/* ===================== App ===================== */
const SUBS = {
  overview: "Theo dõi Kế hoạch Thẩm định Gốc (VMP) — CPC1 HN",
  timeline: "Lịch tổng thể & các mốc: Đề cương → Thẩm định → Báo cáo → Đích VMP",
  inventory: "Danh mục đối tượng theo 5 nhóm — đồng bộ Google Sheet",
  update: "Nhập kết quả thực tế (ngày & trạng thái) — ghi thẳng vào Google Sheet qua n8n",
  alerts: "Cảnh báo tới hạn / quá hạn & dự báo tái thẩm định theo tần suất",
  risk: "Quản lý rủi ro chất lượng (ICH Q9) — ưu tiên theo mức ảnh hưởng GxP",
  reports: "Báo cáo tuần / tháng / quý + nhận xét AI · xuất PDF / DOC / HTML",
  connect: "Kết nối & đồng bộ dữ liệu 2 chiều với Google Sheet",
};
export default function App() {
  const [users, setUsers] = useState(USERS);
  const [user, setUser] = useState(() => loadUser());
  const [view, setView] = useState("overview");
  const [showPw, setShowPw] = useState(false);
  const [objects, setObjects] = useState(SEED_OBJ);
  const [acts, setActs] = useState(SEED_ACT);
  const [conn, setConn] = useState(() => {
    const c = loadConn();
    return c
      ? { readUrl: c.readUrl || "", writeUrl: c.writeUrl || "", status: "demo", msg: "Đã nạp URL đã lưu — đang chờ đồng bộ…" }
      : { readUrl: "", writeUrl: "", status: "demo", msg: "" };
  });
  const enriched = useMemo(() => enrich(objects, acts), [objects, acts]);

  // Nạp font pastel
  useEffect(() => { const id = "pastel-fonts"; if (!document.getElementById(id)) { const l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Quicksand:wght@400;500;600;700&display=swap"; document.head.appendChild(l); } }, []);

  // Ghi nhớ phiên đăng nhập (KHÔNG lưu mật khẩu)
  useEffect(() => { saveUser(user); }, [user]);

  // Cuộn nội dung về đầu trang mỗi khi chuyển mục (chức năng).
  const mainRef = useRef(null);
  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [view]);

  const connectSheet = async (readUrl, writeUrl) => {
    if (!readUrl) { setConn((c) => ({ ...c, writeUrl, msg: "Vui lòng nhập URL đọc dữ liệu." })); return; }
    setConn({ readUrl, writeUrl, status: "loading", msg: "Đang tải dữ liệu…" });
    try {
      const data = await fetchVmpData(readUrl);           // adapter: tự nhận diện n8n hoặc định dạng gốc
      if (Array.isArray(data.objects) && data.objects.length) setObjects(data.objects);
      if (Array.isArray(data.activities) && data.activities.length) setActs(data.activities);
      saveConn(readUrl, writeUrl);                          // ghi nhớ URL cho lần sau
      const tag = data.source === "n8n" ? ` · nguồn n8n (${data.count} dòng)` : "";
      setConn({ readUrl, writeUrl, status: "ok", source: data.source, msg: `Đã tải ${data.objects.length} đối tượng · ${data.activities.length} hạng mục${tag} ✓` });
    } catch (e) {
      setConn({ readUrl, writeUrl, status: "err", msg: "Lỗi tải: " + (e && e.message ? e.message : "không rõ") + " — kiểm tra URL / CORS / workflow đang Active" });
    }
  };

  // Tự kết nối khi mở trang nếu đã có URL đọc (đã lưu hoặc từ .env)
  useEffect(() => {
    const c = loadConn();
    if (c && c.readUrl) connectSheet(c.readUrl, c.writeUrl || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveObject = async (obj, isNew) => {
    setObjects((prev) => isNew ? [...prev, obj] : prev.map((o) => o.code === obj.code ? obj : o));
    if (conn.writeUrl && conn.source !== "n8n") {
      // Backend dạng Apps Script trả {objects,activities} có thể nhận upsertObject.
      try { const r = await postToN8n(conn.writeUrl, { action: "upsertObject", row: obj }); setConn((c) => ({ ...c, msg: `Đã ghi '${obj.code}' lên Sheet (HTTP ${r.status}) ✓` })); }
      catch (e) { setConn((c) => ({ ...c, msg: "Lỗi ghi: " + (e && e.message ? e.message : "không rõ") })); }
    } else if (conn.source === "n8n") {
      // Webhook n8n hiện chỉ hỗ trợ updateRow (ngày/trạng thái), chưa hỗ trợ
      // thêm/sửa metadata đối tượng → lưu tại chỗ & nhắc mở rộng workflow.
      setConn((c) => ({ ...c, msg: `Đã lưu '${obj.code}' tại chỗ. Để ghi vào Sheet cần bổ sung nhánh 'upsertObject' trong n8n (xem README).` }));
    }
  };
  const deleteObject = async (code) => {
    setObjects((prev) => prev.filter((o) => o.code !== code));
    if (conn.writeUrl && conn.source !== "n8n") {
      try { const r = await postToN8n(conn.writeUrl, { action: "deleteObject", code }); setConn((c) => ({ ...c, msg: `Đã xoá '${code}' trên Sheet (HTTP ${r.status}) ✓` })); }
      catch (e) { setConn((c) => ({ ...c, msg: "Lỗi xoá: " + (e && e.message ? e.message : "không rõ") })); }
    } else if (conn.source === "n8n") {
      setConn((c) => ({ ...c, msg: `Đã xoá '${code}' tại chỗ. Để xoá trên Sheet cần bổ sung nhánh 'deleteObject' trong n8n.` }));
    }
  };
  const testWrite = async (writeUrl) => {
    if (!writeUrl) { setConn((c) => ({ ...c, msg: "Vui lòng nhập URL ghi." })); return; }
    try { const r = await postToN8n(writeUrl, buildPing()); const j = await r.json().catch(() => null); setConn((c) => ({ ...c, writeUrl, msg: `Ghi thử OK (HTTP ${r.status}${j && j.pong ? " · pong ✓" : ""})` })); }
    catch (e) { setConn((c) => ({ ...c, writeUrl, msg: "Lỗi ghi thử: " + (e && e.message ? e.message : "không rõ") })); }
  };
  const resetDemo = () => { setObjects(SEED_OBJ); setActs(SEED_ACT); clearConn(); setConn({ readUrl: "", writeUrl: "", status: "demo", msg: "Đã khôi phục dữ liệu demo." }); };

  // DASHBOARD tier — cập nhật ngày & trạng thái thực tế 1 hạng mục (mọi tài
  // khoản đều được phép). Gửi ĐỦ 9 trường (đã điền sẵn giá trị hiện có) để
  // n8n không ghi rỗng đè lên các ô chưa sửa.
  const updateActivity = async (id, patch) => {
    setActs((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const raw = { ...(a._raw || {}), ...patch };
      return { ...a, _raw: raw, ...deriveActivityFields(raw) };
    }));
    if (conn.writeUrl) {
      try {
        const r = await postToN8n(conn.writeUrl, buildUpdateRow(id, patch, user ? user.name : ""));
        const j = await r.json().catch(() => null);
        const ok = r.ok && (!j || j.ok !== false);
        setConn((c) => ({ ...c, msg: ok ? `Đã ghi tiến độ '${id}' lên Google Sheet (HTTP ${r.status}) ✓` : `Gửi '${id}' nhưng n8n báo lỗi (HTTP ${r.status})` }));
      } catch (e) { setConn((c) => ({ ...c, msg: "Lỗi ghi tiến độ: " + (e && e.message ? e.message : "không rõ") })); }
    } else {
      setConn((c) => ({ ...c, msg: `Đã cập nhật '${id}' tại chỗ (chưa cấu hình URL ghi để đồng bộ Sheet).` }));
    }
  };

  const styleTag = (
    <style>{`
      *{box-sizing:border-box;}
      .vmp-scroll::-webkit-scrollbar{width:9px;height:9px;}
      .vmp-scroll::-webkit-scrollbar-thumb{background:${C.pink}55;border-radius:9px;}
      .vmp-scroll::-webkit-scrollbar-track{background:transparent;}
      .card{transition:transform .25s ease, box-shadow .25s ease;}
      .card:hover{transform:translateY(-3px);box-shadow:0 18px 42px rgba(238,123,169,.20);}
      .vmp-nav:hover{background:${C.pinkMist}!important;color:${C.plum}!important;}
      .vmp-row{transition:background .18s ease;}
      .vmp-row:hover{background:${C.pinkMist};}
      @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}
      .fade{animation:fadeUp .5s ease both;}
      @keyframes twinkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
      @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
      .tw{animation:twinkle 2.6s ease-in-out infinite, floaty 5s ease-in-out infinite;pointer-events:none;z-index:0;}
      @keyframes bob{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-7px) rotate(1.5deg)}}
      .bob{animation:bob 3.4s ease-in-out infinite;transform-origin:50% 60%;}
      @keyframes burst{0%{transform:translate(0,0) scale(.2);opacity:1}100%{transform:translate(var(--bx),var(--by)) scale(1.3);opacity:0}}
      .bstar{position:absolute;left:50%;top:34%;animation:burst .8s ease-out forwards;pointer-events:none;}
      @keyframes pop{0%{opacity:0;transform:scale(.9) translateY(8px)}100%{opacity:1;transform:none}}
      .pop{animation:pop .5s ease both;}
      @keyframes rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
      .rise{animation:rise .6s cubic-bezier(.22,1,.36,1) both;}
      @keyframes spin{to{transform:rotate(360deg)}}
      .spin{animation:spin .9s linear infinite;}
      input::placeholder{color:#B79BB2;}
      select{appearance:none;}
      @media (max-width:760px){.login-grid{grid-template-columns:1fr!important;}}
    `}</style>
  );

  if (!user) return (<>{styleTag}<LoginScreen users={users} onLogin={setUser} /></>);
  const title = NAV.find((n) => n.id === view)?.label || "Tổng quan";
  // PHÂN QUYỀN 3 TẦNG:
  //  • Mục GỐC (danh mục/định danh)  → chỉ admin được sửa
  //  • Mục DASHBOARD (nhập tiến độ)   → mọi tài khoản đăng nhập đều sửa được
  //  • Mục TỰ NHẢY (deadline tự tính) → chỉ đọc (công thức), không ai sửa tay
  const isAdmin = user.perm === "admin";
  const stars = [{ t: "10%", l: "30%", s: 14, c: C.gold, d: "0s" }, { t: "24%", l: "92%", s: 12, c: C.pink, d: ".8s" }, { t: "55%", l: "96%", s: 16, c: C.lav, d: "1.4s" }, { t: "82%", l: "34%", s: 12, c: C.sky, d: ".5s" }, { t: "68%", l: "8%", s: 13, c: C.pink, d: "1.1s" }];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: TEXT, color: C.plum, overflow: "hidden" }}>
      {styleTag}
      {showPw && <ChangePwModal user={user} users={users} setUsers={setUsers} onClose={() => setShowPw(false)} />}
      <Sidebar view={view} setView={setView} user={user} connected={conn.status === "ok"} onLogout={() => { setUser(null); setView("overview"); }} onChangePw={() => setShowPw(true)} />
      <main ref={mainRef} className="vmp-scroll" style={{ flex: 1, overflowY: "auto", position: "relative", background: `radial-gradient(720px 520px at 88% -6%, ${C.pinkMist}, transparent 60%), radial-gradient(640px 520px at -6% 104%, ${C.lavSoft}, transparent 55%), radial-gradient(520px 420px at 50% 55%, rgba(226,241,250,.45), transparent 70%), linear-gradient(160deg, ${C.bg1}, ${C.bg2})` }}>
        {stars.map((s, i) => <div key={i} className="tw" style={{ position: "absolute", top: s.t, left: s.l, animationDelay: s.d }}><Sparkle size={s.s} color={s.c} /></div>)}
        <div style={{ position: "relative", zIndex: 1 }}>
          <Topbar title={title} user={user} sub={SUBS[view]} />
          <div style={{ padding: "0 34px 38px" }}>
            {view === "overview" && <Overview acts={enriched} setView={setView} />}
            {view === "timeline" && <TimelineView acts={enriched} />}
            {view === "inventory" && <InventoryView objects={objects} acts={enriched} canEdit={isAdmin} onSave={saveObject} onDelete={deleteObject} conn={conn} />}
            {view === "update" && <UpdateView acts={enriched} conn={conn} isAdmin={isAdmin} onUpdate={updateActivity} />}
            {view === "alerts" && <AlertsView acts={enriched} />}
            {view === "risk" && <QrmView acts={enriched} />}
            {view === "reports" && <ReportsView acts={enriched} />}
          </div>
        </div>
      </main>
    </div>
  );
}
