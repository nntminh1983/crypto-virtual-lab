/* m4.js — Mô-đun 4: Mô hình Shannon — entropy, nén dữ liệu, kênh nhiễu và mã Hamming (Bài 7 · Bài 8)
   Tab: entropy · huffman · lzw · channel · linear · hamming.
   Mọi preset đã đối chiếu số với slide (ghi số slide trên nhãn preset). Mọi kết quả đều được tính lại khi đổi tham số. */
(function () {
"use strict";
const { h, ui, math, txt, chart } = LAB;
const svg = LAB.svg;
const PRESETS = []; LAB.m4presets = PRESETS; /* dùng khi tự kiểm tra: chạy mọi preset của mô-đun */

/* ----------------------------- tiện ích chung ----------------------------- */
const lg2 = x => Math.log(x) / Math.LN2;
const fv = (v, d = 3) => LAB.fmt(v, d).replace(".", ",");                       /* số thập phân kiểu Việt */
const pc = (v, d = 1) => isFinite(v) ? (100 * v).toFixed(d).replace(".", ",") + " %" : "—";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const isBits = s => /^[01]+$/.test(s);
const toBits = s => s.split("").map(Number);
const bstr = a => a.join("");
const xorv = (a, b) => a.map((x, i) => x ^ b[i]);
const wt = a => a.reduce((s, x) => s + x, 0);
const comb = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
const range = (a, b, st) => { const o = []; for (let x = a; x <= b + 1e-12; x += st) o.push(+x.toFixed(10)); return o; };
const presets = (items, lbl) => { PRESETS.push(...items); return ui.presets(items, lbl); };
const segSet = (el, v) => (el.set ? el : el.querySelector(".seg")).set(v);
const binom = (n, p, i) => comb(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
/* đại số GF(2) trên mảng bit */
const T = M => M[0].map((_, j) => M.map(r => r[j]));
const mulVM = (v, M) => M[0].map((_, j) => v.reduce((s, x, i) => s ^ (x & M[i][j]), 0));
const mulMM = (A, B) => A.map(r => mulVM(r, B));
function rref(M) {
  const A = M.map(r => r.slice()); const piv = []; let r = 0;
  for (let c = 0; c < A[0].length && r < A.length; c++) {
    let p = -1; for (let i = r; i < A.length; i++) if (A[i][c]) { p = i; break; }
    if (p < 0) continue;
    [A[r], A[p]] = [A[p], A[r]];
    for (let i = 0; i < A.length; i++) if (i !== r && A[i][c]) A[i] = xorv(A[i], A[r]);
    piv.push(c); r++;
  }
  return { A: A.slice(0, r), piv, rank: r };
}
/* H từ G bất kỳ: nếu G = [I_k | A] thì H = [Aᵀ | I_{n−k}]; tổng quát dùng dạng bậc thang rút gọn */
function parityCheck(G) {
  const { A, piv, rank } = rref(G); const n = G[0].length;
  const free = [...Array(n).keys()].filter(c => !piv.includes(c));
  const H = free.map(f => { const row = Array(n).fill(0); row[f] = 1; piv.forEach((pcol, i) => { row[pcol] = A[i][f]; }); return row; });
  return { H, rank, systematic: rank === G.length && piv.every((c, i) => c === i) };
}
function inverseGF2(M) {
  const n = M.length; const A = M.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => +(i === j))));
  for (let c = 0; c < n; c++) {
    let p = -1; for (let i = c; i < n; i++) if (A[i][c]) { p = i; break; }
    if (p < 0) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let i = 0; i < n; i++) if (i !== c && A[i][c]) A[i] = xorv(A[i], A[c]);
  }
  return A.map(r => r.slice(n));
}
function parseMat(text) {
  const rows = String(text).split(/\n|;/).map(s => s.replace(/\s+/g, "")).filter(Boolean);
  if (!rows.length) return { err: "Chưa nhập ma trận." };
  if (!rows.every(isBits)) return { err: "Ma trận chỉ gồm các bit 0/1, mỗi hàng một dòng." };
  const n = rows[0].length; if (!rows.every(r => r.length === n)) return { err: "Các hàng phải cùng độ dài." };
  return { M: rows.map(toBits) };
}
/* "A 0,4" mỗi dòng (cho phép 1/8, 40 %) → {src:[{s,p}] đã chuẩn hóa, sum} */
function parseSource(text) {
  const src = []; const lines = String(text).split(/\n|;/).map(l => l.trim()).filter(Boolean);
  for (const l of lines) {
    const m = l.match(/^([^\s:=]+)\s*[:=\s]\s*([0-9]*[.,]?[0-9]+(?:\/[0-9]+)?)\s*(%?)$/);
    if (!m) return { err: "Không đọc được dòng «" + esc(l) + "» — dùng dạng «A 0,4» mỗi dòng." };
    const v = m[2].replace(",", "."); let p = v.includes("/") ? Number(v.split("/")[0]) / Number(v.split("/")[1]) : Number(v);
    if (m[3]) p /= 100;
    if (!(p >= 0)) return { err: "Xác suất phải là số không âm." };
    if (src.some(x => x.s === m[1])) return { err: "Ký hiệu «" + esc(m[1]) + "» bị lặp." };
    src.push({ s: m[1], p });
  }
  if (src.length < 2) return { err: "Cần ít nhất 2 ký hiệu." };
  if (src.length > 26) return { err: "Tối đa 26 ký hiệu." };
  const sum = src.reduce((s, x) => s + x.p, 0);
  if (!(sum > 0)) return { err: "Tổng xác suất phải dương." };
  return { src: src.map(x => ({ s: x.s, p: x.p / sum })), sum };
}
const SRC_U = "A 0,4\nB 0,2\nC 0,15\nD 0,1\nE 0,05\nF 0,05\nG 0,05";
const SRC_T10 = "A 0,22\nE 0,2\nC 0,15\nD 0,12\nH 0,1\nN 0,08\nP 0,05\nR 0,04\nS 0,03\nT 0,01";
const SRC_DYAD = "a 1/2\nb 1/4\nc 1/8\nd 1/8";
const EN_TEXT = "Information theory studies the quantification, storage and communication of information. Claude Shannon showed in 1948 that every source has an entropy that limits how far it can be compressed without loss, and that every noisy channel has a capacity below which reliable communication is still possible. Compression removes redundancy before encryption, while channel coding adds controlled redundancy to fight errors.";
const VI_TEXT = "Ly thuyet thong tin nghien cuu cach do luong, luu tru va truyen tin. Shannon chi ra rang moi nguon tin co mot entropy gioi han kha nang nen khong ton hao, va moi kenh nhieu co mot dung luong ma duoi do van co the truyen tin tin cay. Nen du lieu loai bo du thua truoc khi ma hoa mat, con ma hoa kenh them du thua co kiem soat de chong loi tren duong truyen.";

/* ----------------------------- Huffman & Shannon–Fano ----------------------------- */
/* conv.tie: 'composite' (khi hòa gộp nút đã gộp trước — slide 5.4) | 'leaf' (ưu tiên lá — slide 5.6)
   conv.label: 'leaf1' (lá → 1, nút gộp → 0; cùng loại thì xác suất lớn → 1) | 'larger1' (xác suất lớn → 1) */
function huffman(src, conv) {
  let nodes = src.map((x, i) => ({ p: x.p, leaf: true, sym: x.s, name: x.s, idx: i, id: i, lo: i }));
  let nid = src.length; const merges = [];
  const key = n => [+n.p.toFixed(9), n.leaf ? (conv.tie === "composite" ? 1 : 0) : (conv.tie === "composite" ? 0 : 1), n.leaf ? -n.idx : -n.id];
  const cmp = (a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return 0; };
  const ord = n => n.leaf ? n.idx : n.id;
  while (nodes.length > 1) {
    nodes.sort(cmp); const a = nodes[0], b = nodes[1]; let one;
    if (conv.label === "leaf1" && a.leaf !== b.leaf) one = a.leaf ? a : b;
    else if (Math.abs(a.p - b.p) > 1e-12) one = a.p > b.p ? a : b;
    else one = ord(a) < ord(b) ? a : b;
    const zero = one === a ? b : a;
    const nn = { p: a.p + b.p, leaf: false, id: nid++, k0: zero, k1: one, lo: Math.min(a.lo, b.lo), name: [a, b].sort((x, y) => x.lo - y.lo).map(x => x.name).join("") };
    merges.push({ a, b, nn, zero, one }); nodes = nodes.filter(x => x !== a && x !== b); nodes.push(nn);
  }
  const codes = {};
  const walk = (n, pre) => { if (n.leaf) { n.code = pre || "0"; codes[n.sym] = n.code; } else { walk(n.k0, pre + "0"); walk(n.k1, pre + "1"); } };
  walk(nodes[0], ""); return { codes, root: nodes[0], merges };
}
/* Shannon–Fano: sắp giảm dần, chia hai nhóm liên tiếp có tổng gần nhau nhất (hòa → nhóm trên lớn hơn), trên = 1, dưới = 0 */
function shannonFano(src) {
  const items = src.map((x, i) => ({ s: x.s, p: x.p, i })).sort((a, b) => b.p - a.p || a.i - b.i);
  const codes = {}; items.forEach(x => { codes[x.s] = ""; }); const splits = [];
  const rec = list => {
    if (list.length < 2) return;
    const tot = list.reduce((s, x) => s + x.p, 0); let acc = 0, best = null;
    for (let i = 1; i < list.length; i++) { acc += list[i - 1].p; const d = Math.abs(2 * acc - tot); if (best == null || d <= best.d + 1e-12) best = { d, i }; }
    const top = list.slice(0, best.i), bot = list.slice(best.i); const col = {};
    top.forEach(x => { codes[x.s] += "1"; col[x.s] = "1"; }); bot.forEach(x => { codes[x.s] += "0"; col[x.s] = "0"; });
    splits.push({ col, top: top.map(x => x.s).join(","), bot: bot.map(x => x.s).join(","), pt: top.reduce((s, x) => s + x.p, 0), pb: bot.reduce((s, x) => s + x.p, 0) });
    rec(top); rec(bot);
  };
  rec(items); return { codes, splits, order: items };
}
/* vẽ cây Huffman bằng SVG: gốc trên, lá dưới, nhãn 0/1 trên cạnh, xác suất trong nút */
function treeSVG(root, nLeaves) {
  let li = 0, maxD = 0;
  const place = (n, d) => { n.d = d; maxD = Math.max(maxD, d); if (n.leaf) n.x = li++; else { place(n.k0, d + 1); place(n.k1, d + 1); n.x = (n.k0.x + n.k1.x) / 2; } };
  place(root, 0);
  const dx = 66, dy = 60, W = Math.max(320, nLeaves * dx + 20), Hh = (maxD + 1) * dy + 44;
  const X = n => 10 + dx / 2 + n.x * dx, Y = n => 24 + n.d * dy; const els = [];
  const edges = n => { if (n.leaf) return; [[n.k0, "0"], [n.k1, "1"]].forEach(([k, lab]) => {
    els.push(svg("line", { x1: X(n), y1: Y(n), x2: X(k), y2: Y(k), stroke: "var(--line)", "stroke-width": 1.5 }));
    const mx = (X(n) + X(k)) / 2, my = (Y(n) + Y(k)) / 2;
    els.push(svg("circle", { cx: mx, cy: my, r: 8.5, fill: "var(--panel)", stroke: "var(--line2)" }));
    els.push(svg("text", { x: mx, y: my + 4, "text-anchor": "middle", style: "font-weight:700;fill:" + (lab === "1" ? "var(--key)" : "var(--soft)") }, lab));
    edges(k); }); };
  edges(root);
  const all = []; const collect = n => { all.push(n); if (!n.leaf) { collect(n.k0); collect(n.k1); } }; collect(root);
  all.forEach(n => {
    if (n.leaf) {
      els.push(svg("rect", { x: X(n) - 25, y: Y(n) - 13, width: 50, height: 40, rx: 6, fill: "var(--pt-bg)", stroke: "var(--pt)" }));
      els.push(svg("text", { x: X(n), y: Y(n) + 3, "text-anchor": "middle", style: "font-weight:700;fill:var(--pt)" }, n.sym));
      els.push(svg("text", { x: X(n), y: Y(n) + 20, "text-anchor": "middle", class: "lbl" }, fv(n.p, n.p < 0.1 ? 3 : 2)));
      els.push(svg("text", { x: X(n), y: Y(n) + 40, "text-anchor": "middle", style: "fill:var(--key);font-size:11px" }, n.code));
    } else {
      els.push(svg("circle", { cx: X(n), cy: Y(n), r: 17, fill: n === root ? "var(--key-bg)" : "var(--sunk)", stroke: "var(--line2)" }));
      els.push(svg("text", { x: X(n), y: Y(n) + 4, "text-anchor": "middle", style: "font-size:11px" }, fv(n.p, 2)));
    }
  });
  return svg("svg", { class: "diag", viewBox: "0 0 " + W + " " + Hh, style: "max-width:" + W + "px" }, els);
}
/* giải mã tiền tố theo cây/bảng mã: trả về {parts:[{code,sym}], rest} */
function prefixDecode(bits, codes) {
  const inv = {}; Object.keys(codes).forEach(s => { inv[codes[s]] = s; });
  const parts = []; let cur = "";
  for (const b of bits) { cur += b; if (inv[cur] != null) { parts.push({ code: cur, sym: inv[cur] }); cur = ""; } }
  return { parts, rest: cur };
}

