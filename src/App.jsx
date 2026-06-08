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
const VMP_TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
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
  { id: "qc", name: "RD / QC – Kiểm nghiệm", short: "RD/QC" },
  { id: "qa", name: "QA – QLCL", short: "QA" },
];
const DEPT_DEEP = { sx: C.pinkText, cd: C.skyText, kho: C.marigoldText, qc: C.mintText, qa: C.lavText };
const DEPT_COLOR = { sx: C.pink, cd: C.sky, kho: C.marigold, qc: C.mint, qa: C.lav };
const DEPT_CODE = { sx: "SX", cd: "CĐ", kho: "Kho", qc: "QC", qa: "QA" };
const DEP_DAYS = { "Độc lập": 2, "Hóa lý": 2, "Nhiễm khuẩn": 7, "Vô khuẩn": 16 };

// ===== Dữ liệu demo đã được GỠ BỎ — ứng dụng chỉ dùng dữ liệu thật từ Google Sheet (qua n8n). =====
const SEED_OBJ = [];
const SEED_ACT = [];
// Tài khoản đăng nhập (mật khẩu demo — hãy đổi qua chức năng "Đổi mật khẩu").
const USERS = {
  admin: { pass: "admin@123", name: "Quản trị hệ thống", role: "Admin", perm: "admin" },
  hoan: { pass: "hoan@123", name: "Hoàn", role: "V/Q Team — QLCL", perm: "admin" },
  my: { pass: "my@123", name: "My", role: "V/Q Team — QLCL", perm: "admin" },
  nhi: { pass: "nhi@123", name: "Nhi", role: "V/Q Team — QLCL", perm: "admin" },
  bophan: { pass: "bp@123", name: "NV Bộ phận", role: "XSX / Kho / RD / Cơ điện", perm: "edit" },
};
const PERM_LABEL = { admin: "Quản trị", edit: "Chỉnh sửa", view: "Chỉ xem" };
/* ===================== Helpers (khôi phục) ===================== */
const parseD = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
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
  { id: "risk", label: "Đánh giá rủi ro (QRM)", icon: ShieldAlert },
  { id: "workload", label: "Tải công việc", icon: Activity },
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
function Topbar({ title, user, sub, onRefresh, refreshing }) {
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
        <button onClick={onRefresh} title="Làm mới dữ liệu từ Google Sheet" style={{ ...glass, borderRadius: 16, padding: "9px 15px", display: "flex", alignItems: "center", gap: 8, border: "none", cursor: "pointer", color: C.pinkText, fontFamily: TEXT, fontWeight: 800, fontSize: 12.5 }}><RefreshCw size={15} color={C.pink} className={refreshing ? "spin" : ""} /> {refreshing ? "Đang tải…" : "Làm mới"}</button>
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
function MonthlyClimb({ acts }) {
  // Lũy kế THẬT theo tháng: số hạng mục có Deadline VMP tới tháng đó, đã xong thực tế / đã xong hồ sơ.
  const total = acts.length;
  const data = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"].map((m, i) => {
    const mn = i + 1;
    const due = acts.filter((a) => { const mm = a.target ? Number(String(a.target).split("-")[1]) : 0; return mm >= 1 && mm <= mn; });
    return { m, exec: due.filter((a) => a.st === "done").length, doc: due.filter((a) => a.docDone).length };
  });
  const gap = (data[data.length - 1] ? data[data.length - 1].exec - data[data.length - 1].doc : 0);
  const ExecDot = (p) => { const { cx, cy, index, value } = p; if (cx == null) return null; const last = index === data.length - 1; return (
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
          <AreaChart data={data} margin={{ top: 40, right: 18, left: -8, bottom: 4 }}>
            <defs><linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.mint} stopOpacity={0.32} /><stop offset="100%" stopColor={C.mint} stopOpacity={0} /></linearGradient><linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.sky} stopOpacity={0.26} /><stop offset="100%" stopColor={C.sky} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke={C.line} />
            <XAxis dataKey="m" tick={{ fontSize: 13, fill: C.plum, fontFamily: TEXT, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, Math.max(total, 1)]} tick={{ fontSize: 12, fill: C.plumSoft, fontFamily: TEXT, fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTip />} />
            <ReferenceLine y={total} stroke={C.pink} strokeDasharray="5 5" strokeOpacity={0.55} />
            <Area type="monotone" dataKey="doc" name="Hồ sơ" stroke={C.sky} strokeWidth={2.8} fill="url(#gD)" dot={DocDot} activeDot={{ r: 6 }} />
            <Area type="monotone" dataKey="exec" name="Thực tế" stroke={C.mint} strokeWidth={3.2} fill="url(#gE)" dot={ExecDot} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontFamily: TEXT, fontSize: 13, color: C.plum, fontWeight: 700, padding: "10px 13px", borderRadius: 12, background: C.marigoldSoft }}><Clock size={15} color={C.marigoldText} /><span>Hồ sơ đang chậm hơn thực tế <b>{gap} hạng mục</b>. Nét đứt = tổng kế hoạch năm ({total} hạng mục).</span></div>
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
function GanttRow({ a, idx, onOpen }) {
  const ps = phaseStates(a), m = ps.m;
  const x0 = pctYear(m.protocol), xV = pctYear(m.validation), xR = pctYear(m.report), xT = pctYear(m.target);
  const span = (xT - x0) || 1;
  const a1 = ((xV - x0) / span) * 100, a2 = ((xR - x0) / span) * 100;
  const cls = CLS[a.cls];
  const over = a.st === "over";
  const seg = (lp, rp, status, label) => (rp - lp) > 0.5 ? <div title={label} style={{ position: "absolute", left: lp + "%", width: (rp - lp) + "%", top: 0, bottom: 0, background: PHASE_COLOR[status], opacity: status === "future" ? 0.5 : 0.95, borderRadius: 5, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.55)" }} /> : null;
  const runPct = ps.r === "done" ? 100 : ps.v === "done" ? a2 : ps.p === "done" ? a1 : (PROG[a.st] || 8) * 0.3;
  const runner = a.st === "done" ? "🏆" : over ? "🐢" : "🏃";
  return (
    <div className="vmp-row" onClick={() => onOpen && onOpen(a)} title="Bấm để xem chi tiết" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderRadius: 10, cursor: "pointer", background: over ? "rgba(225,75,120,.07)" : (idx % 2 ? "rgba(255,255,255,.5)" : "transparent") }}>
      <div style={{ width: 188, flexShrink: 0, paddingLeft: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Tag color={cls.text} bg={cls.soft}>{a.vtype}</Tag><span style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 700, color: C.plumSoft }}>{a.code}</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}><Pill s={a.st} small /><span style={{ fontSize: 11.5, color: C.plum, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 92 }}>{a.name}</span></div>
      </div>
      <div style={{ flex: 1, position: "relative", height: 30, minWidth: 220 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "rgba(78,42,78,.05)" }} />
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <div key={i} style={{ position: "absolute", left: (i / 12) * 100 + "%", top: 0, bottom: 0, width: 1, background: C.line }} />)}
        <div style={{ position: "absolute", left: x0 + "%", width: span + "%", top: 6, bottom: 6 }}>
          {seg(0, a1, ps.p, "① Đề cương (T-60)")}
          {seg(a1, a2, ps.v, "② Thẩm định thực tế")}
          {seg(a2, 100, ps.r, "③ Báo cáo (T-5)")}
          <span style={{ position: "absolute", left: runPct + "%", top: "50%", transform: "translate(-50%,-50%)", width: 22, height: 22, borderRadius: 999, background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, zIndex: 4 }}>{runner}</span>
        </div>
        <span style={{ position: "absolute", left: xT + "%", top: "50%", transform: "translate(-50%,-50%)", fontSize: 15, zIndex: 3, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.25))" }}>🏁</span>
      </div>
      <div style={{ width: 96, flexShrink: 0, textAlign: "right", paddingRight: 4 }}><div style={{ fontFamily: NUM, fontSize: 12.5, fontWeight: 800, color: over ? C.raspText : C.plum }}>{fmtVN(m.target)}</div><div style={{ fontSize: 10.5, color: C.plumSoft, fontWeight: 600 }}>đích VMP</div></div>
    </div>
  );
}
function TimelineView({ acts }) {
  const [cls, setCls] = useState("all"); const [dept, setDept] = useState("all"); const [q, setQ] = useState(""); const [detail, setDetail] = useState(null);
  const filtered = acts.filter((a) => {
    if (cls !== "all" && a.cls !== cls) return false;
    if (dept !== "all" && a.dept !== dept) return false;
    if (q.trim()) { const s = q.trim().toLowerCase(); if (![a.code, a.name, a.owner, a.id, a.vtype].some((x) => String(x || "").toLowerCase().includes(s))) return false; }
    return true;
  }).sort((x, y) => parseD(x.target) - parseD(y.target));
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 12, border: `1.5px solid ${C.pinkSoft}`, background: "#fff", flex: 1, minWidth: 200 }}><Search size={15} color={C.pink} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo mã, tên, QA, ID…" style={{ border: "none", outline: "none", background: "transparent", fontFamily: TEXT, fontSize: 13.5, color: C.plum, width: "100%", fontWeight: 600 }} /></div>
          {(cls !== "all" || dept !== "all" || q.trim()) && <button onClick={() => { setCls("all"); setDept("all"); setQ(""); }} style={{ padding: "8px 13px", borderRadius: 999, border: "none", cursor: "pointer", background: C.raspSoft, color: C.raspText, fontFamily: TEXT, fontWeight: 800, fontSize: 12.5 }}>✕ Xoá lọc</button>}
        </div>
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: C.pinkMist, display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.plum }}>🏁 Cách đọc đường đua — mỗi hạng mục chạy từ trái sang đích VMP (T):</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: C.plum, fontWeight: 700 }}>
            <span><b style={{ color: C.plumSoft }}>3 chặng (trái→phải):</b></span>
            <span>① Đề cương (T‑60)</span>
            <span style={{ color: C.pinkText }}>② Thẩm định thực tế = <b>timeline thực tế</b></span>
            <span style={{ color: C.lavText }}>③ Báo cáo (T‑5) = <b>trả hồ sơ</b></span>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.plumSoft, fontWeight: 800 }}>Màu chặng (theo tình trạng):</span>
            {legend.map(([k, l]) => <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.plum, fontWeight: 700 }}><span style={{ width: 14, height: 9, borderRadius: 3, background: PHASE_COLOR[k], opacity: k === "future" ? .55 : .92 }} />{l}</span>)}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: C.plum, fontWeight: 700 }}>
            <span style={{ fontSize: 12, color: C.plumSoft, fontWeight: 800 }}>Vận động viên:</span>
            <span>🏃 đang chạy (vị trí = tiến độ)</span>
            <span>🏆 đã về đích</span>
            <span>🐢 bị trễ hạn</span>
            <span>🏁 đích VMP</span>
            <span style={{ color: C.raspText }}>┃ vạch "Hôm nay"</span>
          </div>
        </div>
      </Card>
      <Card variant="strong">
        <CardTitle icon={GanttChartSquare} sub={`${filtered.length} hạng mục · mỗi hàng là 1 làn đua tới đích VMP · Năm 2026`}>🏁 Đường đua thẩm định VMP</CardTitle>
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
              {filtered.map((a, i) => <GanttRow key={a.id} a={a} idx={i} onOpen={setDetail} />)}
              {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: C.plumSoft, fontWeight: 700 }}>Không có hạng mục nào khớp bộ lọc — thử xoá lọc nhé.</div>}
            </div>
          </div>
        </div>
      </Card>
      <ActivityDetailModal a={detail} onClose={() => setDetail(null)} />
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
      <AlertsBody overdue={overdue} soon={soon} requal={requal} Row={Row} />
    </div>
  );
}
function AlertsBody({ overdue, soon, requal, Row }) {
  const [f, setF] = useState("over");
  const cards = [
    { id: "over", emoji: "🚨", bg: C.raspSoft, color: C.raspText, ring: C.rasp, value: overdue.length, label: "Hạng mục quá hạn", sub: "Cần xử lý ngay" },
    { id: "soon", emoji: "⏰", bg: C.marigoldSoft, color: C.marigoldText, ring: C.marigold, value: soon.length, label: `Tới hạn (≤ ${SOON_DAYS} ngày)`, sub: "Theo dõi sát" },
    { id: "requal", emoji: "🔁", bg: C.lavSoft, color: C.lavText, ring: C.lav, value: requal.length, label: "Tái thẩm định sắp tới", sub: "Theo tần suất" },
  ];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 24 }}>
        {cards.map((c) => (
          <div key={c.id} onClick={() => setF(c.id)} style={{ cursor: "pointer", borderRadius: 24, boxShadow: f === c.id ? `0 0 0 3px ${c.ring}` : "none", transition: "box-shadow .2s" }}>
            <KpiCard emoji={c.emoji} bg={c.bg} color={c.color} value={c.value} label={c.label} sub={f === c.id ? "● Đang xem" : c.sub} subColor={c.color} />
          </div>
        ))}
      </div>
      {f !== "requal" && (
        <Card variant="strong">
          <CardTitle icon={AlertCircle} sub="Bấm thẻ phía trên để lọc · Quy tắc: Đề cương T‑60 · Báo cáo T‑5 (+QC: hóa lý 2 / nhiễm khuẩn 7 / vô khuẩn 16)">{f === "over" ? `Hạng mục Quá hạn (${overdue.length})` : `Hạng mục Tới hạn (${soon.length})`}</CardTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {f === "over" && (overdue.length ? overdue.map((x) => <Row key={x.a.id} {...x} />) : <div style={{ textAlign: "center", padding: 30, color: C.mintText, fontWeight: 700 }}>🎉 Không có hạng mục quá hạn!</div>)}
            {f === "soon" && (soon.length ? soon.map((x) => <Row key={x.a.id} {...x} />) : <div style={{ textAlign: "center", padding: 30, color: C.mintText, fontWeight: 700 }}>🎉 Không có hạng mục tới hạn!</div>)}
          </div>
        </Card>
      )}
      {f === "requal" && (
        <Card variant="soft">
          <CardTitle icon={CalendarClock} sub="Dự báo từ ngày hoàn thành gần nhất + tần suất thẩm định (tháng)">Lịch tái thẩm định định kỳ ({requal.length})</CardTitle>
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
      )}
    </>
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
/* Nhãn trạng thái cho 1 pha (tự nhận diện, có xét phủ định "chưa/không") */
function phaseTag(txt) {
  const s = String(txt == null ? "" : txt).trim();
  const lc = s.toLowerCase();
  const neg = /\b(chưa|chua|không|khong)\b/.test(lc) || /^\s*(chưa|chua|không|khong)/.test(lc);
  const done = !neg && /hoàn thành|hoan thanh|done|đạt|✓|✔|100|xong/.test(lc);
  const prog = !neg && /đang|dang|thực hiện|thuc hien|progress|wip/.test(lc);
  const c = done ? { l: "✓ Hoàn thành", col: C.mintText, bg: C.mintSoft }
    : prog ? { l: "● Đang làm", col: C.marigoldText, bg: C.marigoldSoft }
    : s ? { l: "○ " + (s.length > 16 ? s.slice(0, 16) + "…" : s), col: C.skyText, bg: C.skySoft }
    : { l: "Chưa có", col: C.plumSoft, bg: "rgba(122,74,110,.08)" };
  return <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, color: c.col, background: c.bg, whiteSpace: "nowrap" }}>{c.l}</span>;
}
/* Modal CHI TIẾT 1 hạng mục — hiển thị đầy đủ mọi trường + vòng đời 4 pha */
function ActivityDetailModal({ a, onClose }) {
  if (!a) return null;
  const r = a._raw || {};
  const m = a.m || milestones(a);
  const cls = CLS[a.cls] || CLS.tb;
  const dp = DEPTS.find((d) => d.id === a.dept);
  const ct = CRIT[a.crit] || CRIT.TB;
  const dShow = (v) => { const t = String(v == null ? "" : v).trim(); return t || "—"; };
  const has = (v) => String(v == null ? "" : v).trim() !== "";
  const info = [
    ["Phân loại", cls.label], ["Bộ phận", dp ? dp.name : dShow(r.bo_phan)], ["Line", dShow(r.line)],
    ["Khu vực", dShow(r.khu_vuc)], ["Tình trạng", dShow(r.tinh_trang)], ["Tần suất", has(r.tan_suat) ? dShow(r.tan_suat) + " tháng" : "—"],
    ["PL báo cáo", dShow(a.dep)], ["Ngày công", a.effort != null ? String(a.effort) : "—"], ["Điểm trọng yếu", a.score != null ? a.score + " / 9" : "—"],
  ];
  const phases = [
    { ic: "📝", label: "Đề cương", note: "Hạn T‑60", dl: has(r.dl_de_cuong) ? dShow(r.dl_de_cuong) : fmtVN(m.protocol), act: r.ngay_de_cuong, st: r.tt_de_cuong },
    { ic: "🔬", label: "Thẩm định thực tế", note: "Hạn T‑5‑BC", dl: has(r.dl_tham_dinh) ? dShow(r.dl_tham_dinh) : fmtVN(m.validation), act: r.ngay_tham_dinh, st: r.tt_tham_dinh, sched: r.lich_td },
    { ic: "📄", label: "Báo cáo", note: "Hạn T‑5", dl: has(r.dl_bao_cao) ? dShow(r.dl_bao_cao) : fmtVN(m.report), act: r.ngay_bao_cao, st: r.tt_bao_cao },
    { ic: "🏁", label: "Hoàn tất VMP", note: "Đích VMP (T)", dl: has(r.dl_vmp) ? dShow(r.dl_vmp) : fmtVN(m.target), act: r.ngay_vmp, st: r.tt_vmp },
  ];
  return (
    <Modal onClose={onClose} title="Chi tiết hạng mục" icon={FileText} wide>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: cls.text, background: cls.soft, padding: "4px 10px", borderRadius: 9 }}>{a.code}</span>
        <Tag color={cls.text} bg={cls.soft}>{a.vtype}</Tag>
        <Tag color={ct.text} bg={ct.soft}>Rủi ro {a.crit}</Tag>
        <Pill s={a.st} small />
      </div>
      <div style={{ fontFamily: TEXT, fontSize: 18, fontWeight: 800, color: C.plum, marginBottom: 16 }}>{a.name}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 14 }}>
        {info.map(([k, v]) => <div key={k} style={{ background: "#fff", borderRadius: 11, padding: "8px 11px" }}><div style={{ fontSize: 10, color: C.plumSoft, fontWeight: 800, textTransform: "uppercase", letterSpacing: .3 }}>{k}</div><div style={{ fontSize: 13.5, color: C.plum, fontWeight: 700, marginTop: 2 }}>{v}</div></div>)}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 190, background: C.pinkSoft, borderRadius: 12, padding: "10px 13px" }}><div style={{ fontSize: 10, color: C.pinkText, fontWeight: 800, textTransform: "uppercase" }}>QA phụ trách</div><div style={{ fontSize: 14, color: C.plum, fontWeight: 800, marginTop: 2 }}>{dShow(r.qa)}</div>{has(r.email_qa) && <div style={{ fontSize: 11.5, color: C.plumSoft, fontWeight: 600 }}>{r.email_qa}</div>}</div>
        <div style={{ flex: 1, minWidth: 190, background: C.lavSoft, borderRadius: 12, padding: "10px 13px" }}><div style={{ fontSize: 10, color: C.lavText, fontWeight: 800, textTransform: "uppercase" }}>NS bộ phận khác</div><div style={{ fontSize: 14, color: C.plum, fontWeight: 800, marginTop: 2 }}>{dShow(r.ns_khac)}</div>{has(r.email_khac) && <div style={{ fontSize: 11.5, color: C.plumSoft, fontWeight: 600 }}>{r.email_khac}</div>}</div>
      </div>
      <div style={{ fontFamily: TEXT, fontSize: 14, fontWeight: 800, color: C.plum, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}><CalendarClock size={17} color={C.pink} /> Vòng đời thẩm định (Hạn · Thực tế · Trạng thái)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {phases.map((p, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "11px 14px", borderLeft: `4px solid ${has(p.act) ? C.mint : C.pinkSoft}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ fontSize: 18 }}>{p.ic}</span><div><div style={{ fontSize: 14, fontWeight: 800, color: C.plum }}>{p.label}</div><div style={{ fontSize: 10.5, color: C.plumSoft, fontWeight: 600 }}>{p.note}</div></div></div>
              {phaseTag(p.st)}
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap", fontSize: 12.5 }}>
              <span style={{ color: C.plumSoft, fontWeight: 600 }}>Hạn: <b style={{ color: C.plum }}>{dShow(p.dl)}</b></span>
              <span style={{ color: C.plumSoft, fontWeight: 600 }}>Thực tế: <b style={{ color: has(p.act) ? C.mintText : "#C9B6C7" }}>{dShow(p.act)}</b></span>
              {p.sched != null && has(p.sched) && <span style={{ color: C.plumSoft, fontWeight: 600 }}>Lịch xếp: <b style={{ color: C.plum }}>{dShow(p.sched)}</b></span>}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
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
/* Bản đồ giai đoạn cho mục Cập nhật tiến độ */
const STAGES = [
  { id: "chua", label: "Chưa bắt đầu", color: C.skyText, bg: C.skySoft },
  { id: "dang_dc", label: "Đang làm đề cương", color: C.marigoldText, bg: C.marigoldSoft },
  { id: "cho_td", label: "Xong đề cương · chờ thực tế", color: C.lavText, bg: C.lavSoft },
  { id: "dang_td", label: "Đang thẩm định thực tế", color: C.marigoldText, bg: C.marigoldSoft },
  { id: "cho_bc", label: "Xong thực tế · chờ báo cáo", color: C.lavText, bg: C.lavSoft },
  { id: "bc", label: "Đang/đã làm báo cáo", color: C.pinkText, bg: C.pinkSoft },
  { id: "done", label: "Hoàn thành VMP", color: C.mintText, bg: C.mintSoft },
];
const _neg = (v) => { const s = String(v == null ? "" : v).toLowerCase(); return /\b(chưa|chua|không|khong)\b/.test(s) || /^\s*(chưa|chua|không|khong)/.test(s); };
const _doneTxt = (v) => !_neg(v) && /hoàn thành|hoan thanh|done|đạt|dat|✓|✔|100|xong/i.test(String(v == null ? "" : v));
const _progTxt = (v) => !_neg(v) && /đang|dang|progress|thực hiện|thuc hien|wip/i.test(String(v == null ? "" : v));
function stageOf(a) {
  const r = a._raw || {};
  if (a.st === "done" || _doneTxt(r.tt_vmp)) return "done";
  const dc = _doneTxt(r.tt_de_cuong), td = _doneTxt(r.tt_tham_dinh), bc = _doneTxt(r.tt_bao_cao);
  if (bc || _progTxt(r.tt_bao_cao)) return "bc";
  if (td) return "cho_bc";
  if (_progTxt(r.tt_tham_dinh)) return "dang_td";
  if (dc) return "cho_td";
  if (_progTxt(r.tt_de_cuong)) return "dang_dc";
  return "chua";
}
function inPeriod(a, period) {
  if (period === "all") return true;
  if (!a.target) return false;
  const parts = String(a.target).split("-").map(Number); const y = parts[0], m = parts[1];
  const ty = VMP_TODAY.getFullYear(), tm = VMP_TODAY.getMonth() + 1;
  if (period === "thang") return y === ty && m === tm;
  if (period === "quy") return y === ty && Math.floor((m - 1) / 3) === Math.floor((tm - 1) / 3);
  if (period === "sixm") { const diff = (y - ty) * 12 + (m - tm); return diff >= 0 && diff < 6; }
  if (period === "nam") return y === ty;
  return true;
}
const PERIODS = [["all", "Tất cả"], ["thang", "Tháng này"], ["quy", "Quý này"], ["sixm", "6 tháng tới"], ["nam", "Năm nay"]];
function UpdateView({ acts, conn, isAdmin, onUpdate }) {
  const [q, setQ] = useState("");
  const [fst, setFst] = useState("all");
  const [period, setPeriod] = useState("all");
  const [stageF, setStageF] = useState("all");
  const [edit, setEdit] = useState(null);
  const inWindow = acts.filter((a) => inPeriod(a, period));
  const stageCount = STAGES.reduce((m, s) => { m[s.id] = inWindow.filter((a) => stageOf(a) === s.id).length; return m; }, {});
  const list = inWindow.filter((a) => {
    if (stageF !== "all" && stageOf(a) !== stageF) return false;
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
      <Card variant="strong">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <CardTitle icon={Activity} sub="Mỗi việc đang ở giai đoạn nào — bấm 1 ô để lọc danh sách bên dưới">Bản đồ chung giai đoạn ({inWindow.length} hạng mục)</CardTitle>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PERIODS.map(([id, lb]) => <button key={id} onClick={() => setPeriod(id)} style={{ padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: TEXT, fontSize: 12, fontWeight: 800, background: period === id ? GRAD : C.pinkSoft, color: period === id ? "#fff" : C.plumSoft }}>{lb}</button>)}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          <button onClick={() => setStageF("all")} style={{ textAlign: "left", border: "none", cursor: "pointer", padding: "14px 16px", borderRadius: 16, background: "#fff", boxShadow: stageF === "all" ? `0 0 0 3px ${C.pink}` : `inset 0 0 0 1px ${C.pinkSoft}` }}>
            <div style={{ fontFamily: NUM, fontSize: 26, fontWeight: 800, color: C.plum }}>{inWindow.length}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.plumSoft, marginTop: 2 }}>Tất cả giai đoạn</div>
          </button>
          {STAGES.map((s) => (
            <button key={s.id} onClick={() => setStageF(s.id)} style={{ textAlign: "left", border: "none", cursor: "pointer", padding: "14px 16px", borderRadius: 16, background: s.bg, boxShadow: stageF === s.id ? `0 0 0 3px ${s.color}` : "none", opacity: stageCount[s.id] === 0 ? 0.55 : 1 }}>
              <div style={{ fontFamily: NUM, fontSize: 26, fontWeight: 800, color: s.color }}>{stageCount[s.id]}</div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: s.color, marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
            </button>
          ))}
        </div>
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div className="vmp-scroll" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: TEXT, minWidth: 720 }}>
            <thead><tr style={{ background: C.pinkMist }}>
              {["Mã", "Tên đối tượng", "Loại", "QA", "Deadline VMP", "Giai đoạn", "Trạng thái", ""].map((h, i) => <th key={i} style={{ textAlign: i > 4 ? "center" : "left", padding: "13px 16px", fontSize: 12, fontWeight: 800, color: C.plumSoft, whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map((a, i) => { const sg = STAGES.find((s) => s.id === stageOf(a)); return (
                <tr key={a.id} style={{ borderTop: `1px solid ${C.pinkSoft}`, background: i % 2 ? "rgba(255,255,255,.4)" : "transparent" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 800, color: C.plum, fontSize: 13 }}>{a.code}</td>
                  <td style={{ padding: "12px 16px", color: C.plum, fontSize: 13 }}>{a.name}</td>
                  <td style={{ padding: "12px 16px" }}><Tag color={C.lavText} bg={C.lavSoft}>{a.vtype}</Tag></td>
                  <td style={{ padding: "12px 16px", color: C.plumSoft, fontSize: 13, fontWeight: 600 }}>{a.owner}</td>
                  <td style={{ padding: "12px 16px", color: C.plumSoft, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{a.target ? a.target.split("-").reverse().join("/") : "—"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>{sg && <Tag color={sg.color} bg={sg.bg}>{sg.label}</Tag>}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}><Pill s={a.st} small /></td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <button onClick={() => setEdit(a)} style={{ ...btnPrimary, padding: "7px 14px", borderRadius: 10, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}><Pencil size={13} /> Cập nhật</button>
                  </td>
                </tr>
              ); })}
              {!list.length && <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: C.plumSoft, fontWeight: 600 }}>Không có hạng mục phù hợp.</td></tr>}
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
  const [dept, setDept] = useState("all"); const [person, setPerson] = useState(""); const [pscope, setPscope] = useState("all");
  // Gộp người phụ trách theo từng đối tượng: QA phụ trách & người bộ phận khác (riêng biệt)
  const ownerMap = useMemo(() => {
    const m = {};
    acts.forEach((a) => { const r = a._raw || {}; if (!m[a.code]) m[a.code] = { qa: new Set(), other: new Set() }; const qa = (r.qa || a.owner || "").trim(); const ot = (r.ns_khac || "").trim(); if (qa) m[a.code].qa.add(qa); if (ot) m[a.code].other.add(ot); });
    return m;
  }, [acts]);
  const matchPerson = (code) => {
    if (!person.trim()) return true;
    const p = person.trim().toLowerCase();
    const o = ownerMap[code] || { qa: new Set(), other: new Set() };
    const inQa = [...o.qa].some((x) => x.toLowerCase().includes(p));
    const inOther = [...o.other].some((x) => x.toLowerCase().includes(p));
    return pscope === "qa" ? inQa : pscope === "other" ? inOther : (inQa || inOther);
  };
  const filtered = useMemo(() => objects.filter((o) => (o.name + o.code).toLowerCase().includes(q.toLowerCase()) && (cls === "all" || o.cls === cls) && (dept === "all" || o.dept === dept) && matchPerson(o.code)), [objects, q, cls, dept, person, pscope, ownerMap]);
  const counts = Object.keys(CLS).reduce((m, k) => { m[k] = objects.filter((o) => o.cls === k).length; return m; }, {});
  const head = ["Mã", "Tên / Lý do thẩm định", "Nhóm", "Bộ phận", "Phụ trách", "Khu vực", "Ảnh hưởng", "Chu kỳ", "TĐ?", "Trạng thái", ""];
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Filter size={15} color={C.plumSoft} /><span style={{ fontSize: 12.5, fontWeight: 800, color: C.plumSoft }}>Bộ phận:</span>
            <select value={dept} onChange={(e) => setDept(e.target.value)} style={{ ...INP, width: "auto", cursor: "pointer", padding: "8px 12px" }}><option value="all">Tất cả</option>{DEPTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", borderRadius: 12, border: `1.5px solid ${C.pinkSoft}`, background: "#fff", minWidth: 200 }}><Search size={15} color={C.lavText} /><input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Tìm theo người phụ trách…" style={{ border: "none", outline: "none", background: "transparent", fontFamily: TEXT, fontSize: 13.5, color: C.plum, width: "100%", fontWeight: 600 }} /></div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["all", "Tất cả"], ["qa", "QA phụ trách"], ["other", "Người khác"]].map(([id, lb]) => <button key={id} onClick={() => setPscope(id)} style={{ padding: "8px 13px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: TEXT, fontSize: 12, fontWeight: 800, background: pscope === id ? C.lavText : C.lavSoft, color: pscope === id ? "#fff" : C.lavText }}>{lb}</button>)}
          </div>
        </div>
      </Card>
      <Card variant="strong">
        <CardTitle icon={Boxes} sub="Lấy từ các sheet Danh sách của bạn — chỉnh sửa tại đây sẽ ghi ngược lên Google Sheet">Danh mục đối tượng thẩm định ({filtered.length})</CardTitle>
        <div style={{ overflowX: "auto" }} className="vmp-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: TEXT, minWidth: 880 }}>
            <thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: i >= 2 && i <= 9 ? "center" : "left", fontSize: 11, color: C.plumSoft, fontWeight: 800, letterSpacing: 0.5, padding: "0 12px 13px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map((o, i) => { const cl = CLS[o.cls]; const dp = DEPTS.find((d) => d.id === o.dept); const st = objStatus(o.code, acts); const ct = CRIT[o.crit] || CRIT.TB; const ow = ownerMap[o.code] || { qa: new Set(), other: new Set() }; const qaList = [...ow.qa].join(", "); const otList = [...ow.other].join(", "); return (
              <tr key={o.code} className="vmp-row" style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "13px 12px" }}><span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: cl.text, background: cl.soft, padding: "3px 8px", borderRadius: 8 }}>{o.code}</span></td>
                <td style={{ padding: "13px 12px", maxWidth: 280 }}><div style={{ fontSize: 13.5, color: C.plum, fontWeight: 700 }}>{o.name}</div><div style={{ fontSize: 11.5, color: C.plumSoft, marginTop: 2, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{o.reason}</div></td>
                <td style={{ padding: "13px 12px", textAlign: "center" }}><Tag color={cl.text} bg={cl.soft}>{cl.label}</Tag></td>
                <td style={{ padding: "13px 12px", textAlign: "center", fontSize: 13, color: C.plumSoft, fontWeight: 700 }}>{dp ? dp.short : "—"}</td>
                <td style={{ padding: "13px 12px", textAlign: "center", fontSize: 12.5, fontWeight: 700 }}>{qaList ? <span style={{ color: C.plum }}>{qaList}</span> : <span style={{ color: "#C9B6C7" }}>—</span>}{otList && <div style={{ fontSize: 11, color: C.lavText, fontWeight: 600, marginTop: 2 }}>+ {otList}</div>}</td>
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
const _qNow = Math.floor(VMP_TODAY.getMonth() / 3);
const PLABEL = {
  tuan: { t: "BÁO CÁO TUẦN", p: `Tuần chứa ${fmtVN(VMP_TODAY)}` },
  thang: { t: "BÁO CÁO THÁNG", p: `Tháng ${VMP_TODAY.getMonth() + 1}/${VMP_TODAY.getFullYear()}` },
  quy: { t: "BÁO CÁO QUÝ", p: `Quý ${["I", "II", "III", "IV"][_qNow]}/${VMP_TODAY.getFullYear()}` },
};
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
  const [detail, setDetail] = useState(null);
  // Trọng tâm: việc cần xử lý ngay — quá hạn trước (trễ nhiều nhất), rồi tới hạn gần nhất.
  const focus = acts.filter((a) => a.alert).sort((p, q) => { const ord = (x) => (x.alert.kind === "over" ? 0 : 1); return ord(p) !== ord(q) ? ord(p) - ord(q) : (p.alert.dleft || 0) - (q.alert.dleft || 0); }).slice(0, 6);
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

      <Card variant="strong" style={{ background: `linear-gradient(120deg,#fff,${C.raspSoft})` }}>
        <CardTitle icon={Flag} sub="Sắp theo độ gấp — quá hạn trước, rồi tới hạn gần nhất · Bấm 1 dòng để xem chi tiết">🎯 Trọng tâm cần xử lý ngay</CardTitle>
        {focus.length === 0 ? <div style={{ textAlign: "center", padding: 22, color: C.mintText, fontWeight: 800 }}>🎉 Tuyệt! Không có việc quá hạn hay sắp tới hạn.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {focus.map((a) => { const over = a.alert.kind === "over"; const ct = CRIT[a.crit] || CRIT.TB; const cls = CLS[a.cls] || CLS.tb; return (
              <div key={a.id} onClick={() => setDetail(a)} className="vmp-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 14, background: "#fff", cursor: "pointer", borderLeft: `4px solid ${over ? C.rasp : C.marigold}` }}>
                <div style={{ width: 50, textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontFamily: NUM, fontSize: 19, fontWeight: 800, color: over ? C.raspText : C.marigoldText }}>{over ? `−${Math.abs(a.alert.dleft)}` : a.alert.dleft}</div>
                  <div style={{ fontSize: 9.5, color: C.plumSoft, fontWeight: 700 }}>{over ? "ngày trễ" : "ngày tới"}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}><Tag color={cls.text} bg={cls.soft}>{a.vtype}</Tag><span style={{ fontFamily: TEXT, fontSize: 13.5, fontWeight: 800, color: C.plum, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span></div>
                  <div style={{ fontSize: 11.5, color: C.plumSoft, fontWeight: 600, marginTop: 2 }}>Cần làm: <b style={{ color: over ? C.raspText : C.marigoldText }}>{a.alert.stage}</b> · phụ trách {a.owner}</div>
                </div>
                <Tag color={ct.text} bg={ct.soft}>{a.crit}</Tag>
                <ChevronRight size={16} color={C.plumSoft} style={{ flexShrink: 0 }} />
              </div>
            ); })}
          </div>
        )}
      </Card>

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

      <MonthlyClimb acts={acts} />

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 2px 16px" }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: C.raspSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><Radar size={20} color={C.raspText} /></div>
          <div>
            <div style={{ fontFamily: TEXT, fontSize: 18, fontWeight: 800, color: C.plum }}>Cảnh báo &amp; Tái thẩm định</div>
            <div style={{ fontSize: 12.5, color: C.plumSoft, fontWeight: 600 }}>Bấm vào thẻ để lọc nhanh việc quá hạn · tới hạn · tái thẩm định sắp tới</div>
          </div>
        </div>
        <AlertsView acts={acts} />
      </div>

      <div style={{ textAlign: "center", padding: "8px 0 4px", fontFamily: TEXT, fontSize: 12, color: C.plumSoft, fontWeight: 700 }}>✨ VMP Monitor · CPC1 HN · V/Q Team — QLCL · EU GMP Annex 15 · WHO · PIC/S ✨</div>
      <ActivityDetailModal a={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/* ===================== App ===================== */

/* ===== MA TRẬN TẢI CÔNG VIỆC (Người × Tháng) — tích hợp từ bản người dùng ===== */
const WL_MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
const WL_QUARTERS = ["Quý 1", "Quý 2", "Quý 3", "Quý 4"];
// ⚙️ NGÀY CÔNG (ước lượng) — chỉnh các con số này cho khớp năng lực thực tế của đội:
const CAP_MONTH = 10;            // ngưỡng "đầy tải" (ngày công/tháng) — chỉnh theo năng lực đội
const CAP_HOSO_MONTH = 3;        // ngưỡng "nhiều hồ sơ"/tháng — chỉnh theo năng lực đội

const wlMonthOf = (a) => { if (!a.target) return -1; const m = Number(String(a.target).split("-")[1]); return (m >= 1 && m <= 12) ? m - 1 : -1; };
// "Đã xong" 1 pha — XÉT PHỦ ĐỊNH: "chưa hoàn thành" / "không đạt" KHÔNG phải xong.
const wlIsDone = (v) => { const s = String(v == null ? "" : v).toLowerCase(); const neg = /\b(chưa|chua|không|khong)\b/.test(s) || /^\s*(chưa|chua|không|khong)/.test(s); return !neg && /hoàn thành|hoan thanh|done|đạt|dat|✓|✔|100|xong/.test(s); };
const wlScore = (a) => { const s = Number(a.score); if (!isNaN(s) && s > 0) return s; return a.crit === "Cao" ? 8 : a.crit === "TB" ? 5 : 2; };

// Các pha CÒN LẠI (chưa xong) — đọc TRỰC TIẾP trạng thái từng pha trên Sheet.
function wlPending(a) {
  if (a.st === "done") return { p: false, v: false, r: false };
  const raw = a._raw || {};
  return { p: !wlIsDone(raw.tt_de_cuong), v: !wlIsDone(raw.tt_tham_dinh), r: !wlIsDone(raw.tt_bao_cao) };
}
// Ngày công CÒN LẠI = đúng cột "Số ngày công thẩm định thực tế" (cố định mỗi mã trên Sheet),
// tính cho MỌI hạng mục chưa chốt VMP. Đã chốt VMP → 0. KHÔNG ước lượng, KHÔNG trừ theo pha.
function congConLai(a) {
  if (a.st === "done") return 0;
  const e = Number(a.effort);
  return (!isNaN(e) && e > 0) ? e : 0;
}
// Hồ sơ (báo cáo) còn phải trả? — theo trạng thái báo cáo trên Sheet.
const hoSoConLai = (a) => a.st !== "done" && !wlIsDone((a._raw || {}).tt_bao_cao);

function WorkloadView({ acts }) {
  const [scope, setScope] = useState("month");   // month | quarter | year
  const [metric, setMetric] = useState("cong");  // cong | hoso
  const [detail, setDetail] = useState(null);     // { title, tasks } | null

  // Chỉ tính hạng mục CHƯA chốt hoàn thành VMP (còn việc để phân công).
  const pend = useMemo(() => acts.filter((a) => a.st !== "done" && wlMonthOf(a) >= 0), [acts]);

  const people = useMemo(() => {
    const map = {};
    pend.forEach((a) => {
      const mi = wlMonthOf(a);
      const owner = a.owner || "—";
      if (!map[owner]) map[owner] = { name: owner, months: Array.from({ length: 12 }, () => ({ tasks: [], cong: 0, hoso: 0 })), congTotal: 0, hosoTotal: 0, count: 0, over: 0, critCao: 0 };
      const o = map[owner], cell = o.months[mi];
      const c = congConLai(a), h = hoSoConLai(a) ? 1 : 0;
      cell.tasks.push(a); cell.cong += c; cell.hoso += h;
      o.congTotal += c; o.hosoTotal += h; o.count++;
      if (a.st === "over") o.over++;
      if (a.crit === "Cao") o.critCao++;
    });
    return Object.values(map).sort((x, y) => y.congTotal - x.congTotal);
  }, [pend]);

  const cols = scope === "month" ? WL_MONTHS : scope === "quarter" ? WL_QUARTERS : ["Cả năm"];
  const unitMonths = scope === "month" ? 1 : scope === "quarter" ? 3 : 12;
  const congCap = CAP_MONTH * unitMonths;
  const cap = metric === "cong" ? congCap : CAP_HOSO_MONTH * unitMonths;
  const monthsOfCol = (ci) => scope === "month" ? [ci] : scope === "quarter" ? [ci * 3, ci * 3 + 1, ci * 3 + 2] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const valIn = (p, ci) => sum(monthsOfCol(ci).map((mi) => metric === "cong" ? p.months[mi].cong : p.months[mi].hoso));
  const tasksIn = (p, ci) => monthsOfCol(ci).flatMap((mi) => p.months[mi].tasks);
  const peakMonth = (p) => { let mx = 0, mi = -1; p.months.forEach((m, i) => { if (m.cong > mx) { mx = m.cong; mi = i; } }); return { eff: mx, mi }; };

  const heat = (val, capv) => {
    const ratio = capv > 0 ? val / capv : 0;
    let color, text;
    if (ratio > 1) { color = C.rasp; text = C.raspText; }
    else if (ratio >= 0.85) { color = C.marigold; text = C.marigoldText; }
    else if (ratio >= 0.5) { color = C.sky; text = C.skyText; }
    else { color = C.mint; text = C.mintText; }
    const a = Math.round(clamp(0.2 + ratio * 0.55, 0.2, 0.9) * 255).toString(16).padStart(2, "0");
    return { bg: color + a, text };
  };

  const totalCong = sum(pend.map(congConLai));
  const totalHoso = pend.filter(hoSoConLai).length;
  const overloaded = people.filter((p) => peakMonth(p).eff > CAP_MONTH);
  const critCount = { Cao: 0, TB: 0, "Thấp": 0 }; pend.forEach((a) => { critCount[a.crit] = (critCount[a.crit] || 0) + 1; });
  const vtypeCount = {}; pend.forEach((a) => { vtypeCount[a.vtype] = (vtypeCount[a.vtype] || 0) + 1; });
  const focus = pend.filter((a) => a.crit === "Cao" || wlScore(a) >= 7).map((a) => ({ a, sc: wlScore(a) })).sort((x, y) => y.sc - x.sc || (parseD(x.a.target) - parseD(y.a.target))).slice(0, 8);

  const openDetail = (title, tasks) => { if (tasks.length) setDetail({ title, tasks }); };
  const Btn = ({ on, onClick, children }) => <button onClick={onClick} style={{ padding: "8px 15px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: TEXT, fontSize: 12.5, fontWeight: 800, background: on ? GRAD : C.pinkSoft, color: on ? "#fff" : C.plumSoft }}>{children}</button>;

  const mood = overloaded.length > 0 ? "stressed" : "happy";
  const bubble = overloaded.length > 0
    ? `Có ${overloaded.length} bạn đang quá tải ở tháng cao điểm đó nha! Bấm vào từng người xem việc rồi san bớt nhé 💪`
    : `Cả đội đang khá cân đối! Cứ giữ nhịp này là về đích VMP êm ru thôi ✨`;
  const legend = [["Nhẹ", C.mint], ["Vừa", C.sky], ["Sắp đầy", C.marigold], ["Quá tải", C.rasp]];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {detail && <WorkloadDetailModal detail={detail} onClose={() => setDetail(null)} />}

      {/* Hero + controls */}
      <Card variant="strong" style={{ background: `linear-gradient(120deg,#fff,${C.pinkMist})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0 }}><Mascot mood={mood} size={96} /></div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="pop" key={mood} style={{ background: "#fff", border: `1.5px solid ${C.pinkSoft}`, borderRadius: 18, padding: "12px 16px", fontFamily: TEXT, fontSize: 14, color: C.plum, fontWeight: 700, lineHeight: 1.5 }}>{bubble}</div>
            <div style={{ fontSize: 12.5, color: C.plumSoft, marginTop: 8, fontWeight: 700 }}>Còn lại (chưa chốt VMP): <b style={{ color: C.lavText }}>{totalCong} ngày công</b> · <b style={{ color: C.pinkText }}>{totalHoso} hồ sơ</b> phải trả · <b style={{ color: C.mintText }}>{people.length} người</b></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 16 }}>
          <div><div style={{ fontSize: 11.5, color: C.plumSoft, fontWeight: 800, marginBottom: 7 }}>KHUNG THỜI GIAN</div><div style={{ display: "flex", gap: 7 }}><Btn on={scope === "month"} onClick={() => setScope("month")}>Tháng</Btn><Btn on={scope === "quarter"} onClick={() => setScope("quarter")}>Quý</Btn><Btn on={scope === "year"} onClick={() => setScope("year")}>Năm</Btn></div></div>
          <div><div style={{ fontSize: 11.5, color: C.plumSoft, fontWeight: 800, marginBottom: 7 }}>MA TRẬN TÔ THEO</div><div style={{ display: "flex", gap: 7 }}><Btn on={metric === "cong"} onClick={() => setMetric("cong")}>Ngày công</Btn><Btn on={metric === "hoso"} onClick={() => setMetric("hoso")}>Hồ sơ</Btn></div></div>
        </div>
      </Card>

      {!acts.some((a) => Number(a.effort) > 0) && (
        <Card variant="strong" style={{ background: C.marigoldSoft, border: `1.5px solid ${C.marigold}` }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertCircle size={22} color={C.marigoldText} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontFamily: TEXT, fontSize: 13.5, color: C.plum, fontWeight: 700, lineHeight: 1.6 }}>
              Chưa đọc được <b>"Số ngày công thẩm định thực tế"</b> từ Google Sheet (tất cả đang = 0). Kiểm tra nhanh: (1) đã <b>dán lại node Code mới</b> trong n8n và Save chưa? (2) cột này trên Sheet đã có <b>số (vd 1–5)</b> ở các dòng chưa? (3) tải lại trang & bấm <b>Làm mới</b>. Khi đọc được, ô này sẽ tự ẩn.
            </div>
          </div>
        </Card>
      )}

      {/* Capacity cards */}
      <Card variant="strong">
        <CardTitle icon={Activity} sub="Ngày công & hồ sơ là 2 chỉ số tách riêng · thanh = tháng bận nhất so với ngưỡng · bấm vào thẻ để xem chi tiết công việc">Sức tải từng người (việc còn lại)</CardTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(262px,1fr))", gap: 14 }}>
          {people.map((p) => {
            const pk = peakMonth(p); const ratio = CAP_MONTH > 0 ? pk.eff / CAP_MONTH : 0;
            const band = ratio > 1 ? { l: "Quá tải", c: C.rasp, t: C.raspText, bg: C.raspSoft, e: "😵" } : ratio >= 0.6 ? { l: "Khá bận", c: C.marigold, t: C.marigoldText, bg: C.marigoldSoft, e: "🔥" } : { l: "Thong thả", c: C.mint, t: C.mintText, bg: C.mintSoft, e: "🌿" };
            return (
              <button key={p.name} className="rise" onClick={() => openDetail(`Việc còn lại của ${p.name}`, p.months.flatMap((m) => m.tasks))} style={{ textAlign: "left", cursor: "pointer", background: "#fff", border: `1.5px solid ${C.pinkSoft}`, borderRadius: 18, padding: 15, fontFamily: TEXT }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 999, background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontFamily: NUM, fontSize: 17, flexShrink: 0 }}>{p.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 15, color: C.plum }}>{p.name}</div><div style={{ fontSize: 11, color: C.plumSoft, fontWeight: 700 }}>{p.count} hạng mục chưa xong</div></div>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: band.t, background: band.bg, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{band.e} {band.l}</span>
                </div>
                <div style={{ display: "flex", gap: 9, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: C.lavSoft, borderRadius: 12, padding: "9px 11px" }}><div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 21, color: C.lavText, lineHeight: 1 }}>{p.congTotal}</div><div style={{ fontSize: 10.5, color: C.plumSoft, fontWeight: 700, marginTop: 2 }}>ngày công</div></div>
                  <div style={{ flex: 1, background: C.pinkSoft, borderRadius: 12, padding: "9px 11px" }}><div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 21, color: C.pinkText, lineHeight: 1 }}>{p.hosoTotal}</div><div style={{ fontSize: 10.5, color: C.plumSoft, fontWeight: 700, marginTop: 2 }}>hồ sơ phải trả</div></div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: C.plumSoft, marginBottom: 4 }}>
                  <span>Bận nhất: {pk.mi >= 0 ? WL_MONTHS[pk.mi] : "—"}</span>
                  <span style={{ color: band.t }}>{pk.eff}/{CAP_MONTH} nc · {Math.round(ratio * 100)}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: C.pinkSoft, overflow: "hidden" }}><div style={{ height: "100%", width: clamp(ratio, 0, 1) * 100 + "%", background: band.c, borderRadius: 999, transition: "width .9s ease" }} /></div>
                <div style={{ display: "flex", gap: 2, marginTop: 10, alignItems: "flex-end", height: 26 }}>
                  {cols.map((c, ci) => { const v = sum(monthsOfCol(ci).map((mi) => p.months[mi].cong)); const r = congCap > 0 ? v / congCap : 0; const col = r > 1 ? C.rasp : r >= 0.85 ? C.marigold : r >= 0.5 ? C.sky : C.mint; return <div key={ci} title={`${c}: ${v} nc`} style={{ flex: 1, height: v > 0 ? clamp(r, 0.06, 1) * 24 : 3, borderRadius: 3, background: v > 0 ? col : C.pinkSoft }} />; })}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {p.critCao > 0 && <Tag color={C.raspText} bg={C.raspSoft}>{p.critCao} trọng yếu cao</Tag>}
                  {p.over > 0 && <Tag color={C.marigoldText} bg={C.marigoldSoft}>{p.over} quá hạn</Tag>}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: C.pinkText, fontWeight: 800 }}>Xem chi tiết →</span>
                </div>
              </button>
            );
          })}
          {people.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 28, color: C.mintText, fontWeight: 700 }}>🎉 Không còn hạng mục nào chưa chốt VMP!</div>}
        </div>
      </Card>

      {/* Matrix */}
      <Card variant="strong">
        <CardTitle icon={BarChart3} right={<div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{legend.map(([l, c]) => <span key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.plum, fontWeight: 700 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: c }} />{l}</span>)}</div>} sub={`Mỗi ô = ${metric === "cong" ? "số ngày công còn lại" : "số hồ sơ phải trả"} đến hạn trong kỳ · bấm vào ô để xem hạng mục`}>Ma trận tải · Người × {scope === "month" ? "Tháng" : scope === "quarter" ? "Quý" : "Năm"}</CardTitle>
        <div style={{ overflowX: "auto" }} className="vmp-scroll">
          <table style={{ borderCollapse: "separate", borderSpacing: 5, minWidth: scope === "month" ? 880 : 440 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontSize: 11, color: C.plumSoft, fontWeight: 800, padding: "0 8px 8px", position: "sticky", left: 0, background: "#fff" }}>NGƯỜI</th>
                {cols.map((c, ci) => { const isNow = scope === "month" && ci === 5; return <th key={c} style={{ fontSize: 11, fontWeight: 800, color: isNow ? C.pinkText : C.plumSoft, padding: "0 4px 8px", minWidth: 54 }}>{c}{isNow ? " •" : ""}</th>; })}
                <th style={{ fontSize: 11, fontWeight: 800, color: C.plum, padding: "0 6px 8px" }}>TỔNG</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.name}>
                  <td style={{ padding: "4px 8px", position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 26, height: 26, borderRadius: 999, background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontFamily: NUM, fontSize: 12, flexShrink: 0 }}>{p.name[0]}</div><span style={{ fontFamily: TEXT, fontSize: 13, fontWeight: 800, color: C.plum, whiteSpace: "nowrap" }}>{p.name}</span></div>
                  </td>
                  {cols.map((c, ci) => {
                    const v = valIn(p, ci); const tasks = tasksIn(p, ci);
                    if (v <= 0) return <td key={ci} style={{ textAlign: "center" }}><div style={{ height: 42, borderRadius: 10, background: C.pinkMist }} /></td>;
                    const st = heat(v, cap);
                    return <td key={ci} style={{ textAlign: "center" }}>
                      <div onClick={() => openDetail(`${p.name} · ${c}`, tasks)} style={{ height: 42, borderRadius: 10, background: st.bg, border: `1px solid ${st.text}33`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 15, color: st.text, lineHeight: 1 }}>{v}</span>
                        <span style={{ fontSize: 8.5, color: st.text, fontWeight: 700, opacity: .85 }}>{metric === "cong" ? "nc" : "hồ sơ"} · {tasks.length}</span>
                      </div>
                    </td>;
                  })}
                  <td style={{ textAlign: "center" }}>
                    <div style={{ height: 42, borderRadius: 10, background: peakMonth(p).eff > CAP_MONTH ? C.raspSoft : C.lavSoft, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 15, color: peakMonth(p).eff > CAP_MONTH ? C.raspText : C.lavText, lineHeight: 1 }}>{metric === "cong" ? p.congTotal : p.hosoTotal}</span>
                      <span style={{ fontSize: 8.5, color: C.plumSoft, fontWeight: 700 }}>{metric === "cong" ? "nc" : "hồ sơ"}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {people.length > 0 && <tr>
                <td style={{ padding: "6px 8px", position: "sticky", left: 0, background: "#fff", fontSize: 11, fontWeight: 800, color: C.plumSoft }}>TỔNG/KỲ</td>
                {cols.map((c, ci) => { const tot = sum(people.map((p) => valIn(p, ci))); const hot = tot > cap * Math.max(people.length, 1) * 0.5; return <td key={ci} style={{ textAlign: "center", fontFamily: NUM, fontWeight: 800, fontSize: 13, color: hot ? C.raspText : C.plum }}>{tot || ""}</td>; })}
                <td style={{ textAlign: "center", fontFamily: NUM, fontWeight: 800, fontSize: 13, color: C.plum }}>{sum(people.map((p) => metric === "cong" ? p.congTotal : p.hosoTotal))}</td>
              </tr>}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: C.plumSoft, fontWeight: 600, lineHeight: 1.6 }}>Ngày công còn lại = cột <b style={{ color: C.pinkText }}>"Số ngày công thẩm định thực tế"</b> trên Google Sheet, tính cho hạng mục <b style={{ color: C.plum }}>chưa thẩm định xong</b> & chưa chốt VMP (đã xong → 0). Hồ sơ còn lại = số báo cáo chưa hoàn thành. Cột <b style={{ color: C.pinkText }}>T6 •</b> = tháng hiện tại.</div>
      </Card>

      {/* Distribution + Focus */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
        <Card variant="soft">
          <CardTitle icon={ShieldAlert} sub="Trong các hạng mục còn lại — theo mức trọng yếu & loại thẩm định">Phân bố trọng yếu & loại thẩm định</CardTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16 }}>
            <Donut size={132} segments={[{ value: critCount.Cao, color: C.rasp }, { value: critCount.TB, color: C.marigold }, { value: critCount["Thấp"], color: C.mint }]} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {[["Cao", C.rasp, C.raspText], ["TB", C.marigold, C.marigoldText], ["Thấp", C.mint, C.mintText]].map(([k, c, t]) => <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: C.plum }}><span style={{ width: 11, height: 11, borderRadius: 999, background: c }} />Trọng yếu {k}</span><span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 16, color: t }}>{critCount[k] || 0}</span></div>)}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {Object.entries(vtypeCount).sort((a, b) => b[1] - a[1]).map(([v, n]) => <span key={v} style={{ fontSize: 12, fontWeight: 800, color: C.lavText, background: C.lavSoft, padding: "5px 11px", borderRadius: 999, fontFamily: TEXT }}>{v} <b style={{ fontFamily: NUM }}>{n}</b></span>)}
            {Object.keys(vtypeCount).length === 0 && <span style={{ fontSize: 12, color: C.plumSoft, fontWeight: 600 }}>—</span>}
          </div>
        </Card>

        <Card variant="strong">
          <CardTitle icon={Flag} sub="Trọng yếu cao / điểm ≥ 7 & chưa hoàn thành — ưu tiên làm trước">Cần tập trung</CardTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {focus.map(({ a, sc }) => <div key={a.id} className="vmp-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 13, background: "#fff", border: `1px solid ${C.raspSoft}` }}>
              <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 13, color: "#fff", background: sc >= 7 ? C.raspText : C.marigoldText, width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sc}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><Tag color={C.lavText} bg={C.lavSoft}>{a.vtype}</Tag><span style={{ fontFamily: TEXT, fontSize: 13, fontWeight: 800, color: C.plum, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span></div>
                <div style={{ fontSize: 11.5, color: C.plumSoft, fontWeight: 600, marginTop: 1 }}>{a.owner} · {a.code} · đích {a.target ? fmtVN(parseD(a.target)) : "—"}</div>
              </div>
              <Pill s={a.st} small />
            </div>)}
            {focus.length === 0 && <div style={{ textAlign: "center", padding: 22, color: C.mintText, fontWeight: 700 }}>Không còn hạng mục trọng yếu cao tồn đọng 🎉</div>}
          </div>
        </Card>
      </div>

      <div style={{ textAlign: "center", padding: "4px 0", fontFamily: TEXT, fontSize: 12, color: C.plumSoft, fontWeight: 700 }}>✨ Mục tiêu: chia đầu việc đều tay, không ai quá tải — về đích VMP cùng nhau ✨</div>
    </div>
  );
}

// Modal chi tiết — hiện khi bấm vào thẻ người hoặc ô ma trận.
function WorkloadDetailModal({ detail, onClose }) {
  const tasks = [...detail.tasks].sort((a, b) => parseD(a.target) - parseD(b.target));
  const PhaseChip = ({ label, done, cong }) => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999, color: done ? C.mintText : C.marigoldText, background: done ? C.mintSoft : C.marigoldSoft }}>{done ? "✓" : "⏳"} {label}{!done && cong != null ? ` ${cong}nc` : ""}</span>;
  return (
    <Modal onClose={onClose} title={detail.title} icon={Activity} wide>
      <div style={{ fontSize: 12.5, color: C.plumSoft, fontWeight: 700, marginBottom: 14 }}>{tasks.length} hạng mục · còn lại <b style={{ color: C.lavText }}>{sum(tasks.map(congConLai))} ngày công</b> · <b style={{ color: C.pinkText }}>{tasks.filter(hoSoConLai).length} hồ sơ</b> phải trả</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tasks.map((a) => {
          const ph = wlPending(a);
          return (
            <div key={a.id} style={{ background: "#fff", border: `1.5px solid ${C.pinkSoft}`, borderRadius: 14, padding: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
                <Tag color={C.lavText} bg={C.lavSoft}>{a.vtype}</Tag>
                <span style={{ fontFamily: TEXT, fontSize: 14, fontWeight: 800, color: C.plum }}>{a.name}</span>
                <Pill s={a.st} small />
              </div>
              <div style={{ fontSize: 11.5, color: C.plumSoft, fontWeight: 600, marginBottom: 9 }}>{a.code} · {a.owner} · đích {a.target ? fmtVN(parseD(a.target)) : "—"} · còn <b style={{ color: C.lavText }}>{congConLai(a)} nc</b></div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <PhaseChip label="Đề cương" done={!ph.p} />
                <PhaseChip label="Thẩm định" done={!ph.v} cong={Number(a.effort) > 0 ? Number(a.effort) : null} />
                <PhaseChip label="Báo cáo" done={!ph.r} />
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}


const SUBS = {
  overview: "Theo dõi Kế hoạch Thẩm định Gốc (VMP) — CPC1 HN",
  timeline: "Lịch tổng thể & các mốc: Đề cương → Thẩm định → Báo cáo → Đích VMP",
  inventory: "Danh mục đối tượng theo 5 nhóm — đồng bộ Google Sheet",
  update: "Nhập kết quả thực tế (ngày & trạng thái) — ghi thẳng vào Google Sheet qua n8n",
  workload: "Ma trận tải công việc Người × Tháng — tránh quá tải & phân bổ đầu việc hợp lý",
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
  const reloadData = () => { const c = loadConn() || {}; connectSheet(c.readUrl || conn.readUrl, c.writeUrl || conn.writeUrl); };

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
          <Topbar title={title} user={user} sub={SUBS[view]} onRefresh={reloadData} refreshing={conn.status === "loading"} />
          <div style={{ padding: "0 34px 38px" }}>
            {objects.length === 0 && (
              <div style={{ marginBottom: 22, padding: "16px 18px", borderRadius: 16, border: `1.5px solid ${conn.status === "err" ? C.raspSoft : C.pinkSoft}`, background: conn.status === "err" ? C.raspSoft : "#fff", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: conn.status === "err" ? "#fff" : C.pinkMist, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {conn.status === "loading" ? <RefreshCw size={22} color={C.pink} className="spin" /> : conn.status === "err" ? <AlertCircle size={22} color={C.raspText} /> : <Cloud size={22} color={C.pink} />}
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontFamily: TEXT, fontWeight: 800, fontSize: 15, color: conn.status === "err" ? C.raspText : C.plum }}>
                    {conn.status === "loading" ? "Đang tải dữ liệu từ Google Sheet…" : conn.status === "err" ? "Chưa tải được dữ liệu" : conn.readUrl ? "Đang chờ đồng bộ với Google Sheet…" : "Chưa cấu hình kết nối dữ liệu"}
                  </div>
                  <div style={{ fontSize: 12.5, color: C.plumSoft, fontWeight: 600, marginTop: 3 }}>
                    {conn.msg || (conn.readUrl ? "Nếu chờ lâu, bấm Làm mới hoặc kiểm tra workflow n8n đang Active." : "Nhúng URL webhook n8n trong file src/lib/config.js rồi tải lại trang.")}
                  </div>
                </div>
                {conn.readUrl && <button onClick={reloadData} style={{ ...btnPrimary, padding: "10px 18px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}><RefreshCw size={15} /> Thử lại</button>}
              </div>
            )}
            {view === "overview" && <Overview acts={enriched} setView={setView} />}
            {view === "timeline" && <TimelineView acts={enriched} />}
            {view === "inventory" && <InventoryView objects={objects} acts={enriched} canEdit={isAdmin} onSave={saveObject} onDelete={deleteObject} conn={conn} />}
            {view === "update" && <UpdateView acts={enriched} conn={conn} isAdmin={isAdmin} onUpdate={updateActivity} />}
            {view === "risk" && <QrmView acts={enriched} />}
            {view === "workload" && <WorkloadView acts={enriched} />}
            {view === "reports" && <ReportsView acts={enriched} />}
          </div>
        </div>
      </main>
    </div>
  );
}
