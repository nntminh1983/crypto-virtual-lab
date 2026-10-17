/* COM608 — Mô-đun 2: Mã khối — giao thức ba bước, mạng Feistel (Trappe), S-DES, AES-128, chế độ hoạt động.
   Bài 4 (slide 23–63) và Bài 5 phần A (slide 4–34). Mọi preset đã đối chiếu bằng Python với số trên slide:
   - Ba bước: p=101, K=42, a=3, b=7 → a⁻¹=67, b⁻¹=43, K₁=55, K₂=94, K₃=93, K=42.
   - Feistel Trappe: 011100 100110, K=010011001 → vòng 1 R₁=110111; 3 vòng → 100000 100001.
   - S-DES: P=10111101, K=1010000010 → K1=10100100, K2=01000011, C=01110101.
   - AES FIPS-197 → 3925841D02DC09FBDC118597196A0B32; "Computer"/"Document" (đệm 00) → FC37FC07F47109FB4901DB2D32E1674E. */
(function () { "use strict";
const { h, ui, math, chart } = LAB;
const B = math.B;

/* ---------- tiện ích bit / hex ---------- */
const onlyBits = s => String(s || "").replace(/[^01]/g, "");
const xorS = (a, b) => a.split("").map((c, i) => (c === b[i] ? "0" : "1")).join("");
const permS = (s, t) => t.map(i => s[i - 1]).join("");
const rotl = (s, n) => s.slice(n) + s.slice(0, n);
const flipAt = (s, i) => s.slice(0, i) + (s[i] === "1" ? "0" : "1") + s.slice(i + 1);
/* mảng kind cho ui.bits: ô khác nhau giữa a và b tô 'eve', còn lại tô base */
const diffKinds = (a, b, base) => a.split("").map((c, i) => (c !== b[i] ? "eve" : base));
const nDiff = (a, b) => diffKinds(a, b).filter(k => k === "eve").length;
const hexBytes = arr => arr.map(b => LAB.hex(b, 2)).join("");
const hexGrp = arr => LAB.grp(hexBytes(arr), 8, " ");
const sup = s => "<sup>" + s + "</sup>";
const sub = s => "<sub>" + s + "</sub>";

/* ============================================================
   Thuật toán rút gọn kiểu DES của Trappe (khối 12 bit, khóa 9 bit) — slide 4.4.4
   ============================================================ */
const TR_E = [1, 2, 4, 3, 4, 3, 5, 6];
const TR_S1 = [
  ["101", "010", "001", "110", "011", "100", "111", "000"],
  ["001", "100", "110", "010", "000", "111", "101", "011"]];
const TR_S2 = [
  ["100", "000", "110", "101", "111", "001", "011", "010"],
  ["101", "011", "000", "111", "110", "010", "001", "100"]];
/* Kᵢ = 8 bit của K bắt đầu từ bit thứ i (quay vòng) */
function trSubkey(K, i) { let s = ""; for (let j = 0; j < 8; j++) s += K[(i - 1 + j) % 9]; return s; }
function trF(R, Ki) {
  const e = permS(R, TR_E), x = xorS(e, Ki);
  const r1 = +x[0], c1 = parseInt(x.slice(1, 4), 2);
  const r2 = +x[4], c2 = parseInt(x.slice(5, 8), 2);
  const s1 = TR_S1[r1][c1], s2 = TR_S2[r2][c2];
  return { e, x, r1, c1, r2, c2, s1, s2, f: s1 + s2 };
}
function trRun(L, R, keys) {
  const rows = [];
  keys.forEach((Ki, idx) => {
    const d = trF(R, Ki);
    const nL = R, nR = xorS(L, d.f);
    rows.push(Object.assign({ i: idx + 1, Ki, L0: L, R0: R, L: nL, R: nR }, d));
    L = nL; R = nR;
  });
  return rows;
}

/* ============================================================
   S-DES (Schaefer) — bảng chuẩn như slide 4.5.2
   ============================================================ */
const SD = {
  P10: [3, 5, 2, 7, 4, 10, 1, 9, 8, 6], P8: [6, 3, 7, 4, 8, 5, 10, 9],
  IP: [2, 6, 3, 1, 4, 8, 5, 7], IPi: [4, 1, 3, 5, 7, 2, 8, 6],
  EP: [4, 1, 2, 3, 2, 3, 4, 1], P4: [2, 4, 3, 1],
  S0: [[1, 0, 3, 2], [3, 2, 1, 0], [0, 2, 1, 3], [3, 1, 3, 2]],
  S1: [[0, 1, 2, 3], [2, 0, 1, 3], [3, 0, 1, 0], [2, 1, 0, 3]]
};
function sdKeys(K) {
  const p10 = permS(K, SD.P10);
  const l1 = rotl(p10.slice(0, 5), 1), r1 = rotl(p10.slice(5), 1);
  const K1 = permS(l1 + r1, SD.P8);
  const l2 = rotl(l1, 2), r2 = rotl(r1, 2);
  const K2 = permS(l2 + r2, SD.P8);
  return { p10, l1, r1, K1, l2, r2, K2 };
}
/* hàng = b₁b₄, cột = b₂b₃ */
function sdBox(S, b) {
  const row = parseInt(b[0] + b[3], 2), col = parseInt(b[1] + b[2], 2);
  return { row, col, out: LAB.bin(S[row][col], 2) };
}
function sdFk(L, R, sk) {
  const ep = permS(R, SD.EP), x = xorS(ep, sk);
  const s0 = sdBox(SD.S0, x.slice(0, 4)), s1 = sdBox(SD.S1, x.slice(4));
  const p4 = permS(s0.out + s1.out, SD.P4);
  return { L, R, ep, x, s0, s1, p4, nL: xorS(L, p4) };
}
function sdes(P, K, dec) {
  const ks = sdKeys(K);
  let k1 = ks.K1, k2 = ks.K2;
  if (dec) [k1, k2] = [k2, k1];
  const ip = permS(P, SD.IP);
  const r1 = sdFk(ip.slice(0, 4), ip.slice(4), k1);
  const sw = r1.R + r1.nL;
  const r2 = sdFk(sw.slice(0, 4), sw.slice(4), k2);
  const pre = r2.nL + r2.R;
  const C = permS(pre, SD.IPi);
  return { ks, ip, r1, sw, r2, pre, C, k1, k2 };
}
/* bảng tra 256 giá trị E_K(p) để mã ảnh nhanh */
function sdTable(K) {
  const t = new Uint8Array(256);
  for (let p = 0; p < 256; p++) t[p] = parseInt(sdes(LAB.bin(p, 8), K).C, 2);
  return t;
}

/* ============================================================
   AES-128 — S-box tự sinh (nghịch đảo GF(2⁸) + affine), mở rộng khóa, 10 vòng, giải mã
   ============================================================ */
const SBOX = new Uint8Array(256), ISBOX = new Uint8Array(256);
function gfInv(a) {
  if (!a) return 0;
  let r = 1, b = a, e = 254;
  while (e) { if (e & 1) r = math.gmul(r, b); b = math.gmul(b, b); e >>= 1; }
  return r;
}
(function buildSbox() {
  for (let a = 0; a < 256; a++) {
    const inv = gfInv(a);
    let s = inv;
    for (let k = 1; k <= 4; k++) s ^= ((inv << k) | (inv >>> (8 - k))) & 0xFF; /* bᵢ ⊕ bᵢ₊₄ ⊕ bᵢ₊₅ ⊕ bᵢ₊₆ ⊕ bᵢ₊₇ */
    s ^= 0x63;
    SBOX[a] = s; ISBOX[s] = a;
  }
})();
const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36];
const MC = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]];
const IMC = [[14, 11, 13, 9], [9, 14, 11, 13], [13, 9, 14, 11], [11, 13, 9, 14]];
function keyExpand(key) {
  const w = [], det = [];
  for (let i = 0; i < 4; i++) { w.push(key.slice(4 * i, 4 * i + 4)); det.push(null); }
  for (let i = 4; i < 44; i++) {
    let t = w[i - 1].slice(), d = null;
    if (i % 4 === 0) {
      const rot = [t[1], t[2], t[3], t[0]];
      const sb = rot.map(b => SBOX[b]);
      const rc = [sb[0] ^ RCON[i / 4 - 1], sb[1], sb[2], sb[3]];
      d = { temp: t, rot, sb, rc, rcon: RCON[i / 4 - 1] };
      t = rc;
    }
    w.push(w[i - 4].map((b, j) => b ^ t[j]));
    det.push(d);
  }
  return { w, det };
}
/* trạng thái: mảng 16 byte xếp theo cột, s[r, c] = st[r + 4c] */
const subBytes = (s, box) => s.map(b => box[b]);
function shiftRows(s, inv) {
  const o = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const src = inv ? (c - r + 4) % 4 : (c + r) % 4;
    o[r + 4 * c] = s[r + 4 * src];
  }
  return o;
}
function mixCol(a, M) { return [0, 1, 2, 3].map(r => a.reduce((v, b, k) => v ^ math.gmul(b, M[r][k]), 0)); }
function mixColumns(s, inv) {
  const M = inv ? IMC : MC, o = [];
  for (let c = 0; c < 4; c++) o.push(...mixCol(s.slice(4 * c, 4 * c + 4), M));
  return o;
}
const addKey = (s, w, r) => s.map((b, i) => b ^ w[4 * r + (i >> 2)][i & 3]);
function aesEncrypt(pt, w) {
  const rounds = [];
  let s = pt.slice();
  const a0 = addKey(s, w, 0);
  rounds.push({ in: s, ark: a0 }); s = a0;
  for (let r = 1; r <= 10; r++) {
    const sb = subBytes(s, SBOX), sr = shiftRows(sb);
    const mc = r < 10 ? mixColumns(sr) : null;
    const ark = addKey(mc || sr, w, r);
    rounds.push({ in: s, sb, sr, mc, ark }); s = ark;
  }
  return { ct: s, rounds };
}
function aesDecrypt(ct, w) {
  let s = addKey(ct, w, 10);
  for (let r = 9; r >= 0; r--) {
    s = shiftRows(s, true); s = subBytes(s, ISBOX); s = addKey(s, w, r);
    if (r > 0) s = mixColumns(s, true);
  }
  return s;
}
/* đọc 16 byte: hex (đệm 00) hoặc ASCII (đệm 00) */
function parse16(str, mode) {
  const out = new Array(16).fill(0);
  if (mode === "ascii") {
    const cs = Array.from(String(str));
    if (cs.some(c => c.codePointAt(0) > 255)) return { err: "Chỉ nhận ký tự ASCII/Latin-1 (mã < 256)." };
    if (cs.length > 16) return { err: "Chuỗi dài quá 16 ký tự." };
    cs.forEach((c, i) => { out[i] = c.codePointAt(0); });
    return { bytes: out, padded: cs.length < 16 };
  }
  const hx = String(str).replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]*$/.test(hx)) return { err: "Chuỗi hex chỉ gồm 0–9, A–F." };
  if (hx.length > 32 || hx.length % 2) return { err: "Cần tối đa 16 byte = 32 chữ số hex (số chữ số chẵn)." };
  for (let i = 0; i < hx.length / 2; i++) out[i] = parseInt(hx.substr(2 * i, 2), 16);
  return { bytes: out, padded: hx.length < 32 };
}
const stateRows = s => [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => s[r + 4 * c]));
const stateMat = (s, cls) => ui.matrix(stateRows(s), { cls, fmt: v => LAB.hex(v, 2) });