/* ----------------------------- LZW / LZ78 / RLE ----------------------------- */
function lzwEncode(s, init) {              /* init: mảng ký tự, mã = vị trí + 1 */
  const dict = new Map(init.map((c, i) => [c, i + 1])); let w = ""; const out = [], rows = [];
  for (const c of s) {
    if (!dict.has(c)) return { err: "Ký tự «" + esc(c) + "» không có trong từ điển khởi tạo." };
    if (dict.has(w + c)) w += c;
    else { const idx = dict.size + 1; out.push(dict.get(w)); dict.set(w + c, idx); rows.push({ w, c, code: dict.get(w), add: w + c, idx }); w = c; }
  }
  if (w) { out.push(dict.get(w)); rows.push({ w, c: "–", code: dict.get(w), add: "–", idx: "" }); }
  return { out, rows, size: dict.size };
}
function lzwDecode(codes, init) {
  const dict = new Map(init.map((c, i) => [i + 1, c])); let next = dict.size + 1; const rows = [];
  if (!dict.has(codes[0])) return { err: "Mã đầu tiên " + codes[0] + " không có trong từ điển khởi tạo." };
  let prev = dict.get(codes[0]), out = prev; rows.push({ k: codes[0], out: prev, add: "–", idx: "", special: false });
  for (const k of codes.slice(1)) {
    let cur, special = false;
    if (dict.has(k)) cur = dict.get(k); else if (k === next) { cur = prev + prev[0]; special = true; }
    else return { err: "Mã " + k + " chưa có trong từ điển (từ điển hiện có " + (next - 1) + " mục) — dãy mã không hợp lệ.", rows, out };
    out += cur; dict.set(next, prev + cur[0]); rows.push({ k, out: cur, add: prev + cur[0], idx: next, special }); next++; prev = cur;
  }
  return { out, rows };
}
function lz78(s) {
  const dict = new Map(); let w = ""; const rows = [];
  for (const c of s) { if (dict.has(w + c)) w += c; else { rows.push({ idx: w ? dict.get(w) : 0, c, phrase: w + c, n: dict.size + 1 }); dict.set(w + c, dict.size + 1); w = ""; } }
  if (w) rows.push({ idx: dict.get(w), c: "", phrase: w, n: "–", partial: true });
  return rows;
}
function rle(s) { const runs = []; for (const c of s) { if (runs.length && runs[runs.length - 1].c === c) runs[runs.length - 1].n++; else runs.push({ c, n: 1 }); } return runs; }

/* ----------------------------- Hamming [7,4] theo vị trí ----------------------------- */
const HPOS = [[0, 0, 0, 1, 1, 1, 1], [0, 1, 1, 0, 0, 1, 1], [1, 0, 1, 0, 1, 0, 1]]; /* hàng b₂ b₁ b₀, cột j = nhị phân của j */
const hamEnc = m => { const [d3, d5, d6, d7] = m; return [d3 ^ d5 ^ d7, d3 ^ d6 ^ d7, d3, d5 ^ d6 ^ d7, d5, d6, d7]; };
const hamSyn = r => HPOS.map(row => row.reduce((s, x, i) => s ^ (x & r[i]), 0));
const hamInfo = c => [c[2], c[4], c[5], c[6]];
const MC = { G: ["1000110", "0100101", "0010011", "0001111"].map(toBits), H: ["1101100", "1011010", "0111001"].map(toBits),
  S: ["1101", "1001", "0111", "1100"].map(toBits), perm: [2, 6, 0, 4, 1, 5, 3] /* cột j của Ĝ = cột perm[j] của S·G (tìm bằng thử 5040 hoán vị) */ };

