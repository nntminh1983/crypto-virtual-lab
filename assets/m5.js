/* COM608 — Mô-đun 5: Mã chập và giải mã Viterbi (Bài 9)
   Tab: encoder (bộ mã hóa thanh ghi dịch), trellis (bảng/sơ đồ trạng thái, lưới), dfree (khoảng cách tự do, thảm họa, đục lỗ),
        viterbi (giải mã quyết định cứng từng nhịp, quyết định mềm), ber (mô phỏng BER trên BSC, xen kẽ khối).
   Quy ước (nhất quán với slide 1.2–1.4): đa thức sinh viết cơ số 8 → chuỗi K bit, bit TRÁI nhất là hệ số D⁰ (nhân với uₜ),
   bit tiếp theo là D¹ (s₁), D² (s₂)… Ví dụ 7 = 111 = 1 + D + D²; 5 = 101 = 1 + D²; 6 = 110 = 1 + D (K = 3).
   Trạng thái (s₁s₂…) = (uₜ₋₁ uₜ₋₂ …); trạng thái mới = (uₜ, s₁, …); thứ tự hiển thị 00, 10, 01, 11
   (chỉ số trạng thái i: s_j = bit thứ j−1 của i, nên i = 1 ↔ "10", i = 2 ↔ "01"). */