/* ============================================================ */
LAB.module({
  id: "m2",
  tabs: [

  /* ---------------- Tab 1: Giao thức ba bước ---------------- */
  { id: "threepass", title: "Giao thức ba bước",
    intro: "Shamir: Alice và Bob trao khóa K qua kênh công khai bằng lũy thừa modulo giao hoán (K<sup>a</sup>)<sup>b</sup> = (K<sup>b</sup>)<sup>a</sup>; nghịch đảo a<sup>−1</sup>, b<sup>−1</sup> tính theo <b>mod (p − 1)</b> (slide 4.3.2–4.3.4).",
    build(pane) {
      const S = { p: 101, K: 42, a: 3, b: 7, step: 4, det: "K1" };
      const { root, ctrl, view } = ui.sim();
      const F = {};
      const mk = (key, label, hint) => (F[key] = ui.field({
        id: "m2tp-" + key, label, type: "number", value: S[key], mono: true, hint,
        onInput: v => { S[key] = v; S.step = 4; draw(); } }));
      const setAll = (p, K, a, b) => {
        Object.assign(S, { p, K, a, b, step: 0 });
        ["p", "K", "a", "b"].forEach(k => { F[k].input.value = S[k]; });
        draw();
      };
      ctrl.append(
        mk("p", "Số nguyên tố p", "công khai, p > K"),
        mk("K", "Khóa K cần gửi (0 < K < p)"),
        mk("a", "Bí mật của Alice a", "cần gcd(a, p − 1) = 1"),
        mk("b", "Bí mật của Bob b", "cần gcd(b, p − 1) = 1"),
        ui.presets([
          { label: "p = 101, K = 42, a = 3, b = 7 (slide 4.3.4)", apply: () => setAll(101, 42, 3, 7) },
          { label: "Bài tập 3.1: p = 23, K = 10, a = 5, b = 9", apply: () => setAll(23, 10, 5, 9) },
          { label: "p = 31, K = 17, a = 7, b = 11", apply: () => setAll(31, 17, 7, 11) },
          { label: "Bài tập 3.2: a = 2 (gcd ≠ 1)", apply: () => setAll(101, 42, 2, 7) }
        ]),
        h("div", { class: "row" },
          ui.btn("‹ Lùi", () => { S.step = Math.max(0, S.step - 1); draw(); }, "sm"),
          ui.btn("Bước tiếp ›", () => { S.step = Math.min(4, S.step + 1); draw(); }, "pri"),
          ui.btn("Chạy hết", () => { S.step = 4; draw(); }, "sm"),
          ui.btn("Đặt lại", () => { S.step = 0; draw(); }, "sm")),
        ui.seg({ id: "m2tp-det", label: "Chi tiết bình phương – nhân cho",
          options: [["K1", "K₁"], ["K2", "K₂"], ["K3", "K₃"], ["K4", "K (Bob)"]], value: S.det,
          onChange: v => { S.det = v; draw(); } }));
      const out = ui.slot(); view.append(out);

      /* bảng Euclid mở rộng cho x⁻¹ mod m */
      function invTable(x, m, name) {
        const e = math.egcd(x, m);
        const inv = math.mod(e.s, m);
        const rows = e.steps.map(s => [String(s.a), String(s.b), String(s.q), String(s.r)]);
        return ui.panel(name + sup("−1") + " mod " + m + " bằng Euclid mở rộng",
          ui.table(["r" + sub("i−1"), "r" + sub("i"), "q", "r" + sub("i+1")], rows, { mono: true, cls: "tight" }),
          ui.note("gcd = " + e.g + "; hệ số Bézout: " + x + "·(" + e.s + ") + " + m + "·(" + e.t + ") = 1 ⇒ <b>" + name + sup("−1") + " = " + inv +
            "</b> (kiểm tra: " + x + "·" + inv + " = " + (B(x) * inv) + " = " + ((B(x) * inv - 1n) / B(m)) + "·" + m + " + 1)", "ok"));
      }
      /* một ô trong lưới .flow, mờ đi nếu chưa tới lượt */
      const cell = (cls, html, k) => h("div", { class: cls, html, style: { opacity: k <= S.step ? 1 : 0.18, transition: "opacity .25s" } });

      function draw() {
        const p = B(S.p), K = B(S.K), a = B(S.a), b = B(S.b), pm1 = p - 1n;
        const errs = [];
        if (!(p > 2n) || !math.isPrime(p)) errs.push("p = " + p + " không phải số nguyên tố (> 2).");
        if (!(K > 0n && K < p)) errs.push("Cần 0 < K < p.");
        if (a < 1n || b < 1n) errs.push("a, b phải là số nguyên dương.");
        if (p > 2n && math.gcd(a, pm1) !== 1n) errs.push("gcd(a, p − 1) = gcd(" + a + ", " + pm1 + ") = " + math.gcd(a, pm1) +
          " ≠ 1 → a<sup>−1</sup> mod (p − 1) không tồn tại; Bob không thể khôi phục K (bài tập 3.2).");
        if (p > 2n && math.gcd(b, pm1) !== 1n) errs.push("gcd(b, p − 1) = " + math.gcd(b, pm1) + " ≠ 1 → b<sup>−1</sup> không tồn tại.");
        if (errs.length) { out.render(errs.map(e => ui.note(e, "eve"))); return; }

        const ai = math.modinv(a, pm1), bi = math.modinv(b, pm1);
        const K1 = math.powmod(K, a, p), K2 = math.powmod(K1, b, p);
        const K3 = math.powmod(K2, ai, p), K4 = math.powmod(K3, bi, p);
        const ok = K4 === K;
        const flow = h("div", { class: "flow" },
          h("div", { class: "who a" }, "Alice"), h("div"), h("div", { class: "who b" }, "Bob"),
          cell("side", "Chọn a = " + a + ", tính a" + sup("−1") + " = " + ai + " mod " + pm1 + ".<br>K" + sub("1") + " = K" + sup("a") + " mod p = " + K + sup(String(a)) + " mod " + p + " = <b>" + K1 + "</b>", 1),
          cell("msg", "K₁ = " + K1 + "  →", 1),
          cell("side", "", 1),
          cell("side", "", 2),
          cell("msg", "←  K₂ = " + K2, 2),
          cell("side", "Chọn b = " + b + ", tính b" + sup("−1") + " = " + bi + ".<br>K" + sub("2") + " = K" + sub("1") + sup("b") + " mod p = " + K1 + sup(String(b)) + " mod " + p + " = <b>" + K2 + "</b>", 2),
          cell("side", "Gỡ ổ A: K" + sub("3") + " = K" + sub("2") + sup("a⁻¹") + " = " + K2 + sup(String(ai)) + " mod " + p + " = <b>" + K3 + "</b>", 3),
          cell("msg", "K₃ = " + K3 + "  →", 3),
          cell("side", "", 3),
          cell("side", "", 4),
          cell("arrow", "🔓", 4),
          cell("side", "Gỡ ổ B: K = K" + sub("3") + sup("b⁻¹") + " = " + K3 + sup(String(bi)) + " mod " + p + " = <b class='" + (ok ? "ok-c" : "eve-c") + "'>" + K4 + (ok ? " ✓" : " ✗") + "</b>", 4));
        const seen = [K1, K2, K3].slice(0, Math.max(0, Math.min(3, S.step)));
        const detMap = { K1: [K, a, "K₁ = K^a"], K2: [K1, b, "K₂ = K₁^b"], K3: [K2, ai, "K₃ = K₂^(a⁻¹)"], K4: [K3, bi, "K = K₃^(b⁻¹)"] };
        const [bb, ee, nm] = detMap[S.det];
        const sq = math.sqm(bb, ee, p);
        const small = ee < 60n && bb.toString().length * Number(ee) < 40;
        out.render(
          ui.readouts([
            { k: "a⁻¹ mod (p−1)", v: String(ai), kind: "key" }, { k: "b⁻¹ mod (p−1)", v: String(bi), kind: "key" },
            { k: "K₁ = K^a", v: String(K1), kind: "ct" }, { k: "K₂ = K₁^b", v: String(K2), kind: "ct" }, { k: "K₃ = K₂^(a⁻¹)", v: String(K3), kind: "ct" },
            { k: "Bob khôi phục", v: String(K4) + (ok ? " ✓" : " ✗"), kind: ok ? "ok" : "eve", big: true }]),
          ui.panel("Luồng trao đổi (lượt " + S.step + "/4)", flow,
            ui.note("<b>Eve chỉ thấy:</b> " + (seen.length ? seen.join(", ") : "(chưa có gì)") +
              ". Để tìm K từ K₁ = K<sup>a</sup>, K₂ = K₁<sup>b</sup>, K₃ phải giải logarit rời rạc modulo p — khó khi p lớn (bài tập 3.3).", "eve")),
          h("div", { class: "cols" }, invTable(a, pm1, "a"), invTable(b, pm1, "b")),
          ui.panel("Vì sao Bob nhận đúng K (slide 4.3.3)", ui.steps([
            { t: "a·a" + sup("−1") + " ≡ 1 (mod p − 1): " + a + "·" + ai + " = " + (a * ai) + " = " + ((a * ai - 1n) / pm1) + "·" + pm1 + " + 1" },
            { t: "b·b" + sup("−1") + " ≡ 1 (mod p − 1): " + b + "·" + bi + " = " + (b * bi) + " = " + ((b * bi - 1n) / pm1) + "·" + pm1 + " + 1" },
            { t: "K" + sub("3") + sup("b⁻¹") + " = K" + sup("a·b·a⁻¹·b⁻¹") + " = K" + sup("1 + m(p−1)") + " ≡ K·(K" + sup("p−1") + ")" + sup("m") + " ≡ K (Fermat, vì K<sup>p−1</sup> ≡ 1 mod p)", r: "K = " + K4, hi: true }])),
          ui.panel("Bình phương – nhân: " + nm + " = " + bb + sup(String(ee)) + " mod " + p,
            small ? ui.note(bb + sup(String(ee)) + " = " + (bb ** ee) + " = " + ((bb ** ee) / p) + "·" + p + " + " + ((bb ** ee) % p) + " ⇒ kết quả " + ((bb ** ee) % p), "mut") : null,
            ui.table(["Bit e" + sub("i"), "r² mod p", "× " + bb + "?", "r"],
              sq.steps.map(s => [s.bit, String(s.sq), s.bit === "1" ? "có" : "—", String(s.r)]),
              { mono: true, cls: "tight", rowCls: (r, i) => i === sq.steps.length - 1 ? "hi" : null }),
            ui.note("Số mũ " + ee + " = " + sq.bits + sub("2") + "; duyệt bit từ trái sang phải: bình phương rồi nhân thêm cơ số nếu bit = 1. Kết quả " + sq.r + ".", "mut")),
          ui.note("<b>Nhược điểm (slide 4.3.5):</b> 3 lần truyền; <b>không xác thực</b> → kẻ ở giữa Mallory có thể đóng vai Bob với Alice (nhận K<sup>a</sup>, trả K<sup>am</sup>, lấy được K) rồi đóng vai Alice với Bob bằng khóa K′ của mình. Thường chỉ dùng để trao khóa, sau đó mã dữ liệu bằng mã khối.", "key"));
      }
      draw();
      pane.appendChild(root);
    } },

  /* ---------------- Tab 2: Mạng Feistel (Trappe) ---------------- */
  { id: "feistel", title: "Feistel (Trappe)",
    intro: "Thuật toán kiểu DES rút gọn: khối 12 bit L<sub>0</sub>R<sub>0</sub>, khóa 9 bit, K<sub>i</sub> = 8 bit của K bắt đầu từ bit i (quay vòng); f = S<sub>1</sub>‖S<sub>2</sub>(E(R) ⊕ K<sub>i</sub>); L<sub>i</sub> = R<sub>i−1</sub>, R<sub>i</sub> = L<sub>i−1</sub> ⊕ f (slide 4.4.3–4.4.6).",
    build(pane) {
      const S = { blk: "011100 100110", K: "010011001", n: 3, dec: false, qe: "110010", qs: "0101" };
      const { root, ctrl, view } = ui.sim();
      const fB = ui.field({ id: "m2fe-blk", label: "Bản rõ L₀R₀ (12 bit)", value: S.blk, mono: true, onInput: v => { S.blk = v; draw(); } });
      const fK = ui.field({ id: "m2fe-k", label: "Khóa K (9 bit)", value: S.K, mono: true, onInput: v => { S.K = v; draw(); } });
      const fN = ui.range({ id: "m2fe-n", label: "Số vòng", min: 1, max: 4, value: S.n, onInput: v => { S.n = v; draw(); } });
      const bDec = ui.btn("Giải mã (chạy ngược)", () => { S.dec = !S.dec; bDec.classList.toggle("pri", S.dec); draw(); });
      const set = (blk, K, n) => { Object.assign(S, { blk, K, n }); fB.input.value = blk; fK.input.value = K; fN.set(n); draw(); };
      const fQe = ui.field({ id: "m2fe-qe", label: "Tra nhanh E(x), x 6 bit", value: S.qe, mono: true, onInput: v => { S.qe = v; drawQ(); } });
      const fQs = ui.field({ id: "m2fe-qs", label: "Tra nhanh S₁(y), S₂(y), y 4 bit", value: S.qs, mono: true, onInput: v => { S.qs = v; drawQ(); } });
      const q = ui.slot();
      ctrl.append(fB, fK, fN,
        ui.presets([
          { label: "011100 100110, K = 010011001, 3 vòng (slide 4.4.5–4.4.6)", apply: () => set("011100 100110", "010011001", 3) },
          { label: "Bài tập 4.1: 000111 011011, 1 vòng", apply: () => set("000111 011011", "010011001", 1) },
          { label: "Đổi 1 bit bản rõ: 011100 100111", apply: () => set("011100 100111", "010011001", 3) }
        ]),
        bDec,
        ui.note("E = [1 2 4 3 4 3 5 6]; S-box: bit đầu chọn hàng, 3 bit còn lại chọn cột; mỗi hộp ra 3 bit.", "mut"),
        fQe, fQs, q);
      const out = ui.slot(); view.append(out);

      const sboxTable = (name, Sb, used) => ui.table([name, "000", "001", "010", "011", "100", "101", "110", "111"],
        [0, 1].map(r => [{ html: "<b>hàng " + r + "</b>" }].concat(
          Sb[r].map((v, c) => ({ html: v, cls: used.some(u => u[0] === r && u[1] === c) ? "hl" : null })))),
        { mono: true, cls: "tight" });

      /* tra nhanh cho bài tập 4.2 */
      function drawQ() {
        const x = onlyBits(S.qe), y = onlyBits(S.qs);
        const parts = [];
        if (x.length === 6) parts.push("E(" + x + ") = <b>" + permS(x, TR_E) + "</b>");
        else parts.push("<span class='eve-c'>E cần 6 bit</span>");
        if (y.length === 4) {
          const r = +y[0], c = parseInt(y.slice(1), 2);
          parts.push("S₁(" + y + ") = hàng " + r + ", cột " + y.slice(1) + " → <b>" + TR_S1[r][c] + "</b>; S₂(" + y + ") → <b>" + TR_S2[r][c] + "</b>");
        } else parts.push("<span class='eve-c'>S-box cần 4 bit</span>");
        q.render(ui.note(parts.join("<br>"), "key"));
      }

      function draw() {
        const blk = onlyBits(S.blk), K = onlyBits(S.K);
        if (blk.length !== 12) { out.render(ui.note("Bản rõ phải gồm đúng 12 bit (hiện có " + blk.length + ").", "eve")); return; }
        if (K.length !== 9) { out.render(ui.note("Khóa phải gồm đúng 9 bit (hiện có " + K.length + ").", "eve")); return; }
        const keys = []; for (let i = 1; i <= S.n; i++) keys.push(trSubkey(K, i));
        const rows = trRun(blk.slice(0, 6), blk.slice(6), keys);
        const last = rows[rows.length - 1], r0 = rows[0];
        const ct = last.L + last.R;
        const kids = [
          ui.readouts([
            { k: "L₀R₀", v: LAB.grp(blk, 6), kind: "pt" }, { k: "Khóa K", v: K, kind: "key" },
            { k: "Khóa con", v: keys.map((k, i) => "K" + (i + 1) + "=" + k).join("  "), kind: "key" },
            { k: "L" + S.n + "R" + S.n + " (bản mã)", v: LAB.grp(ct, 6), kind: "ct", big: true }]),
          ui.bits(blk, { group: 6, kind: "pt", label: "L₀ | R₀" }),
          ui.bits(ct, { group: 6, kinds: diffKinds(ct, blk, "ct"), label: "L" + S.n + " | R" + S.n }),
          ui.note("Số bit khác giữa bản rõ và bản mã: <b>" + nDiff(ct, blk) + "/12</b> (ô đỏ) — khuếch tán tăng theo số vòng.", "mut"),
          ui.title("Từng vòng mã hóa", "cột như bảng slide 4.4.6"),
          ui.table(["Vòng", "K" + sub("i"), "E(R" + sub("i−1") + ")", "⊕ K" + sub("i"), "S₁ (hàng,cột)", "S₂ (hàng,cột)", "f", "L" + sub("i") + " = R" + sub("i−1"), "R" + sub("i") + " = L" + sub("i−1") + " ⊕ f"],
            rows.map(r => [r.i, { html: "<span class='key-c'>" + r.Ki + "</span>" }, r.e, r.x,
              r.s1 + " (" + r.r1 + "," + r.c1 + ")", r.s2 + " (" + r.r2 + "," + r.c2 + ")", r.f, r.L,
              { html: "<span class='ct-c'>" + r.R + "</span>" }]),
            { mono: true, cls: "tight" }),
          ui.steps([
            { t: "K" + sub("1") + " = 8 bit của K từ bit 1: " + K.slice(0, 8) + "; K" + sub("2") + " từ bit 2 (quay vòng): " + trSubkey(K, 2) + "; K" + sub("3") + " = " + trSubkey(K, 3) + "; K" + sub("4") + " = " + trSubkey(K, 4) },
            { t: "Vòng 1: E(R₀) = E(" + r0.R0 + ") = <b>" + r0.e + "</b> (lấy bit 1 2 4 3 4 3 5 6); ⊕ K₁ = " + r0.x },
            { t: "S₁(" + r0.x.slice(0, 4) + "): hàng " + r0.r1 + ", cột " + LAB.bin(r0.c1, 3) + " → " + r0.s1 + "; S₂(" + r0.x.slice(4) + "): hàng " + r0.r2 + ", cột " + LAB.bin(r0.c2, 3) + " → " + r0.s2 + " ⇒ f = " + r0.f },
            { t: "R₁ = L₀ ⊕ f = " + r0.L0 + " ⊕ " + r0.f + " = <b>" + r0.R + "</b>; L₁ = R₀ = " + r0.L, hi: true }]),
          h("div", { class: "cols" },
            sboxTable("S₁", TR_S1, rows.map(r => [r.r1, r.c1])),
            sboxTable("S₂", TR_S2, rows.map(r => [r.r2, r.c2])))
        ];
        if (S.dec) {
          const rkeys = keys.slice().reverse();
          const drows = trRun(last.R, last.L, rkeys);
          const dl = drows[drows.length - 1];
          const rec = dl.R + dl.L;
          kids.push(ui.panel("Giải mã: đảo hai nửa, chạy cùng mạch với K" + sub(String(S.n)) + " … K₁, đảo lại",
            ui.steps([
              { t: "① Đảo: R" + sub(String(S.n)) + "L" + sub(String(S.n)) + " = " + last.R + " " + last.L },
              { t: "② Chạy " + S.n + " vòng với khóa " + rkeys.map((k, i) => "K" + (S.n - i)).join(", ") + " → " + dl.L + " " + dl.R },
              { t: "③ Đảo lần cuối → <b>" + rec.slice(0, 6) + " " + rec.slice(6) + "</b> " + (rec === blk ? "= L₀R₀ ✓" : "≠ L₀R₀ ✗"), hi: true }]),
            ui.table(["Vòng", "K", "E(R)⊕K", "f", "L", "R"], drows.map((r, i) => ["K" + (S.n - i), r.Ki, r.x, r.f, r.L, r.R]), { mono: true, cls: "tight" }),
            ui.bits(rec, { group: 6, kinds: diffKinds(rec, blk, "ok"), label: "Khôi phục" }),
            ui.note("Vì R" + sub("i−1") + " = L" + sub("i") + " và L" + sub("i−1") + " = R" + sub("i") + " ⊕ f(L" + sub("i") + ", K" + sub("i") + "), hàm f <b>không cần khả nghịch</b> — bài tập 4.3.", "ok")));
        }
        out.render(kids);
      }
      draw(); drawQ();
      pane.appendChild(root);
    } },

  /* ---------------- Tab 3: S-DES ---------------- */
  { id: "sdes", title: "S-DES",
    intro: "S-DES (Schaefer): khối 8 bit, khóa 10 bit, 2 vòng. C = IP<sup>−1</sup>(f<sub>K2</sub>(SW(f<sub>K1</sub>(IP(P))))); giải mã dùng K2 trước, K1 sau (slide 4.5.1–4.5.10).",
    build(pane) {
      const S = { P: "10111101", K: "1010000010", dec: false, flip: null, brute: null, avP: [], avK: [] };
      const { root, ctrl, view } = ui.sim();
      const fP = ui.field({ id: "m2sd-p", label: "Bản rõ P (8 bit)", value: S.P, mono: true, onInput: v => { S.P = v; S.brute = null; draw(); } });
      const fK = ui.field({ id: "m2sd-k", label: "Khóa K (10 bit)", value: S.K, mono: true, onInput: v => { S.K = v; S.brute = null; draw(); } });
      const bDec = ui.btn("Giải mã (kiểm tra D(C) = P)", () => { S.dec = !S.dec; bDec.classList.toggle("pri", S.dec); draw(); });
      const bBr = ui.btn("Vét cạn 1024 khóa cho cặp (P, C)", () => { S.brute = true; draw(); }, "sm");
      const set = (P, K) => { Object.assign(S, { P, K, brute: null, flip: null }); fP.input.value = P; fK.input.value = K; draw(); };
      ctrl.append(fP, fK,
        ui.presets([
          { label: "P = 10111101, K = 1010000010 (slide 4.5.3–4.5.10)", apply: () => set("10111101", "1010000010") },
          { label: "Bài tập 5.3: P = 11110000", apply: () => set("11110000", "1010000010") },
          { label: "Bài tập 5.1: K = 0111111101", apply: () => set("10111101", "0111111101") }
        ]),
        bDec, bBr,
        ui.note("Tra S-box: hàng = b₁b₄, cột = b₂b₃, ra 2 bit. P10 = [3 5 2 7 4 10 1 9 8 6], P8 = [6 3 7 4 8 5 10 9], IP = [2 6 3 1 4 8 5 7], IP⁻¹ = [4 1 3 5 7 2 8 6], E/P = [4 1 2 3 2 3 4 1], P4 = [2 4 3 1].", "mut"));
      const out = ui.slot(); view.append(out);
      const chP = chart.box(b => chart.bars(b, {
        labels: [1, 2, 3, 4, 5, 6, 7, 8], series: [{ name: "lật bit P", color: "pt", values: S.avP }],
        ymax: 8, ylabel: "số bit C đổi", title: "Lật 1 bit bản rõ (vị trí)", aspect: 0.55,
        hi: S.flip && S.flip.w === "P" ? S.flip.i : null }));
      const chK = chart.box(b => chart.bars(b, {
        labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], series: [{ name: "lật bit K", color: "key", values: S.avK }],
        ymax: 8, ylabel: "số bit C đổi", title: "Lật 1 bit khóa (vị trí)", aspect: 0.55,
        hi: S.flip && S.flip.w === "K" ? S.flip.i : null }));

      const sboxView = (name, Sb, hit) => ui.table([name, "00", "01", "10", "11"],
        Sb.map((row, r) => [{ html: "<b>" + LAB.bin(r, 2) + "</b>" }].concat(
          row.map((v, c) => ({ html: LAB.bin(v, 2), cls: hit.some(x => x.row === r && x.col === c) ? "hl" : null })))),
        { mono: true, cls: "tight" });
      const roundCol = (r, kname, kval) => [kname + " = " + kval, r.L + " | " + r.R, r.ep, r.x, r.s0.out + " | " + r.s1.out, r.p4, r.nL];
      const labels = ["Khóa con", "Đầu vào L | R", "E/P(R)", "E/P(R) ⊕ K", "S0 | S1", "P4", "L ⊕ P4"];

      function draw() {
        const P = onlyBits(S.P), K = onlyBits(S.K);
        if (P.length !== 8) { out.render(ui.note("Bản rõ phải gồm đúng 8 bit (hiện có " + P.length + ").", "eve")); return; }
        if (K.length !== 10) { out.render(ui.note("Khóa phải gồm đúng 10 bit (hiện có " + K.length + ").", "eve")); return; }
        const e = sdes(P, K), ks = e.ks, C = e.C;
        const r1 = roundCol(e.r1, "K1", e.k1), r2 = roundCol(e.r2, "K2", e.k2);
        const kids = [
          ui.readouts([
            { k: "P", v: P, kind: "pt" }, { k: "K", v: K, kind: "key" },
            { k: "K1", v: ks.K1, kind: "key" }, { k: "K2", v: ks.K2, kind: "key" },
            { k: "Bản mã C", v: C, kind: "ct", big: true }]),
          ui.panel("Sinh khóa (slide 4.5.3–4.5.4)",
            ui.bits(K, { kind: "key", label: "K" }),
            ui.bits(ks.p10, { group: 5, kind: "key", label: "P10(K)" }),
            ui.bits(ks.l1 + ks.r1, { group: 5, kind: "key", label: "LS-1" }),
            ui.bits(ks.K1, { kind: "key", label: "K1 = P8" }),
            ui.bits(ks.l2 + ks.r2, { group: 5, kind: "key", label: "LS-2" }),
            ui.bits(ks.K2, { kind: "key", label: "K2 = P8" }),
            ui.steps([
              { t: "P10(K): bit ra thứ j = bit vào thứ P10[j] → " + ks.p10.slice(0, 5) + " | " + ks.p10.slice(5) },
              { t: "LS-1 mỗi nửa (dịch vòng trái 1): " + ks.l1 + " | " + ks.r1 + " → P8 → <b>K1 = " + ks.K1 + "</b>" },
              { t: "LS-2 (dịch trái thêm 2): " + ks.l2 + " | " + ks.r2 + " → P8 → <b>K2 = " + ks.K2 + "</b>", hi: true }])),
          ui.panel("Mã hóa: bảng tổng hợp giá trị trung gian (slide 4.5.10)",
            ui.bits(P, { kind: "pt", label: "P" }),
            ui.bits(e.ip, { group: 4, kind: "pt", label: "IP(P)" }),
            ui.bits(e.r1.nL + e.r1.R, { group: 4, kind: "aqua", label: "f_K1" }),
            ui.bits(e.sw, { group: 4, kind: "aqua", label: "SW" }),
            ui.bits(e.pre, { group: 4, kind: "aqua", label: "f_K2" }),
            ui.bits(C, { kind: "ct", label: "IP⁻¹ = C" }),
            ui.table(["Giai đoạn", "Vòng 1", "Vòng 2"],
              labels.map((l, i) => [l, r1[i], r2[i]]).concat([["Đầu ra", e.r1.nL + " " + e.r1.R + " → SW → " + e.sw, e.pre + " → IP⁻¹ → " + C]]),
              { mono: true, cls: "tight" }),
            h("div", { class: "cols" }, sboxView("S0", SD.S0, [e.r1.s0, e.r2.s0]), sboxView("S1", SD.S1, [e.r1.s1, e.r2.s1])),
            ui.note("Vòng 1: S0(" + e.r1.x.slice(0, 4) + "): hàng " + LAB.bin(e.r1.s0.row, 2) + ", cột " + LAB.bin(e.r1.s0.col, 2) + " → " + e.r1.s0.out +
              "; S1(" + e.r1.x.slice(4) + "): hàng " + LAB.bin(e.r1.s1.row, 2) + ", cột " + LAB.bin(e.r1.s1.col, 2) + " → " + e.r1.s1.out +
              ". Vòng 2: S0 → " + e.r2.s0.out + ", S1 → " + e.r2.s1.out + " (ô tô vàng).", "mut"))
        ];
        if (S.dec) {
          const d = sdes(C, K, true);
          kids.push(ui.panel("Giải mã C với K2 trước, K1 sau",
            ui.bits(C, { kind: "ct", label: "C" }),
            ui.bits(d.ip, { group: 4, kind: "ct", label: "IP(C)" }),
            ui.bits(d.r1.nL + d.r1.R, { group: 4, kind: "aqua", label: "f_K2" }),
            ui.bits(d.sw, { group: 4, kind: "aqua", label: "SW" }),
            ui.bits(d.pre, { group: 4, kind: "aqua", label: "f_K1" }),
            ui.bits(d.C, { kinds: diffKinds(d.C, P, "ok"), label: "IP⁻¹" }),
            ui.table(["Giai đoạn", "Vòng 1 (K2)", "Vòng 2 (K1)"],
              labels.map((l, i) => [l, roundCol(d.r1, "K2", d.k1)[i], roundCol(d.r2, "K1", d.k2)[i]]), { mono: true, cls: "tight" }),
            ui.note("D(" + C + ") = <b>" + d.C + "</b> " + (d.C === P ? "= P ✓" : "≠ P ✗"), d.C === P ? "ok" : "eve")));
        }
        /* hiệu ứng thác lũ: lật từng bit của P và của K */
        S.avP = []; S.avK = [];
        for (let i = 0; i < 8; i++) S.avP.push(nDiff(sdes(flipAt(P, i), K).C, C));
        for (let i = 0; i < 10; i++) S.avK.push(nDiff(sdes(P, flipAt(K, i)).C, C));
        const fl = S.flip;
        const P2 = fl && fl.w === "P" ? flipAt(P, fl.i) : P;
        const K2 = fl && fl.w === "K" ? flipAt(K, fl.i) : K;
        const C2 = sdes(P2, K2).C;
        const nd = nDiff(C2, C);
        const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
        kids.push(ui.panel("Hiệu ứng thác lũ — bấm vào một bit của P hoặc K để lật",
          ui.bits(P, { kind: "pt", label: "P (bấm)", onClick: i => { S.flip = fl && fl.w === "P" && fl.i === i ? null : { w: "P", i }; draw(); } }),
          ui.bits(K, { kind: "key", label: "K (bấm)", onClick: i => { S.flip = fl && fl.w === "K" && fl.i === i ? null : { w: "K", i }; draw(); } }),
          fl ? h("div", { class: "stack" },
            ui.bits(fl.w === "P" ? P2 : K2, { kinds: diffKinds(fl.w === "P" ? P2 : K2, fl.w === "P" ? P : K, fl.w === "P" ? "pt" : "key"), label: fl.w + "′ (lật bit " + (fl.i + 1) + ")" }),
            ui.bits(C, { kind: "ct", label: "C" }),
            ui.bits(C2, { kinds: diffKinds(C2, C, "ct"), label: "C′" }),
            ui.note("Lật 1 bit của " + fl.w + " ở vị trí " + (fl.i + 1) + " ⇒ <b>" + nd + "/8</b> bit bản mã thay đổi. Lý tưởng (thác lũ chặt) là ≈ một nửa; S-DES chỉ 2 vòng nên chưa đạt.", nd >= 3 ? "ok" : "key"))
            : ui.note("Trung bình trên các vị trí: lật 1 bit P đổi <b>" + avg(S.avP) + "</b> bit C; lật 1 bit K đổi <b>" + avg(S.avK) + "</b> bit C (DES đầy đủ: ≈ 32/64).", "mut"),
          h("div", { class: "cols" }, chP, chK)));
        /* vét cạn khóa */
        if (S.brute) {
          const hits = [];
          for (let k = 0; k < 1024; k++) { const kb = LAB.bin(k, 10); if (sdes(P, kb).C === C) hits.push(kb); }
          kids.push(ui.panel("Vét cạn: khóa nào cho E" + sub("K") + "(" + P + ") = " + C + "?",
            ui.note("Thử hết 2<sup>10</sup> = 1024 khóa → <b>" + hits.length + " khóa</b> khớp (khóa thật được tô):", "key"),
            h("div", { class: "row" }, hits.map(k => ui.tag(k, k === K ? "key" : "mut"))),
            ui.note("Khối chỉ 8 bit mà khóa 10 bit nên trung bình 2<sup>10−8</sup> = 4 khóa cho cùng một cặp (P, C); cần thêm cặp (P, C) thứ hai để xác định khóa duy nhất. DES thật: 2<sup>56</sup> khóa — vét cạn trung bình 2<sup>55</sup> phép thử ≈ 417 ngày ở 10<sup>9</sup> khóa/giây (slide 4.6.5).", "mut")));
        }
        out.render(kids);
        chP.draw(); chK.draw();
      }
      draw();
      pane.appendChild(root);
    } },

  /* ---------------- Tab 4: AES-128 ---------------- */
  { id: "aes", title: "AES-128",
    intro: "AES-128 đầy đủ: S-box sinh từ nghịch đảo GF(2⁸) và biến đổi affine, mở rộng khóa 44 từ, 10 vòng SubBytes → ShiftRows → MixColumns → AddRoundKey (vòng 10 bỏ MixColumns), giải mã ngược lại. Vector chuẩn FIPS-197 (slide 5.2.3–5.3.6).",
    build(pane) {
      const S = { pt: "3243F6A8 885A308D 313198A2 E0370734", key: "2B7E1516 28AED2A6 ABF71588 09CF4F3C", mode: "hex", r: 1, layer: "sb", ga: "57", gb: "83", col: "DB 13 53 45" };
      const { root, ctrl, view } = ui.sim();
      const fP = ui.field({ id: "m2ae-pt", label: "Bản rõ (16 byte)", value: S.pt, mono: true, onInput: v => { S.pt = v; draw(); } });
      const fK = ui.field({ id: "m2ae-key", label: "Khóa (16 byte)", value: S.key, mono: true, onInput: v => { S.key = v; draw(); } });
      const sMode = ui.seg({ id: "m2ae-mode", label: "Định dạng nhập", options: [["hex", "Hex"], ["ascii", "ASCII (đệm 00)"]], value: S.mode, onChange: v => { S.mode = v; draw(); } });
      const rR = ui.range({ id: "m2ae-r", label: "Vòng r", min: 0, max: 10, value: S.r, onInput: v => { S.r = v; draw(); } });
      const sL = ui.seg({ id: "m2ae-layer", label: "Lớp biến đổi",
        options: [["sb", "SubBytes"], ["sr", "ShiftRows"], ["mc", "MixColumns"], ["ark", "AddRoundKey"]], value: S.layer,
        onChange: v => { S.layer = v; draw(); } });
      const set = (pt, key, mode, r, layer) => {
        Object.assign(S, { pt, key, mode, r, layer });
        fP.input.value = pt; fK.input.value = key;
        sMode.querySelector(".seg").set(mode); rR.set(r); sL.querySelector(".seg").set(layer);
        draw();
      };
      ctrl.append(fP, fK, sMode,
        ui.presets([
          { label: "FIPS-197: 3243F6A8… / 2B7E1516… (slide 5.3.3–5.3.4)", apply: () => set("3243F6A8 885A308D 313198A2 E0370734", "2B7E1516 28AED2A6 ABF71588 09CF4F3C", "hex", 1, "sb") },
          { label: "\"Computer\" / \"Document\" đệm 00 (slide 5.3.6)", apply: () => set("Computer", "Document", "ascii", 1, "ark") },
          { label: "Toàn 00 / khóa 00", apply: () => set("", "", "hex", 1, "sb") }
        ]),
        rR, sL);
      const fGa = ui.field({ id: "m2ae-ga", label: "GF(2⁸): byte a (hex)", value: S.ga, mono: true, onInput: v => { S.ga = v; drawGF(); } });
      const fGb = ui.field({ id: "m2ae-gb", label: "byte b (hex)", value: S.gb, mono: true, onInput: v => { S.gb = v; drawGF(); } });
      const fCol = ui.field({ id: "m2ae-col", label: "Cột MixColumns (4 byte hex)", value: S.col, mono: true, onInput: v => { S.col = v; drawGF(); } });
      const setGF = (a, b) => { S.ga = a; S.gb = b; fGa.input.value = a; fGb.input.value = b; drawGF(); };
      ctrl.append(ui.presets([
        { label: "{57}·{83} = {C1}", apply: () => setGF("57", "83") },
        { label: "{57}·{13} = {FE}", apply: () => setGF("57", "13") },
        { label: "{53}⁻¹ = {CA}", apply: () => setGF("53", "CA") }
      ], "Số học GF(2⁸) (slide 5.1.3–5.1.5)"), fGa, fGb, fCol);
      const out = ui.slot(), gf = ui.slot(); view.append(out, gf);
      const colCls = ["pt", "ct", "hi", "eve"];

      function draw() {
        const P = parse16(S.pt, S.mode), Kk = parse16(S.key, S.mode);
        if (P.err || Kk.err) { out.render(ui.note((P.err ? "Bản rõ: " + P.err : "") + " " + (Kk.err ? "Khóa: " + Kk.err : ""), "eve")); return; }
        const { w, det } = keyExpand(Kk.bytes);
        const enc = aesEncrypt(P.bytes, w);
        const dec = aesDecrypt(enc.ct, w);
        const r = S.r;
        let layer = S.layer, warn = null;
        if (r === 0 && layer !== "ark") { layer = "ark"; warn = "Vòng 0 chỉ có AddRoundKey(w[0..3])."; }
        if (r === 10 && layer === "mc") { layer = "ark"; warn = "Vòng cuối (10) không có MixColumns → hiển thị AddRoundKey."; }
        const R = enc.rounds[r];
        const pick = {
          sb: [R.in, R.sb, "SubBytes: mỗi byte a → S(a) = affine(a⁻¹)"],
          sr: [R.sb, R.sr, "ShiftRows: hàng i dịch vòng trái i byte (màu = cột gốc)"],
          mc: [R.sr, R.mc, "MixColumns: mỗi cột × ma trận [02 03 01 01] trong GF(2⁸)"],
          ark: [r === 0 ? R.in : (R.mc || R.sr), R.ark, "AddRoundKey: ⊕ khóa vòng w[" + 4 * r + ".." + (4 * r + 3) + "]"]
        }[layer];
        const before = pick[0], after = pick[1];
        const clsB = layer === "sr" ? (i, j) => colCls[j] : () => "";
        const clsA = layer === "sr" ? (i, j) => colCls[(j + i) % 4] : (i, j) => (after[i + 4 * j] !== before[i + 4 * j] ? "hi" : "");
        const rk = [0, 1, 2, 3].map(c => w[4 * r + c]);
        const rkMat = ui.matrix([0, 1, 2, 3].map(i => rk.map(wd => wd[i])), { fmt: v => LAB.hex(v, 2) });
        const col0 = arr => [0, 1, 2, 3].map(i => LAB.hex(arr[i])).join(" ");
        const explain = [];
        if (layer === "sb") explain.push({ t: "Byte [0,0]: {" + LAB.hex(before[0]) + "}⁻¹ = {" + LAB.hex(gfInv(before[0])) + "} → affine → S({" + LAB.hex(before[0]) + "}) = <b>" + LAB.hex(after[0]) + "</b>; cột 0 sau SubBytes: " + col0(after) });
        if (layer === "sr") explain.push({ t: "Hàng 1: " + [0, 1, 2, 3].map(c => LAB.hex(before[1 + 4 * c])).join(" ") + " → " + [0, 1, 2, 3].map(c => LAB.hex(after[1 + 4 * c])).join(" ") + " (≪1); hàng 2 ≪2; hàng 3 ≪3. Sau đó mỗi cột chứa đúng 1 byte từ mỗi cột ban đầu." });
        if (layer === "mc") {
          const a = before.slice(0, 4), g = math.gmul;
          explain.push({ t: "Cột 0: " + col0(a) + " → s′₀ = 02·" + LAB.hex(a[0]) + " ⊕ 03·" + LAB.hex(a[1]) + " ⊕ " + LAB.hex(a[2]) + " ⊕ " + LAB.hex(a[3]) + " = " + LAB.hex(g(a[0], 2)) + " ⊕ " + LAB.hex(g(a[1], 3)) + " ⊕ " + LAB.hex(a[2]) + " ⊕ " + LAB.hex(a[3]) + " = <b>" + LAB.hex(after[0]) + "</b>; cột ra: " + col0(after) });
        }
        if (layer === "ark") explain.push({ t: "Cột 0: " + [0, 1, 2, 3].map(i => LAB.hex(before[i]) + " ⊕ " + LAB.hex(rk[0][i]) + " = " + LAB.hex(after[i])).join(";  ") });
        const kx = det.map((d, i) => [i,
          { html: "<span class='" + (i >= 4 * r && i < 4 * r + 4 ? "hl" : "") + "'>" + hexBytes(w[i]) + "</span>" },
          d ? hexBytes(d.temp) : "–", d ? hexBytes(d.rot) : "–", d ? hexBytes(d.sb) : "–",
          d ? LAB.hex(d.rcon) + " → " + hexBytes(d.rc) : "–", i >= 4 ? hexBytes(w[i - 4]) : "–"]);
        const roundTable = enc.rounds.map((R2, i) => [i, hexGrp(R2.in), hexGrp([].concat(...[0, 1, 2, 3].map(c => w[4 * i + c])))])
          .concat([[{ html: "<b>ra</b>" }, { html: "<b class='ct-c'>" + hexGrp(enc.ct) + "</b>" }, ""]]);
        out.render(
          ui.readouts([
            { k: "Bản rõ", v: hexGrp(P.bytes), kind: "pt" }, { k: "Khóa", v: hexGrp(Kk.bytes), kind: "key" },
            { k: "Bản mã", v: hexGrp(enc.ct), kind: "ct", big: true },
            { k: "Giải mã kiểm tra", v: hexBytes(dec) === hexBytes(P.bytes) ? "D(C) = P ✓" : "✗", kind: "ok" }]),
          (P.padded || Kk.padded) ? ui.note("Đầu vào ngắn hơn 16 byte đã được đệm 00 ở cuối." + (S.mode === "ascii" ? " ASCII: \"" + String(S.pt).slice(0, 16) + "\" = " + hexGrp(P.bytes) + "; khóa = " + hexGrp(Kk.bytes) : ""), "mut") : null,
          warn ? ui.note(warn, "key") : null,
          ui.panel("Vòng " + r + " — " + pick[2],
            h("div", { class: "row", style: { alignItems: "center", gap: "16px" } },
              h("div", { class: "stack" }, h("div", { class: "small" }, "Trước"), stateMat(before, clsB)),
              h("div", { style: { fontSize: "22px", color: "var(--faint)" } }, "→"),
              h("div", { class: "stack" }, h("div", { class: "small" }, "Sau" + (layer === "sr" ? "" : " (ô đổi tô vàng)")), stateMat(after, clsA)),
              layer === "ark" ? h("div", { class: "stack" }, h("div", { class: "small" }, "Khóa vòng w[" + 4 * r + "..]"), rkMat) : null),
            ui.steps(explain),
            ui.note("Trạng thái xếp <b>theo cột</b>: s[r, c] = in[r + 4c]. Vòng r dùng khóa vòng w[" + 4 * r + ".." + (4 * r + 3) + "] từ bảng mở rộng khóa, không dùng lại khóa gốc (trừ vòng 0).", "mut")),
          ui.panel("Trạng thái đầu mỗi vòng (slide 5.3.4)",
            ui.table(["Vòng", "State đầu vòng (theo cột)", "Khóa vòng"], roundTable, { mono: true, cls: "tight", rowCls: (row, i) => i === r ? "hi" : null })),
          ui.panel("Mở rộng khóa w[0..43] (slide 5.3.1–5.3.2)",
            ui.table(["i", "w[i]", "temp = w[i−1]", "RotWord", "SubWord", "⊕ Rcon", "w[i−4]"], kx, { mono: true, cls: "tight" }),
            ui.note("Với i chia hết cho 4: w[i] = w[i−4] ⊕ SubWord(RotWord(w[i−1])) ⊕ Rcon[i/4]; Rcon = 01 02 04 08 10 20 40 80 1B 36. Khóa vòng 1 = w[4..7] = " + [4, 5, 6, 7].map(i => hexBytes(w[i])).join(" ") + ".", "key")));
      }

      /* khối GF(2⁸): xtime, tích, nghịch đảo, MixColumns một cột */
      function drawGF() {
        const pa = parseInt(String(S.ga).replace(/\s/g, ""), 16), pb = parseInt(String(S.gb).replace(/\s/g, ""), 16);
        if (isNaN(pa) || isNaN(pb) || pa < 0 || pa > 255 || pb < 0 || pb > 255) { gf.render(ui.note("a, b phải là byte hex 00–FF.", "eve")); return; }
        const xt = [];
        let v = pa;
        for (let k = 0; k < 8; k++) { const carry = !!(v & 0x80); const nv = math.xtime(v); xt.push({ k, v, carry, nv }); v = nv; }
        const parts = [];
        for (let k = 0; k < 8; k++) if (pb & (1 << k)) parts.push(k);
        const prod = math.gmul(pa, pb), inv = gfInv(pa);
        const cs = String(S.col).replace(/\s+/g, "");
        const cb = /^[0-9a-fA-F]{8}$/.test(cs) ? [0, 1, 2, 3].map(i => parseInt(cs.substr(2 * i, 2), 16)) : null;
        const mcOut = cb ? mixCol(cb, MC) : null;
        const steps = [
          { t: "b = {" + LAB.hex(pb) + "} = " + (parts.length ? parts.map(k => "{" + LAB.hex(1 << k) + "}").join(" ⊕ ") : "0") + " ⇒ a·b = " + (parts.length ? parts.map(k => "{" + LAB.hex(xt[k].v) + "}").join(" ⊕ ") : "0") + " = <b>{" + LAB.hex(prod) + "}</b>", hi: true },
          { t: "Nghịch đảo a⁻¹ = a" + sup("254") + " = <b>{" + LAB.hex(inv) + "}</b>; kiểm tra a·a⁻¹ = {" + LAB.hex(math.gmul(pa, inv)) + "}. S-box: S({" + LAB.hex(pa) + "}) = affine({" + LAB.hex(inv) + "}) = <b>{" + LAB.hex(SBOX[pa]) + "}</b>" }];
        if (cb) steps.push({ t: "MixColumns cột " + cb.map(x => LAB.hex(x)).join(" ") + ": s′₀ = 02·" + LAB.hex(cb[0]) + " ⊕ 03·" + LAB.hex(cb[1]) + " ⊕ " + LAB.hex(cb[2]) + " ⊕ " + LAB.hex(cb[3]) + " = " + LAB.hex(math.gmul(cb[0], 2)) + " ⊕ " + LAB.hex(math.gmul(cb[1], 3)) + " ⊕ " + LAB.hex(cb[2]) + " ⊕ " + LAB.hex(cb[3]) + " = " + LAB.hex(mcOut[0]) + "; cột ra = <b>" + mcOut.map(x => LAB.hex(x)).join(" ") + "</b>; InvMixColumns(cột ra) = " + mixCol(mcOut, IMC).map(x => LAB.hex(x)).join(" ") + " ✓" });
        else steps.push({ t: "<span class='eve-c'>Cột MixColumns cần đúng 4 byte hex.</span>" });
        gf.render(ui.panel("GF(2⁸): nhân bằng xtime, nghịch đảo, MixColumns một cột",
          ui.table(["k", "a·{2" + sup("k") + "}", "giá trị", "nhị phân", "tràn b₇?", "xtime →"],
            xt.map(s => [s.k, "{" + LAB.hex(1 << s.k) + "}·a", LAB.hex(s.v), LAB.grp(LAB.bin(s.v, 8), 4), s.carry ? "có → ⊕ 1B" : "không", s.k < 7 ? LAB.hex(s.nv) : "—"]),
            { mono: true, cls: "tight", rowCls: (row, i) => parts.includes(i) ? "hi" : null }),
          ui.steps(steps),
          ui.note("Cộng = XOR; nhân = nhân đa thức rồi chia dư cho m(x) = x⁸ + x⁴ + x³ + x + 1 ({11B}); xtime(a) = dịch trái 1 bit, nếu tràn thì ⊕ {1B}. Các hàng tô vàng là các lũy thừa được cộng lại để ra tích.", "mut")));
      }
      draw(); drawGF();
      pane.appendChild(root);
    } },

  /* ---------------- Tab 5: Chế độ hoạt động ---------------- */
  { id: "modes", title: "ECB · CBC · CTR",
    intro: "Mã khối chỉ mã một khối; chế độ hoạt động quyết định cách mã hóa thông điệp dài. ECB lộ cấu trúc dữ liệu (ảnh), CBC/CTR trông như nhiễu; lỗi 1 bit lan truyền khác nhau (slide 4.6.7, 5.3.7).",
    build(pane) {
      const W = 64, Hh = 32, CELL = 5;
      const S = { img: "text", cipher: "sdes", seed: 7, key: "1010000010", msg: "COM608", mode: "cbc", flip: null };
      const { root, ctrl, view } = ui.sim();
      ctrl.append(
        ui.seg({ id: "m2mo-img", label: "Ảnh gốc (64×32 ô, mỗi ô 1 byte xám)", options: [["text", "Chữ COM608"], ["shape", "Hình học"], ["grad", "Dải xám"]], value: S.img, onChange: v => { S.img = v; drawImg(); } }),
        ui.seg({ id: "m2mo-ci", label: "Mã khối", options: [["sdes", "S-DES (khối = 1 ô)"], ["aes", "AES-128 (khối = 16 ô)"]], value: S.cipher, onChange: v => { S.cipher = v; drawImg(); } }),
        h("div", { class: "row" }, ui.btn("Chạy lại (khóa, IV, nonce ngẫu nhiên mới)", () => { S.seed = (S.seed * 31 + 7) % 100003; drawImg(); }, "pri")),
        ui.field({ id: "m2mo-key", label: "Lan truyền lỗi: khóa S-DES (10 bit)", value: S.key, mono: true, onInput: v => { S.key = v; S.flip = null; drawErr(); } }),
        ui.field({ id: "m2mo-msg", label: "Thông điệp 6 ký tự ASCII (6 khối 8 bit)", value: S.msg, mono: true, onInput: v => { S.msg = v; S.flip = null; drawErr(); } }),
        ui.seg({ id: "m2mo-mode", label: "Chế độ cho khối lan truyền lỗi", options: [["ecb", "ECB"], ["cbc", "CBC"], ["ctr", "CTR"]], value: S.mode, onChange: v => { S.mode = v; drawErr(); } }),
        ui.note("Bấm vào một bit của dãy bản mã (hàng C) để lật nó rồi xem các khối bản rõ nào bị hỏng.", "mut"));
      const imgOut = ui.slot(), errOut = ui.slot(); view.append(imgOut, errOut);

      /* ảnh 64×32, mỗi ô 1 byte mức xám */
      function makeImage() {
        const img = new Uint8Array(W * Hh);
        const bg = 0x1A, fg = 0xE6;
        if (S.img === "text") {
          /* vẽ chữ lên canvas ẩn rồi ngưỡng hóa thành ảnh 2 mức — đen/trắng ở đây chỉ là mặt nạ, không hiển thị */
          const cv = document.createElement("canvas"); cv.width = W; cv.height = Hh;
          const g = cv.getContext("2d");
          g.fillStyle = "#000"; g.fillRect(0, 0, W, Hh);
          g.fillStyle = "#fff"; g.font = "bold 23px Arial, Helvetica, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("COM608", W / 2, Hh / 2 + 1);
          const d = g.getImageData(0, 0, W, Hh).data;
          let n = 0;
          for (let i = 0; i < W * Hh; i++) { const on = d[4 * i] > 127; img[i] = on ? fg : bg; if (on) n++; }
          /* nếu môi trường không vẽ được chữ: dùng ô cờ để vẫn có cấu trúc */
          if (n < 20) for (let i = 0; i < W * Hh; i++) { const x = i % W, y = (i / W) | 0; img[i] = ((x >> 3) + (y >> 3)) % 2 ? fg : bg; }
        } else if (S.img === "shape") {
          for (let i = 0; i < W * Hh; i++) {
            const x = i % W, y = (i / W) | 0;
            img[i] = bg;
            if ((x - 18) ** 2 + (y - 16) ** 2 <= 121) img[i] = fg;
            if (x >= 36 && x <= 58 && y >= 7 && y <= 25) img[i] = 0x80;
            if (x >= 42 && x <= 52 && y >= 12 && y <= 20) img[i] = fg;
          }
        } else {
          for (let i = 0; i < W * Hh; i++) {
            const x = i % W, y = (i / W) | 0;
            img[i] = (x >> 3) * 36;
            if ((x - 32) ** 2 + (y - 16) ** 2 <= 100) img[i] = 0xFF - img[i];
          }
        }
        return img;
      }
      function encryptImage(img) {
        const rnd = LAB.rng(S.seed);
        const rb = () => Math.floor(rnd() * 256);
        const N = W * Hh;
        const ecb = new Uint8Array(N), cbc = new Uint8Array(N), ctr = new Uint8Array(N);
        let info;
        if (S.cipher === "sdes") {
          const K = LAB.bin(Math.floor(rnd() * 1024), 10), T = sdTable(K), iv = rb(), nonce = rb();
          let prev = iv;
          for (let i = 0; i < N; i++) {
            ecb[i] = T[img[i]];
            prev = T[img[i] ^ prev]; cbc[i] = prev;
            ctr[i] = img[i] ^ T[(nonce + i) & 255];
          }
          info = "S-DES, khóa K = " + K + ", IV = " + LAB.bin(iv, 8) + ", nonce = " + LAB.bin(nonce, 8) + ". Mỗi ô là một khối 8 bit → ECB ánh xạ mỗi mức xám sang đúng một giá trị: hình lộ hoàn toàn. CTR với khối 8 bit có dòng khóa chu kỳ 256 ô (4 hàng) — khối nhỏ không an toàn cho CTR.";
        } else {
          const key = Array.from({ length: 16 }, rb), { w } = keyExpand(key);
          const iv = Array.from({ length: 16 }, rb), nonce = Array.from({ length: 12 }, rb);
          let prev = iv;
          for (let bI = 0; bI < N / 16; bI++) {
            const p = Array.from(img.slice(16 * bI, 16 * bI + 16));
            const e = aesEncrypt(p, w).ct;
            const c2 = aesEncrypt(p.map((b, j) => b ^ prev[j]), w).ct; prev = c2;
            const ks = aesEncrypt(nonce.concat([(bI >>> 24) & 255, (bI >>> 16) & 255, (bI >>> 8) & 255, bI & 255]), w).ct;
            for (let j = 0; j < 16; j++) { ecb[16 * bI + j] = e[j]; cbc[16 * bI + j] = c2[j]; ctr[16 * bI + j] = p[j] ^ ks[j]; }
          }
          info = "AES-128, khóa " + hexGrp(key) + ". Mỗi khối = 16 ô liên tiếp trên một hàng: các khối nền giống nhau cho bản mã giống nhau → vẫn lộ đường nét theo khối 16 ô, kém rõ hơn S-DES nhưng là cách dùng thật (như ảnh \"ECB penguin\").";
        }
        return { ecb, cbc, ctr, info };
      }
      function canvasOf(img, title) {
        const cv = h("canvas", { width: W * CELL, height: Hh * CELL, style: { width: "100%", maxWidth: (W * CELL) + "px", imageRendering: "pixelated", border: "1px solid var(--line)", borderRadius: "4px", display: "block" } });
        const g = cv.getContext("2d");
        for (let i = 0; i < W * Hh; i++) { const v = img[i]; g.fillStyle = "rgb(" + v + "," + v + "," + v + ")"; g.fillRect((i % W) * CELL, ((i / W) | 0) * CELL, CELL, CELL); }
        return h("div", { class: "stack" }, h("div", { class: "small" }, h("b", null, title), " · " + new Set(img).size + " mức xám"), cv);
      }
      function drawImg() {
        const img = makeImage();
        const r = encryptImage(img);
        imgOut.render(ui.panel("Cùng một ảnh, ba chế độ",
          h("div", { class: "cols" },
            canvasOf(img, "Gốc P"), canvasOf(r.ecb, "ECB: Cᵢ = E(Pᵢ)"),
            canvasOf(r.cbc, "CBC: Cᵢ = E(Pᵢ ⊕ Cᵢ₋₁)"), canvasOf(r.ctr, "CTR: Cᵢ = Pᵢ ⊕ E(nonce‖i)")),
          ui.note(r.info, "mut"),
          ui.table(["Chế độ", "Công thức", "Đặc điểm", "Khuyến nghị (slide 5.3.7)"], [
            ["ECB", "Cᵢ = E(Pᵢ)", "Khối giống nhau → mã giống nhau; song song; lỗi không lan", { html: "<b class='eve-c'>Không dùng</b>" }],
            ["CBC", "Cᵢ = E(Pᵢ ⊕ Cᵢ₋₁), C₀ = IV", "Cần IV ngẫu nhiên; mã hóa tuần tự; giải mã song song", "Có thể (kèm MAC)"],
            ["CTR", "Cᵢ = Pᵢ ⊕ E(nonce ‖ i)", "Thành mã dòng; song song; không dùng lại (khóa, nonce)", "Tốt (kèm MAC)"],
            ["GCM", "CTR + xác thực GHASH", "Mã hóa có xác thực (AEAD)", { html: "<b class='ok-c'>Khuyên dùng (TLS 1.3)</b>" }]
          ], { cls: "tight" })));
      }

      /* lan truyền lỗi: 6 khối S-DES 8 bit, lật 1 bit bản mã */
      function drawErr() {
        const K = onlyBits(S.key);
        const msg = Array.from(String(S.msg));
        if (K.length !== 10) { errOut.render(ui.note("Khóa S-DES phải gồm 10 bit.", "eve")); return; }
        if (msg.length !== 6 || msg.some(c => c.codePointAt(0) > 255)) { errOut.render(ui.note("Thông điệp phải gồm đúng 6 ký tự ASCII (6 khối 8 bit).", "eve")); return; }
        const P = msg.map(c => c.codePointAt(0));
        const T = sdTable(K), Ti = new Uint8Array(256);
        for (let p = 0; p < 256; p++) Ti[T[p]] = p;
        const IV = 0xAA, nonce = 0x3C;
        const encAll = ps => {
          const cs = []; let prev = IV;
          ps.forEach((p, i) => {
            if (S.mode === "ecb") cs.push(T[p]);
            else if (S.mode === "cbc") { prev = T[p ^ prev]; cs.push(prev); }
            else cs.push(p ^ T[(nonce + i) & 255]);
          });
          return cs;
        };
        const decAll = cs => {
          const ps = []; let prev = IV;
          cs.forEach((c, i) => {
            if (S.mode === "ecb") ps.push(Ti[c]);
            else if (S.mode === "cbc") { ps.push(Ti[c] ^ prev); prev = c; }
            else ps.push(c ^ T[(nonce + i) & 255]);
          });
          return ps;
        };
        const toBits = arr => arr.map(v => LAB.bin(v, 8)).join("");
        const C = encAll(P);
        const C2 = C.slice();
        if (S.flip != null) C2[S.flip >> 3] ^= 1 << (7 - (S.flip & 7));
        const P2 = decAll(C2);
        const Ps = toBits(P), Cs = toBits(C), C2s = toBits(C2), P2s = toBits(P2);
        const perBlock = P2.map((p, i) => math.popcount(p ^ P[i]));
        const chr = v => (v >= 32 && v < 127) ? String.fromCharCode(v) : "·";
        const f = S.flip, bi = f == null ? null : (f >> 3) + 1;
        const verdict = f == null ? "Chưa lật bit nào." : {
          ecb: "ECB: chỉ khối P" + sub(String(bi)) + " hỏng (" + perBlock[bi - 1] + " bit), các khối khác nguyên vẹn — lỗi không lan truyền.",
          cbc: "CBC: P" + sub(String(bi)) + " hỏng toàn bộ (" + perBlock[bi - 1] + " bit sai vì đi qua S-box), P" + sub(String(bi + 1)) + " lỗi <b>đúng 1 bit</b> cùng vị trí (" + (perBlock[bi] == null ? "không có khối sau" : perBlock[bi] + " bit") + "), các khối khác đúng — bài tập 6.3.",
          ctr: "CTR: chỉ 1 bit của P" + sub(String(bi)) + " đổi (" + perBlock[bi - 1] + " bit) — như mã dòng, lỗi không lan."
        }[S.mode];
        const modeInfo = S.mode === "cbc" ? " (IV = " + LAB.bin(IV, 8) + ")" : S.mode === "ctr" ? " (nonce = " + LAB.bin(nonce, 8) + ")" : "";
        errOut.render(ui.panel("Lan truyền lỗi — chuỗi 6 khối S-DES, chế độ " + S.mode.toUpperCase() + modeInfo,
          ui.bits(Ps, { group: 8, kind: "pt", label: "P (" + msg.join("") + ")" }),
          ui.bits(Cs, { group: 8, kind: "ct", label: "C (bấm để lật)", onClick: i => { S.flip = S.flip === i ? null : i; drawErr(); } }),
          f == null ? null : ui.bits(C2s, { group: 8, kinds: diffKinds(C2s, Cs, "ct"), label: "C′ (nhận được)" }),
          ui.bits(P2s, { group: 8, kinds: diffKinds(P2s, Ps, "ok"), label: "P′ = D(C′)" }),
          ui.table(["Khối", "P", "P′", "Ký tự", "Số bit sai"],
            P.map((p, i) => [i + 1, LAB.bin(p, 8), LAB.bin(P2[i], 8), chr(P2[i]), perBlock[i]]),
            { mono: true, cls: "tight", rowCls: (row, i) => perBlock[i] ? "bad" : null }),
          ui.note(verdict, f == null ? "mut" : (S.mode === "cbc" ? "key" : "ok")),
          ui.note("CBC giải mã: P" + sub("i") + " = D(C" + sub("i") + ") ⊕ C" + sub("i−1") + ". Lỗi ở C" + sub("i") + " đi qua D (phi tuyến) → P" + sub("i") + " hỏng hẳn; C" + sub("i") + " còn được XOR thẳng vào P" + sub("i+1") + " → đúng 1 bit sai; từ P" + sub("i+2") + " trở đi không dùng C" + sub("i") + " nữa (slide 4.6.7).", "mut")));
      }
      drawImg(); drawErr();
      pane.appendChild(root);
    } }
  ]
});
})();