LAB.module({
  id: "m4",
  tabs: [
  /* =============================== 1. ENTROPY =============================== */
  { id: "entropy", title: "Entropy nguồn", intro: "H(X) = −Σ p<sub>i</sub> log<sub>2</sub> p<sub>i</sub> (bit/ký hiệu), 0 ≤ H ≤ log<sub>2</sub> n, độ dư thừa R = 1 − H/H<sub>max</sub>. Ví dụ nguồn U (slide 3.3), hàm H(p) (slide 3.2) và entropy mật khẩu (slide 3.6).",
    build(pane) {
      const S = { mode: "table", text: SRC_U, doc: EN_TEXT, p: 0.1, N: 62, L: 10 };
      const { root, ctrl, view } = ui.sim();
      const seg = ui.seg({ id: "m4en-mode", label: "Nguồn tin", options: [["table", "Bảng xác suất"], ["text", "Từ văn bản"]], value: S.mode, onChange: v => { S.mode = v; sync(); draw(); } });
      const fTab = ui.field({ id: "m4en-src", label: "Ký hiệu và xác suất (mỗi dòng «A 0,4»; cho phép 1/8, 40 %)", type: "textarea", rows: 8, value: S.text, onInput: v => { S.text = v; draw(); } });
      const fDoc = ui.field({ id: "m4en-doc", label: "Đoạn văn (chỉ đếm 26 chữ A–Z sau khi bỏ dấu)", type: "textarea", rows: 8, value: S.doc, onInput: v => { S.doc = v; draw(); } });
      const sync = () => { fTab.style.display = S.mode === "table" ? "" : "none"; fDoc.style.display = S.mode === "text" ? "" : "none"; };
      const setTab = t => { S.mode = "table"; S.text = t; fTab.input.value = t; segSet(seg, "table"); sync(); draw(); };
      const setDoc = t => { S.mode = "text"; S.doc = t; fDoc.input.value = t; segSet(seg, "text"); sync(); draw(); };
      ctrl.append(seg, fTab, fDoc, presets([
        { label: "Nguồn U, 7 ký hiệu (slide 3.3) → H = 2,384", apply: () => setTab(SRC_U) },
        { label: "{1/2, 1/4, 1/8, 1/8} (slide 3.1) → 1,75", apply: () => setTab(SRC_DYAD) },
        { label: "Đồng xu lệch 0,9/0,1 → 0,469", apply: () => setTab("Ngửa 0,9\nSấp 0,1") },
        { label: "Xúc xắc đều → 2,585", apply: () => setTab("1 1/6\n2 1/6\n3 1/6\n4 1/6\n5 1/6\n6 1/6") },
        { label: "10 chữ cái (slide 5.6) → 2,966", apply: () => setTab(SRC_T10) },
        { label: "Văn bản tiếng Anh", apply: () => setDoc(EN_TEXT) },
        { label: "Văn bản tiếng Việt không dấu", apply: () => setDoc(VI_TEXT) }
      ]));
      sync();
      const out = ui.slot(); let cur = null;
      const barBox = chart.box(b => { if (!cur) return; chart.bars(b, { labels: cur.src.map(x => x.s), series: [{ name: "pᵢ", color: "pt", values: cur.src.map(x => x.p) }], ylabel: "pᵢ", fmtY: v => fv(v, 2), fmtTip: v => fv(v, 4), title: "Phân bố xác suất của nguồn", aspect: 0.4 }); });
      view.append(out, barBox);
      function draw() {
        let src, warn = null, textMode = S.mode === "text", nAlpha;
        if (!textMode) {
          const r = parseSource(S.text); if (r.err) { cur = null; out.render(ui.note(r.err, "eve")); return; }
          src = r.src; nAlpha = src.length;
          if (Math.abs(r.sum - 1) > 1e-6) warn = ui.note("Tổng xác suất nhập vào = " + fv(r.sum, 4) + " ≠ 1 — đã <b>chuẩn hóa</b> (chia mỗi p<sub>i</sub> cho tổng).", "key");
        } else {
          const c = txt.clean(S.doc); if (c.length < 10) { cur = null; out.render(ui.note("Cần ít nhất 10 chữ cái A–Z để ước lượng tần suất.", "eve")); return; }
          const f = txt.count(c); src = Object.keys(f).sort((a, b) => f[b] - f[a] || (a < b ? -1 : 1)).map(k => ({ s: k, p: f[k] / c.length, n: f[k] })); nAlpha = 26; src.total = c.length;
        }
        cur = { src };
        const H = math.entropy(src.map(x => x.p)), Hmax = lg2(nAlpha), R = 1 - H / Hmax, fixed = Math.ceil(lg2(nAlpha));
        const rows = src.map(x => [x.s, textMode ? x.n : { html: "" }, fv(x.p, 4), x.p > 0 ? fv(-lg2(x.p), 4) : "—", fv(x.p > 0 ? -x.p * lg2(x.p) : 0, 4)].filter((_, i) => textMode || i !== 1));
        rows.push(textMode ? ["Tổng", src.total, "1", "", { html: "<b>" + fv(H, 4) + "</b>" }] : ["Tổng", "1", "", { html: "<b>" + fv(H, 4) + "</b>" }]);
        const kids = [warn,
          ui.readouts([{ k: "H(X) bit/ký hiệu", v: fv(H, 3), kind: "pt", big: true }, { k: "H_max = log₂ " + nAlpha, v: fv(Hmax, 3), kind: "aqua" }, { k: "Độ dư thừa R = 1 − H/H_max", v: pc(R, 1), kind: "key" }, { k: "Mã cố định ⌈log₂ " + nAlpha + "⌉", v: fixed + " bit", kind: "ct" }]),
          ui.table(textMode ? ["Chữ", "Số lần", "pᵢ", "−log₂ pᵢ", "−pᵢ log₂ pᵢ"] : ["Ký hiệu", "pᵢ", "−log₂ pᵢ (lượng tin)", "−pᵢ log₂ pᵢ"], rows, { mono: true, cls: "tight", rowCls: (r, i) => i === rows.length - 1 ? "hi" : null })];
        if (textMode) {
          const Hen = math.entropy(Object.values(txt.freqEN).map(v => v / 100));
          kids.push(ui.note("Đây là entropy <b>bậc 0</b> (chỉ tần suất từng chữ, chưa xét phụ thuộc giữa các chữ). Bảng tần suất tiếng Anh chuẩn cho H ≈ " + fv(Hen, 2) + " bit/chữ; xét cả ngữ cảnh, Shannon (1951) ước lượng chỉ ≈ 1,0–1,5 bit/chữ ⇒ độ dư thừa thực ≈ 70 % (slide 3.7). Dư thừa này là thứ thám mã khai thác và nén loại bỏ.", "mut"));
        } else kids.push(ui.note("H = " + fv(H, 2) + " bit nhưng mã độ dài cố định cần " + fixed + " bit/ký hiệu ⇒ có thể nén tới " + pc(1 - H / fixed, 1) + " (định lý mã hóa nguồn: H ≤ L̄ < H + 1, xem tab Huffman).", "mut"));
        out.render(kids); barBox.draw();
      }
      draw();
      /* ---- hàm entropy nhị phân ---- */
      const roB = ui.slot(); let binBox;
      const rP = ui.range({ id: "m4en-p", label: "p (xác suất bit = 1)", min: 0, max: 1, step: 0.01, value: S.p, fmt: v => fv(v, 2), onInput: v => { S.p = v; drawBin(); } });
      binBox = chart.box(b => chart.line(b, {
        series: [
          { name: "H(p)", color: "pt", points: range(0, 1, 0.01).map(p => [p, math.H2(p)]) },
          { name: "p hiện tại", color: "key", points: [[S.p, math.H2(S.p)]], markerOnly: true, r: 6 }],
        xlabel: "p", ylabel: "H(p) [bit]", xmin: 0, xmax: 1, ymin: 0, ymax: 1.02, fmtX: v => fv(v, 1), fmtY: v => fv(v, 1),
        title: "Hàm entropy nhị phân H(p) = −p log₂ p − (1 − p) log₂(1 − p)", aspect: 0.42 }));
      function drawBin() {
        const p = S.p;
        roB.render(
          ui.readouts([{ k: "H(" + fv(p, 2) + ")", v: fv(math.H2(p), 3) + " bit", kind: "pt", big: true }, { k: "Mất entropy so với p = ½", v: fv(1 - math.H2(p), 3) + " bit", kind: "eve" }]),
          ui.note("Cực đại 1 bit tại p = ½, đối xứng, H(0) = H(1) = 0. Giá trị slide 3.2: H(0,05) = 0,286; H(0,1) = 0,469; H(0,2) = 0,722; H(0,3) = 0,881. Bit khóa lệch (p ≠ ½) ⇒ khóa mất entropy ⇒ dễ đoán hơn.", "mut"));
        binBox.draw();
      }
      view.append(ui.panel("Hàm entropy nhị phân H(p) — slide 3.2", rP, roB, binBox)); drawBin();
      /* ---- entropy của mật khẩu ---- */
      const PW = [["Mã PIN 4 chữ số", 10, 4], ["8 chữ thường a–z", 26, 8], ["8 ký tự in được (94)", 94, 8], ["12 ký tự in được (94)", 94, 12], ["6 từ Diceware (7776 từ)", 7776, 6], ["Khóa DES", 2, 56], ["Khóa AES-128", 2, 128]];
      const roP = ui.slot();
      const fN = ui.field({ id: "m4en-N", label: "Kích thước bảng chữ N", type: "number", min: 2, max: 100000, value: S.N, onInput: v => { S.N = +v; drawPw(); } });
      const fL = ui.field({ id: "m4en-L", label: "Độ dài L", type: "number", min: 1, max: 1024, value: S.L, onInput: v => { S.L = +v; drawPw(); } });
      function drawPw() {
        const ok = S.N >= 2 && S.L >= 1; const Hb = ok ? S.L * lg2(S.N) : NaN;
        const rows = PW.map(([t, N, L]) => [t, N + "^" + L, fv(L * lg2(N), 1)]);
        if (ok) rows.push(["Của bạn: N = " + S.N + ", L = " + S.L, S.N + "^" + S.L, fv(Hb, 1)]);
        roP.render(ui.table(["Bí mật (chọn ngẫu nhiên đều)", "Số khả năng N^L", "Entropy log₂(N^L) = L·log₂ N (bit)"], rows, { mono: true, cls: "tight", rowCls: (r, i) => ok && i === rows.length - 1 ? "hi" : null }),
          ok ? ui.note("Mật khẩu của bạn: H = " + S.L + " × log₂ " + S.N + " = " + S.L + " × " + fv(lg2(S.N), 3) + " = <b>" + fv(Hb, 1) + " bit</b>; vét cạn trung bình 2<sup>H−1</sup> ≈ 2<sup>" + fv(Hb - 1, 1) + "</sup> lần thử. Chỉ đúng khi chọn ngẫu nhiên đều — mật khẩu người đặt có entropy thực thấp hơn nhiều (slide 3.6). Bài tập 3.2: N = 62, L = 10 → 59,5 bit.", "key") : ui.note("N ≥ 2 và L ≥ 1.", "eve"));
      }
      view.append(ui.panel("Entropy của khóa và mật khẩu — slide 3.6", h("div", { class: "cols" }, fN, fL), roP)); drawPw();
      /* ---- entropy đồng thời, có điều kiện, tương hỗ (slide 3.4–3.5) ---- */
      S.joint = "1/2 1/4\n0 1/4";
      const roJ = ui.slot();
      const fJ = ui.field({ id: "m4en-joint", label: "Bảng p(x, y): mỗi dòng một giá trị của X, các cột là Y (cho phép 1/4, 0,25)", type: "textarea", rows: 3, value: S.joint, onInput: v => { S.joint = v; drawJoint(); } });
      const num = t => { t = t.replace(",", "."); if (t.includes("/")) { const [a, b] = t.split("/"); return Number(a) / Number(b); } return Number(t); };
      const setJ = t => { S.joint = t; fJ.input.value = t; drawJoint(); };
      function drawJoint() {
        const rows = S.joint.split(/\n|;/).map(l => l.trim()).filter(Boolean).map(l => l.split(/\s+/).map(num));
        const nc = rows.length ? rows[0].length : 0;
        if (!rows.length || nc < 1 || rows.some(r => r.length !== nc || r.some(v => !(v >= 0)))) { roJ.render(ui.note("Bảng p(x, y) phải là ma trận số không âm, các hàng cùng số cột.", "eve")); return; }
        const tot = rows.flat().reduce((s, v) => s + v, 0);
        if (!(tot > 0)) { roJ.render(ui.note("Tổng xác suất phải dương.", "eve")); return; }
        const P = rows.map(r => r.map(v => v / tot));
        const px = P.map(r => r.reduce((s, v) => s + v, 0)), py = P[0].map((_, j) => P.reduce((s, r) => s + r[j], 0));
        const HX = math.entropy(px), HY = math.entropy(py), HXY = math.entropy(P.flat());
        const Hxy = HXY - HY, Hyx = HXY - HX, I = HX + HY - HXY;
        roJ.render(
          Math.abs(tot - 1) > 1e-6 ? ui.note("Tổng = " + fv(tot, 4) + " ≠ 1 — đã chuẩn hóa.", "key") : null,
          ui.table(["p(x, y)"].concat(py.map((_, j) => "Y = " + j)).concat(["p(x)"]),
            P.map((r, i) => ["X = " + i].concat(r.map(v => fv(v, 3))).concat([{ html: "<b>" + fv(px[i], 3) + "</b>" }]))
              .concat([["p(y)"].concat(py.map(v => ({ html: "<b>" + fv(v, 3) + "</b>" }))).concat(["1"])]), { mono: true, cls: "tight" }),
          ui.table(["Đại lượng", "Tính", "Kết quả (bit)"], [
            ["H(X)", "H(" + px.map(v => fv(v, 3)).join("; ") + ")", fv(HX, 3)],
            ["H(Y)", "H(" + py.map(v => fv(v, 3)).join("; ") + ")", fv(HY, 3)],
            ["H(X, Y)", "−Σ p(x, y) log₂ p(x, y)", fv(HXY, 3)],
            ["H(X | Y)", "H(X, Y) − H(Y) = " + fv(HXY, 3) + " − " + fv(HY, 3), fv(Hxy, 3)],
            ["H(Y | X)", "H(X, Y) − H(X) = " + fv(HXY, 3) + " − " + fv(HX, 3), fv(Hyx, 3)],
            ["I(X; Y)", "H(X) − H(X | Y) = " + fv(HX, 3) + " − " + fv(Hxy, 3), fv(I, 3)]], { mono: true, cls: "tight", rowCls: (r, i) => i === 5 ? "hi" : null }),
          ui.note("I(X; Y) ≥ 0 và H(X | Y) ≤ H(X): «biết thêm không làm tăng bất định»; I = 0 ⇔ X, Y độc lập. Biết Y giảm bất định về X từ " + fv(HX, 3) + " xuống " + fv(Hxy, 3) + " bit. Bí mật hoàn hảo (slide 3.8) chính là I(M; C) = 0 — bản mã không cho biết gì về bản rõ.", I < 1e-9 ? "ok" : "mut"));
      }
      view.append(ui.panel("Entropy đồng thời, có điều kiện và thông tin tương hỗ — slide 3.5", fJ, presets([
        { label: "Slide 3.5: I(X; Y) = 0,311", apply: () => setJ("1/2 1/4\n0 1/4") },
        { label: "Độc lập: I = 0", apply: () => setJ("1/4 1/4\n1/4 1/4") },
        { label: "Y = X: I = H(X) = 1", apply: () => setJ("1/2 0\n0 1/2") },
        { label: "One-time pad 1 bit: p(m, c) đều", apply: () => setJ("0,25 0,25\n0,25 0,25") }
      ], "Ví dụ"), roJ)); drawJoint();
      /* ---- khoảng cách duy nhất (slide 3.7) ---- */
      S.HK = 23.5; S.D = 3.2;
      const roU = ui.slot();
      const fHK = ui.field({ id: "m4en-hk", label: "Entropy khóa H(K) (bit)", type: "number", min: 0, step: 0.1, value: S.HK, onInput: v => { S.HK = +v; drawUni(); } });
      const fD = ui.field({ id: "m4en-D", label: "Độ dư thừa D của ngôn ngữ (bit/chữ)", type: "number", min: 0.1, max: 4.7, step: 0.1, value: S.D, onInput: v => { S.D = +v; drawUni(); } });
      const lgFact = n => { let s = 0; for (let i = 2; i <= n; i++) s += lg2(i); return s; };
      function drawUni() {
        const ok = S.D > 0 && S.HK >= 0;
        const sys = [["Caesar", lg2(26)], ["Vigenère (khóa 5)", 5 * lg2(26)], ["Thay thế đơn (26!)", lgFact(26)], ["DES", 56], ["AES-128", 128]];
        const rows = sys.map(([t, hk]) => [t, fv(hk, 1), ok ? "≈ " + fv(hk / S.D, 1) + " chữ" : "—"]);
        if (ok) rows.push(["Của bạn: H(K) = " + fv(S.HK, 1), fv(S.HK, 1), "≈ " + fv(S.HK / S.D, 1) + " chữ"]);
        roU.render(ui.table(["Hệ mã", "H(K) (bit)", "n₀ ≈ H(K)/D"], rows, { mono: true, cls: "tight", rowCls: (r, i) => ok && i === rows.length - 1 ? "hi" : null }),
          ui.note("Tiếng Anh: tối đa log₂ 26 ≈ 4,7 bit/chữ, thực tế ≈ 1,5 ⇒ D ≈ 3,2 bit/chữ (~70 %). Khoảng cách duy nhất n₀ là số chữ bản mã tối thiểu để khóa được xác định về mặt thông tin; n₀ nhỏ <b>không</b> có nghĩa là dễ phá. Nén trước khi mã hóa làm D giảm ⇒ n₀ tăng. Bài tập 3.3: Vigenère khóa 5 → n₀ ≈ 7 chữ.", "mut"));
      }
      view.append(ui.panel("Dư thừa ngôn ngữ và khoảng cách duy nhất — slide 3.7", h("div", { class: "cols" }, fHK, fD), roU)); drawUni();
      pane.appendChild(root);
    } },

  /* =============================== 2. HUFFMAN =============================== */
  { id: "huffman", title: "Shannon–Fano & Huffman", intro: "Cùng một bảng xác suất: Shannon–Fano chia đôi từ gốc xuống (slide 5.1–5.2), Huffman gộp hai nút nhỏ nhất từ lá lên (slide 5.3–5.4). Hiệu suất η = H/L̄, kiểm tra Kraft Σ 2<sup>−l<sub>i</sub></sup> ≤ 1.",
    build(pane) {
      const S = { text: SRC_U, conv: "s54", enc: "BADC", dec: "0111001010" };
      const CONV = { s54: { tie: "composite", label: "leaf1" }, s56: { tie: "leaf", label: "larger1" } };
      const { root, ctrl, view } = ui.sim();
      const fSrc = ui.field({ id: "m4hf-src", label: "Ký hiệu và xác suất (mỗi dòng «A 0,4»)", type: "textarea", rows: 8, value: S.text, onInput: v => { S.text = v; draw(); } });
      const sConv = ui.seg({ id: "m4hf-conv", label: "Quy ước Huffman khi hòa / gán 0-1", options: [["s54", "Slide 5.4"], ["s56", "Slide 5.6"]], value: S.conv, onChange: v => { S.conv = v; draw(); } });
      const fEnc = ui.field({ id: "m4hf-enc", label: "Mã hóa chuỗi ký hiệu (Huffman)", mono: true, value: S.enc, onInput: v => { S.enc = v; draw(); } });
      const fDec = ui.field({ id: "m4hf-dec", label: "Giải mã dãy bit (Huffman)", mono: true, value: S.dec, onInput: v => { S.dec = v; draw(); } });
      const set = (t, conv, enc, dec) => { S.text = t; S.conv = conv; S.enc = enc; S.dec = dec; fSrc.input.value = t; segSet(sConv, conv); fEnc.input.value = enc; fDec.input.value = dec; draw(); };
      ctrl.append(fSrc, sConv, ui.note("<b>Slide 5.4</b>: khi hòa, gộp nút đã gộp trước; lá → nhánh 1, nút gộp → nhánh 0. <b>Slide 5.6</b>: khi hòa ưu tiên lá; xác suất lớn hơn → nhánh 1. Cả hai đều là Huffman hợp lệ: từ mã có thể khác nhưng L̄ luôn bằng nhau (tối ưu).", "mut"), fEnc, fDec, presets([
        { label: "Nguồn U (slide 5.2, 5.4, 5.5): giải mã 0111001010 → BADC", apply: () => set(SRC_U, "s54", "BADC", "0111001010") },
        { label: "10 chữ cái (slide 5.6): SPACE AND EARTH", apply: () => set(SRC_T10, "s56", "SPACEANDEARTH", "1110011010011100001101110000011110111100011111") },
        { label: "Bài tập 5.1: {0,5; 0,25; 0,125; 0,125}", apply: () => set(SRC_DYAD, "s54", "abacad", "1011001") },
        { label: "Nhị phân p = 0,9 theo cặp (slide 4.4)", apply: () => set("00 0,81\n01 0,09\n10 0,09\n11 0,01", "s54", "", "") }
      ]));
      const out = ui.slot(); view.append(out);
      function draw() {
        const r = parseSource(S.text); if (r.err) { out.render(ui.note(r.err, "eve")); return; }
        const src = r.src, H = math.entropy(src.map(x => x.p));
        const hf = huffman(src, CONV[S.conv]), sf = shannonFano(src);
        const Lh = src.reduce((s, x) => s + x.p * hf.codes[x.s].length, 0), Ls = src.reduce((s, x) => s + x.p * sf.codes[x.s].length, 0);
        const kraft = src.reduce((s, x) => s + Math.pow(2, -hf.codes[x.s].length), 0), kraftS = src.reduce((s, x) => s + Math.pow(2, -sf.codes[x.s].length), 0);
        const fixed = Math.ceil(lg2(src.length));
        const kids = [
          Math.abs(r.sum - 1) > 1e-6 ? ui.note("Tổng xác suất = " + fv(r.sum, 4) + " ≠ 1 — đã chuẩn hóa.", "key") : null,
          ui.readouts([{ k: "H(X)", v: fv(H, 3) + " bit", kind: "pt" }, { k: "L̄ Huffman", v: fv(Lh, 3) + " bit", kind: "key", big: true }, { k: "η Huffman = H/L̄", v: pc(H / Lh, 1), kind: "ok" }, { k: "L̄ Shannon–Fano", v: fv(Ls, 3) + " bit", kind: "ct" }, { k: "η Shannon–Fano", v: pc(H / Ls, 1), kind: "aqua" }, { k: "Mã cố định", v: fixed + " bit" }]),
          ui.note("Định lý mã hóa nguồn: H = " + fv(H, 2) + " ≤ L̄ = " + fv(Lh, 2) + " < H + 1 = " + fv(H + 1, 2) + (Lh >= H - 1e-9 && Lh < H + 1 ? " ✓" : " ✗") + ". So với mã cố định " + fixed + " bit, Huffman tiết kiệm " + pc(1 - Lh / fixed, 1) + ".", "mut")];
        /* bảng từ mã */
        kids.push(ui.panel("Bảng từ mã", ui.table(["Ký hiệu", "pᵢ", "Huffman", "lᵢ", "pᵢ·lᵢ", "Shannon–Fano", "lᵢ", "⌈−log₂ pᵢ⌉ (Shannon)"],
          src.map(x => [x.s, fv(x.p, 3),
            { html: "<b class='key-c'>" + hf.codes[x.s] + "</b>" }, hf.codes[x.s].length, fv(x.p * hf.codes[x.s].length, 3),
            { html: "<span class='ct-c'>" + sf.codes[x.s] + "</span>" }, sf.codes[x.s].length,
            x.p > 0 ? Math.ceil(-lg2(x.p) - 1e-9) : "—"])
            .concat([["L̄ / Kraft", "", { html: "Σ2^−l = " + fv(kraft, 3) }, "", { html: "<b>" + fv(Lh, 3) + "</b>" }, { html: "Σ2^−l = " + fv(kraftS, 3) }, { html: "<b>" + fv(Ls, 3) + "</b>" }, ""]]),
          { mono: true, cls: "tight", rowCls: (row, i) => i === src.length ? "hi" : null }),
          ui.note("Kraft–McMillan: mã tiền tố tồn tại ⇔ Σ 2<sup>−lᵢ</sup> ≤ 1. Huffman luôn cho dấu «=» (cây đầy đủ): " + fv(kraft, 3) + (Math.abs(kraft - 1) < 1e-9 ? " = 1 ✓" : " ≤ 1 ✓") + ". Không từ mã nào là tiền tố của từ mã khác ⇒ giải mã tức thời, không cần dấu phân cách.", "mut")));
        /* cây Huffman */
        kids.push(ui.panel("Cây Huffman (gộp từ lá lên gốc) — slide 5.3–5.4", treeSVG(hf.root, src.length),
          ui.table(["Bước", "Hai nút nhỏ nhất", "Nút mới", "Nhánh 0", "Nhánh 1"], hf.merges.map((m, i) => [i + 1, m.a.name + " (" + fv(m.a.p, 3) + ") + " + m.b.name + " (" + fv(m.b.p, 3) + ")", m.nn.name + " = " + fv(m.nn.p, 3), m.zero.name, m.one.name]), { mono: true, cls: "tight" })));
        /* Shannon–Fano */
        const ns = sf.splits.length;
        kids.push(ui.panel("Shannon–Fano (chia đôi từ gốc xuống) — slide 5.1–5.2",
          ui.table(["Ký hiệu", "pᵢ"].concat(sf.splits.map((_, i) => "B" + (i + 1))).concat(["Từ mã"]),
            sf.order.map(x => [x.s, fv(x.p, 3)].concat(sf.splits.map(sp => sp.col[x.s] == null ? "" : { html: sp.col[x.s] === "1" ? "<b class='key-c'>1</b>" : "0" })).concat([{ html: "<b class='ct-c'>" + sf.codes[x.s] + "</b>" }])), { mono: true, cls: "tight" }),
          ui.steps(sf.splits.slice(0, 12).map((sp, i) => ({ t: "B" + (i + 1) + ": {" + esc(sp.top) + "} = " + fv(sp.pt, 3) + " <b>| </b>{" + esc(sp.bot) + "} = " + fv(sp.pb, 3) + " (lệch " + fv(Math.abs(sp.pt - sp.pb), 3) + ")", r: "nhóm trên → 1, nhóm dưới → 0" }))),
          ns > 12 ? ui.note("… còn " + (ns - 12) + " lần chia nữa.", "mut") : null,
          ui.note("Chia hòa (lệch bằng nhau) → chọn nhóm trên lớn hơn, đúng như slide 5.2 ({A,B} | {C…G}). Nếu chia {A} | {B…G}, L̄ = 2,45: Shannon–Fano phụ thuộc cách chia, không luôn tối ưu.", "mut")));
        /* mã hóa / giải mã */
        const encIn = S.enc.replace(/\s+/g, "").toUpperCase(); const encRows = []; let encErr = null, encBits = "";
        const upper = {}; Object.keys(hf.codes).forEach(k => { upper[k.toUpperCase()] = k; });
        for (const ch of encIn) { const k = upper[ch]; if (k == null) { encErr = "Ký hiệu «" + esc(ch) + "» không có trong bảng (chỉ mã hóa được ký hiệu 1 chữ)."; break; } encRows.push({ sym: k, code: hf.codes[k] }); encBits += hf.codes[k]; }
        const decIn = S.dec.replace(/\s+/g, ""); const dec = isBits(decIn) || decIn === "" ? prefixDecode(decIn, hf.codes) : null;
        kids.push(ui.panel("Mã hóa và giải mã bằng mã Huffman — slide 5.5",
          encIn ? (encErr ? ui.note(encErr, "eve") : h("div", { class: "stack" },
            ui.bits(encRows.map(x => x.sym), { kind: "pt", label: "ký hiệu" }),
            ui.bits(encRows.map(x => x.code), { kind: "key", wide: true, label: "từ mã" }),
            ui.readouts([{ k: "Dãy bit", v: encBits, kind: "key" }, { k: "Độ dài", v: encBits.length + " bit so với " + encRows.length * fixed + " bit mã cố định", kind: "ok" }]))) : null,
          decIn === "" ? null : !dec ? ui.note("Dãy giải mã chỉ gồm bit 0/1.", "eve") : h("div", { class: "stack" },
            ui.bits(dec.parts.map(x => x.code).concat(dec.rest ? [dec.rest] : []), { kinds: dec.parts.map(() => "key").concat(dec.rest ? ["eve"] : []), wide: true, label: "tách" }),
            ui.bits(dec.parts.map(x => x.sym), { kind: "pt", label: "ký hiệu" }),
            ui.readouts([{ k: "Kết quả", v: dec.parts.map(x => x.sym).join(""), kind: "pt", big: true }]),
            dec.rest ? ui.note("Dư " + dec.rest.length + " bit «" + dec.rest + "» không ứng với từ mã nào — dãy bị cắt hoặc sai.", "eve") : ui.note("Đọc từ trái sang, đi từ gốc xuống lá; gặp lá thì xuất ký hiệu và quay về gốc — không cần dấu phân cách.", "ok"))));
        out.render(kids);
      }
      draw();
      /* ---- bất đẳng thức Kraft cho một dãy độ dài (slide 4.3) ---- */
      S.lens = "2 2 2 3 3";
      const roK = ui.slot();
      const fK = ui.field({ id: "m4hf-kraft", label: "Dãy độ dài từ mã l₁ … lₙ", mono: true, value: S.lens, onInput: v => { S.lens = v; drawKraft(); } });
      const setK = t => { S.lens = t; fK.input.value = t; drawKraft(); };
      function drawKraft() {
        const ls = S.lens.trim() ? S.lens.trim().split(/[\s,;]+/).map(Number) : [];
        if (!ls.length || ls.some(l => !Number.isInteger(l) || l < 1 || l > 30)) { roK.render(ui.note("Nhập các số nguyên 1…30 cách nhau bởi dấu cách.", "eve")); return; }
        const sum = ls.reduce((s, l) => s + Math.pow(2, -l), 0), ok = sum <= 1 + 1e-12;
        const sorted = ls.map((l, i) => ({ l, i })).sort((a, b) => a.l - b.l || a.i - b.i);
        const codes = []; let code = 0;                     /* mã tiền tố chính tắc: gán theo độ dài tăng dần */
        if (ok) sorted.forEach((x, k) => { codes[x.i] = LAB.bin(code, x.l); if (k + 1 < sorted.length) code = (code + 1) * Math.pow(2, sorted[k + 1].l - x.l); });
        roK.render(
          ui.readouts([
            { k: "Σ 2^−lᵢ", v: ls.map(l => "2^−" + l).join(" + ") + " = " + fv(sum, 4), kind: ok ? "ok" : "eve", big: true },
            { k: "Kết luận", v: ok ? (Math.abs(sum - 1) < 1e-12 ? "= 1: tồn tại mã tiền tố, cây đầy đủ ✓" : "≤ 1: tồn tại mã tiền tố ✓") : "> 1: không tồn tại mã tiền tố (và cả mã giải được duy nhất) ✗", kind: ok ? "ok" : "eve" }]),
          ok ? ui.bits(codes, { kind: "key", wide: true, label: "một mã tiền tố" }) : null,
          ui.note("Kraft–McMillan: tồn tại mã tiền tố nhị phân với độ dài l₁…lₙ ⇔ Σ 2<sup>−lᵢ</sup> ≤ 1; mọi mã giải được duy nhất cũng thỏa Kraft nên chỉ cần xét mã tiền tố. Từ mã độ dài l «chiếm» 2<sup>−l</sup> phần của cây nhị phân. Slide 4.3: (1, 2, 3, 3) = 1 ✓; (1, 1, 2) = 1,25 ✗; (2, 2, 2, 3, 3) = 1 ✓ → 00, 01, 10, 110, 111.", "mut"));
      }
      view.append(ui.panel("Bất đẳng thức Kraft–McMillan — slide 4.3", fK, presets([
        { label: "(2, 2, 2, 3, 3) = 1 ✓", apply: () => setK("2 2 2 3 3") },
        { label: "C₄: (1, 2, 3, 3) = 1 ✓", apply: () => setK("1 2 3 3") },
        { label: "(1, 1, 2) = 1,25 ✗", apply: () => setK("1 1 2") },
        { label: "Bài tập 4.2: (1, 2, 2, 3)", apply: () => setK("1 2 2 3") },
        { label: "Bài tập 4.2: (2, 2, 3, 3, 3, 3)", apply: () => setK("2 2 3 3 3 3") }
      ], "Ví dụ"), roK)); drawKraft();
      /* ---- mã hóa số học (slide 5.7) ---- */
      S.arP = "A 0,5\nB 0,3\nC 0,2"; S.arM = "ACB";
      const roA = ui.slot();
      const fAP = ui.field({ id: "m4hf-arp", label: "Xác suất (thứ tự dòng = thứ tự khoảng con)", type: "textarea", rows: 3, value: S.arP, onInput: v => { S.arP = v; drawAr(); } });
      const fAM = ui.field({ id: "m4hf-arm", label: "Thông điệp", mono: true, value: S.arM, onInput: v => { S.arM = v; drawAr(); } });
      const setA = (p, m) => { S.arP = p; S.arM = m; fAP.input.value = p; fAM.input.value = m; drawAr(); };
      function drawAr() {
        const r = parseSource(S.arP); if (r.err) { roA.render(ui.note(r.err, "eve")); return; }
        const msg = S.arM.replace(/\s+/g, "").toUpperCase().split(""); if (!msg.length || msg.length > 24) { roA.render(ui.note("Thông điệp 1–24 ký hiệu.", "eve")); return; }
        const idx = {}; r.src.forEach((x, i) => { idx[x.s.toUpperCase()] = i; });
        const cum = []; r.src.reduce((s, x) => { cum.push(s); return s + x.p; }, 0);
        let lo = 0, hi = 1; const rows = [["(bắt đầu)", "[0; 1)", "1"]];
        for (const ch of msg) { const i = idx[ch]; if (i == null) { roA.render(ui.note("Ký hiệu «" + esc(ch) + "» không có trong bảng.", "eve")); return; } const w = hi - lo; hi = lo + w * (cum[i] + r.src[i].p); lo = lo + w * cum[i]; rows.push([ch, "[" + fv(lo, 5) + "; " + fv(hi, 5) + ")", fv(hi - lo, 5)]); }
        let bits = null; for (let k = 1; k <= 40; k++) { const n = Math.ceil(lo * Math.pow(2, k)); if (n / Math.pow(2, k) < hi) { bits = { k, s: LAB.bin(n, k), v: n / Math.pow(2, k) }; break; } }
        /* giải mã kiểm tra: đi ngược từ số đã chọn */
        let dec = "", v = bits ? bits.v : 0; for (let t = 0; t < msg.length; t++) { let i = r.src.findIndex((x, j) => v >= cum[j] && v < cum[j] + x.p); if (i < 0) i = r.src.length - 1; dec += r.src[i].s; v = (v - cum[i]) / r.src[i].p; }
        roA.render(
          ui.table(["Ký hiệu", "Khoảng mới [lo; hi)", "Độ rộng = P(thông điệp)"], rows, { mono: true, cls: "tight", rowCls: (x, i) => i === rows.length - 1 ? "hi" : null }),
          bits ? ui.readouts([
            { k: "Số nhị phân ngắn nhất trong khoảng", v: fv(bits.v, 6) + " = 0," + bits.s + "₂", kind: "key" },
            { k: "Mã", v: bits.s + " (" + bits.k + " bit)", kind: "ct", big: true },
            { k: "−log₂ P = −log₂ " + fv(hi - lo, 5), v: fv(-lg2(hi - lo), 2) + " bit", kind: "pt" },
            { k: "Giải mã kiểm tra", v: dec + (dec.toUpperCase() === msg.join("") ? " ✓" : " ✗"), kind: "ok" }]) : ui.note("Khoảng quá hẹp để biểu diễn bằng 40 bit.", "eve"),
          ui.note("Mỗi ký hiệu thu hẹp khoảng hiện tại theo tỷ lệ xác suất; cả thông điệp thành một số thực trong [0, 1). Độ dài mã ≈ −log₂ P(thông điệp) ⇒ tiến rất sát H kể cả khi pᵢ lệch (Huffman tốn ≥ 1 bit/ký hiệu). Dùng trong JPEG 2000, H.264/H.265 (CABAC).", "mut"));
      }
      view.append(ui.panel("Mã hóa số học — slide 5.7", fAP, fAM, presets([
        { label: "Slide 5.7: ACB → 01111 (5 bit)", apply: () => setA("A 0,5\nB 0,3\nC 0,2", "ACB") },
        { label: "Nguồn lệch p = 0,9: AAAAAAAAAB", apply: () => setA("A 0,9\nB 0,1", "AAAAAAAAAB") }
      ], "Ví dụ"), roA)); drawAr();
      pane.appendChild(root);
    } },

  /* =============================== 3. LZW / LZ78 / RLE =============================== */
  { id: "lzw", title: "LZW · LZ78 · RLE", intro: "Nén từ điển không cần biết xác suất: LZ78 xuất cặp (chỉ số, ký tự) (slide 5.9); LZW khởi tạo từ điển bằng mọi ký tự đơn nên chỉ xuất chỉ số (slide 5.10–5.11); RLE thay loạt lặp bằng (số lần, ký hiệu) (slide 5.8).",
    build(pane) {
      const S = { alg: "lzw", s: "BABAABAAA", init: "chars", codes: "1 2 3 5", alpha: "AB" };
      const { root, ctrl, view } = ui.sim();
      const sAlg = ui.seg({ id: "m4lz-alg", label: "Thuật toán", options: [["lzw", "LZW"], ["lz78", "LZ78"], ["rle", "RLE"]], value: S.alg, onChange: v => { S.alg = v; sync(); draw(); } });
      const fS = ui.field({ id: "m4lz-s", label: "Chuỗi cần nén", mono: true, value: S.s, onInput: v => { S.s = v; draw(); } });
      const sInit = ui.seg({ id: "m4lz-init", label: "Từ điển khởi tạo LZW", options: [["chars", "Các ký tự xuất hiện (A=1, B=2…)"], ["ascii", "ASCII (1…256)"]], value: S.init, onChange: v => { S.init = v; draw(); } });
      const fC = ui.field({ id: "m4lz-codes", label: "Giải mã LZW: dãy mã (cách nhau bởi dấu cách)", mono: true, value: S.codes, onInput: v => { S.codes = v; draw(); } });
      const fA = ui.field({ id: "m4lz-alpha", label: "Bảng chữ của bộ giải mã (A=1, B=2, …)", mono: true, value: S.alpha, onInput: v => { S.alpha = v; draw(); } });
      const sync = () => { const lz = S.alg === "lzw"; sInit.style.display = lz ? "" : "none"; fC.style.display = lz ? "" : "none"; fA.style.display = lz && S.init === "chars" ? "" : "none"; };
      const set = (alg, s, codes, alpha) => { S.alg = alg; S.s = s; S.init = "chars"; if (codes != null) S.codes = codes; if (alpha != null) S.alpha = alpha; segSet(sAlg, alg); fS.input.value = s; segSet(sInit, "chars"); fC.input.value = S.codes; fA.input.value = S.alpha; sync(); draw(); };
      ctrl.append(sAlg, fS, sInit, fA, fC, presets([
        { label: "LZW: BABAABAAA → 2 1 3 4 1 7 (slide 5.10)", apply: () => set("lzw", "BABAABAAA", "1 2 3 5", "AB") },
        { label: "LZW giải mã 1 2 3 5 — trường hợp cScSc (slide 5.11)", apply: () => set("lzw", "ABABABA", "1 2 3 5", "AB") },
        { label: "Bài tập 5.4: giải mã 2 1 3 4 1 7", apply: () => set("lzw", "BABAABAAA", "2 1 3 4 1 7", "AB") },
        { label: "LZW: TOBEORNOTTOBEORTOBEORNOT (ASCII)", apply: () => { set("lzw", "TOBEORNOTTOBEORTOBEORNOT", null, null); S.init = "ascii"; segSet(sInit, "ascii"); sync(); draw(); } },
        { label: "LZ78: ABBCBCABABCAABCAAB (slide 5.9)", apply: () => set("lz78", "ABBCBCABABCAABCAAB") },
        { label: "Bài tập 5.3: LZ78 AABABBBABAABABBBABBABB", apply: () => set("lz78", "AABABBBABAABABBBABBABB") },
        { label: "Bài tập 5.2: RLE WWWWWBBWWWWWWWWBW", apply: () => set("rle", "WWWWWBBWWWWWWWWBW") },
        { label: "RLE dòng fax 67 điểm (slide 5.8)", apply: () => set("rle", "W".repeat(12) + "B" + "W".repeat(12) + "BBB" + "W".repeat(24) + "B" + "W".repeat(14)) }
      ]));
      sync();
      const out = ui.slot(); view.append(out);
      const ASCII = Array.from({ length: 256 }, (_, i) => String.fromCharCode(i));
      function draw() {
        const s = S.s.replace(/\s+/g, "").toUpperCase(); const kids = [];
        if (!s) { out.render(ui.note("Nhập một chuỗi (khoảng trắng bị bỏ, chữ được viết hoa).", "eve")); return; }
        if (s.length > 400) { out.render(ui.note("Giới hạn 400 ký tự để bảng còn đọc được.", "eve")); return; }
        if (S.alg === "lzw") {
          const init = S.init === "ascii" ? ASCII : [...new Set(s.split(""))].sort();
          const e = lzwEncode(s, init); if (e.err) { out.render(ui.note(e.err, "eve")); return; }
          const bitsPer = Math.max(1, Math.ceil(lg2(e.size + 1))), inBits = s.length * (S.init === "ascii" ? 8 : Math.max(1, Math.ceil(lg2(init.length))));
          kids.push(ui.readouts([
              { k: "Từ điển khởi tạo", v: S.init === "ascii" ? "256 ký tự ASCII" : init.map((c, i) => c + "=" + (i + 1)).join(", "), kind: "aqua" },
              { k: "Đầu ra", v: e.out.join(" "), kind: "ct", big: true },
              { k: "Số mã / số ký tự", v: e.out.length + " / " + s.length, kind: "key" },
              { k: "Ước lượng bit", v: inBits + " → " + e.out.length * bitsPer + " (" + bitsPer + " bit/mã)", kind: "ok" }]),
            ui.table(["w", "c", "Xuất mã(w)", "Thêm vào từ điển"], e.rows.map(r => [r.w, r.c, { html: "<b class='ct-c'>" + r.code + "</b>" }, r.add === "–" ? "–" : r.add + " = " + r.idx]), { mono: true, cls: "tight" }),
            ui.note("Quy tắc: w ← ký tự đầu; với mỗi c: nếu wc có trong từ điển thì w ← wc, ngược lại <b>xuất mã(w)</b>, thêm wc, w ← c. Cuối chuỗi xuất mã(w). Bộ giải mã dựng lại cùng từ điển ⇒ không cần gửi bảng. Chuỗi càng lặp, cụm càng dài, tỷ số nén càng cao (GIF, TIFF, compress).", "mut"));
          /* giải mã */
          const codes = S.codes.trim() ? S.codes.trim().split(/[\s,]+/).map(Number) : [];
          const dinit = S.init === "ascii" ? ASCII : [...new Set(S.alpha.replace(/\s+/g, "").toUpperCase().split(""))];
          if (codes.length && codes.every(k => Number.isInteger(k) && k >= 1) && dinit.length) {
            const d = lzwDecode(codes, dinit);
            const re = d.out ? lzwEncode(d.out, dinit) : null;
            kids.push(ui.panel("Giải mã LZW — slide 5.11",
              d.rows ? ui.table(["Đọc mã k", "Xuất từ điển[k]", "Thêm (chuỗi trước + ký tự đầu của chuỗi hiện tại)"],
                d.rows.map(r => [r.k + (r.special ? " (chưa có!)" : ""),
                  { html: "<b class='pt-c'>" + esc(r.out) + "</b>" + (r.special ? " = trước + ký tự đầu của trước" : "") },
                  r.add === "–" ? "–" : esc(r.add) + " = " + r.idx]),
                { mono: true, cls: "tight", rowCls: r => String(r[0]).includes("chưa") ? "hi" : null }) : null,
              d.err ? ui.note(d.err, "eve") : ui.readouts([{ k: "Kết quả", v: d.out, kind: "pt", big: true }, { k: "Mã hóa lại", v: re && !re.err ? re.out.join(" ") + (re.out.join(" ") === codes.join(" ") ? " ✓" : "") : "—", kind: "ok" }]),
              ui.note("Bộ giải mã chậm hơn bộ mã hóa một bước: chỉ thêm mục mới khi đã đọc mã tiếp theo. Trường hợp đặc biệt k = mục sắp được thêm (dạng cScSc): chuỗi = trước + ký tự đầu của trước.", "mut")));
          } else if (S.codes.trim()) kids.push(ui.note("Dãy mã giải mã phải là các số nguyên ≥ 1; bảng chữ không rỗng.", "eve"));
        } else if (S.alg === "lz78") {
          const rows = lz78(s); const nb = Math.max(1, Math.ceil(lg2(rows.length + 1)));
          kids.push(ui.readouts([{ k: "Đầu ra", v: rows.map(r => "(" + r.idx + "," + (r.c || "–") + ")").join(" "), kind: "ct", big: true }, { k: "Số cặp / số ký tự", v: rows.length + " / " + s.length, kind: "key" }, { k: "Ước lượng bit", v: s.length * 8 + " → " + rows.length * (nb + 8) + " (" + nb + " bit chỉ số + 8 bit ký tự)", kind: "ok" }]),
            ui.table(["Bước", "Cụm mới", "Chỉ mục", "Đầu ra (chỉ số của w, c)"], rows.map((r, i) => [i + 1, r.phrase, r.n, { html: "<b class='ct-c'>(" + r.idx + ", " + (r.c || "–") + ")</b>" + (r.partial ? " — cụm cuối đã có trong từ điển" : "") }]), { mono: true, cls: "tight" }),
            ui.note("Tìm cụm dài nhất w đã có trong từ điển, đọc thêm ký tự c, xuất (chỉ số của w, c) và thêm wc. Với chuỗi ngắn, đầu ra có thể dài hơn đầu vào — LZ chỉ có lợi khi văn bản đủ dài và lặp.", "mut"));
        } else {
          const runs = rle(s); const maxRun = Math.max(...runs.map(r => r.n)); const nb = Math.max(1, Math.ceil(lg2(maxRun + 1)));
          kids.push(ui.readouts([{ k: "RLE", v: runs.map(r => r.n + r.c).join(" "), kind: "ct", big: true }, { k: "Số cặp / số ký hiệu", v: runs.length + " / " + s.length, kind: "key" }, { k: "Ước lượng bit (nhị phân W/B)", v: s.length + " → " + runs.length * nb + " (" + nb + " bit độ dài, ký hiệu luân phiên)", kind: "ok" }]),
            ui.bits(s.split(""), { kinds: s.split("").map(c => c === "B" ? "ct" : c === "W" ? null : "pt"), label: "dòng" }),
            ui.table(["Loạt", "Ký hiệu", "Số lần"], runs.map((r, i) => [i + 1, r.c, r.n]), { mono: true, cls: "tight" }),
            ui.note("Fax nhóm 3 (Modified Huffman) = RLE độ dài loạt + mã Huffman cho các độ dài ⇒ nén ~10–20 lần trên trang giấy nhiều nền trắng. Dữ liệu ít lặp có thể dài hơn sau RLE.", "mut"));
        }
        out.render(kids);
      }
      draw(); pane.appendChild(root);
    } },

  /* =============================== 4. KÊNH BSC =============================== */
  { id: "channel", title: "Kênh BSC & dung lượng", intro: "Kênh nhị phân đối xứng BSC(p) lật mỗi bit với xác suất p: C = 1 − H(p) bit/lần dùng kênh (slide 6.1–6.2). Định lý Shannon: R &lt; C ⇒ tồn tại mã có lỗi nhỏ tùy ý (slide 6.3); mã lặp (slide 6.4) là ví dụ đơn giản nhất.",
    build(pane) {
      const S = { p: 0.1, n: 3, seed: 7 };
      const { root, ctrl, view } = ui.sim();
      const rP = ui.range({ id: "m4ch-p", label: "p (xác suất lật bit)", min: 0, max: 0.5, step: 0.005, value: S.p, fmt: v => fv(v, 3), onInput: v => { S.p = v; draw(); } });
      const sN = ui.seg({ id: "m4ch-n", label: "Mã lặp n lần", options: [[3, "n = 3"], [5, "n = 5"], [7, "n = 7"]], value: S.n, onChange: v => { S.n = +v; draw(); } });
      const set = (p, n) => { S.p = p; S.n = n; rP.set(p); segSet(sN, n); draw(); };
      ctrl.append(rP, sN, ui.btn("Chạy lại (đổi mầm ngẫu nhiên)", () => { S.seed = (S.seed * 16807 + 13) % 2147483647; draw(); }, "pri"), presets([
        { label: "BSC(0,1), lặp 3 (slide 6.4): C = 0,531; P_lỗi = 0,028", apply: () => set(0.1, 3) },
        { label: "BSC(0,1), lặp 5: 0,0086", apply: () => set(0.1, 5) },
        { label: "Bài tập 6.3: BSC(0,05), lặp 3", apply: () => set(0.05, 3) },
        { label: "Bài tập 6.1: p = 0,25", apply: () => set(0.25, 3) },
        { label: "p = 0,5: C = 0", apply: () => set(0.5, 3) }
      ]));
      const out = ui.slot(), sim = ui.slot();
      const capBox = chart.box(b => chart.line(b, {
        series: [
          { name: "C = 1 − H(p) (BSC)", color: "pt", points: range(0, 0.5, 0.005).map(p => [p, 1 - math.H2(p)]) },
          { name: "H(p)", color: "ct", points: range(0, 0.5, 0.005).map(p => [p, math.H2(p)]), dash: [4, 4] },
          { name: "C_BEC = 1 − ε", color: "aqua", points: [[0, 1], [0.5, 0.5]], dash: [2, 4] },
          { name: "p hiện tại", color: "key", points: [[S.p, 1 - math.H2(S.p)]], markerOnly: true, r: 6 }],
        xlabel: "p", ylabel: "bit / lần dùng kênh", xmin: 0, xmax: 0.5, ymin: 0, ymax: 1.02, fmtX: v => fv(v, 2), fmtY: v => fv(v, 1),
        title: "Dung lượng BSC(p) — slide 6.2", aspect: 0.42 }));
      const pe = (n, p) => { let s = 0; for (let i = Math.floor(n / 2) + 1; i <= n; i++) s += binom(n, p, i); return s; };
      const peBox = chart.box(b => chart.line(b, {
        series: [1, 3, 5, 7].map((n, i) => ({
          name: n === 1 ? "không mã (n = 1)" : "lặp n = " + n, color: ["eve", "key", "pt", "ok"][i],
          points: range(0.005, 0.5, 0.005).map(p => [p, pe(n, p)]), width: n === S.n ? 3 : 1.5 })),
        xlabel: "p", ylabel: "P_lỗi / bit (thang log)", xmin: 0, xmax: 0.5, ymin: 1e-5, ymax: 1, ylog: true, fmtX: v => fv(v, 2),
        vlines: [{ x: S.p, label: "p = " + fv(S.p, 3), color: "var(--key)" }], title: "Xác suất lỗi sau giải mã đa số", aspect: 0.45 }));
      view.append(out, capBox, sim, peBox);
      function draw() {
        const p = S.p, Hp = math.H2(p), C = 1 - Hp, n = S.n;
        const tbl = [0, 0.01, 0.1, 0.2, 0.5].map(q => [fv(q, 2), fv(math.H2(q), 3), fv(1 - math.H2(q), 3), fv(1 - q, 3)]);
        tbl.push([fv(p, 3) + " (hiện tại)", fv(Hp, 3), fv(C, 3), fv(1 - p, 3)]);
        out.render(
          ui.readouts([{ k: "p", v: fv(p, 3), kind: "eve" }, { k: "H(p)", v: fv(Hp, 3), kind: "ct" }, { k: "C_BSC = 1 − H(p)", v: fv(C, 3) + " bit", kind: "pt", big: true }, { k: "C_BEC(ε = p) = 1 − ε", v: fv(1 - p, 3) + " bit", kind: "aqua" }, { k: "Tốc độ mã lặp R = 1/" + n, v: fv(1 / n, 3), kind: "key" }]),
          ui.table(["p (BSC)", "H(p)", "C = 1 − H(p)", "C_BEC(ε = p)"], tbl, { mono: true, cls: "tight", rowCls: (r, i) => i === tbl.length - 1 ? "hi" : null }),
          ui.note("Định lý mã hóa kênh: R &lt; C ⇒ tồn tại mã có xác suất lỗi nhỏ tùy ý; R &gt; C ⇒ không thể. Với p = " + fv(p, 3) + ": R = 1/" + n + " = " + fv(1 / n, 3) + (1 / n < C ? " &lt; C = " + fv(C, 3) + " ⇒ có mã tốt hơn nhiều mã lặp (Hamming, LDPC…)." : " ≥ C = " + fv(C, 3) + " ⇒ không mã nào ở tốc độ này làm lỗi tiến về 0.") + " Kênh xóa BEC «dễ» hơn BSC cùng tham số vì bit mất được đánh dấu «?» thay vì bị lật âm thầm.", 1 / n < C ? "ok" : "eve"));
        /* mô phỏng 64 bit */
        const rng = LAB.rng(S.seed); const N = 64;
        const sent = Array.from({ length: N }, () => rng() < 0.5 ? 1 : 0);
        const recv = sent.map(b => rng() < p ? b ^ 1 : b); const errRaw = xorv(sent, recv);
        const dec = sent.map(b => { let ones = 0; for (let i = 0; i < n; i++) ones += (rng() < p ? b ^ 1 : b); return ones > n / 2 ? 1 : 0; }); const errDec = xorv(sent, dec);
        const rows = [1, 3, 5, 7].map(k => [k === 1 ? "Không mã" : "Lặp " + k, k === 1 ? "1" : "1/" + k, fv(pe(k, p), 4), k === 1 ? "p" : k === 3 ? "3p²(1−p) + p³" : k === 5 ? "10p³(1−p)² + 5p⁴(1−p) + p⁵" : "Σ_{i≥4} C(7,i) pⁱ(1−p)^{7−i}"]);
        rows.push(["Giới hạn Shannon", "≤ " + fv(C, 3), "→ 0", "mã đủ dài với R < C"]);
        sim.render(ui.panel("Mô phỏng: 64 bit qua BSC(" + fv(p, 3) + ") — không mã và mã lặp n = " + n,
          ui.bits(sent, { group: 8, kind: "pt", label: "gửi" }),
          ui.bits(recv, { group: 8, kinds: errRaw.map(e => e ? "eve" : null), label: "nhận" }),
          ui.bits(dec, { group: 8, kinds: errDec.map(e => e ? "eve" : "ok"), label: "lặp " + n }),
          ui.readouts([
            { k: "Lỗi không mã", v: wt(errRaw) + "/" + N + " = " + pc(wt(errRaw) / N, 1), kind: "eve" },
            { k: "Lỗi sau giải mã đa số (n = " + n + ")", v: wt(errDec) + "/" + N + " = " + pc(wt(errDec) / N, 1), kind: wt(errDec) ? "eve" : "ok" },
            { k: "Lý thuyết P_lỗi (n = " + n + ")", v: fv(pe(n, p), 4), kind: "key" },
            { k: "Băng thông", v: n + "× (" + N * n + " bit kênh cho " + N + " bit tin)", kind: "ct" }]),
          ui.steps([
            { t: "Mã hóa: 0 → " + "0".repeat(n) + ", 1 → " + "1".repeat(n) + " (R = 1/" + n + ")" },
            { t: "Giải mã theo đa số: sai khi ≥ " + (Math.floor(n / 2) + 1) + " trong " + n + " bit bị lật",
              r: "P_lỗi = Σ<sub>i&gt;n/2</sub> C(n,i) pⁱ(1−p)<sup>n−i</sup> = " + fv(pe(n, p), 4)
                + (n === 3 ? " = 3p²(1−p) + p³ = 3·" + fv(p * p, 4) + "·" + fv(1 - p, 2) + " + " + fv(p ** 3, 4) : ""), hi: true }]),
          ui.table(["Mã", "Tốc độ R", "P_lỗi / bit tại p = " + fv(p, 3), "Công thức"], rows, { mono: true, cls: "tight", rowCls: (r, i) => [1, 3, 5, 7][i] === n ? "hi" : null })));
        capBox.draw(); peBox.draw();
      }
      draw(); pane.appendChild(root);
    } },

  /* =============================== 5. MÃ TUYẾN TÍNH =============================== */
  { id: "linear", title: "Mã tuyến tính G, H", intro: "Mã [n, k, d]: c = m·G, c·H<sup>T</sup> = 0; G = [I<sub>k</sub> | A] ⇒ H = [A<sup>T</sup> | I<sub>n−k</sub>] (slide 2.4–2.6). Giải mã hội chứng: s = r·H<sup>T</sup> → đại diện lớp kề e → c = r + e (slide 3.1–3.5).",
    build(pane) {
      const S = { G: "100011\n010101\n001110", r: "101111" };
      const { root, ctrl, view } = ui.sim();
      const fG = ui.field({ id: "m4ln-G", label: "Ma trận sinh G (mỗi hàng một dòng, k ≤ 6, n ≤ 10)", type: "textarea", rows: 5, value: S.G, onInput: v => { S.G = v; draw(); } });
      const fR = ui.field({ id: "m4ln-r", label: "Từ nhận r", mono: true, value: S.r, onInput: v => { S.r = v; draw(); } });
      const set = (G, r) => { S.G = G; S.r = r; fG.input.value = G; fR.input.value = r; draw(); };
      ctrl.append(fG, fR, presets([
        { label: "[6,3,3] A = (011;101;110), r = 101111 (slide 2.4, 3.5)", apply: () => set("100011\n010101\n001110", "101111") },
        { label: "[6,3,3]: 2 lỗi, r = 100100 (slide 3.5 vd 2)", apply: () => set("100011\n010101\n001110", "100100") },
        { label: "Trappe [4,2] G = (1011;0110), r = 0101 (slide 3.1–3.3)", apply: () => set("1011\n0110", "0101") },
        { label: "[5,2,3] G = (11100;00111), r = 10100 (slide 1.5, 2.3)", apply: () => set("11100\n00111", "10100") },
        { label: "Bài tập 2.2: G = (10110;01011)", apply: () => set("10110\n01011", "11111") },
        { label: "Slide 2.9: d = 1, không sửa được lỗi", apply: () => set("10001\n01010\n00100", "00111") },
        { label: "Bài tập 3.2: r = 110111", apply: () => set("100011\n010101\n001110", "110111") }
      ]));
      const out = ui.slot(); view.append(out);
      function draw() {
        const pm = parseMat(S.G); if (pm.err) { out.render(ui.note(pm.err, "eve")); return; }
        const G = pm.M, k = G.length, n = G[0].length;
        if (k > 6 || n > 10 || k >= n) { out.render(ui.note("Cần k ≤ 6, n ≤ 10 và k < n (hiện k = " + k + ", n = " + n + ").", "eve")); return; }
        const { H, rank, systematic } = parityCheck(G);
        if (rank < k) { out.render(ui.note("Các hàng của G phụ thuộc tuyến tính (hạng = " + rank + " < k = " + k + ") — G không phải ma trận sinh hợp lệ; bỏ bớt hàng.", "eve")); return; }
        /* bảng từ mã */
        const cw = []; const cmap = new Map();
        for (let i = 0; i < (1 << k); i++) { const m = LAB.bin(i, k).split("").map(Number); const c = mulVM(m, G); cw.push({ m, c, w: wt(c) }); cmap.set(bstr(c), m); }
        const d = Math.min(...cw.filter(x => x.w > 0).map(x => x.w)); const t = Math.floor((d - 1) / 2);
        /* đại diện lớp kề */
        const lead = new Map(); const alpha = Array(n + 1).fill(0);
        const vecs = []; for (let v = 0; v < (1 << n); v++) vecs.push(LAB.bin(v, n).split("").map(Number)); vecs.sort((a, b) => wt(a) - wt(b));
        vecs.forEach(e => { const s = bstr(mulVM(e, T(H))); if (!lead.has(s)) { lead.set(s, e); alpha[wt(e)]++; } });
        /* slide 3.6: P_đúng = Σ αᵢ pⁱ(1−p)ⁿ⁻ⁱ (αᵢ đã là số mẫu lỗi, không nhân thêm C(n,i)) */
        const pw = (p, i) => Math.pow(p, i) * Math.pow(1 - p, n - i);
        const Pc = p => alpha.reduce((s, a, i) => s + a * pw(p, i), 0);
        const Pund = p => Object.keys(Ai).filter(w => +w > 0).reduce((s, w) => s + Ai[w] * pw(p, +w), 0);
        const kids = [ui.readouts([{ k: "Mã [n, k, d]", v: "[" + n + ", " + k + ", " + d + "]", kind: "pt", big: true }, { k: "Số từ mã 2^k", v: String(1 << k), kind: "aqua" }, { k: "Tốc độ R = k/n", v: fv(k / n, 3), kind: "key" }, { k: "Phát hiện s = d − 1", v: (d - 1) + " lỗi", kind: "ct" }, { k: "Sửa t = ⌊(d−1)/2⌋", v: t + " lỗi", kind: "ok" }]),
          ui.note(systematic ? "G = [I<sub>" + k + "</sub> | A] ở dạng hệ thống ⇒ H = [A<sup>T</sup> | I<sub>" + (n - k) + "</sub>]; k bit đầu của từ mã chính là tin." : "G <b>không</b> ở dạng hệ thống: H được tính từ dạng bậc thang rút gọn của G (cột trụ ↔ cột tự do); tin m được tra ngược từ bảng từ mã.", "mut"),
          h("div", { class: "cols" }, ui.panel("G (" + k + " × " + n + ")", ui.matrix(G, { cls: (i, j) => systematic && j < k ? "pt" : (systematic ? "key" : null) })), ui.panel("H (" + (n - k) + " × " + n + ")", ui.matrix(H, { cls: (i, j) => systematic && j >= k ? "pt" : (systematic ? "key" : null) })), ui.panel("Kiểm tra G·Hᵀ = 0", ui.matrix(mulMM(G, T(H)))))];
        const Ai = {}; cw.forEach(x => { Ai[x.w] = (Ai[x.w] || 0) + 1; });
        const sphere = (1 << k) * [...Array(t + 1).keys()].reduce((s, i) => s + comb(n, i), 0); /* giới hạn đóng gói cầu */
        kids.push(ui.panel("Bảng từ mã c = m·G và trọng số", ui.table(["Tin m", "Từ mã c", "wt(c)"], cw.map(x => [bstr(x.m), { html: systematic ? "<span class='pt-c'>" + bstr(x.c.slice(0, k)) + "</span> <span class='key-c'>" + bstr(x.c.slice(k)) + "</span>" : bstr(x.c) }, x.w]), { mono: true, cls: "tight", rowCls: x => x[2] === d ? "hi" : null }),
          ui.note("d(C) = trọng số nhỏ nhất của từ mã khác 0 = <b>" + d + "</b> (chỉ cần xét 2<sup>k</sup> − 1 từ mã thay vì mọi cặp). Phân bố trọng số A<sub>i</sub>: "
            + Object.keys(Ai).map(w => "A<sub>" + w + "</sub> = " + Ai[w]).join(", ")
            + ". Giới hạn Hamming: 2<sup>k</sup>·Σ<sub>i≤t</sub>C(n,i) = " + sphere
            + (sphere === (1 << n) ? " = 2ⁿ ⇒ mã hoàn hảo." : " < 2ⁿ = " + (1 << n) + " ⇒ không hoàn hảo."), "mut")));
        /* bảng hội chứng */
        const leadRows = [...lead.entries()].sort((a, b) => wt(a[1]) - wt(b[1]) || (a[0] < b[0] ? -1 : 1));
        kids.push(ui.panel("Bảng hội chứng → đại diện lớp kề (2^(n−k) = " + (1 << (n - k)) + " dòng)", ui.table(["Hội chứng s", "Đại diện e (trọng số nhỏ nhất)", "wt(e)"], leadRows.map(([s, e]) => [s, bstr(e), wt(e)]), { mono: true, cls: "tight" }),
          ui.note("α<sub>i</sub> (số đại diện trọng số i): " + alpha.map((a, i) => a ? "α<sub>" + i + "</sub> = " + a : null).filter(Boolean).join(", ")
            + ". Xác suất giải mã đúng P<sub>đúng</sub> = Σ α<sub>i</sub> pⁱ(1−p)<sup>n−i</sup>: p = 0,1 → <b>" + fv(Pc(0.1), 3) + "</b> (không mã hóa k bit: " + fv(Math.pow(0.9, k), 3) + "); p = 0,01 → " + fv(Pc(0.01), 4)
            + ". Lỗi không phát hiện P<sub>ẩn</sub> = Σ A<sub>i</sub> pⁱ(1−p)<sup>n−i</sup> (p = 0,1) = " + fv(Pund(0.1), 4) + " (slide 3.6).", "mut")));
        /* giải mã r */
        const r = S.r.replace(/\s+/g, "");
        if (!isBits(r) || r.length !== n) kids.push(ui.note("Từ nhận r phải gồm đúng " + n + " bit.", "eve"));
        else {
          const rv = toBits(r), s = mulVM(rv, T(H)), ss = bstr(s), e = lead.get(ss), c = xorv(rv, e), m = cmap.get(bstr(c));
          const colIdx = H[0].map((_, j) => bstr(H.map(row => row[j]))).indexOf(ss);
          kids.push(ui.panel("Giải mã hội chứng cho r = " + r,
            ui.bits(rv, { kinds: e.map(x => x ? "eve" : null), label: "r" }), ui.bits(e, { kinds: e.map(x => x ? "eve" : null), label: "e" }), ui.bits(c, { kind: "ok", label: "c = r + e" }), ui.bits(m, { kind: "pt", label: "m" }),
            ui.steps([{ t: "Hội chứng s = r·H<sup>T</sup> = " + H.map((row, i) => "(" + row.map((x, j) => x ? "r" + (j + 1) : null).filter(Boolean).join("+") + ")").join(", "), r: "s = " + ss + (ss === "0".repeat(n - k) ? " = 0 ⇒ r là từ mã (nhiều khả năng không lỗi)" : (colIdx >= 0 ? " = cột " + (colIdx + 1) + " của H" : " ≠ cột nào của H ⇒ ≥ 2 lỗi")), hi: true },
              { t: "Tra bảng: đại diện lớp kề có hội chứng s", r: "e = " + bstr(e) + " (wt = " + wt(e) + (wt(e) > t ? " > t = " + t + " — chỉ là một trong nhiều mẫu lỗi cùng hội chứng, có thể sửa sai" : "") + ")" },
              { t: "c = r + e; tin m" + (systematic ? " = " + k + " bit đầu" : " tra bảng từ mã"), r: "c = " + bstr(c) + ", m = <b>" + bstr(m) + "</b>" }]),
            wt(e) > t ? ui.note("Với d = " + d + " chỉ chắc chắn sửa được t = " + t + " lỗi; mẫu lỗi trọng số " + wt(e) + " cho cùng hội chứng với " + [...vecs.filter(v => wt(v) === wt(e) && bstr(mulVM(v, T(H))) === ss)].length + " mẫu khác ⇒ bảng chỉ chọn một đại diện.", "eve") : null));
        }
        out.render(kids);
      }
      draw(); pane.appendChild(root);
    } },

  /* =============================== 6. HAMMING [7,4] + McELIECE =============================== */
  { id: "hamming", title: "Hamming [7,4] & McEliece", intro: "Mã Hamming [7, 4] theo vị trí nhị phân: bit kiểm tra ở 1, 2, 4; hội chứng s = (b<sub>2</sub>b<sub>1</sub>b<sub>0</sub>) đọc như số nhị phân chỉ thẳng vị trí lỗi (slide 4.2–4.4). Mô phỏng trên BSC (slide 4.6) và hệ mật McEliece thu nhỏ (slide 6.3).",
    build(pane) {
      const S = { m: "1011", flips: new Set(), ext: false, p: 0.1, seed: 11, mm: "1101", epos: 5 };
      const { root, ctrl, view } = ui.sim();
      const fM = ui.field({ id: "m4hm-m", label: "Tin m = d₃ d₅ d₆ d₇ (4 bit)", mono: true, value: S.m, onInput: v => { S.m = v; draw(); } });
      const cExt = ui.check({ id: "m4hm-ext", label: "Mã mở rộng [8, 4, 4] — thêm bit chẵn lẻ tổng p₀ (SECDED)", value: S.ext, onChange: v => { S.ext = v; draw(); } });
      const set = (m, flips, ext) => { S.m = m; S.flips = new Set(flips); S.ext = ext; fM.input.value = m; cExt.input.checked = ext; draw(); };
      const setFromR = r => { const rv = toBits(r.slice(0, 7)); const s = hamSyn(rv), pos = s[0] * 4 + s[1] * 2 + s[2]; const c = rv.slice(); if (pos) c[pos - 1] ^= 1; const m = bstr(hamInfo(c)); const fl = []; rv.forEach((b, i) => { if (b !== c[i]) fl.push(i + 1); }); if (r.length === 8 && (+r[7]) !== wt(c) % 2) fl.push(8); set(m, fl, r.length === 8); };
      ctrl.append(fM, cExt, ui.note("Bấm vào ô bit của <b>từ nhận r</b> để lật (tạo 1 hoặc 2 lỗi).", "mut"), ui.btn("Xóa mọi lỗi", () => { S.flips.clear(); draw(); }, "sm"), presets([
        { label: "m = 1011 → c = 0110011 (slide 4.2)", apply: () => set("1011", [], false) },
        { label: "Lỗi bit 6 → s = 110 (slide 4.3)", apply: () => set("1011", [6], false) },
        { label: "Lỗi bit 2 và 6 → s = 100, sửa nhầm bit 4 (slide 4.3)", apply: () => set("1011", [2, 6], false) },
        { label: "[8,4,4]: 2 lỗi được phát hiện (slide 4.4)", apply: () => set("1011", [2, 6], true) },
        { label: "Bài tập 4.1: m = 0101", apply: () => set("0101", [], false) },
        { label: "Bài tập 4.2: giải mã r = 1011011", apply: () => setFromR("1011011") },
        { label: "Bài tập 4.4: r = 01100100 (mở rộng)", apply: () => setFromR("01100100") }
      ]));
      const out = ui.slot(); view.append(out);
      function draw() {
        const m = S.m.replace(/\s+/g, "");
        if (!isBits(m) || m.length !== 4) { out.render(ui.note("Tin m phải gồm đúng 4 bit.", "eve")); return; }
        const mv = toBits(m), c = hamEnc(mv), p0 = wt(c) % 2; const nb = S.ext ? 8 : 7;
        const full = S.ext ? c.concat([p0]) : c;
        const r = full.map((b, i) => S.flips.has(i + 1) ? b ^ 1 : b);
        const s = hamSyn(r.slice(0, 7)), pos = s[0] * 4 + s[1] * 2 + s[2], ss = bstr(s);
        const par = wt(r) % 2; /* chẵn lẻ tổng (8 bit) */
        const nErr = [...S.flips].filter(x => x <= nb).length;
        const kindsC = full.map((_, i) => (i + 1 === 1 || i + 1 === 2 || i + 1 === 4) ? "key" : i === 7 ? "ct" : "pt");
        let fixed = r.slice(), verdict, verdictKind = "ok", action;
        if (S.ext) {
          if (pos === 0 && par === 0) { verdict = "s = 0, chẵn lẻ đúng ⇒ không lỗi"; action = "giữ nguyên"; }
          else if (pos !== 0 && par === 1) { fixed[pos - 1] ^= 1; verdict = "s ≠ 0, chẵn lẻ sai ⇒ 1 lỗi tại vị trí s = " + pos + " — sửa"; action = "lật bit " + pos; }
          else if (pos === 0 && par === 1) { fixed[7] ^= 1; verdict = "s = 0, chẵn lẻ sai ⇒ lỗi ở bit p₀ — sửa"; action = "lật bit 8"; }
          else { verdict = "s = " + ss + " ≠ 0 nhưng chẵn lẻ tổng vẫn đúng ⇒ <b>2 lỗi — chỉ phát hiện, không sửa</b>"; verdictKind = "eve"; action = "báo lỗi kép, yêu cầu gửi lại"; }
        } else { if (pos) fixed[pos - 1] ^= 1; verdict = pos ? "s = " + ss + "₂ = " + pos + " ⇒ lật bit " + pos : "s = 000 ⇒ không lỗi"; action = pos ? "lật bit " + pos : "giữ nguyên"; }
        const mOut = hamInfo(fixed); const okDec = bstr(mOut) === m && (!S.ext || verdictKind !== "eve");
        if (S.ext && verdictKind === "eve") { /* phát hiện 2 lỗi: không trả tin */ }
        else if (!okDec) { verdictKind = "eve"; verdict += " — <b>sai!</b> (" + nErr + " lỗi vượt khả năng sửa t = 1 ⇒ thêm lỗi mới)"; }
        const kids = [
          ui.readouts([
            { k: "Tin m", v: m, kind: "pt" },
            { k: "Từ mã c", v: LAB.grp(bstr(full), 7, " "), kind: "key", big: true },
            { k: "Số lỗi đưa vào", v: String(nErr), kind: nErr ? "eve" : "ok" },
            { k: "Hội chứng s = b₂b₁b₀", v: ss + " = " + pos, kind: "ct" },
            S.ext ? { k: "Chẵn lẻ tổng của r", v: par ? "lẻ (sai)" : "chẵn (đúng)", kind: par ? "eve" : "ok" } : null].filter(Boolean)),
          ui.bits(full.map((_, i) => String(i + 1)), { label: "vị trí", dim: new Set(full.map((_, i) => i)) }),
          ui.bits(full, { kinds: kindsC, label: "gửi c" }),
          ui.bits(r, { kinds: r.map((b, i) => S.flips.has(i + 1) ? "eve" : kindsC[i]), label: "nhận r", onClick: i => { if (S.flips.has(i + 1)) S.flips.delete(i + 1); else S.flips.add(i + 1); draw(); } }),
          ui.bits(fixed, { kinds: fixed.map((b, i) => b !== full[i] ? "eve" : (b !== r[i] ? "ok" : kindsC[i])), label: "sửa" }),
          ui.bits(mOut, { kind: okDec ? "ok" : "eve", label: "tin ra" }),
          ui.steps([
            { t: "Mã hóa: bit tin ở 3, 5, 6, 7; bit kiểm tra ở 1, 2, 4 (lũy thừa của 2)",
              r: "p₁ = d₃+d₅+d₇ = " + mv[0] + "+" + mv[1] + "+" + mv[3] + " = " + c[0]
                + "; p₂ = d₃+d₆+d₇ = " + mv[0] + "+" + mv[2] + "+" + mv[3] + " = " + c[1]
                + "; p₄ = d₅+d₆+d₇ = " + mv[1] + "+" + mv[2] + "+" + mv[3] + " = " + c[3] + (S.ext ? "; p₀ = Σcᵢ = " + p0 : "") },
            { t: "Hội chứng: cột j của H là nhị phân của j ⇒ s = r·H<sup>T</sup>", r: "b₂ = r₄+r₅+r₆+r₇ = " + s[0] + "; b₁ = r₂+r₃+r₆+r₇ = " + s[1] + "; b₀ = r₁+r₃+r₅+r₇ = " + s[2] + " ⇒ s = " + ss + "₂ = " + pos, hi: true },
            { t: "Quyết định: " + verdict, r: action + " ⇒ tin (3, 5, 6, 7) = " + bstr(mOut) + (S.ext && verdictKind === "eve" ? " (không tin cậy)" : "") }]),
          ui.note(verdictKind === "ok" ? (nErr ? "Sửa đúng: Hamming [7,4] sửa mọi lỗi đơn — mã hoàn hảo 2⁴·(1+7) = 2⁷." : "Không lỗi: s = 0.") : (S.ext ? "Mã mở rộng d = 4: sửa 1 lỗi <b>và</b> phát hiện 2 lỗi (SECDED, dùng trong RAM ECC [72, 64])." : "Hai lỗi cho hội chứng = XOR hai cột ⇒ chỉ thẳng vào một bit <b>khác</b> ⇒ sửa nhầm, thêm lỗi thứ ba. Khắc phục: bật mã mở rộng [8, 4, 4]."), verdictKind),
          ui.panel("Ma trận H theo vị trí nhị phân (slide 4.2)", ui.matrix([["j", 1, 2, 3, 4, 5, 6, 7]].concat(HPOS.map((row, i) => [["b₂", "b₁", "b₀"][i]].concat(row))), { cls: (i, j) => i === 0 || j === 0 ? "hi" : (pos && j === pos && i > 0 ? "eve" : null) }))];
        if (S.ext) kids.push(ui.panel("Bảng quyết định SECDED (slide 4.4)",
          ui.table(["Hội chứng s", "Chẵn lẻ tổng", "Kết luận"],
            [["= 0", "đúng", "Không lỗi"], ["≠ 0", "sai", "1 lỗi — sửa tại vị trí s"], ["= 0", "sai", "Lỗi ở bit p₀"], ["≠ 0", "đúng", "2 lỗi — chỉ phát hiện"]],
            { cls: "tight", rowCls: (row, i) => [pos === 0 && par === 0, pos !== 0 && par === 1, pos === 0 && par === 1, pos !== 0 && par === 0][i] ? "hi" : null })));
        out.render(kids);
      }
      draw();
      /* ---- mô phỏng BSC ---- */
      const simOut = ui.slot(); let mcPts = null;
      const rP = ui.range({ id: "m4hm-p", label: "p của kênh BSC", min: 0.001, max: 0.3, step: 0.001, value: S.p, fmt: v => fv(v, 3), onInput: v => { S.p = v; drawSim(); } });
      /* Monte Carlo: N khối 4 bit, mỗi khối gửi thô (4 bit) và gửi qua Hamming (7 bit) trên cùng BSC(p) */
      const simHam = (p, N, rng) => {
        let okU = 0, okH = 0;
        for (let b = 0; b < N; b++) {
          const mm = [0, 0, 0, 0].map(() => rng() < 0.5 ? 1 : 0);
          if (mm.every(() => rng() >= p)) okU++;
          const rr = hamEnc(mm).map(x => rng() < p ? x ^ 1 : x);
          const sy = hamSyn(rr), ps = sy[0] * 4 + sy[1] * 2 + sy[2];
          if (ps) rr[ps - 1] ^= 1;
          if (bstr(hamInfo(rr)) === bstr(mm)) okH++;
        }
        return { u: okU / N, h: okH / N };
      };
      const PH = p => Math.pow(1 - p, 7) + 7 * p * Math.pow(1 - p, 6), PU = p => Math.pow(1 - p, 4);
      const simBox = chart.box(b => chart.line(b, {
        series: [
          { name: "Không mã (1−p)⁴", color: "eve", points: range(0.001, 0.3, 0.003).map(p => [p, PU(p)]) },
          { name: "Hamming (1−p)⁷ + 7p(1−p)⁶", color: "pt", points: range(0.001, 0.3, 0.003).map(p => [p, PH(p)]) },
          { name: "Monte Carlo Hamming (2000 khối)", color: "key", points: mcPts || [], markerOnly: true, r: 5 },
          { name: "Monte Carlo không mã", color: "ct", points: (mcPts && mcPts.u) || [], markerOnly: true, r: 4 }],
        xlabel: "p", ylabel: "P(khối 4 bit đúng)", xmin: 0, xmax: 0.3, ymin: 0.2, ymax: 1, fmtX: v => fv(v, 2), fmtY: v => fv(v, 1),
        vlines: [{ x: S.p, label: "p = " + fv(S.p, 3), color: "var(--key)" }], title: "Hiệu năng Hamming [7,4] trên BSC(p) — slide 4.6", aspect: 0.45 }));
      function drawSim() {
        const rng = LAB.rng(S.seed); const N = 2000;
        const grid = [0.005, 0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
        const res = grid.map(p => simHam(p, N, rng)); mcPts = grid.map((p, i) => [p, res[i].h]); mcPts.u = grid.map((p, i) => [p, res[i].u]);
        const cur = simHam(S.p, N, rng); const p = S.p;
        const rows = [0.1, 0.01, 0.001].map(q => [fv(q, 3), fv(PU(q), 4), fv(PH(q), 5), pc(1 - PU(q), 2) + " → " + pc(1 - PH(q), 2)]);
        rows.push([fv(p, 3) + " (hiện tại)", fv(PU(p), 4) + " · MC " + fv(cur.u, 3), fv(PH(p), 5) + " · MC " + fv(cur.h, 3), pc(1 - PU(p), 2) + " → " + pc(1 - PH(p), 2)]);
        simOut.render(ui.readouts([{ k: "p", v: fv(p, 3), kind: "eve" }, { k: "Không mã: (1−p)⁴", v: fv(PU(p), 4), kind: "ct" }, { k: "Hamming: (1−p)⁷ + 7p(1−p)⁶", v: fv(PH(p), 4), kind: "pt", big: true }, { k: "Monte Carlo N = 2000 khối", v: "không mã " + fv(cur.u, 3) + " · Hamming " + fv(cur.h, 3), kind: "key" }]),
          ui.table(["p", "Không mã: 4 bit đúng", "Hamming: khối đúng", "Lỗi khối"], rows, { mono: true, cls: "tight", rowCls: (r, i) => i === rows.length - 1 ? "hi" : null }),
          ui.note("Khối đúng khi có 0 hoặc 1 lỗi trong 7 bit (8 đại diện lớp kề trọng số ≤ 1). Lợi ích tăng mạnh khi p nhỏ: lỗi khối từ ≈ 4p xuống ≈ 21p²; đổi lại tốn thêm 75 % băng thông. Monte Carlo dùng mầm cố định — bấm «Chạy lại» để đổi.", "mut"));
        simBox.draw();
      }
      view.append(ui.panel("Mô phỏng Hamming [7,4] trên BSC(p) — slide 4.6", rP, ui.btn("Chạy lại (đổi mầm)", () => { S.seed = (S.seed * 48271 + 7) % 2147483647; drawSim(); }, "sm"), simOut, simBox)); drawSim();
      /* ---- McEliece thu nhỏ ---- */
      const mcOut = ui.slot();
      const fMM = ui.field({ id: "m4hm-mm", label: "Tin m (4 bit)", mono: true, value: S.mm, onInput: v => { S.mm = v; drawMc(); } });
      const sE = ui.select({ id: "m4hm-e", label: "Vị trí lỗi e (trọng số t = 1)", options: [[0, "không lỗi"], [1, "bit 1"], [2, "bit 2"], [3, "bit 3"], [4, "bit 4"], [5, "bit 5 (slide 6.3)"], [6, "bit 6"], [7, "bit 7"]], value: S.epos, onChange: v => { S.epos = +v; drawMc(); } });
      const setMc = (mm, e) => { S.mm = mm; S.epos = e; fMM.input.value = mm; sE.input.value = String(e); drawMc(); };
      const P = Array.from({ length: 7 }, (_, i) => Array.from({ length: 7 }, (_, j) => +(MC.perm[j] === i))); /* Ĝ = S·G·P */
      const SG = mulMM(MC.S, MC.G), Ghat = mulMM(SG, P), Sinv = inverseGF2(MC.S);
      function drawMc() {
        const mm = S.mm.replace(/\s+/g, "");
        if (!isBits(mm) || mm.length !== 4) { mcOut.render(ui.note("Tin m phải gồm đúng 4 bit.", "eve")); return; }
        const m = toBits(mm), e = Array.from({ length: 7 }, (_, i) => +(i + 1 === S.epos));
        const mG = mulVM(m, Ghat), c = xorv(mG, e);
        const cP = mulVM(c, T(P)), s = mulVM(cP, T(MC.H)), ss = bstr(s);
        const colIdx = MC.H[0].map((_, j) => bstr(MC.H.map(row => row[j]))).indexOf(ss);
        const fixed = cP.slice(); if (colIdx >= 0) fixed[colIdx] ^= 1;
        const mS = fixed.slice(0, 4), mOut = mulVM(mS, Sinv);
        mcOut.render(
          h("div", { class: "cols" },
            ui.panel("S (4×4, bí mật)", ui.matrix(MC.S, { cls: () => "ct" })),
            ui.panel("G Hamming hệ thống (slide 4.5)", ui.matrix(MC.G, { cls: (i, j) => j < 4 ? "pt" : "key" })),
            ui.panel("P (hoán vị 7 cột, bí mật)", ui.matrix(P, { cls: (i, j, v) => v ? "ct" : null })),
            ui.panel("Ĝ = S·G·P (công khai)", ui.matrix(Ghat, { cls: () => "hi" }))),
          ui.note("P tìm được bằng cách thử 5040 hoán vị: cột j của Ĝ = cột " + MC.perm.map(x => x + 1).join(", ") + " của S·G — hoán vị duy nhất cho đúng Ĝ của slide 6.3. S·G = " + SG.map(bstr).join(" / ") + ".", "mut"),
          h("div", { class: "flow" },
            h("div", { class: "who a" }, "Alice mã hóa"), h("div", { class: "arrow" }, "→"), h("div", { class: "who b" }, "Bob giải mã"),
            h("div", { class: "stack" }, ui.steps([{ t: "m·Ĝ = tổng các hàng Ĝ ứng với bit 1 của m", r: bstr(m) + " · Ĝ = " + bstr(mG) }, { t: "Chọn e ngẫu nhiên, wt(e) = t = 1", r: "e = " + bstr(e) }, { t: "Bản mã c = m·Ĝ + e", r: "c = <b>" + bstr(c) + "</b>", hi: true }])),
            h("div", { class: "arrow" }, "c"),
            h("div", { class: "stack" }, ui.steps([
              { t: "Bỏ hoán vị: c·P⁻¹ = (m·S)·G + e·P⁻¹ (trọng số lỗi không đổi)", r: "c·P⁻¹ = " + bstr(cP) },
              { t: "Hội chứng với H của Hamming", r: "s = " + ss + (colIdx >= 0 ? " = cột " + (colIdx + 1) + " của H ⇒ lật bit " + (colIdx + 1) : " = 0 ⇒ không lỗi") + " ⇒ " + bstr(fixed) },
              { t: "4 bit đầu (hệ thống) = m·S; nhân S⁻¹ = " + Sinv.map(bstr).join("; "), r: "m·S = " + bstr(mS) + " ⇒ m = " + bstr(mS) + "·S⁻¹ = <b>" + bstr(mOut) + "</b>" + (bstr(mOut) === mm ? " ✓" : " ✗"), hi: true }]))),
          ui.bits(c, { kinds: e.map(x => x ? "eve" : "ct"), label: "c" }), ui.bits(cP, { kinds: cP.map((_, i) => i === colIdx ? "eve" : "aqua"), label: "c·P⁻¹" }), ui.bits(mOut, { kind: bstr(mOut) === mm ? "ok" : "eve", label: "m" }),
          ui.note("Kẻ tấn công chỉ thấy Ĝ «trông ngẫu nhiên» và phải giải bài toán giải mã hội chứng tổng quát (NP-khó); Bob có cửa sập (S, G, P) nên dùng bộ giải mã Hamming nhanh. Hamming [7,4] quá nhỏ (Ĝ dễ bị nhận ra) — thực tế dùng mã Goppa [1024, 524] với t = 50, khóa ≈ 67 KB (slide 6.4).", "key"));
      }
      view.append(ui.panel("McEliece thu nhỏ với Hamming [7,4] — slide 6.3", h("div", { class: "cols" }, fMM, sE), presets([
        { label: "Slide 6.3: m = 1101, e = 0000100 → c = 0011110", apply: () => setMc("1101", 5) },
        { label: "Bài tập 6.1: m = 1000, e = 0100000", apply: () => setMc("1000", 2) },
        { label: "m = 0110, không lỗi", apply: () => setMc("0110", 0) }
      ]), mcOut)); drawMc();
      pane.appendChild(root);
    } }
  ]
});
})();