(function () { "use strict";
const { h, ui, math, chart } = LAB;
const svg = LAB.svg;

/* ============================ tiện ích chung ============================ */
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹", SUB = "₀₁₂₃₄₅₆₇₈₉";
const sup = n => String(n).split("").map(d => SUP[+d]).join("");
const sub = n => String(n).split("").map(d => SUB[+d]).join("");
const C_ = i => "c" + sup(i + 1);                       /* tên đầu ra c¹, c², c³ */
const vn = (x, d = 2) => LAB.fmt(x, d).replace(".", ","); /* số thực kiểu Việt Nam */
let uid = 0;                                            /* id duy nhất cho marker SVG */

/* chuỗi bit "1011" (cho phép dấu cách) → mảng số; null nếu có ký tự lạ */
function parseBits(s) {
  const t = String(s || "").replace(/[\s,;|]/g, "");
  return /^[01]*$/.test(t) ? t.split("").map(Number) : null;
}
/* dãy nhận "11 10 00" → mảng các bộ n bit; null nếu sai độ dài */
function parsePairs(s, n) {
  const b = parseBits(s);
  if (!b || b.length === 0 || b.length % n) return null;
  const r = [];
  for (let i = 0; i < b.length; i += n) r.push(b.slice(i, i + n));
  return r;
}
/* đa thức: mảng hệ số [D⁰, D¹, …] ↔ số nguyên (bit j = hệ số Dʲ) ↔ chuỗi "1 + D + D²" */
function polyStr(taps) {
  const t = [];
  taps.forEach((c, j) => { if (c) t.push(j === 0 ? "1" : j === 1 ? "D" : "D" + sup(j)); });
  return t.length ? t.join(" + ") : "0";
}
const polyInt = taps => taps.reduce((a, c, j) => a | (c << j), 0);
function intTaps(v, w) { const a = []; for (let j = 0; j < w; j++) a.push((v >> j) & 1); return a; }
const intPolyStr = v => polyStr(intTaps(v, 31));
const deg = v => v ? 31 - Math.clz32(v) : -1;
const grpPairs = arr => arr.map(o => o.join("")).join(" ");

/* Xây mã từ S = {K, n, g:[chuỗi cơ số 8]} → {K, m, n, nS, gens, names, T, …} hoặc {err} */
function mkCode(S) {
  const K = +S.K, n = +S.n, m = K - 1, nS = 1 << m;
  if (!(K >= 2 && K <= 5)) return { err: "Chỉ hỗ trợ K từ 2 đến 5 (2–16 trạng thái) để còn vẽ được lưới." };
  const gens = [], oct = [];
  for (let i = 0; i < n; i++) {
    const g = String(S.g[i] == null ? "" : S.g[i]).trim();
    if (!/^[0-7]+$/.test(g)) return { err: "g" + sub(i + 1) + " phải là số cơ số 8 (chỉ gồm chữ số 0–7)." };
    const v = parseInt(g, 8);
    if (v === 0) return { err: "g" + sub(i + 1) + " = 0: đầu ra " + C_(i) + " luôn bằng 0, không phải đa thức sinh hợp lệ." };
    if (v >= (1 << K)) return { err: "g" + sub(i + 1) + " = " + g + "₈ = " + v.toString(2) + "₂ cần " + v.toString(2).length + " bit > K = " + K + ". Hãy tăng K hoặc đổi đa thức." };
    gens.push(v.toString(2).padStart(K, "0").split("").map(Number));
    oct.push(g);
  }
  /* tên trạng thái theo chỉ số: s_j = bit j−1 của i → 0:"00", 1:"10", 2:"01", 3:"11" */
  const names = [];
  for (let i = 0; i < nS; i++) { let s = ""; for (let j = 0; j < m; j++) s += (i >> j) & 1; names.push(s); }
  /* bảng chuyển trạng thái T[i][u] = {out, outStr, ns, w} */
  const T = [];
  for (let i = 0; i < nS; i++) {
    T.push([0, 1].map(u => {
      const win = [u];
      for (let j = 0; j < m; j++) win.push((i >> j) & 1);
      const out = gens.map(g => g.reduce((a, c, j) => a ^ (c & win[j]), 0));
      return { out, outStr: out.join(""), ns: ((i << 1) | u) & (nS - 1), w: out.reduce((a, b) => a + b, 0) };
    }));
  }
  return { K, m, n, nS, gens, oct, names, T, bin: gens.map(g => g.join("")), poly: gens.map(polyStr), label: "(" + oct.join(", ") + ")" };
}

/* Mã hóa: bits (mảng) + đuôi m bit 0 nếu tail → {u, steps, out, L, end} */
function encode(code, bits, tail) {
  const u = bits.concat(tail ? new Array(code.m).fill(0) : []);
  let st = 0;
  const steps = [], out = [];
  u.forEach((b, t) => {
    const tr = code.T[st][b];
    const win = [b];
    for (let j = 0; j < code.m; j++) win.push((st >> j) & 1);
    steps.push({ t: t + 1, u: b, tail: t >= bits.length, st, ns: tr.ns, out: tr.out, win });
    out.push(tr.out);
    st = tr.ns;
  });
  return { u, steps, out, L: bits.length, end: st };
}

/* Viterbi quyết định cứng. r: mảng các bộ n bit. tail: kết thúc tại 00 (L = T − m nhịp cuối chỉ có u = 0).
   Hòa: giữ nhánh đến từ trạng thái có chỉ số nhỏ hơn (duyệt tăng dần, chỉ thay khi nhỏ hơn hẳn).
   detail = true → lưu mọi ứng viên ACS của từng nhịp để hiển thị. */
function viterbi(code, r, tail, detail) {
  const T = r.length, nS = code.nS, L = tail ? T - code.m : T, INF = 1e9;
  let PM = new Array(nS).fill(INF);
  PM[0] = 0;
  const rows = [], det = [], hist = [];
  for (let t = 0; t < T; t++) {
    const nPM = new Array(nS).fill(INF), prev = new Int8Array(nS).fill(-1), prevU = new Int8Array(nS);
    const cands = detail ? Array.from({ length: nS }, () => []) : null;
    const us = (tail && t >= L) ? [0] : [0, 1];
    for (let s = 0; s < nS; s++) {
      if (PM[s] >= INF) continue;
      for (const u of us) {
        const tr = code.T[s][u];
        let bm = 0;
        for (let i = 0; i < code.n; i++) if (tr.out[i] !== r[t][i]) bm++;
        const sum = PM[s] + bm, j = tr.ns;
        if (detail) cands[j].push({ from: s, u, out: tr.outStr, bm, pm: PM[s], sum, win: false });
        if (sum < nPM[j]) { nPM[j] = sum; prev[j] = s; prevU[j] = u; }
      }
    }
    if (detail) for (let j = 0; j < nS; j++) cands[j].forEach(c => { c.win = c.from === prev[j] && c.u === prevU[j]; });
    PM = nPM;
    rows.push(PM.slice());
    hist.push({ prev, prevU });
    if (detail) det.push(cands);
  }
  /* trạng thái kết thúc: 00 nếu có đuôi, ngược lại trạng thái có PM nhỏ nhất (cắt ngắn) */
  let end = 0;
  if (!tail) for (let s = 1; s < nS; s++) if (PM[s] < PM[end]) end = s;
  /* truy vết */
  const uhat = [], chat = [], path = [];
  let cur = end;
  for (let t = T - 1; t >= 0; t--) {
    const s = hist[t].prev[cur];
    if (s < 0) break;
    const u = hist[t].prevU[cur], tr = code.T[s][u];
    path.push({ t, from: s, to: cur, u, out: tr.outStr, tail: tail && t >= L });
    uhat.push(u); chat.push(tr.out);
    cur = s;
  }
  uhat.reverse(); chat.reverse(); path.reverse();
  let nfix = 0;
  chat.forEach((c, t) => c.forEach((b, i) => { if (b !== r[t][i]) nfix++; }));
  return { T, L, rows, det, uhat, chat, path, end, pmEnd: PM[end], nfix, INF };
}

/* Khoảng cách tự do:
   – Dijkstra trên lưới từ nhánh u = 1 rời 00 cho tới khi quay về 00 → d_free;
   – liệt kê các đường trọng số ≤ d_free + 2 bằng duyệt sâu có giới hạn;
   – phổ trọng số A_d (d ≤ Wmax) bằng quy hoạch động theo (trạng thái, trọng số). */
function dfree(code) {
  const nS = code.nS, INF = 1e9, first = code.T[0][1];
  const dist = new Array(nS).fill(INF);
  let pq = [[first.w, first.ns]], d = null, guard = 0;
  while (pq.length && guard++ < 5000) {
    pq.sort((a, b) => a[0] - b[0]);
    const [w, s] = pq.shift();
    if (s === 0) { d = w; break; }
    if (dist[s] <= w) continue;
    dist[s] = w;
    for (const u of [0, 1]) { const tr = code.T[s][u]; pq.push([w + tr.w, tr.ns]); }
  }
  if (d == null) return { d: null, paths: [], spec: [], Wmax: 0 };
  const Wl = d + 2, paths = [];
  let cnt = 0;
  (function dfs(s, w, us, cs, depth) {
    if (cnt > 40000 || depth > 30 || paths.length > 400) return;
    cnt++;
    for (const u of [0, 1]) {
      const tr = code.T[s][u], nw = w + tr.w;
      if (nw > Wl) continue;
      if (tr.ns === 0) paths.push({ w: nw, u: us + u, c: cs.concat([tr.outStr]) });
      else dfs(tr.ns, nw, us + u, cs.concat([tr.outStr]), depth + 1);
    }
  })(first.ns, first.w, "1", [first.outStr], 0);
  paths.sort((a, b) => a.w - b.w || a.u.length - b.u.length || (a.u < b.u ? -1 : 1));
  /* phổ trọng số: cur[s][w] = số đường đang ở trạng thái s với trọng số w (chưa chạm 00) */
  const Wmax = Math.min(d + 7, 12);
  const spec = new Array(Wmax + 1).fill(0);
  let cur = Array.from({ length: nS }, () => new Array(Wmax + 1).fill(0));
  cur[first.ns][first.w] = 1;
  let open = true, steps = 0;
  while (open && steps++ < 80) {
    const nxt = Array.from({ length: nS }, () => new Array(Wmax + 1).fill(0));
    open = false;
    for (let s = 0; s < nS; s++) for (let w = 0; w <= Wmax; w++) {
      const c = cur[s][w];
      if (!c) continue;
      for (const u of [0, 1]) {
        const tr = code.T[s][u], nw = w + tr.w;
        if (nw > Wmax) continue;
        if (tr.ns === 0) spec[nw] += c; else { nxt[tr.ns][nw] += c; open = true; }
      }
    }
    cur = nxt;
  }
  return { d, paths, spec, Wmax, specOpen: open, truncated: cnt > 40000 || paths.length > 400 };
}
/* Kiểm tra thảm họa (Massey–Sain, k = 1): gcd các gᵢ(D) trên GF(2) phải là Dˡ */
function catastrophic(code) {
  const ints = code.gens.map(polyInt);
  let g = ints[0];
  for (let i = 1; i < ints.length; i++) g = math.gf2gcd(g, ints[i]);
  return { g, poly: intPolyStr(g), bad: (g & (g - 1)) !== 0 };
}

/* ============================ điều khiển dùng chung ============================ */
/* Bộ chọn tham số mã (K, n, g₁…gₙ). S được sửa tại chỗ; wrap.sync() cập nhật ô nhập từ S. */
function codeCtrl(pre, S, onChange) {
  const selK = ui.select({ id: pre + "-K", label: "Độ dài ràng buộc K",
    options: [[2, "K = 2 (2 trạng thái)"], [3, "K = 3 (4 trạng thái)"], [4, "K = 4 (8 trạng thái)"], [5, "K = 5 (16 trạng thái)"]],
    value: S.K, onChange: v => { S.K = +v; onChange(); } });
  const segN = ui.seg({ id: pre + "-n", label: "Số đầu ra n (tốc độ 1/n)", options: [[2, "n = 2"], [3, "n = 3"]], value: S.n,
    onChange: v => { S.n = +v; g[2].style.display = S.n === 3 ? "" : "none"; onChange(); } });
  const g = [0, 1, 2].map(i => ui.field({ id: pre + "-g" + i, label: "g" + sub(i + 1) + " (cơ số 8)", value: S.g[i], mono: true,
    onInput: v => { S.g[i] = v; onChange(); } }));
  g[2].style.display = S.n === 3 ? "" : "none";
  const wrap = h("div", { class: "stack" }, selK, segN, h("div", { class: "row" }, g),
    h("div", { class: "small", html: "Chuỗi K bit của g: bit trái nhất nhân với u<sub>t</sub> (D⁰), rồi s₁ (D¹), s₂ (D²)…: 7 = 111 = 1 + D + D², 5 = 101 = 1 + D², 6 = 110 = 1 + D." }));
  wrap.sync = () => {
    selK.input.value = S.K;
    const seg = segN.querySelector(".seg");
    if (seg && seg.set) seg.set(S.n);
    g.forEach((f, i) => { f.input.value = S.g[i] == null ? "" : S.g[i]; });
    g[2].style.display = S.n === 3 ? "" : "none";
  };
  return wrap;
}
/* Dòng tóm tắt mã: ký hiệu, đa thức sinh */
function codeInfo(code) {
  return h("div", { class: "kv" },
    h("dt", null, "Mã"),
    h("dd", null, code.label + " cơ số 8 — (n, k, K) = (" + code.n + ", 1, " + code.K + "), R = 1/" + code.n + ", m = " + code.m + ", " + code.nS + " trạng thái"),
    ...code.gens.flatMap((g, i) => [h("dt", null, "g" + sub(i + 1)), h("dd", null, code.bin[i] + "  ↔  g" + sub(i + 1) + "(D) = " + code.poly[i])]));
}
/* Nút «‹ Bước› / Chạy hết / Đặt lại» điều khiển S[key] trong [0, max()] */
function stepper(S, key, max, draw) {
  return h("div", { class: "row" },
    ui.btn("‹ Bước", () => { if (S[key] > 0) { S[key]--; draw(); } }),
    ui.btn("Bước ›", () => { if (S[key] < max()) { S[key]++; draw(); } }, "pri"),
    ui.btn("Chạy hết", () => { S[key] = max(); draw(); }),
    ui.btn("Đặt lại", () => { S[key] = 0; draw(); }, "sm"));
}

/* ============================ hình SVG ============================ */
/* Thanh ghi dịch: win = [uₜ, s₁, …] (null = chưa có), out = [c¹…] (null = chưa tính) */
function regSVG(code, win, out) {
  const m = code.m, n = code.n, cw = 46, ch = 34, gap = 14, x0 = 64, y0 = 26;
  const xa = x0 + (m + 1) * (cw + gap) + 54, r = 13;
  const ya = i => y0 + ch + 40 + i * 50;
  const W = xa + 150, H = ya(n - 1) + 36;
  const g = svg("svg", { class: "diag", viewBox: "0 0 " + W + " " + H, style: "max-width:" + W + "px" });
  const mk = "m5arr" + (++uid);
  g.appendChild(svg("defs", null, svg("marker", { id: mk, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" },
    svg("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--soft)" }))));
  const cx = j => x0 + j * (cw + gap) + cw / 2;
  /* đầu vào u → ô uₜ */
  g.appendChild(svg("line", { x1: 8, y1: y0 + ch / 2, x2: x0 - 2, y2: y0 + ch / 2, stroke: "var(--soft)", "stroke-width": 1.5, "marker-end": "url(#" + mk + ")" }));
  g.appendChild(svg("text", { x: 10, y: y0 + ch / 2 - 8, class: "lbl" }, "u"));
  /* các ô uₜ, s₁ … sₘ */
  for (let j = 0; j <= m; j++) {
    const v = win ? win[j] : null;
    g.appendChild(svg("rect", { x: x0 + j * (cw + gap), y: y0, width: cw, height: ch, rx: 5,
      fill: v === 1 ? "var(--key-bg)" : "var(--sunk)", stroke: v === 1 ? "var(--key)" : "var(--line)", "stroke-width": 1.4 }));
    g.appendChild(svg("text", { x: cx(j), y: y0 + ch / 2 + 5, "text-anchor": "middle", "font-weight": "600", fill: v === 1 ? "var(--key)" : "var(--ink)" }, v == null ? "·" : v));
    g.appendChild(svg("text", { x: cx(j), y: y0 - 8, "text-anchor": "middle", class: "lbl" }, j === 0 ? "uₜ" : "s" + sub(j) + " = uₜ₋" + sub(j)));
    if (j < m) g.appendChild(svg("line", { x1: x0 + j * (cw + gap) + cw, y1: y0 + ch / 2, x2: x0 + (j + 1) * (cw + gap) - 1, y2: y0 + ch / 2,
      stroke: "var(--soft)", "stroke-width": 1.5, "marker-end": "url(#" + mk + ")" }));
  }
  /* các bộ cộng ⊕ nối theo hệ số của gᵢ */
  for (let i = 0; i < n; i++) {
    const y = ya(i), taps = code.gens[i];
    taps.forEach((c, j) => {
      if (!c) return;
      const x = cx(j) + i * 6 - (n - 1) * 3;
      g.appendChild(svg("polyline", { points: x + "," + (y0 + ch) + " " + x + "," + y + " " + (xa - r) + "," + y, fill: "none", stroke: "var(--soft)", "stroke-width": 1.4 }));
      g.appendChild(svg("circle", { cx: x, cy: y0 + ch, r: 2.5, fill: "var(--soft)" }));
    });
    const v = out ? out[i] : null;
    g.appendChild(svg("circle", { cx: xa, cy: y, r, fill: v === 1 ? "var(--ct-bg)" : "var(--panel)", stroke: "var(--ct)", "stroke-width": 1.6 }));
    g.appendChild(svg("text", { x: xa, y: y + 5, "text-anchor": "middle", "font-size": 15, fill: "var(--ct)" }, "⊕"));
    g.appendChild(svg("line", { x1: xa + r, y1: y, x2: xa + r + 34, y2: y, stroke: "var(--soft)", "stroke-width": 1.5, "marker-end": "url(#" + mk + ")" }));
    g.appendChild(svg("text", { x: xa + r + 40, y: y + 4, fill: "var(--ct)", "font-weight": "600" }, C_(i) + (v == null ? "" : " = " + v) + "  (g" + sub(i + 1) + " = " + code.bin[i] + ")"));
  }
  return h("div", { style: { overflowX: "auto" } }, g);
}

/* Lưới T nhịp. o.edge(t,s,u) → null (không vẽ) | {hi, dim, bold, color, label}; o.node(t,s) → null | {text, hi, dim, color} */
function trellisSVG(code, T, o) {
  const nS = code.nS;
  const colW = o.colW || (T > 9 ? 76 : 96), rowH = nS <= 4 ? 64 : nS <= 8 ? 46 : 30;
  const R = o.r || (nS <= 4 ? 13 : nS <= 8 ? 11 : 7), left = 56, top = 34;
  const W = left + T * colW + 40, H = top + (nS - 1) * rowH + 36;
  const X = t => left + t * colW, Y = s => top + s * rowH;
  const g = svg("svg", { class: "diag", viewBox: "0 0 " + W + " " + H, style: "max-width:" + W + "px" });
  for (let s = 0; s < nS; s++) g.appendChild(svg("text", { x: left - 24, y: Y(s) + 4, "text-anchor": "middle", class: "lbl", "font-weight": "600" }, code.names[s]));
  for (let t = 0; t <= T; t++) g.appendChild(svg("text", { x: X(t), y: 12, "text-anchor": "middle", class: "lbl" }, "t=" + t));
  const gE = svg("g"), gH = svg("g"), gN = svg("g"), gL = svg("g");
  g.append(gE, gH, gN, gL);
  for (let t = 0; t < T; t++) for (let s = 0; s < nS; s++) for (const u of [0, 1]) {
    const e = o.edge(t, s, u);
    if (!e) continue;
    const tr = code.T[s][u], x1 = X(t), y1 = Y(s), x2 = X(t + 1), y2 = Y(tr.ns);
    const col = e.color || "var(--soft)";
    (e.hi ? gH : gE).appendChild(svg("line", { x1, y1, x2, y2, stroke: col, "stroke-width": e.hi ? 3.2 : e.bold ? 2.2 : 1.3,
      "stroke-dasharray": u ? "6,4" : null, opacity: e.dim ? 0.18 : 1, "stroke-linecap": "round" }));
    if (e.label) {
      /* nhãn đặt ở 32 % chiều dài, lệch theo pháp tuyến để không đè lên đường */
      const f = 0.32, lx = x1 + (x2 - x1) * f, ly = y1 + (y2 - y1) * f;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * 9, ny = dx / len * 9;
      gL.appendChild(svg("text", { x: lx + nx, y: ly + ny + 4, "text-anchor": "middle", "font-size": 10.5, fill: col,
        stroke: "var(--panel)", "stroke-width": 3, "paint-order": "stroke", opacity: e.dim ? 0.3 : 1 }, e.label));
    }
  }
  for (let t = 0; t <= T; t++) for (let s = 0; s < nS; s++) {
    const nd = o.node ? o.node(t, s) : {};
    if (nd === null) continue;
    const col = nd.color || (nd.hi ? "var(--eve)" : "var(--line)");
    gN.appendChild(svg("circle", { cx: X(t), cy: Y(s), r: nd.text != null ? R + 2 : R - 4, fill: nd.hi ? "var(--eve-bg)" : "var(--panel)",
      stroke: col, "stroke-width": nd.hi ? 2.4 : 1.4, opacity: nd.dim ? 0.3 : 1 }));
    if (nd.text != null) gN.appendChild(svg("text", { x: X(t), y: Y(s) + 4, "text-anchor": "middle", "font-size": nS > 8 ? 9 : 11.5, "font-weight": "600",
      fill: nd.hi ? "var(--eve)" : "var(--ink)", opacity: nd.dim ? 0.4 : 1 }, nd.text));
  }
  return h("div", { style: { overflowX: "auto" } }, g);
}

/* Sơ đồ trạng thái: 4 nút xếp hình thoi như slide 2.2 (00 trái, 10 trên, 01 dưới, 11 phải); nhiều hơn thì xếp vòng tròn.
   hiSet = tập "s:u" các cạnh được tô đỏ (đường của tin). */
function stateSVG(code, hiSet) {
  const nS = code.nS, W = 460, H = nS <= 4 ? 300 : 440, cx = W / 2, cy = H / 2 + 6;
  const R = nS <= 4 ? 22 : nS <= 8 ? 20 : 16;
  let pos;
  if (nS === 2) pos = [[cx - 110, cy], [cx + 110, cy]];
  else if (nS === 4) pos = [[cx - 150, cy], [cx, cy - 100], [cx, cy + 100], [cx + 150, cy]];
  else {
    const rr = Math.min(W, H) / 2 - 56;
    pos = code.names.map((_, i) => [cx + rr * Math.cos(-Math.PI / 2 + 2 * Math.PI * i / nS), cy + rr * Math.sin(-Math.PI / 2 + 2 * Math.PI * i / nS)]);
  }
  const g = svg("svg", { class: "diag", viewBox: "0 0 " + W + " " + H, style: "max-width:" + W + "px" });
  const mk = "m5sd" + (++uid);
  g.appendChild(svg("defs", null, ...["var(--soft)", "var(--eve)"].map((c, i) =>
    svg("marker", { id: mk + i, viewBox: "0 0 10 10", refX: 10, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, svg("path", { d: "M0,0 L10,5 L0,10 z", fill: c })))));
  const gE = svg("g"), gL = svg("g"), gN = svg("g");
  g.append(gE, gN, gL);
  const lbl = (x, y, t, col) => gL.appendChild(svg("text", { x, y: y + 4, "text-anchor": "middle", "font-size": 11, fill: col, stroke: "var(--panel)", "stroke-width": 3, "paint-order": "stroke" }, t));
  for (let s = 0; s < nS; s++) for (const u of [0, 1]) {
    const tr = code.T[s][u], hi = hiSet && hiSet.has(s + ":" + u), col = hi ? "var(--eve)" : "var(--soft)";
    const [x1, y1] = pos[s], [x2, y2] = pos[tr.ns], label = u + "/" + tr.outStr;
    const attrs = { fill: "none", stroke: col, "stroke-width": hi ? 2.8 : 1.5, "stroke-dasharray": u ? "6,4" : null, "marker-end": "url(#" + mk + (hi ? 1 : 0) + ")" };
    if (tr.ns === s) {
      /* vòng tự lặp: vẽ ra phía ngoài tâm hình */
      let dx = x1 - cx, dy = y1 - cy;
      const Ln = Math.hypot(dx, dy) || 1; dx /= Ln; dy /= Ln;
      const px = -dy, py = dx;
      const a = [x1 + dx * R * 0.5 + px * R * 0.85, y1 + dy * R * 0.5 + py * R * 0.85];
      const b = [x1 + dx * R * 0.5 - px * R * 0.85, y1 + dy * R * 0.5 - py * R * 0.85];
      const c1 = [x1 + dx * 75 + px * 34, y1 + dy * 75 + py * 34], c2 = [x1 + dx * 75 - px * 34, y1 + dy * 75 - py * 34];
      gE.appendChild(svg("path", Object.assign({ d: "M" + a.join(",") + " C" + c1.join(",") + " " + c2.join(",") + " " + b.join(",") }, attrs)));
      lbl(x1 + dx * 66, y1 + dy * 66, label, col);
    } else {
      /* cung bậc hai lệch về một phía để hai chiều A→B, B→A không trùng nhau */
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, Ln = Math.hypot(dx, dy) || 1;
      const nx = -dy / Ln, ny = dx / Ln, k = 30, qx = mx + nx * k, qy = my + ny * k;
      const ex = x2 - (dx / Ln) * R, ey = y2 - (dy / Ln) * R;
      const sx = x1 + (dx / Ln) * R + nx * 4, sy = y1 + (dy / Ln) * R + ny * 4;
      gE.appendChild(svg("path", Object.assign({ d: "M" + sx + "," + sy + " Q" + qx + "," + qy + " " + (ex + nx * 4) + "," + (ey + ny * 4) }, attrs)));
      lbl(0.25 * x1 + 0.5 * qx + 0.25 * x2 + nx * 6, 0.25 * y1 + 0.5 * qy + 0.25 * y2 + ny * 6, label, col);
    }
  }
  pos.forEach(([x, y], s) => {
    gN.appendChild(svg("circle", { cx: x, cy: y, r: R, fill: "var(--panel)", stroke: "var(--pt)", "stroke-width": 2 }));
    gN.appendChild(svg("text", { x, y: y + 4.5, "text-anchor": "middle", "font-weight": "600", "font-size": nS > 8 ? 10 : 13 }, code.names[s]));
  });
  g.appendChild(svg("text", { x: 8, y: H - 8, class: "lbl" }, "Nhãn u / " + code.gens.map((_, i) => C_(i)).join("") + " — nét liền u = 0, nét đứt u = 1"));
  return h("div", { style: { overflowX: "auto" } }, g);
}

/* ============================ đăng ký mô-đun ============================ */
LAB.module({
  id: "m5",
  tabs: [
  /* ---------------------------------------------------------------- 1. Bộ mã hóa ---------------------------------------------------------------- */
  { id: "encoder", title: "Bộ mã hóa",
    intro: "Mã chập (n, 1, K): thanh ghi dịch m = K − 1 ô và n bộ cộng modulo 2; mỗi bit vào sinh n bit ra. Preset: mã (7, 5), tin 1011 + 2 bit đuôi → 11 10 00 01 01 11 (slide 1.2–1.4).",
    build(pane) {
      const S = { K: 3, n: 2, g: ["7", "5", "6"], msg: "1011", tail: true, k: 0 };
      const { root, ctrl, view } = ui.sim();
      const cc = codeCtrl("m5en", S, () => { S.k = 0; draw(); });
      const fMsg = ui.field({ id: "m5en-msg", label: "Chuỗi tin u (bit)", value: S.msg, mono: true, onInput: v => { S.msg = v; S.k = 0; draw(); } });
      const cTail = ui.check({ id: "m5en-tail", label: "Thêm m bit đuôi 0 (zero-tail) để về trạng thái 00", value: S.tail, onChange: v => { S.tail = v; S.k = 0; draw(); } });
      const set = (K, n, g, msg, tail) => {
        S.K = K; S.n = n; S.g = g.concat(["6"]).slice(0, 3); S.msg = msg; S.tail = tail; S.k = 0;
        cc.sync(); fMsg.input.value = msg; cTail.input.checked = tail; draw();
      };
      ctrl.append(cc, fMsg, cTail, ui.presets([
        { label: "(7, 5), tin 1011 (slide 1.3)", apply: () => set(3, 2, ["7", "5"], "1011", true) },
        { label: "Bài tập 1.1: tin 1101", apply: () => set(3, 2, ["7", "5"], "1101", true) },
        { label: "Bài tập 1.3: g = (1 + D, 1 + D + D²) = (6, 7), tin 1011", apply: () => set(3, 2, ["6", "7"], "1011", true) },
        { label: "Tốc độ 1/3: (7, 5, 6), tin 1 (slide 1.6)", apply: () => set(3, 3, ["7", "5", "6"], "1", true) },
        { label: "Đáp ứng xung: tin 1000 (slide 1.5)", apply: () => set(3, 2, ["7", "5"], "1000", false) },
        { label: "GSM K = 5: (23, 33), tin 1011", apply: () => set(5, 2, ["23", "33"], "1011", true) }
      ]), ui.note("Mã NASA (171, 133) có K = 7 (64 trạng thái) – quá lớn để vẽ lưới nên trang này giới hạn K ≤ 5; tốc độ vẫn là 1/2 và cách mã hóa hoàn toàn giống (bài tập 1.4).", "mut"));
      const out = ui.slot();
      view.append(out);
      function draw() {
        const code = mkCode(S);
        if (code.err) { out.render(ui.note(code.err, "eve")); return; }
        const bits = parseBits(S.msg);
        if (!bits || !bits.length) { out.render(codeInfo(code), ui.note("Chuỗi tin phải gồm các bit 0/1 (có thể cách nhau bằng dấu cách) và không rỗng.", "eve")); return; }
        if (bits.length > 64) { out.render(ui.note("Để bảng còn đọc được, hãy nhập tối đa 64 bit tin.", "eve")); return; }
        const E = encode(code, bits, S.tail), T = E.u.length;
        if (S.k > T) S.k = T;
        const cur = S.k > 0 ? E.steps[S.k - 1] : null;
        const codeStr = grpPairs(E.out), outFlat = E.out.flat();
        const kinds = outFlat.map((_, i) => (Math.floor(i / code.n) >= bits.length) ? "key" : "ct");
        const outsName = code.gens.map((_, i) => C_(i)).join("");
        /* bảng từng nhịp với phép tính chi tiết của từng cⁱ */
        const rows = E.steps.map(st => [
          st.t, st.u + (st.tail ? " (đuôi)" : ""), code.names[st.st],
          ...code.gens.map((g, i) => { const terms = []; g.forEach((c, j) => { if (c) terms.push(st.win[j]); }); return terms.join("⊕") + " = " + st.out[i]; }),
          { html: "<b>" + st.out.join("") + "</b>" }, code.names[st.ns]]);
        const heads = ["t", "uₜ", "Trạng thái (s₁s₂…)",
          ...code.gens.map((g, i) => ({ html: C_(i) + " = " + g.map((c, j) => c ? (j === 0 ? "u" : "s" + sub(j)) : null).filter(x => x != null).join("⊕") })),
          "Ra", "Trạng thái mới"];
        /* kiểm tra bằng nhân đa thức trên GF(2) */
        const uInt = polyInt(bits), prods = code.gens.map(g => math.gf2mul(uInt, polyInt(g)));
        const polyBits = prods.map(p => intTaps(p, T)), inter = [];
        for (let t = 0; t < T; t++) for (let i = 0; i < code.n; i++) inter.push(polyBits[i][t]);
        const same = inter.join("") === outFlat.join("");
        out.render(
          ui.readouts([
            { k: "Mã", v: code.label, kind: "key" }, { k: "(n, k, K)", v: "(" + code.n + ", 1, " + code.K + ")" }, { k: "Trạng thái 2ᵐ", v: code.nS },
            { k: "Tốc độ R", v: "1/" + code.n }, { k: "Tin L + đuôi", v: bits.length + (S.tail ? " + " + code.m : " + 0") },
            { k: "Tốc độ thực", v: bits.length + "/" + (code.n * T) + " = " + LAB.fmt(bits.length / (code.n * T), 3) }]),
          codeInfo(code),
          ui.panel("Thanh ghi dịch" + (cur ? " — nhịp t = " + cur.t + ": uₜ = " + cur.u + ", trạng thái " + code.names[cur.st] + " → ra " + cur.out.join("") + ", trạng thái mới " + code.names[cur.ns] : " — trạng thái đầu 00, chưa đưa bit nào vào"),
            regSVG(code, cur ? cur.win : [null].concat(new Array(code.m).fill(0)), cur ? cur.out : null),
            stepper(S, "k", () => T, draw),
            h("div", { class: "small" }, "Mỗi nhịp: tính " + code.gens.map((_, i) => C_(i)).join(", ") + " từ (uₜ, s₁, …) theo hệ số của g, xuất " + outsName + " rồi dịch thanh ghi sang phải (s₁ ← uₜ, s₂ ← s₁).")),
          ui.title("Bảng từng nhịp", "slide 1.3"),
          ui.table(heads, rows, { mono: true, cls: "tight", rowCls: (r, i) => i === S.k - 1 ? "hi" : null }),
          ui.readouts([{ k: "Tin u" + (S.tail ? " + đuôi" : ""), v: E.u.join(""), kind: "pt" }, { k: "Dãy mã c (" + code.n * T + " bit)", v: codeStr, kind: "ct", big: true }]),
          ui.bits(outFlat, { group: code.n, kinds, label: "Dãy mã" }),
          ui.panel("Kiểm tra bằng phép nhân đa thức (biến trễ D)",
            ui.steps([
              { t: "u(D) = " + polyStr(bits), r: "tin " + bits.join("") + " ↔ hệ số của D⁰, D¹, …" },
              ...code.gens.map((g, i) => ({
                t: C_(i) + "(D) = u(D)·g" + sub(i + 1) + "(D) = (" + polyStr(bits) + ")(" + polyStr(g) + ")",
                r: "= " + intPolyStr(prods[i]) + " → " + polyBits[i].join(" ") + (S.tail ? "" : " (cắt tới " + T + " hệ số vì không có đuôi)") })),
              { t: "Ghép xen kẽ " + outsName + " theo từng nhịp", r: grpPairs(polyBits[0].map((_, t) => polyBits.map(p => p[t]))) + (same ? " ✓ trùng với bảng" : " ✗ khác bảng"), hi: true }
            ]),
            h("div", { class: "small" }, "Mã chập là mã tuyến tính và bất biến theo dịch: dãy mã = tổng XOR các đáp ứng xung (tin 1000… → 11 10 11 00…) dịch theo vị trí các bit 1 của tin (slide 1.5).")),
          ui.note(S.tail
            ? "Zero-tail: " + code.m + " bit 0 đưa thanh ghi về 00 nên bộ giải mã biết trạng thái cuối; tốn m·n = " + code.m * code.n + " bit, tốc độ thực " + bits.length + "/" + code.n * T + ". Với L = 1000 bit tốc độ thực là 1000/" + (code.n * (1000 + code.m)) + " ≈ " + LAB.fmt(1000 / (code.n * (1000 + code.m)), 3) + " (slide 2.5)."
            : "Không thêm đuôi (cắt ngắn): trạng thái cuối " + code.names[E.end] + " không được bộ giải mã biết trước – các bit cuối kém tin cậy hơn (slide 2.5).", "mut")
        );
      }
      draw();
      pane.appendChild(root);
    } },

  /* ---------------------------------------------------------------- 2. Trạng thái và lưới ---------------------------------------------------------------- */
  { id: "trellis", title: "Trạng thái & lưới",
    intro: "Mã chập là máy trạng thái hữu hạn: bảng chuyển trạng thái (slide 2.1), sơ đồ trạng thái (2.2) và lưới trải theo thời gian (2.4) với đường đi của tin tô đỏ.",
    build(pane) {
      const S = { K: 3, n: 2, g: ["7", "5", "6"], msg: "1011", tail: true };
      const { root, ctrl, view } = ui.sim();
      const cc = codeCtrl("m5tr", S, draw);
      const fMsg = ui.field({ id: "m5tr-msg", label: "Chuỗi tin u (đường tô đỏ trên lưới)", value: S.msg, mono: true, onInput: v => { S.msg = v; draw(); } });
      const cTail = ui.check({ id: "m5tr-tail", label: "Thêm m bit đuôi (các nhịp cuối chỉ có nhánh u = 0)", value: S.tail, onChange: v => { S.tail = v; draw(); } });
      const set = (K, g, msg) => {
        S.K = K; S.n = 2; S.g = g.concat(["6"]); S.msg = msg; S.tail = true;
        cc.sync(); fMsg.input.value = msg; cTail.input.checked = true; draw();
      };
      ctrl.append(cc, fMsg, cTail, ui.presets([
        { label: "(7, 5), tin 1011 (slide 2.2–2.4)", apply: () => set(3, ["7", "5"], "1011") },
        { label: "Bài tập 2.3: tin 1101", apply: () => set(3, ["7", "5"], "1101") },
        { label: "Bài tập 2.1–2.2: g = (1 + D, 1 + D + D²) = (6, 7)", apply: () => set(3, ["6", "7"], "1011") },
        { label: "K = 4: (15, 17), 8 trạng thái", apply: () => set(4, ["15", "17"], "1011") }
      ]));
      const out = ui.slot();
      view.append(out);
      function draw() {
        const code = mkCode(S);
        if (code.err) { out.render(ui.note(code.err, "eve")); return; }
        const bits = parseBits(S.msg) || [];
        if (bits.length > 24) { out.render(ui.note("Lưới chỉ vẽ tới 24 bit tin.", "eve")); return; }
        const E = encode(code, bits, S.tail), T = Math.max(E.u.length, code.m + 2);
        const onPath = new Map();
        E.steps.forEach((st, t) => onPath.set(t + ":" + st.st + ":" + st.u, st));
        const hiSD = new Set(E.steps.map(st => st.st + ":" + st.u));
        /* bảng chuyển trạng thái tự sinh, kèm phép tính chi tiết với giá trị s₁, s₂ của từng hàng */
        const tbl = ui.table(["Trạng thái (s₁s₂…)", { html: "u = 0: ra / tới" }, { html: "u = 1: ra / tới" }, "Cách tính"], code.names.map((nm, s) => {
          const ex = code.gens.map((g, i) => C_(i) + " = " + g.map((c, j) => c ? (j === 0 ? "u" : String((s >> (j - 1)) & 1)) : null).filter(x => x != null).join("⊕")).join(";  ");
          return [nm, code.T[s][0].outStr + " / " + code.names[code.T[s][0].ns], code.T[s][1].outStr + " / " + code.names[code.T[s][1].ns], { html: "<span class='small'>" + ex + "</span>" }];
        }), { mono: true, cls: "tight", rowCls: (r, s) => E.steps.some(st => st.st === s) ? "hi" : null });
        const seq = E.steps.length ? "00 → " + E.steps.map(st => code.names[st.ns]).join(" → ") : "—";
        out.render(
          codeInfo(code),
          ui.title("Bảng chuyển trạng thái", "slide 2.1 — hàng vàng: trạng thái mà tin đi qua"),
          tbl,
          ui.note("Trạng thái mới = (uₜ, s₁, …): bit vào đẩy vào ô đầu. Mỗi trạng thái có đúng 2 nhánh ra và 2 nhánh vào; hai nhánh ra từ cùng một trạng thái có đầu ra bù nhau khi mọi gᵢ có hệ số D⁰ = 1. Ví dụ slide 2.1: trạng thái 01, u = 1 ⇒ c¹ = 1⊕0⊕1 = 0, c² = 1⊕1 = 0, tới (1, 0) = 10.", "mut"),
          h("div", { class: "cols" },
            ui.panel("Sơ đồ trạng thái (slide 2.2)", stateSVG(code, hiSD),
              h("div", { class: "small" }, "Đường của tin " + (bits.join("") || "—") + (S.tail ? " + đuôi" : "") + ": " + seq)),
            ui.panel("Đường đi của tin",
              ui.table(["t", "uₜ", "Từ", "Tới", "Ra"], E.steps.map(st => [st.t, st.u + (st.tail ? " (đuôi)" : ""), code.names[st.st], code.names[st.ns], { html: "<b class='eve-c'>" + st.out.join("") + "</b>" }]), { mono: true, cls: "tight" }),
              ui.readouts([{ k: "Dãy mã đọc trên lưới", v: grpPairs(E.out) || "—", kind: "ct", big: true }]))),
          ui.title("Lưới mã (trellis) cho " + T + " nhịp", "slide 2.4 — nét liền u = 0, nét đứt u = 1, nhãn: đầu ra " + code.gens.map((_, i) => C_(i)).join("")),
          trellisSVG(code, T, {
            edge: (t, s, u) => {
              if (S.tail && t >= bits.length && u === 1) return null;
              const st = onPath.get(t + ":" + s + ":" + u);
              if (st) return { hi: true, color: "var(--eve)", label: st.out.join("") };
              return { label: code.nS <= 4 ? code.T[s][u].outStr : null, dim: t >= E.u.length };
            },
            node: (t, s) => {
              const on = (t === 0 && s === 0) || E.steps.some(st => st.t === t && st.ns === s);
              return { hi: on, dim: t > E.u.length };
            }
          }),
          ui.note("Mỗi dãy mã ↔ một đường đi từ 00 về 00 trong lưới. Cây mã có 2ᴸ nút sau L nhịp, nhưng chỉ có " + code.nS + " trạng thái khác nhau nên các nút cùng trạng thái được gộp lại (slide 2.3). Với L = 200 bit, zero-tail: " + (code.n * (200 + code.m)) + " bit mã, tốc độ thực 200/" + code.n * (200 + code.m) + " ≈ " + LAB.fmt(200 / (code.n * (200 + code.m)), 3) + " (bài tập 2.4).", "mut")
        );
      }
      draw();
      pane.appendChild(root);
    } },

  /* ---------------------------------------------------------------- 3. Khoảng cách tự do ---------------------------------------------------------------- */
  { id: "dfree", title: "Khoảng cách tự do",
    intro: "d<sub>free</sub> = trọng số nhỏ nhất của đường rời 00 rồi quay về 00 (slide 3.1); phổ trọng số và hàm truyền (3.2); bộ mã hóa thảm họa theo tiêu chuẩn Massey–Sain (3.5); bảng mã tốt nhất tốc độ 1/2 (3.4); đục lỗ (3.6).",
    build(pane) {
      const S = { K: 3, n: 2, g: ["7", "5", "6"], pMsg: "1011", pat: "11;10" };
      const { root, ctrl, view } = ui.sim();
      const cc = codeCtrl("m5df", S, draw);
      const set = (K, n, g) => { S.K = K; S.n = n; S.g = g.concat(["6"]).slice(0, 3); cc.sync(); draw(); };
      ctrl.append(cc, ui.presets([
        { label: "(7, 5): d_free = 5 (slide 3.1)", apply: () => set(3, 2, ["7", "5"]) },
        { label: "Bài tập 3.2: g = (1 + D, 1 + D + D²) = (6, 7)", apply: () => set(3, 2, ["6", "7"]) },
        { label: "Thảm họa: g = (1 + D, 1 + D²) = (6, 5) (slide 3.5)", apply: () => set(3, 2, ["6", "5"]) },
        { label: "Bài tập 3.3: g = (1 + D², 1 + D + D² + D³) = (12, 17), K = 4", apply: () => set(4, 2, ["12", "17"]) },
        { label: "Tốc độ 1/3: (7, 5, 6)", apply: () => set(3, 3, ["7", "5", "6"]) }
      ]));
      const BEST = [[3, "7, 5", 5, "Mã dùng trong bài"], [4, "15, 17", 6, ""], [5, "23, 35", 7, "GSM dùng (23, 33)"], [6, "53, 75", 8, ""], [7, "133, 171", 10, "NASA, Wi-Fi, DVB-S"], [9, "561, 753", 12, "IS-95 CDMA"]];
      ctrl.append(ui.title("Mã tốt nhất tốc độ 1/2", "slide 3.4"),
        ui.table(["K", "Trạng thái", "g (cơ số 8)", "d_free", ""], BEST.map(b => [b[0], 1 << (b[0] - 1), b[1], b[2],
          b[0] <= 5 ? ui.btn("Dùng", () => set(b[0], 2, b[1].split(", ")), "sm") : { html: "<span class='small'>K quá lớn để vẽ</span>" }]), { mono: true, cls: "tight" }),
        h("div", { class: "small" }, "K tăng 1 ⇒ d_free tăng ≈ 1 nhưng số trạng thái Viterbi gấp đôi. Nút «Dùng» nạp mã vào mô phỏng để kiểm chứng d_free."));
      const out = ui.slot();
      view.append(out);
      /* khối đục lỗ (slide 3.6, bài tập 3.4): ô nhập riêng, vẽ lại độc lập */
      const punc = ui.slot();
      const fPMsg = ui.field({ id: "m5df-pmsg", label: "Tin để đục lỗ", value: S.pMsg, mono: true, onInput: v => { S.pMsg = v; drawPunc(); } });
      const fPat = ui.field({ id: "m5df-pat", label: "Mẫu đục lỗ P (một hàng cho mỗi cⁱ, cách nhau bằng «;»)", value: S.pat, mono: true, onInput: v => { S.pat = v; drawPunc(); } });
      const puncPre = ui.presets([
        { label: "P = (11; 10) ⇒ R = 2/3 (slide 3.6)", apply: () => { S.pat = "11;10"; fPat.input.value = S.pat; drawPunc(); } },
        { label: "Bài tập 3.4: P = (110; 101)", apply: () => { S.pat = "110;101"; fPat.input.value = S.pat; drawPunc(); } },
        { label: "Wi-Fi 3/4: P = (110; 101) từ mã K = 7", apply: () => { S.pat = "110;101"; fPat.input.value = S.pat; drawPunc(); } }
      ], "Mẫu đục lỗ");
      function drawPunc() {
        const code = mkCode(S);
        if (code.err) { punc.render(); return; }
        const bits = parseBits(S.pMsg) || [];
        const rowsP = String(S.pat).split(/[;\n]/).map(s => s.replace(/[\s,]/g, ""));
        if (rowsP.length !== code.n || rowsP.some(r => !/^[01]+$/.test(r)) || new Set(rowsP.map(r => r.length)).size !== 1 || !bits.length) {
          punc.render(ui.note("Mẫu P cần đúng n = " + code.n + " hàng bit 0/1 cùng độ dài (chu kỳ), ví dụ «11;10»; tin không rỗng.", "eve")); return;
        }
        const per = rowsP[0].length, kept = rowsP.join("").split("").filter(c => c === "1").length;
        const E = encode(code, bits, true), flat = E.out.flat();
        const dim = new Set();
        flat.forEach((_, idx) => { const t = Math.floor(idx / code.n), i = idx % code.n; if (rowsP[i][t % per] === "0") dim.add(idx); });
        const keptBits = flat.filter((_, idx) => !dim.has(idx));
        const gcdR = math.gcd(per, kept);
        punc.render(
          ui.bits(flat, { group: code.n, kind: "ct", dim, label: "Mã mẹ 1/" + code.n }),
          ui.bits(keptBits, { kind: "ct", label: "Sau đục lỗ" }),
          ui.readouts([
            { k: "Chu kỳ mẫu", v: per + " nhịp → " + per + " bit tin" }, { k: "Bit giữ lại mỗi chu kỳ", v: kept + "/" + per * code.n },
            { k: "Tốc độ mới", v: per + "/" + kept + (gcdR > 1n ? " = " + (BigInt(per) / gcdR) + "/" + (BigInt(kept) / gcdR) : ""), kind: "key", big: true },
            { k: "Số bit truyền", v: keptBits.length + " thay vì " + flat.length }]),
          ui.note("Phía thu chèn ký hiệu «xóa» vào vị trí bị đục rồi giải mã như mã mẹ: BM bỏ qua vị trí xóa (slide 4.11). Một bộ giải mã Viterbi phục vụ nhiều tốc độ – Wi-Fi 802.11a dùng mã mẹ K = 7, R = 1/2 đục lỗ thành 2/3 và 3/4 (bài tập 5.2: 3/4 giữ 4 bit trên 6).", "mut"));
      }
      function draw() {
        const code = mkCode(S);
        if (code.err) { out.render(ui.note(code.err, "eve")); return; }
        const D = dfree(code), cat = catastrophic(code), outs = code.gens.map((_, i) => C_(i)).join("");
        const t = D.d != null ? Math.floor((D.d - 1) / 2) : null;
        const pathRows = D.paths.slice(0, 30).map(p => [p.u, p.c.join(" "), p.w]);
        const specRows = [];
        for (let w = D.d; w <= D.Wmax; w++) specRows.push([w, D.spec[w]]);
        const is75 = code.oct.join(",") === "7,5";
        /* minh họa thảm họa: tin toàn 1 không đuôi */
        const ones = encode(code, new Array(10).fill(1), false), wOnes = ones.out.flat().reduce((a, b) => a + b, 0);
        const gcdSteps = (() => {
          const ints = code.gens.map(polyInt), st = [];
          let g = ints[0];
          for (let i = 1; i < ints.length; i++) { const r = math.gf2gcd(g, ints[i]); st.push({ t: "gcd(" + intPolyStr(g) + ", " + intPolyStr(ints[i]) + ")", r: "= " + intPolyStr(r) }); g = r; }
          return st;
        })();
        /* chặn trên Viterbi cứng cho (7,5): T(D) = D⁵/(1−2D) tại D = 2√(p(1−p)) */
        const bound = p => { const Dd = 2 * Math.sqrt(p * (1 - p)); return 2 * Dd < 1 ? Math.pow(Dd, 5) / (1 - 2 * Dd) : NaN; };
        out.render(
          codeInfo(code),
          ui.readouts([
            { k: "d_free", v: D.d == null ? "∞?" : D.d, kind: "key", big: true },
            { k: "Sửa được t = ⌊(d_free − 1)/2⌋", v: t == null ? "—" : t + " lỗi trong một đoạn ngắn", kind: "ok" },
            { k: "gcd(g₁, …, gₙ)", v: cat.poly, kind: cat.bad ? "eve" : "ok" },
            { k: "Kết luận", v: cat.bad ? "THẢM HỌA" : "Không thảm họa", kind: cat.bad ? "eve" : "ok" }]),
          ui.title("Các đường rời 00 và quay về 00 có trọng số ≤ d_free + 2", "slide 3.1 — tìm bằng Dijkstra trên lưới rồi liệt kê bằng duyệt sâu" + (D.truncated ? " (đã cắt bớt)" : "")),
          ui.table(["Tin (tách khỏi 00)", "Dãy mã " + outs, "Trọng số"], pathRows, { mono: true, cls: "tight", rowCls: r => r[2] === D.d ? "hi" : null }),
          pathRows.length < D.paths.length ? h("div", { class: "small" }, "Chỉ hiện 30/" + D.paths.length + " đường.") : null,
          h("div", { class: "cols" },
            ui.panel("Phổ trọng số A_d (số đường trọng số d)",
              ui.table(["d", "A_d"], specRows, { mono: true, cls: "tight grid" }),
              h("div", { class: "small" }, D.specOpen
                ? "Vẫn còn đường chưa về 00 sau 80 nhịp (vòng lặp trọng số 0 ⇒ thảm họa): phổ chỉ đếm các đường độ dài ≤ 80."
                : "Đếm bằng quy hoạch động trên lưới theo (trạng thái, trọng số); mọi đường có trọng số ≤ " + D.Wmax + " đã được đếm đủ."),
              is75 ? ui.note("Hàm truyền (slide 3.2): T(D) = D⁵/(1 − 2D) = D⁵ + 2D⁶ + 4D⁷ + 8D⁸ + … – hệ số trùng cột A_d. Chặn trên lỗi sự kiện trên BSC(p): P_e ≲ T(D)|<sub>D = 2√(p(1−p))</sub>; p = 0,01 ⇒ D ≈ " + vn(2 * Math.sqrt(0.01 * 0.99), 3) + " ⇒ P_e ≲ " + bound(0.01).toExponential(1).replace(".", ",") + ".", "key") : null),
            ui.panel("Kiểm tra thảm họa (Massey–Sain, k = 1)",
              ui.steps(gcdSteps.concat([{ t: "Thảm họa ⇔ gcd ≠ Dˡ",
                r: cat.bad ? "gcd = " + cat.poly + " không phải lũy thừa của D ⇒ <b>bộ mã hóa thảm họa</b>" : "gcd = " + cat.poly + " = D" + sup(deg(cat.g)) + " ⇒ an toàn", hi: true }])),
              ui.title("Tin 1111111111 (không đuôi)", "slide 3.5"),
              ui.bits(ones.out.flat(), { group: code.n, kinds: ones.out.flat().map(b => b ? "eve" : "ct"), label: "Dãy mã" }),
              ui.note(cat.bad
                ? "Tin trọng số vô hạn (toàn 1) sinh dãy mã trọng số chỉ " + wOnes + " trên 10 nhịp rồi toàn 0: vòng lặp trọng số 0 ở trạng thái " + code.names[ones.end] + ". Nếu vài bit đầu bị lỗi thành 0, bộ giải mã đoán tin toàn 0 ⇒ sai vô hạn bit."
                : "Tin toàn 1 vẫn cho dãy mã trọng số tăng không ngừng (" + wOnes + " trên 10 nhịp): không có vòng lặp trọng số 0 ngoài trạng thái 00.", cat.bad ? "eve" : "ok"))),
          ui.note("Mã chập là mã tuyến tính nên d_free = trọng số nhỏ nhất của một đường khác 0. Nó sửa được nhiều lỗi trên dãy dài miễn là các lỗi cách xa nhau vài độ dài ràng buộc; lỗi chùm cần xen kẽ (tab 5).", "mut"),
          ui.panel("Đục lỗ (puncturing) để tăng tốc độ — slide 3.6", h("div", { class: "row" }, fPMsg, fPat), puncPre, punc)
        );
        drawPunc();
      }
      draw();
      pane.appendChild(root);
    } },

  /* ---------------------------------------------------------------- 4. Giải mã Viterbi ---------------------------------------------------------------- */
  { id: "viterbi", title: "Giải mã Viterbi",
    intro: "Quy hoạch động trên lưới: mỗi nhịp một phép Cộng – So sánh – Chọn (ACS) cho từng trạng thái, chỉ giữ đường sống sót có metric nhỏ nhất, rồi truy vết (slide 4.1–4.7). Preset: r = 11 11 00 01 01 11 (1 lỗi ở nhịp 2) → 1011.",
    build(pane) {
      const S = { K: 3, n: 2, g: ["7", "5", "6"], r: "11 11 00 01 01 11", msg: "1011", tail: true, k: 6, orig: null, sr: "+0,8; -0,1" };
      const { root, ctrl, view } = ui.sim();
      const cc = codeCtrl("m5vt", S, () => { S.orig = null; S.k = 99; draw(); });
      const fR = ui.field({ id: "m5vt-r", label: "Dãy nhận r (các bộ n bit)", value: S.r, mono: true, onInput: v => { S.r = v; S.orig = null; S.k = 99; draw(); } });
      const cTail = ui.check({ id: "m5vt-tail", label: "Có m bit đuôi (kết thúc tại 00)", value: S.tail, onChange: v => { S.tail = v; S.k = 99; draw(); } });
      const fMsg = ui.field({ id: "m5vt-msg", label: "Tin để tạo r từ bộ mã hóa", value: S.msg, mono: true, onInput: v => { S.msg = v; } });
      const bEnc = ui.btn("Mã hóa tin → r (rồi bấm vào bit để gây lỗi)", () => {
        const code = mkCode(S), b = parseBits(S.msg);
        if (code.err || !b || !b.length) return;
        const E = encode(code, b, S.tail);
        S.r = grpPairs(E.out); S.orig = E.out.flat(); fR.input.value = S.r; S.k = 99; draw();
      }, "pri");
      const set = (r, tail, msg) => {
        S.K = 3; S.n = 2; S.g = ["7", "5", "6"]; S.r = r; S.tail = tail; S.orig = null; S.k = 99;
        if (msg) { S.msg = msg; fMsg.input.value = msg; }
        cc.sync(); fR.input.value = r; cTail.input.checked = tail; draw();
      };
      ctrl.append(cc, fR, cTail, fMsg, bEnc, ui.presets([
        { label: "Slide 4.3: 1 lỗi, r = 11 11 00 01 01 11", apply: () => set("11 11 00 01 01 11", true, "1011") },
        { label: "Slide 4.6: 2 lỗi rời, r = 11 00 00 11 01 11", apply: () => set("11 00 00 11 01 11", true, "1011") },
        { label: "Slide 4.7 (van Tilborg): 7 bit tin + 2 đuôi", apply: () => set("01 11 00 10 11 11 10 11 00", true, "1010010") },
        { label: "Bài tập 4.1: r = 11 01 11 00 10 11", apply: () => set("11 01 11 00 10 11", true, "1101") },
        { label: "Bài tập 4.2: r = 01 10 00 01 01 11", apply: () => set("01 10 00 01 01 11", true, "1011") }
      ]), ui.note("Quy ước hòa: khi hai ứng viên có cùng metric, giữ nhánh đến từ trạng thái có chỉ số nhỏ hơn theo thứ tự 00, 10, 01, 11 (slide 4.2: «hòa ⇒ chọn tùy ý theo quy ước»).", "mut"));
      const out = ui.slot();
      view.append(out);
      /* ---- khối quyết định mềm (slide 4.9) ---- */
      const soft = ui.slot();
      const fSoft = ui.field({ id: "m5vt-soft", label: "Mẫu nhận (r₁; r₂) sau BPSK (bit 0 → +1, bit 1 → −1)", value: S.sr, mono: true, onInput: v => { S.sr = v; drawSoft(); } });
      function drawSoft() {
        const nums = String(S.sr).replace(/,/g, ".").split(/[;\s]+/).filter(Boolean).map(Number);
        if (nums.length !== 2 || nums.some(x => !isFinite(x))) { soft.render(ui.note("Nhập hai số thực, ví dụ «+0,8; −0,1».", "eve")); return; }
        const [a, b] = nums, hard = [a < 0 ? 1 : 0, b < 0 ? 1 : 0];
        const term = (r, s) => "(" + vn(r, 1) + (s > 0 ? " − 1" : " + 1") + ")²";
        const rows = ["00", "11", "01", "10"].map(c => {
          const bits = c.split("").map(Number), s = bits.map(x => x ? -1 : 1);
          const hd = (bits[0] !== hard[0]) + (bits[1] !== hard[1]), e2 = (a - s[0]) ** 2 + (b - s[1]) ** 2;
          return [c, "(" + s.map(x => (x > 0 ? "+" : "−") + "1").join(", ") + ")", hd, term(a, s[0]) + " + " + term(b, s[1]) + " = " + vn(e2), vn(-(a * s[0] + b * s[1]))];
        });
        const tieH = rows[0][2] === rows[1][2];
        const e00 = (a - 1) ** 2 + (b - 1) ** 2, e11 = (a + 1) ** 2 + (b + 1) ** 2;
        soft.render(
          ui.readouts([
            { k: "Quyết định cứng (lấy dấu)", v: hard.join(""), kind: "ct" },
            { k: "Hamming tới 00 / 11", v: rows[0][2] + " / " + rows[1][2] + (tieH ? " — hòa" : ""), kind: tieH ? "eve" : "ok" },
            { k: "Euclid² tới 00 / 11", v: vn(e00) + " / " + vn(e11), kind: "key" },
            { k: "Mềm chọn", v: e00 < e11 ? "00" : e11 < e00 ? "11" : "hòa", kind: "ok", big: true }]),
          ui.table(["Nhánh", "Điểm tín hiệu", "BM cứng (Hamming với " + hard.join("") + ")", "BM mềm (Euclid²)", "−tương quan"], rows, { mono: true, cls: "tight", rowCls: (r, i) => i < 2 ? "hi" : null }),
          ui.note("Mẫu " + vn(Math.abs(a) < Math.abs(b) ? a : b, 1) + " gần ngưỡng 0 là kém tin cậy: quyết định cứng bỏ mất thông tin này" + (tieH ? " nên hòa giữa 00 và 11" : "") + "; quyết định mềm dùng khoảng cách Euclid (hoặc tương quan) làm BM – thuật toán Viterbi không đổi, lợi ≈ 2 dB (slide 4.9). Bài tập 4.4: thử (−0,9; +0,2).", "mut"));
      }
      function draw() {
        const code = mkCode(S);
        if (code.err) { out.render(ui.note(code.err, "eve")); return; }
        const r = parsePairs(S.r, code.n);
        if (!r) { out.render(codeInfo(code), ui.note("Dãy nhận phải gồm bit 0/1 với số bit chia hết cho n = " + code.n + " (có thể cách nhau bằng dấu cách).", "eve")); return; }
        if (r.length > 40) { out.render(ui.note("Để bảng còn đọc được, hãy nhập tối đa 40 nhịp (" + 40 * code.n + " bit); mô phỏng dài dùng tab BER.", "eve")); return; }
        if (S.tail && r.length <= code.m) { out.render(ui.note("Với bit đuôi cần nhiều hơn m = " + code.m + " nhịp.", "eve")); return; }
        const V = viterbi(code, r, S.tail, true), T = V.T;
        if (S.k > T) S.k = T;
        const k = S.k, flat = r.flat(), done = k === T;
        /* dãy nhận có thể bấm để lật bit; đỏ = khác dãy mã gốc từ bộ mã hóa */
        const kinds = flat.map((b, i) => (S.orig && S.orig[i] !== b) ? "eve" : "aqua");
        const bitsEl = ui.bits(flat, { group: code.n, kinds, label: "r (bấm để lật bit)", onClick: i => {
          if (!S.orig) S.orig = flat.slice();
          flat[i] ^= 1;
          const nr = [];
          for (let j = 0; j < flat.length; j += code.n) nr.push(flat.slice(j, j + code.n));
          S.r = grpPairs(nr); fR.input.value = S.r; S.k = 99; draw();
        } });
        const survivors = new Set(), onPath = new Set();
        V.det.forEach((cands, t) => cands.forEach(cs => cs.forEach(c => { if (c.win) survivors.add(t + ":" + c.from + ":" + c.u); })));
        V.path.forEach(p => onPath.add(p.t + ":" + p.from + ":" + p.u));
        const pathStates = new Set(V.path.map(p => (p.t + 1) + ":" + p.to));
        pathStates.add("0:0");
        const pmRows = V.rows.slice(0, k).map((row, t) => [t + 1, r[t].join(""), ...row.map((v, s) => {
          const txt = v >= V.INF ? "–" : String(v);
          return done && pathStates.has((t + 1) + ":" + s) ? { html: "<span class='hl'>" + txt + "</span>" } : txt;
        })]);
        const acs = k > 0 ? V.det[k - 1] : null;
        const tCap = Math.floor(((dfree(code).d || 1) - 1) / 2);
        out.render(
          codeInfo(code),
          bitsEl,
          ui.readouts([
            { k: "Số nhịp T", v: T + (S.tail ? " (L = " + V.L + " + " + code.m + " đuôi)" : " (cắt ngắn)") },
            { k: "Đã xử lý", v: k + "/" + T },
            { k: "PM cuối tại " + code.names[V.end], v: done ? V.pmEnd : "…", kind: "key" },
            { k: "Tin giải mã û", v: done ? V.uhat.slice(0, V.L).join("") + (S.tail ? " (" + V.uhat.slice(V.L).join("") + ")" : "") : "…", kind: "pt", big: true }]),
          ui.panel("Lưới với metric đường — " + (k === 0 ? "trạng thái đầu" : "sau nhịp t = " + k),
            trellisSVG(code, T, {
              edge: (t, s, u) => {
                if (t >= k) return null;
                if (S.tail && t >= V.L && u === 1) return null;
                if (V.rows[t - 1] ? V.rows[t - 1][s] >= V.INF : s !== 0) return null;   /* trạng thái chưa tới được */
                const key = t + ":" + s + ":" + u;
                if (done && onPath.has(key)) return { hi: true, color: "var(--eve)", label: code.T[s][u].outStr };
                if (survivors.has(key)) return { bold: true, color: "var(--pt)", label: code.nS <= 4 ? code.T[s][u].outStr : null };
                return { dim: true, label: code.nS <= 4 ? code.T[s][u].outStr : null };
              },
              node: (t, s) => {
                if (t > k) return { dim: true };
                const pm = t === 0 ? (s === 0 ? 0 : null) : (V.rows[t - 1][s] >= V.INF ? null : V.rows[t - 1][s]);
                if (pm == null) return { dim: true };
                return { text: pm, hi: done && pathStates.has(t + ":" + s) };
              },
              r: 12 }),
            stepper(S, "k", () => T, draw),
            h("div", { class: "small" }, "Số trên nút: PM. Nhánh xanh đậm: sống sót; nhánh mờ: bị loại trong ACS; đường đỏ: truy vết cuối cùng từ " + (S.tail ? "00" : "trạng thái có PM nhỏ nhất") + ".")),
          ui.title("Bảng metric đường PM theo nhịp", "slide 4.3 — thứ tự cột " + code.names.join(", ") + (done ? "; ô vàng: trạng thái trên đường sống sót cuối" : "")),
          ui.table(["t", "r", ...code.names.map(nm => "PM(" + nm + ")")], pmRows, { mono: true, cls: "tight" }),
          acs ? ui.panel("ACS tại nhịp t = " + k + " (nhận " + r[k - 1].join("") + ")",
            ui.table(["Tới trạng thái", "Ứng viên: từ (PM) + BM(nhánh u/ra, r)", "PM mới", "Survivor đến từ"], acs.map((cs, s) => {
              if (!cs.length) return null;
              const w = cs.find(c => c.win);
              return [code.names[s],
                { html: cs.map(c => (c.win ? "<b>" : "") + code.names[c.from] + " (" + c.pm + ") + d(" + c.out + ", " + r[k - 1].join("") + ") = " + c.pm + " + " + c.bm + " = " + c.sum + (c.win ? "</b>" : "")).join("<br>") },
                V.rows[k - 1][s], code.names[w.from] + " (u = " + w.u + ")"];
            }).filter(Boolean), { mono: true, cls: "tight" }),
            h("div", { class: "small" }, "PM(s) = min{PM(s′) + BM}: mỗi nhịp " + code.nS + " phép ACS, không cần so 2ᴸ đường (slide 4.2). Bài tập 4.3: xem ACS cho 01 tại t = 2.")) : null,
          done ? ui.panel("Truy vết (traceback) và kết quả — slide 4.5",
            ui.table(["Bước lùi", "Từ trạng thái", "Survivor đến từ", "Nhánh (u / ra)", "Bit tin"],
              V.path.slice().reverse().map((p, i) => [i + 1, code.names[p.to], code.names[p.from], p.u + " / " + p.out, p.u + (p.tail ? " (đuôi)" : "")]), { mono: true, cls: "tight" }),
            ui.readouts([
              { k: "Tin giải mã (đọc ngược)", v: V.uhat.join(""), kind: "pt" },
              { k: "Dãy mã ước lượng ĉ", v: grpPairs(V.chat), kind: "ct" },
              { k: "Khác r", v: V.nfix + " bit = PM cuối " + V.pmEnd, kind: V.nfix ? "eve" : "ok" }]),
            ui.bits(V.chat.flat(), { group: code.n, kinds: V.chat.flat().map((b, i) => b !== flat[i] ? "eve" : "ct"), label: "ĉ (đỏ: vị trí đã sửa)" }),
            ui.note(V.pmEnd <= tCap
              ? "PM cuối = " + V.pmEnd + " ≤ t = ⌊(d_free − 1)/2⌋ = " + tCap + ": dãy nhận khác đường tốt nhất " + V.pmEnd + " bit ⇒ sửa được chắc chắn."
              : "PM cuối = " + V.pmEnd + " vượt khả năng sửa bảo đảm t = " + tCap + "; kết quả vẫn là dãy mã gần r nhất nhưng có thể không phải dãy đã gửi (lỗi gần nhau ⇒ cần xen kẽ, slide 4.6).", V.pmEnd <= tCap ? "ok" : "key"))
            : ui.note("Bấm «Bước ›» để xem từng nhịp hoặc «Chạy hết» để truy vết.", "mut"),
          ui.panel("Quyết định mềm (slide 4.9)", fSoft, soft)
        );
        drawSoft();
      }
      draw();
      pane.appendChild(root);
    } },

  /* ---------------------------------------------------------------- 5. Mô phỏng BER ---------------------------------------------------------------- */
  { id: "ber", title: "Mô phỏng BER",
    intro: "Tin ngẫu nhiên → mã chập → kênh BSC(p) → Viterbi cứng; so BER sau giải mã với p không mã hóa (độ lợi mã hóa, slide 4.10–4.11). Khối xen kẽ R × C rải chùm lỗi thành lỗi đơn (slide 5.4).",
    build(pane) {
      const S = { K: 3, n: 2, g: ["7", "5", "6"], N: 2000, seed: 9, res: null, running: false, R: 3, C: 4, b: 3, start: 4 };
      const PS = [0.005, 0.01, 0.02, 0.03, 0.05, 0.07, 0.1, 0.15, 0.2];
      const { root, ctrl, view } = ui.sim();
      const cc = codeCtrl("m5br", S, () => { S.res = null; draw(); });
      const selN = ui.select({ id: "m5br-N", label: "Số bit tin N cho mỗi giá trị p", options: [[1000, "1 000"], [2000, "2 000"], [5000, "5 000"], [10000, "10 000"]], value: S.N,
        onChange: v => { S.N = +v; S.res = null; draw(); } });
      const prog = ui.slot();
      /* chạy từng giá trị p trong setTimeout để cập nhật tiến độ */
      const run = () => {
        const code = mkCode(S);
        if (code.err || S.running) return;
        S.running = true; S.res = [];
        const rng = LAB.rng(S.seed * 7919 + S.N);
        let i = 0;
        const step = () => {
          const p = PS[i], bits = [];
          for (let j = 0; j < S.N; j++) bits.push(rng() < 0.5 ? 1 : 0);
          const E = encode(code, bits, true);
          let chErr = 0;
          const r = E.out.map(o => o.map(b => { if (rng() < p) { chErr++; return b ^ 1; } return b; }));
          const V = viterbi(code, r, true, false);
          let err = 0;
          for (let j = 0; j < S.N; j++) if (V.uhat[j] !== bits[j]) err++;
          S.res.push({ p, chErr, nCode: r.length * code.n, err, ber: err / S.N });
          i++;
          prog.render(ui.note("Đang mô phỏng… " + i + "/" + PS.length + " (p = " + p + ": " + err + " lỗi bit tin sau giải mã)", "key"));
          if (i < PS.length) setTimeout(step, 0); else { S.running = false; prog.render(); draw(); }
        };
        prog.render(ui.note("Đang mô phỏng…", "key"));
        setTimeout(step, 0);
      };
      ctrl.append(cc, selN, h("div", { class: "row" }, ui.btn("Chạy mô phỏng", run, "pri"), ui.btn("Chạy lại (mầm mới)", () => { S.seed++; run(); })), prog,
        ui.presets([
          { label: "(7, 5), N = 2000", apply: () => { S.K = 3; S.n = 2; S.g = ["7", "5", "6"]; S.N = 2000; cc.sync(); selN.input.value = 2000; S.res = null; run(); } },
          { label: "GSM (23, 33), K = 5", apply: () => { S.K = 5; S.n = 2; S.g = ["23", "33", "6"]; cc.sync(); S.res = null; run(); } },
          { label: "Tốc độ 1/3: (7, 5, 6)", apply: () => { S.K = 3; S.n = 3; S.g = ["7", "5", "6"]; cc.sync(); S.res = null; run(); } }
        ]),
        ui.note("Mỗi lần chạy tối đa " + PS.length + " × 10 000 bit tin; kết quả tái lập theo mầm (LAB.rng). BER = 0 trong N bit được ghi là «&lt; 1/N» và không hiện trên trục log.", "mut"));
      const out = ui.slot();
      view.append(out);
      const box = chart.box(b => {
        if (!S.res || !S.res.length) return;
        const code = mkCode(S);
        const is75 = !code.err && code.oct.join(",") === "7,5";
        const bound = PS.map(p => { const Dd = 2 * Math.sqrt(p * (1 - p)); return (!is75 || 2 * Dd >= 1) ? [p, NaN] : [p, Math.pow(Dd, 5) / Math.pow(1 - 2 * Dd, 2)]; });
        const pts = S.res.map(x => [x.p, x.ber > 0 ? x.ber : NaN]);
        const positives = S.res.filter(x => x.ber > 0).map(x => x.ber);
        chart.line(b, {
          series: [
            { name: "Không mã hóa: BER = p", color: "eve", points: PS.map(p => [p, p]), marker: true },
            { name: "Mã " + (code.err ? "" : code.label) + " + Viterbi cứng", color: "pt", points: pts, marker: true },
            { name: "Chặn trên D⁵/(1−2D)² (slide 4.11)", color: "key", points: bound, dash: [5, 4] }],
          xlabel: "Xác suất lỗi bit của kênh p (BSC)", ylabel: "BER sau giải mã", ylog: true,
          ymin: Math.max(1e-5, Math.min(0.5 / S.N, ...positives) / 2), ymax: 0.5, xmin: 0, xmax: 0.21,
          fmtX: v => String(+v.toFixed(3)), fmtY: v => v.toExponential(0), aspect: 0.55 });
      });
      function draw() {
        const code = mkCode(S);
        if (code.err) { out.render(ui.note(code.err, "eve")); return; }
        const rows = (S.res || []).map(x => [x.p, x.chErr + " / " + x.nCode + " (" + LAB.pct(x.chErr / x.nCode, 2) + ")", x.err + " / " + S.N,
          x.ber > 0 ? x.ber.toExponential(2) : "< " + (1 / S.N).toExponential(1), x.ber > 0 ? LAB.fmt(x.p / x.ber, 1) + "×" : "> " + LAB.fmt(x.p * S.N, 0) + "×"]);
        out.render(
          codeInfo(code),
          S.res && S.res.length === PS.length ? box : ui.note(S.running ? "Đang chạy…" : "Bấm «Chạy mô phỏng» để tính BER cho p ∈ {" + PS.join("; ") + "}.", "mut"),
          S.res && S.res.length ? ui.table(["p", "Lỗi kênh / bit mã", "Lỗi tin sau giải mã / N", "BER", "Giảm lỗi"], rows, { mono: true, cls: "tight", rowCls: r => r[0] <= 0.03 ? "good" : (r[0] >= 0.15 ? "bad" : null) }) : null,
          S.res && S.res.length ? ui.note("Khi p nhỏ, các lỗi kênh cách xa nhau nên Viterbi sửa gần hết (BER giảm nhiều bậc); khi p lớn (≳ 0,1) các lỗi gần nhau vượt quá t = 2 trong một độ dài ràng buộc và mã mất tác dụng – đường mã cắt đường không mã hóa. Đó là bản chất «ngưỡng» của độ lợi mã hóa.", "key") : null,
          ui.panel("Độ lợi mã hóa ở BER = 10⁻⁵ trên kênh AWGN (slide 4.10)",
            ui.table(["Hệ thống", "Eb/N0 cần", "Độ lợi"], [
              ["BPSK không mã hóa", "≈ 9,6 dB", "–"], ["Mã (7, 5), Viterbi cứng", "≈ 7,5 dB", "≈ 2 dB"], ["K = 7 (133, 171), Viterbi cứng", "≈ 6,6 dB", "≈ 3 dB"],
              ["K = 7, Viterbi mềm", "≈ 4,4 dB", "≈ 5 dB"], ["Mã turbo (1993)", "≈ 1 dB", "≈ 8,6 dB"], ["Giới hạn Shannon (R = 1/2)", "0,19 dB", "–"]], { cls: "tight" }),
            h("div", { class: "small" }, "Độ lợi mã hóa = mức giảm Eb/N0 cần thiết ở cùng BER; 5 dB ≈ giảm 3 lần công suất phát hoặc tăng ~1,8 lần cự ly. Mô phỏng ở trên dùng kênh BSC nên chỉ so theo p, không theo Eb/N0.")),
          interleaver()
        );
        if (S.res && S.res.length === PS.length) box.draw();
      }
      /* ---- xen kẽ khối R × C (slide 5.4): ghi theo hàng, đọc theo cột ---- */
      const il = ui.slot();
      const fR = ui.field({ id: "m5br-R", label: "Số hàng R", type: "number", value: S.R, min: 1, max: 12, onInput: v => { S.R = +v; drawIL(); } });
      const fC = ui.field({ id: "m5br-C", label: "Số cột C", type: "number", value: S.C, min: 1, max: 12, onInput: v => { S.C = +v; drawIL(); } });
      const fB = ui.field({ id: "m5br-b", label: "Độ dài chùm lỗi b", type: "number", value: S.b, min: 1, max: 40, onInput: v => { S.b = +v; drawIL(); } });
      const fS = ui.field({ id: "m5br-s", label: "Vị trí bắt đầu chùm (trong thứ tự truyền)", type: "number", value: S.start, min: 1, max: 144, onInput: v => { S.start = +v; drawIL(); } });
      const setIL = (R, C, b, st) => { S.R = R; S.C = C; S.b = b; S.start = st; [fR, fC, fB, fS].forEach((f, i) => { f.input.value = [R, C, b, st][i]; }); drawIL(); };
      const ilPre = ui.presets([
        { label: "3 × 4, chùm 3 tại vị trí 4 (slide 5.4)", apply: () => setIL(3, 4, 3, 4) },
        { label: "Bài tập 5.1: 4 × 5, chùm 4", apply: () => setIL(4, 5, 4, 6) },
        { label: "Chùm dài hơn R: 3 × 4, chùm 5", apply: () => setIL(3, 4, 5, 4) }
      ], "Ví dụ xen kẽ");
      function interleaver() { return ui.panel("Xen kẽ khối R × C chống lỗi chùm (slide 5.4)", h("div", { class: "row" }, fR, fC, fB, fS), ilPre, il); }
      function drawIL() {
        const R = S.R, C = S.C, b = S.b, st = S.start;
        if (!(R >= 1 && C >= 1 && R * C <= 144) || !(b >= 1) || !(st >= 1)) { il.render(ui.note("R, C ≥ 1 với R·C ≤ 144; b ≥ 1; vị trí ≥ 1.", "eve")); return; }
        const tx = [];
        for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) tx.push(r * C + c + 1);
        const hit = new Set(tx.slice(st - 1, st - 1 + b)), hitPos = new Set();
        for (let i = st - 1; i < Math.min(tx.length, st - 1 + b); i++) hitPos.add(i);
        const rowsHit = new Set([...hit].map(x => Math.floor((x - 1) / C)));
        const perRow = Array.from({ length: R }, (_, r) => [...hit].filter(x => Math.floor((x - 1) / C) === r).length);
        const sorted = [...hit].sort((a, c) => a - c);
        let gap = null;
        for (let i = 1; i < sorted.length; i++) gap = gap == null ? sorted[i] - sorted[i - 1] : Math.min(gap, sorted[i] - sorted[i - 1]);
        const worst = Math.max(...perRow);
        il.render(
          h("div", { class: "cols" },
            h("div", { class: "stack" },
              h("div", { class: "small" }, "Ghi theo hàng 1…" + R * C + " (ô đỏ: ký hiệu bị chùm lỗi phá, sau khi khử xen kẽ)"),
              ui.matrix(Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => r * C + c + 1)), { cls: (i, j, v) => hit.has(v) ? "eve" : null })),
            h("div", { class: "stack" },
              ui.bits(tx.map(String), { wide: true, kinds: tx.map((_, i) => hitPos.has(i) ? "eve" : "aqua"), label: "Thứ tự truyền (đọc theo cột)" }),
              ui.bits(Array.from({ length: R * C }, (_, i) => String(i + 1)), { wide: true, group: C, kinds: Array.from({ length: R * C }, (_, i) => hit.has(i + 1) ? "eve" : "pt"), label: "Sau khử xen kẽ" }))),
          ui.readouts([
            { k: "Thứ tự truyền", v: tx.join(" "), kind: "aqua" },
            { k: "Ký hiệu bị lỗi (vị trí gốc)", v: sorted.join(", ") || "—", kind: "eve" },
            { k: "Số hàng bị ảnh hưởng", v: rowsHit.size + "/" + R + " (tối đa " + worst + " lỗi/hàng)", kind: worst <= 1 ? "ok" : "eve" },
            { k: "Khoảng cách nhỏ nhất giữa hai lỗi", v: gap == null ? "—" : gap, kind: "key" }]),
          ui.note(b <= R
            ? "Chùm dài b = " + b + " ≤ R = " + R + " được rải thành lỗi đơn cách nhau " + C + " vị trí (mỗi hàng ≤ 1 lỗi) – Viterbi sửa lỗi rời rạc tốt hơn nhiều so với lỗi chùm. Giá phải trả: độ trễ R × C = " + R * C + " ký hiệu."
            : "Chùm dài b = " + b + " > R = " + R + ": có hàng chịu nhiều hơn 1 lỗi (" + perRow.filter(x => x > 1).length + " hàng). Tăng R (độ trễ R × C = " + R * C + ") để chịu được chùm dài hơn.", b <= R ? "ok" : "eve"));
      }
      drawIL();
      draw();
      pane.appendChild(root);
    } }
  ]
});
})();
