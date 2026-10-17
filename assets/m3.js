/* COM608 — Mô-đun 3: Khóa công khai — RSA, Diffie–Hellman, ElGamal, hàm băm và chữ ký số (Bài 5 phần B · Bài 6)
   Mọi phép tính số dùng BigInt qua LAB.math; SHA-256 cài thuần JS theo FIPS 180-4.
   Các tab:
     1. rsa       — sinh khóa (Euclid mở rộng), mã hóa/giải mã (bình phương–nhân, CRT), chữ ký s = m^d   (slide 5.4.3–5.4.9, 6.1.5)
     2. rsaattack — Fermat khi p ≈ q, số mũ nhỏ e = 3, chung thừa số gcd(n₁, n₂), tính đồng cấu nhân      (slide 5.5.2–5.5.5)
     3. dh        — trao khóa Diffie–Hellman, căn nguyên thủy, MITM, logarit rời rạc (vét cạn, BSGS)       (slide 6.1.3, 6.3.2–6.3.6)
     4. elgamal   — mã hóa/giải mã ElGamal, tấn công dùng lại k                                           (slide 6.3.7–6.3.9)
     5. hash      — SHA-256: tuyết lở, đệm, nghịch lý ngày sinh, tấn công ngày sinh, bằng chứng công việc  (slide 6.2.1–6.2.13)
     6. sign      — chữ ký RSA (giả mạo tồn tại), ElGamal, DSA, dùng lại k trong DSA, bảng so sánh        (slide 6.4.3–6.4.8, 6.4.11)
   Mọi preset đã được đối chiếu bằng Python (pow, hashlib) trước khi ghi vào đây. */
(function () { "use strict";
const { h, ui, math, txt, chart } = LAB;
const B = math.B;

/* ============================ tiện ích chung ============================ */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pint = v => { const s = String(v).trim(); return /^\d+$/.test(s) ? BigInt(s) : null; }; /* số nguyên không âm, null nếu sai */
const sup = (b, e) => b + "<sup>" + e + "</sup>";
const sub = (b, i) => b + "<sub>" + i + "</sub>";
const bad = msg => ui.note(msg, "eve");
const pow2 = x => Math.pow(2, x);
const sci = x => { if (!isFinite(x)) return "∞"; if (x < 1e6) return Math.round(x).toLocaleString("vi-VN"); const e = Math.floor(Math.log10(x)); return (x / Math.pow(10,
  e)).toFixed(2).replace(".", ",") + "·10" + "<sup>" + e + "</sup>"; };

/* nhóm ô nhập dùng chung: fields(prefix, [{k,label,v,hint}], cb) → {S (giá trị chuỗi), els, set(obj), map} */
function fields(pre, specs, cb) {
  const S = {}, els = [], map = {};
  specs.forEach(sp => {
    S[sp.k] = String(sp.v);
    const f = ui.field({ id: pre + "-" + sp.k, label: sp.label, value: sp.v, mono: true, hint: sp.hint,
      onInput: v => { S[sp.k] = v; cb(); } });
    els.push(f); map[sp.k] = f;
  });
  const set = o => { for (const k in o) { S[k] = String(o[k]); if (map[k]) map[k].input.value = o[k]; } cb(); };
  return { S, els, set, map };
}
/* bảng Euclid mở rộng r_i = r_{i-2} − q_i·r_{i-1}; a·s_i + b·t_i = r_i */
function egcdTable(a, b) {
  const rows = [{ i: 0, r: a, q: "–", s: 1n, t: 0n }, { i: 1, r: b, q: "–", s: 0n, t: 1n }];
  let [r0, r1] = [a, b], [s0, s1] = [1n, 0n], [t0, t1] = [0n, 1n];
  while (r1 !== 0n) {
    const q = r0 / r1, r = r0 - q * r1, s = s0 - q * s1, t = t0 - q * t1;
    [r0, r1] = [r1, r]; [s0, s1] = [s1, s]; [t0, t1] = [t1, t];
    rows.push({ i: rows.length, r: r1, q, s: s1, t: t1 });
  }
  return { g: r0, s: s0, t: t0, rows };
}
function egcdView(a, b, la, lb) {
  const E = egcdTable(a, b);
  return [ui.table(["i", sub("r", "i"), sub("q", "i"), sub("s", "i"), sub("t", "i")].map(x => ({ html: x })),
      E.rows.map(r => [r.i, r.r, r.q, r.s, r.t]), { mono: true, cls: "tight", rowCls: (r, i) => (i === E.rows.length - 2 ? "hi" : null) }),
    ui.note("Dòng tô vàng: gcd = " + E.g + " = " + la + "·(" + E.s + ") + " + lb + "·(" + E.t + ").", "mut")];
}
/* bảng bình phương liên tiếp kiểu slide 5.4.6: b^(2^k) mod m và tích các lũy thừa ứng với bit 1 (phải → trái) */
function powTable(b, e, m) {
  const bits = e.toString(2), L = bits.length, rows = [], used = []; let x = math.mod(b, m);
  for (let k = 0; k < L; k++) { const bit = bits[L - 1 - k] === "1"; rows.push({ k, pow: x, bit }); if (bit) used.push(x); x = x * x % m; }
  let prod = 1n; used.forEach(u => { prod = prod * u % m; });
  return { rows, used, prod, bits };
}
function powTableView(b, e, m, name) {
  const T = powTable(b, e, m), pc = T.used.length;
  return [ui.table([{ html: "k" }, { html: sup(name, "2<sup>k</sup>") + " mod n" }, { html: "bit k của e" }, { html: "dùng?" }],
      T.rows.map(r => [r.k, r.pow, r.bit ? 1 : 0, r.bit ? "×" : "–"]), { mono: true, cls: "tight",
        rowCls: r => (r[3] === "×" ? "hi" : null) }),
    ui.note("e = " + T.bits + "₂ → " + name + "<sup>" + e + "</sup> = " + T.used.map(u => u).join(" · ") + " mod n = <b>" + T.prod + "</b> — " + (T.bits.length - 1) + " bình phương + " + (pc - 1) + " phép nhân (thay vì " + (e - 1n) + ").",
      "mut")];
}
/* bảng bình phương–nhân trái → phải (math.sqm) */
function sqmView(b, e, m, label) {
  const R = math.sqm(b, e, m);
  if (R.bits.length > 64) return [ui.note(label + ": số mũ có " + R.bits.length + " bit — bỏ qua bảng, kết quả = <b>" + R.r + "</b>.",
    "mut")];
  return [ui.table(["Bit", { html: sup("r", "2") + " mod n" }, "× cơ số nếu bit = 1", "r"],
    R.steps.map(s => [s.bit, s.i ? String(s.sq) : "1", s.bit === "1" ? String(s.r) : "–", s.r]), { mono: true, cls: "tight",
      rowCls: r => (r[0] === "1" ? "hi" : null) })];
}
/* sơ đồ luồng Alice | thông điệp | Bob */
const who = (t, k) => h("div", { class: "who " + k }, t);
const side = html => h("div", { class: "side", html });
const msg = html => h("div", { class: "msg", html });
const flow = rows => h("div", { class: "flow" }, rows.map(r => r.map(c => (typeof c === "string" ? msg(c) : c))));
/* kiểm tra căn nguyên thủy theo slide 6.3.2: g^((p−1)/q) ≢ 1 với mọi ước nguyên tố q của p − 1 */
function primRoot(g, p) {
  const fs = [...new Set(math.factor(p - 1n).map(String))].map(BigInt);
  const rows = fs.map(q => ({ q, v: math.powmod(g, (p - 1n) / q, p) }));
  return { ok: rows.every(r => r.v !== 1n), rows, fs };
}
function primRootView(g, p) {
  const R = primRoot(g, p);
  return [ui.table([{ html: "ước nguyên tố q của p − 1" }, { html: sup("g", "(p−1)/q") + " mod p" }, "≢ 1?"], R.rows.map(r => [r.q,
    r.v, r.v !== 1n ? "✓" : "✗"]), { mono: true, cls: "tight", rowCls: r => (r[2] === "✗" ? "bad" : "good") }),
    R.ok ? ui.note("g = " + g + " là <b>căn nguyên thủy</b> mod " + p + " (sinh đủ 1 … " + (p - 1n) + ").", "ok")
      : bad("g = " + g + " <b>không</b> là căn nguyên thủy mod " + p + (p < 100000n ? " (bậc " + math.order(g,
        p) + ")" : "") + " — vẫn tính được nhưng nhóm sinh nhỏ hơn.")];
}
const irootK = (n, k) => { if (n < 2n) return n; let lo = 0n, hi = 1n << BigInt(Math.ceil(n.toString(2).length / Number(k)) + 1); while (lo < hi) { const mid = (lo + hi + 1n) / 2n; if (mid ** k <= n) lo = mid; else hi = mid - 1n; } return lo; };

/* ============================ SHA-256 thuần JS (FIPS 180-4) ============================ */
const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
  0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
    0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f,
    0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const enc = new TextEncoder();
const W = new Uint32Array(64);
function shaPad(bytes) { /* thêm bit 1, các bit 0, độ dài 64 bit big-endian → bội của 64 byte */
  const L = bytes.length, total = ((L + 9 + 63) >> 6) << 6, out = new Uint8Array(total);
  out.set(bytes); out[L] = 0x80;
  const bits = L * 8, dv = new DataView(out.buffer); dv.setUint32(total - 8, Math.floor(bits / 4294967296)); dv.setUint32(total - 4,
    bits >>> 0);
  return out;
}
const rotr = (x, n) => (x >>> n) | (x << (32 - n));
function sha256(bytes) {
  const p = shaPad(bytes), dv = new DataView(p.buffer), Hh = H0.slice();
  for (let off = 0; off < p.length; off += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(off + 4 * t);
    for (let t = 16; t < 64; t++) { const w15 = W[t - 15], w2 = W[t - 2]; const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3),
      s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10); W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0; }
    let [a, b, c, d, e, f, g, hh] = Hh;
    for (let t = 0; t < 64; t++) {
      const T1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[t] + W[t]) >>> 0;
      const T2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + T1) >>> 0; d = c; c = b; b = a; a = (T1 + T2) >>> 0;
    }
    Hh[0] = (Hh[0] + a) >>> 0; Hh[1] = (Hh[1] + b) >>> 0; Hh[2] = (Hh[2] + c) >>> 0; Hh[3] = (Hh[3] + d) >>> 0;
    Hh[4] = (Hh[4] + e) >>> 0; Hh[5] = (Hh[5] + f) >>> 0; Hh[6] = (Hh[6] + g) >>> 0; Hh[7] = (Hh[7] + hh) >>> 0;
  }
  return Hh;
}
const hexWords = ws => ws.map(w => w.toString(16).padStart(8, "0")).join("");
const sha256hex = s => hexWords(sha256(enc.encode(s)));
const hex2bits = hx => hx.split("").map(c => parseInt(c, 16).toString(2).padStart(4, "0")).join("");
const leadZeroBits = hx => { let n = 0; for (const c of hx) { const v = parseInt(c, 16); if (v === 0) { n += 4; continue; } n += Math.clz32(v) - 28; break; } return n; };
LAB.sha256hex = sha256hex; /* cho mô-đun khác dùng nếu cần */

/* ============================ đăng ký mô-đun ============================ */
LAB.module({
  id: "m3",
  tabs: [

  /* ------------------------------------------------------------------ 1. RSA ------------------------------------------------------------------ */
  { id: "rsa", title: "Sinh khóa RSA", intro: "n = p·q, φ(n) = (p − 1)(q − 1), d = e<sup>−1</sup> mod φ(n); C = M<sup>e</sup> mod n, M = C<sup>d</sup> mod n; giải mã nhanh bằng CRT; chữ ký s = m<sup>d</sup> (slide 5.4.3 – 5.4.9, 6.1.5).",
    build(pane) {
      const { root, ctrl, view } = ui.sim();
      const S = { mode: "num" };
      const out = ui.slot(); view.append(out);
      const F = fields("m3rsa", [
        { k: "p", label: "Số nguyên tố p", v: 61 }, { k: "q", label: "Số nguyên tố q", v: 53 },
        { k: "e", label: "Số mũ công khai e", v: 17, hint: "1 < e < φ(n), gcd(e, φ(n)) = 1" },
        { k: "M", label: "Thông điệp M (mã hóa)", v: 65 }, { k: "m", label: "Thông điệp m (ký)", v: 100 }], draw);
      const seg = ui.seg({ id: "m3rsa-mode", options: [["num", "Số"], ["txt", "Chữ cái A=01…Z=26"]],
        value: "num", onChange: v => { S.mode = v; draw(); } });
      const setMode = v => { S.mode = v; seg.set(v); };
      ctrl.append(F.els[0], F.els[1], F.els[2], h("div", { class: "fld" }, h("label", null,
        h("b", null, "Kiểu thông điệp")), seg), F.els[3], F.els[4], ui.presets([
        { label: "p = 61, q = 53, e = 17, M = 65 (slide 5.4.5–5.4.7)", apply: () => { setMode("num"); F.set({ p: 61,
          q: 53, e: 17, M: 65, m: 100 }); } },
        { label: "\"HI\" → 809 → 1171 (slide 5.4.8)", apply: () => { setMode("txt"); F.set({ p: 61, q: 53, e: 17, M: "HI", m: 100 }); } },
        { label: "Bài tập 4.1: p = 5, q = 11, e = 3, M = 2", apply: () => { setMode("num"); F.set({ p: 5, q: 11, e: 3, M: 2, m: 3 }); } },
        { label: "Bài tập 4.2: p = 7, q = 13, e = 5, M = 10", apply: () => { setMode("num"); F.set({ p: 7, q: 13, e: 5, M: 10, m: 4 }); } },
        { label: "Cửa sập 18 chữ số: p = 885320963, q = 238855417, e = 9007, \"CAT\" (slide 6.1.5)",
          apply: () => { setMode("txt"); F.set({ p: 885320963,
          q: 238855417, e: 9007, M: "CAT", m: 30120 }); } }
      ]));
      function draw() {
        const p = pint(F.S.p), q = pint(F.S.q), e = pint(F.S.e), errs = [];
        if (p == null || q == null || e == null) errs.push("p, q, e phải là số nguyên dương.");
        else {
          if (p.toString().length > 12 || q.toString().length > 12) errs.push("Mô phỏng giới hạn p, q ≤ 12 chữ số.");
          else { if (!math.isPrime(p)) errs.push("p = " + p + " <b>không phải số nguyên tố</b>."); if (!math.isPrime(q)) errs.push("q = " + q + " <b>không phải số nguyên tố</b>."); if (p === q) errs.push("p phải khác q (nếu p = q thì φ(n) = p(p − 1), Eve lấy căn bậc hai của n là xong)."); }
        }
        if (errs.length) { out.render(bad(errs.join("<br>"))); return; }
        const n = p * q, phi = (p - 1n) * (q - 1n), E = egcdTable(phi, e);
        if (e <= 1n || e >= phi) errs.push("Cần 1 < e < φ(n) = " + phi + ".");
        if (E.g !== 1n) errs.push("gcd(e, φ(n)) = gcd(" + e + ", " + phi + ") = <b>" + E.g + "</b> ≠ 1 → e không khả nghịch; chọn e khác (3, 5, 7, 17, 65537…).");
        const head = [ui.readouts([{ k: "n = p·q", v: n, kind: "key" }, { k: "φ(n) = (p−1)(q−1)", v: phi, kind: "key" }])];
        if (errs.length) { out.render(head, bad(errs.join("<br>")), ui.panel("Euclid mở rộng gcd(φ(n), e)",
          egcdView(phi, e, "φ(n)", "e"))); return; }
        const d = math.mod(E.t, phi), kq = (e * d - 1n) / phi;
        /* thông điệp */
        let M, letters = null, mErr = null;
        if (S.mode === "txt") { letters = txt.clean(F.S.M); if (!letters) mErr = "Nhập ít nhất một chữ cái A–Z."; else M = BigInt(letters.split("").map(ch => String(txt.n(ch) + 1).padStart(2,
          "0")).join("")); }
        else { M = pint(F.S.M); if (M == null) mErr = "M phải là số nguyên không âm."; }
        const encBlock = [];
        if (mErr) encBlock.push(bad(mErr));
        else if (M >= n) encBlock.push(bad("M = " + M + " ≥ n = " + n + ": phải <b>chia khối</b> (mỗi khối < n) hoặc chọn p, q lớn hơn / dùng mã hóa lai."));
        else {
          const C = math.powmod(M, e, n), Md = math.powmod(C, d, n);
          const decoded = letters != null ? (() => { let s = Md.toString(); if (s.length % 2) s = "0" + s; return s.match(/../g).map(x => { const v = +x; return v >= 1 && v <= 26 ? txt.c(v - 1) : "?"; }).join(""); })() : null;
          if (letters != null) encBlock.push(ui.table(["Chữ", ...letters.split("")], [["Mã (A=01)",
            ...letters.split("").map(ch => String(txt.n(ch) + 1).padStart(2,
            "0"))]], { mono: true, cls: "tight" }),
            ui.note("Ghép các mã hai chữ số: M = " + letters.split("").map(ch => String(txt.n(ch) + 1).padStart(2,
              "0")).join("") + " = <b>" + M + "</b> " + (M < n ? "< n ✓" : ""),
              "mut"));
          encBlock.push(ui.readouts([{ k: "M", v: M, kind: "pt" }, { k: "C = M^e mod n", v: C, kind: "ct", big: true }, { k: "C^d mod n",
            v: Md, kind: Md === M ? "ok" : "eve" }, decoded != null ? { k: "Giải mã → chữ", v: decoded,
              kind: "pt" } : null].filter(Boolean)));
          encBlock.push(ui.title("Mã hóa: bình phương liên tiếp (slide 5.4.6)", "C = M^e mod n"), ...powTableView(M, e, n, "M"));
          encBlock.push(ui.title("Giải mã: bình phương–nhân trái → phải", "M = C^d mod n, d = " + d.toString(2) + "₂"),
            ...sqmView(C, d, n, "Giải mã"));
          /* CRT */
          const dp = d % (p - 1n), dq = d % (q - 1n), cp = C % p, cq = C % q, mp = math.powmod(cp, dp, p), mq = math.powmod(cq,
            dq, q), qi = math.modinv(q, p), hc = math.mod(qi * (mp - mq), p), Mc = mq + hc * q;
          encBlock.push(ui.title("Giải mã nhanh bằng CRT (slide 5.4.7)", "Bob biết p, q"), ui.table(["Đại lượng", "Giá trị"], [
            [{ html: sub("d", "p") + " = d mod (p − 1) = " + d + " mod " + (p - 1n) }, dp], [{ html: sub("d",
              "q") + " = d mod (q − 1) = " + d + " mod " + (q - 1n) },
              dq],
            ["C mod p, C mod q", cp + ", " + cq], [{ html: sub("m", "p") + " = " + cp + "<sup>" + dp + "</sup> mod " + p },
              mp], [{ html: sub("m", "q") + " = " + cq + "<sup>" + dq + "</sup> mod " + q }, mq],
            [{ html: sup("q", "−1") + " mod p = " + q + "<sup>−1</sup> mod " + p }, qi], [{ html: "h = q<sup>−1</sup>(" + sub("m",
              "p") + " − " + sub("m", "q") + ") mod p = " + qi + "·(" + mp + " − " + mq + ") mod " + p }, hc],
            [{ html: "M = " + sub("m", "q") + " + h·q = " + mq + " + " + hc + "·" + q }, { html: "<b>" + Mc + "</b> " + (Mc === M ? "✓" : "✗") }]],
              { mono: true, cls: "tight", rowCls: (r, i) => (i === 7 ? "hi" : null) }),
            ui.note("Hai lũy thừa với số mũ và modulus bằng một nửa độ dài → nhanh hơn ≈ 4 lần; mọi thư viện RSA đều dùng.", "mut"));
        }
        /* chữ ký */
        const m = pint(F.S.m), sigBlock = [];
        if (m == null || m >= n) sigBlock.push(bad("m phải là số nguyên 0 ≤ m < n."));
        else { const s = math.powmod(m, d, n), v = math.powmod(s, e, n);
          sigBlock.push(ui.readouts([{ k: "m", v: m, kind: "pt" }, { k: "s = m^d mod n (Bob ký)", v: s, kind: "ct", big: true },
            { k: "s^e mod n (ai cũng xác minh)", v: v, kind: v === m ? "ok" : "eve" }]),
            ui.steps([{ t: "Ký bằng khóa bí mật d: s = " + m + "<sup>" + d + "</sup> mod " + n, r: String(s) },
              { t: "Xác minh bằng khóa công khai (e, n): s<sup>e</sup> = " + s + "<sup>" + e + "</sup> mod " + n,
              r: v + (v === m ? " = m ✓" : " ≠ m ✗"), hi: true }]),
            ui.note("Đảo vai trò hai khóa: chỉ Bob ký được, mọi người kiểm tra được. Thực tế ký H(m) với đệm RSA-PSS; xem tab <b>Chữ ký số</b>.",
              "mut")); }
        out.render(head,
          ui.readouts([{ k: "d = e⁻¹ mod φ(n)", v: d, kind: "key", big: true }, { k: "Khóa công khai (e, n)", v: "(" + e + ", " + n + ")",
            kind: "aqua" }, { k: "Khóa bí mật d (cùng p, q)", v: d, kind: "key" }]),
          ui.panel("Euclid mở rộng: d = e⁻¹ mod φ(n) (slide 5.4.5)", ...egcdView(phi, e, "φ(n)", "e"),
            ui.steps([{ t: "Hệ số của e là t = " + E.t + " ⇒ d ≡ " + E.t + " ≡ <b>" + d + "</b> (mod " + phi + ")", r: "d = " + d,
              hi: true }, { t: "Kiểm tra: e·d = " + e + "·" + d + " = " + (e * d) + " = " + kq + "·" + phi + " + 1",
                r: "e·d ≡ 1 (mod φ(n)) ✓" }])),
          ui.panel("Mã hóa và giải mã (slide 5.4.6 – 5.4.8)", ...encBlock),
          ui.panel("Chữ ký RSA (slide 5.4.9)", ...sigBlock),
          ui.note("Thực tế: p, q ≥ 1024 bit (n ≥ 2048 bit), e = 65537, luôn đệm OAEP/PSS. \"Textbook RSA\" tất định: cùng M → cùng C.",
            "key"));
      }
      draw(); pane.appendChild(root);
    } },

  /* ------------------------------------------------------------------ 2. Tấn công RSA ------------------------------------------------------------------ */
  { id: "rsaattack", title: "Tấn công RSA", intro: "Bốn điểm yếu khi dùng RSA sai cách: p ≈ q (Fermat), e nhỏ không đệm, chung thừa số giữa hai modulus và tính đồng cấu nhân (slide 5.5.2 – 5.5.5).",
    build(pane) {
      const { root, view } = ui.sim({ wide: true });
      /* (a) Fermat */
      const oA = ui.slot();
      const FA = fields("m3ra-f", [{ k: "n", label: "Modulus n", v: 8051 }], drawA);
      function drawA() {
        const n = pint(FA.S.n);
        if (n == null || n < 4n) return oA.render(bad("n phải là số nguyên ≥ 4."));
        if (n % 2n === 0n) return oA.render(bad("n chẵn → thừa số 2 ngay lập tức; Fermat chỉ dùng cho n lẻ."));
        let a = math.isqrt(n); if (a * a < n) a++;
        const rows = []; let found = null;
        for (let i = 0; i < 5000 && !found; i++, a++) { const b2 = a * a - n, b = math.isqrt(b2),
          sq = b * b === b2; if (rows.length < 14) rows.push([a,
          a * a - n, sq ? b + "² ✓" : "✗"]); if (sq) found = { a, b, i: i + 1 }; }
        const kids = [ui.readouts([{ k: "√n ≈", v: Math.sqrt(Number(n)).toFixed(1).replace(".",
          ","), kind: "key" }, { k: "a bắt đầu = ⌈√n⌉",
          v: rows[0][0], kind: "key" }]),
          ui.table(["a", "a² − n", "Chính phương?"], rows, { mono: true, cls: "tight", rowCls: r => (String(r[2]).includes("✓") ? "good" : null) })];
        if (!found) kids.push(bad("Không tìm thấy sau 5000 bước: |p − q| lớn → Fermat không hiệu quả (đúng như khuyến nghị)."));
        else if (found.a - found.b === 1n) kids.push(bad("Chỉ ra phân tích tầm thường n = 1·" + n + " → n là số nguyên tố (hoặc Fermat chỉ gặp nghiệm tầm thường)."));
        else kids.push(ui.steps([{ t: "n = a² − b² = " + found.a + "² − " + found.b + "²", r: String(n) },
          { t: "= (a − b)(a + b) = (" + found.a + " − " + found.b + ")(" + found.a + " + " + found.b + ")",
          r: "<b>" + (found.a - found.b) + " · " + (found.a + found.b) + "</b>", hi: true }, { t: "Số bước thử a",
            r: found.i + " bước — vì |p − q| = " + (2n * found.b) + " nhỏ" }]));
        oA.render(kids);
      }
      /* (b) e nhỏ */
      const oB = ui.slot();
      const FB = fields("m3ra-e", [{ k: "C", label: "Bản mã C (bắt được)", v: 74088 }, { k: "e", label: "Số mũ e", v: 3 }], drawB);
      function drawB() {
        const C = pint(FB.S.C), e = pint(FB.S.e);
        if (C == null || e == null || e < 2n || e > 11n) return oB.render(bad("C là số nguyên, 2 ≤ e ≤ 11."));
        const M = irootK(C, e), exact = M ** e === C;
        oB.render(ui.readouts([{ k: "⌊C^(1/e)⌋", v: M, kind: exact ? "pt" : "eve", big: true },
          { k: "M^e", v: M ** e, kind: exact ? "ok" : "eve" }]),
          exact ? ui.note("M<sup>" + e + "</sup> = " + C + " <b>đúng bằng C</b>: vì M<sup>e</sup> < n nên phép mod không rút gọn gì → Eve lấy căn bậc " + e + " là ra M = <b>" + M + "</b> mà không cần d.",
            "ok")
            : bad("M<sup>e</sup> ≠ C: bản mã đã bị rút gọn theo mod n (M<sup>e</sup> ≥ n) hoặc có đệm ngẫu nhiên → tấn công căn thất bại."),
          ui.note("Håstad: cùng M gửi cho e người nhận với cùng e → CRT ghép thành M<sup>e</sup> mod n₁n₂…n<sub>e</sub> = M<sup>e</sup> → lại lấy căn. Phòng chống: e = 65537 và luôn đệm OAEP.",
            "mut"));
      }
      /* (c) chung thừa số */
      const oC = ui.slot();
      const FC = fields("m3ra-g", [{ k: "n1", label: "n₁", v: 3233 }, { k: "n2", label: "n₂", v: 4331 }], drawC);
      function drawC() {
        const n1 = pint(FC.S.n1), n2 = pint(FC.S.n2);
        if (!n1 || !n2) return oC.render(bad("n₁, n₂ phải là số nguyên dương."));
        const steps = []; let a = n1 > n2 ? n1 : n2, b = n1 > n2 ? n2 : n1;
        while (b !== 0n && steps.length < 60) { const q = a / b, r = a - q * b; steps.push([a + " = " + q + "·" + b + " + " + r]); [a,
          b] = [b, r]; }
        const g = a, kids = [ui.table(["Euclid"], steps, { mono: true, cls: "tight" }), ui.readouts([{ k: "gcd(n₁, n₂)",
          v: g, kind: g > 1n && g < n1 && g < n2 ? "eve" : "ok", big: true }])];
        if (g > 1n && g < n1 && g < n2) kids.push(ui.note("<b>Chung thừa số p = " + g + "</b>: n₁ = " + g + " · " + (n1 / g) + ", n₂ = " + g + " · " + (n2 / g) + " — phân tích cả hai khóa chỉ bằng vài phép chia (quét Internet 2012 tìm thấy hàng chục nghìn khóa như vậy do bộ sinh số ngẫu nhiên kém).",
          "eve"));
        else kids.push(ui.note("Hai modulus nguyên tố cùng nhau — không khai thác được theo cách này.", "ok"));
        oC.render(kids);
      }
      /* (d) đồng cấu */
      const oD = ui.slot();
      const FD = fields("m3ra-h", [{ k: "n", label: "n", v: 3233 }, { k: "e", label: "e", v: 17 }, { k: "M1", label: "M₁",
        v: 2 }, { k: "M2", label: "M₂", v: 3 }], drawD);
      function drawD() {
        const n = pint(FD.S.n), e = pint(FD.S.e), M1 = pint(FD.S.M1), M2 = pint(FD.S.M2);
        if (!n || !e || M1 == null || M2 == null) return oD.render(bad("Nhập n, e, M₁, M₂ là số nguyên."));
        const E = x => math.powmod(x, e, n), C1 = E(M1), C2 = E(M2), prod = C1 * C2 % n, M12 = M1 * M2 % n, C12 = E(M12);
        oD.render(ui.steps([{ t: "E(M₁) = " + M1 + "<sup>" + e + "</sup> mod " + n, r: String(C1) },
          { t: "E(M₂) = " + M2 + "<sup>" + e + "</sup> mod " + n,
          r: String(C2) },
            { t: "E(M₁)·E(M₂) mod n = " + C1 + "·" + C2 + " mod " + n, r: String(prod), hi: true }, { t: "E(M₁M₂ mod n) = E(" + M12 + ")",
              r: C12 + (C12 === prod ? " — bằng nhau ✓" : " ✗") }]),
          ui.note("Eve không cần d vẫn <b>sửa bản mã có kiểm soát</b>: nhân C với E(2) = " + E(2n) + " thì Bob giải ra 2·M₁ = " + (2n * M1 % n) + " (ví dụ gấp đôi số tiền). Đệm OAEP/PSS phá tính đồng cấu này; cũng là lý do \"băm rồi ký\" ở chữ ký số.",
            "eve"));
      }
      view.append(h("div", { class: "cols" },
        ui.panel("(a) Phân tích Fermat khi p ≈ q (slide 5.5.2; bài tập 5.1: n = 5959)", h("div", { class: "row" }, ...FA.els,
          ui.btn("n = 8051", () => FA.set({ n: 8051 }), "sm"), ui.btn("Bài tập: n = 5959", () => FA.set({ n: 5959 }), "sm"),
          ui.btn("n = 642401 (BTVN)", () => FA.set({ n: 642401 }), "sm")), oA),
        ui.panel("(b) Số mũ nhỏ e = 3, không đệm (slide 5.5.3; bài tập 5.3)", h("div", { class: "row" }, ...FB.els, ui.btn("C = 74088",
          () => FB.set({ C: 74088, e: 3 }), "sm"), ui.btn("Bài tập: C = 1331000", () => FB.set({ C: 1331000, e: 3 }), "sm")),
          oB)),
        h("div", { class: "cols" },
          ui.panel("(c) Hai modulus chung thừa số: gcd(n₁, n₂) (slide 5.5.4; bài tập 5.2)", h("div", { class: "row" }, ...FC.els,
            ui.btn("3233, 4331", () => FC.set({ n1: 3233, n2: 4331 }), "sm"), ui.btn("3233, 3599 (không chung)", () => FC.set({ n1: 3233,
            n2: 3599 }), "sm")), oC),
          ui.panel("(d) Tính đồng cấu nhân E(M₁)·E(M₂) = E(M₁M₂) (slide 5.5.5; bài tập 5.4)", h("div", { class: "row" }, ...FD.els), oD)),
        ui.note("Bài học (slide 5.5.5): p, q ngẫu nhiên độc lập và |p − q| lớn; e = 65537; mỗi người một n riêng; luôn dùng RSA-OAEP / RSA-PSS (PKCS#1 v2.2); chống kênh kề bằng blinding và mã constant-time.",
          "key"));
      drawA(); drawB(); drawC(); drawD(); pane.appendChild(root);
    } },

  /* ------------------------------------------------------------------ 3. Diffie–Hellman ------------------------------------------------------------------ */
  { id: "dh", title: "Diffie–Hellman", intro: "Công khai p, g; Alice gửi A = g<sup>a</sup>, Bob gửi B = g<sup>b</sup>; cả hai tính K = g<sup>ab</sup> mod p. Eve phải giải logarit rời rạc; Mallory đứng giữa nếu không xác thực (slide 6.3.2 – 6.3.5, 6.1.3).",
    build(pane) {
      const { root, ctrl, view } = ui.sim();
      const S = { mitm: false };
      const out = ui.slot(), outDlp = ui.slot();
      const F = fields("m3dh", [{ k: "p", label: "Số nguyên tố p", v: 23 }, { k: "g", label: "Căn nguyên thủy g", v: 5 },
        { k: "a", label: "Bí mật của Alice a", v: 6 }, { k: "b", label: "Bí mật của Bob b", v: 15 },
          { k: "m", label: "Bí mật của Mallory m",
        v: 7 }], draw);
      const chk = ui.check({ id: "m3dh-mitm", label: "Mallory đứng giữa (MITM, slide 6.3.6)",
        value: false, onChange: v => { S.mitm = v; draw(); } });
      ctrl.append(F.els[0], F.els[1], F.els[2], F.els[3], chk, F.els[4], ui.presets([
        { label: "p = 23, g = 5, a = 6, b = 15 → K = 2 (slide 6.3.5)", apply: () => F.set({ p: 23, g: 5, a: 6, b: 15 }) },
        { label: "p = 7, g = 3, a = 5, b = 9 → K = 6 (slide 6.3.5)", apply: () => F.set({ p: 7, g: 3, a: 5, b: 9 }) },
        { label: "Bài tập 3.1: p = 23, g = 5, a = 4, b = 3", apply: () => F.set({ p: 23, g: 5, a: 4, b: 3 }) },
        { label: "p = 7, g = 2 (không phải căn nguyên thủy, slide 6.3.2)", apply: () => F.set({ p: 7, g: 2, a: 5, b: 9 }) }
      ]));
      /* khối logarit rời rạc có ô nhập riêng */
      const FD = fields("m3dlp", [{ k: "p", label: "p", v: 17 }, { k: "g", label: "g", v: 3 }, { k: "y", label: "y = g^x mod p",
        v: 7 }, { k: "m", label: "m (baby steps)", v: 5, hint: "để trống → m = ⌈√(p − 1)⌉" }], drawDlp);
      view.append(out, ui.panel("Logarit rời rạc: vét cạn và baby-step giant-step (slide 6.1.3, 6.3.3)",
        h("div", { class: "row" }, ...FD.els, ui.btn("3^x ≡ 7 (mod 17), m = 5", () => FD.set({ p: 17, g: 3, y: 7, m: 5 }),
          "sm"), ui.btn("m = 4 = ⌈√16⌉", () => FD.set({ p: 17, g: 3, y: 7, m: "" }), "sm"), ui.btn("3^x ≡ 13 (slide 6.1.3)",
          () => FD.set({ p: 17, g: 3, y: 13, m: "" }), "sm"), ui.btn("BTVN: 2^x ≡ 11 (mod 29)", () => FD.set({ p: 29, g: 2,
          y: 11, m: "" }), "sm")), outDlp));
      function draw() {
        const p = pint(F.S.p), g = pint(F.S.g), a = pint(F.S.a), b = pint(F.S.b), m = pint(F.S.m);
        if (p == null || g == null || a == null || b == null) return out.render(bad("p, g, a, b phải là số nguyên dương."));
        if (p > 1000000000000n) return out.render(bad("Mô phỏng giới hạn p ≤ 10¹²."));
        if (!math.isPrime(p)) return out.render(bad("p = " + p + " không phải số nguyên tố."));
        if (g <= 1n || g >= p) return out.render(bad("Cần 1 < g < p."));
        const A = math.powmod(g, a, p), Bv = math.powmod(g, b, p), KA = math.powmod(Bv, a, p), KB = math.powmod(A, b, p);
        const kids = [ui.readouts([{ k: "A = g^a mod p", v: A, kind: "pt" }, { k: "B = g^b mod p", v: Bv, kind: "aqua" },
          { k: "K = B^a = A^b mod p", v: KA, kind: KA === KB ? "key" : "eve", big: true }])];
        kids.push(flow([[who("Alice", "a"), msg("A = " + g + "<sup>" + a + "</sup> mod " + p + " = <b>" + A + "</b> ⟶"), who("Bob", "b")],
          [side("chọn bí mật a = " + a), msg("⟵ B = " + g + "<sup>" + b + "</sup> mod " + p + " = <b>" + Bv + "</b>"),
            side("chọn bí mật b = " + b)],
          [side("K = B<sup>a</sup> = " + Bv + "<sup>" + a + "</sup> mod " + p + " = <b class='key-c'>" + KA + "</b>"),
            msg("Eve thấy p, g, A, B"),
            side("K = A<sup>b</sup> = " + A + "<sup>" + b + "</sup> mod " + p + " = <b class='key-c'>" + KB + "</b>")]]));
        kids.push(ui.steps([{ t: "Rút gọn số mũ theo mod (p − 1) (Fermat): a ≡ " + (a % (p - 1n)) + ", b ≡ " + (b % (p - 1n)) + " (mod " + (p - 1n) + ")",
          r: "A = " + g + "<sup>" + (a % (p - 1n)) + "</sup> = " + A + ", B = " + g + "<sup>" + (b % (p - 1n)) + "</sup> = " + Bv },
          { t: "B<sup>a</sup> = (g<sup>b</sup>)<sup>a</sup> = g<sup>ab</sup> = (g<sup>a</sup>)<sup>b</sup> = A<sup>b</sup>",
            r: "K = " + KA + (KA === KB ? " (hai phía trùng nhau ✓)" : " ✗"), hi: true }]));
        if (p <= 100n) {
          const ks = [], vs = []; for (let k = 1n; k < p; k++) { const v = math.powmod(g, k, p); ks.push({ html: String(k),
            cls: k === a ? "pt-c" : k === b ? "aqua-c" : null }); vs.push({ html: (v === KA ? "<span class='hl'>" + v + "</span>" : String(v)),
            cls: k === a ? "pt-c" : k === b ? "aqua-c" : null }); }
          kids.push(ui.title("Bảng g^k mod p", "k = a (xanh), k = b (lam), giá trị K (vàng) — Eve dò bảng này để tìm a từ A: " + a + " phép thử"),
            ui.table([{ html: "k" }, ...ks], [[{ html: sup("g", "k") }, ...vs]], { mono: true, cls: "tight" }));
        } else kids.push(ui.note("p > 100: không in bảng g<sup>k</sup>; với p ~ 2<sup>2048</sup> Eve cần ~√p ≈ 2<sup>1024</sup> bước.",
          "mut"));
        kids.push(ui.title("Kiểm tra căn nguyên thủy (slide 6.3.2)"), ...primRootView(g, p));
        if (S.mitm) {
          if (m == null || m < 1n) kids.push(bad("m của Mallory phải là số nguyên dương."));
          else { const Mv = math.powmod(g, m, p), K1 = math.powmod(A, m, p), K2 = math.powmod(Bv, m, p);
            kids.push(ui.panel("Mallory đứng giữa (slide 6.3.6)",
              flow([[who("Alice", "a"), msg("A = g<sup>a</sup> = " + A + " ⟶"), who("Mallory", "e")],
                [side("nhận g<sup>m</sup> = " + Mv + ", tính K₁ = " + Mv + "<sup>" + a + "</sup> = <b class='eve-c'>" + K1 + "</b>"),
                msg("⟵ g<sup>m</sup> = " + Mv), side("chặn A, thay bằng g<sup>m</sup> = " + Mv)],
                [who("Mallory", "e"), msg("g<sup>m</sup> = " + Mv + " ⟶"), who("Bob", "b")], [side("K₂ = B<sup>m</sup> = " + Bv + "<sup>" + m + "</sup> = <b class='eve-c'>" + K2 + "</b>"),
                  msg("⟵ B = g<sup>b</sup> = " + Bv), side("tính K₂ = " + Mv + "<sup>" + b + "</sup> = <b class='eve-c'>" + math.powmod(Mv,
                  b, p) + "</b>")]]),
              ui.readouts([{ k: "K₁ = g^(am) (Alice ↔ Mallory)", v: K1, kind: "eve" }, { k: "K₂ = g^(bm) (Mallory ↔ Bob)", v: K2,
                kind: "eve" }, { k: "K thật g^(ab) — không ai dùng", v: KA, kind: "key" }]),
              ui.note("Mallory giải mã bằng K₁, đọc, mã hóa lại bằng K₂: Alice và Bob không phát hiện được. Khắc phục: ký g<sup>a</sup>, g<sup>b</sup> bằng khóa có chứng chỉ (STS, TLS 1.3); dùng khóa tạm thời mỗi phiên → bí mật chuyển tiếp.",
                "eve"))); }
        }
        kids.push(ui.note("K thường được đưa qua KDF/hàm băm để làm khóa AES. DH không tự xác thực hai bên. Thực tế: p ≥ 2048 bit hoặc ECDH (X25519).",
          "mut"));
        out.render(kids);
      }
      function drawDlp() {
        const p = pint(FD.S.p), g = pint(FD.S.g), y = pint(FD.S.y); let m = pint(FD.S.m);
        if (p == null || g == null || y == null || p < 3n || !math.isPrime(p)) return outDlp.render(bad("p phải là số nguyên tố; g, y là số nguyên."));
        if (p > 25000000n) return outDlp.render(bad("Giới hạn p ≤ 2,5·10⁷ cho bảng baby steps."));
        if (g % p === 0n || y % p === 0n) return outDlp.render(bad("g và y phải khác 0 mod p."));
        if (!m || m < 1n) m = math.isqrt(p - 1n), m += (m * m < p - 1n ? 1n : 0n);
        const kids = [];
        if (p <= 100n) { const vals = []; for (let k = 1n; k < p; k++) vals.push(math.powmod(g, k, p));
          kids.push(ui.title("Chiều thuận dễ, chiều ngược phải dò (slide 6.1.3)", "bảng " + g + "^k mod " + p),
            ui.table([{ html: "k" }, ...vals.map((_, i) => String(i + 1))], [[{ html: sup(String(g),
              "k") }, ...vals.map(v => ({ html: v === y % p ? "<span class='hl'>" + v + "</span>" : String(v) }))]],
              { mono: true, cls: "tight" })); }
        /* BSGS */
        const baby = new Map(), babyRows = []; let gj = 1n;
        for (let j = 0n; j < m; j++) { if (!baby.has(gj)) baby.set(gj, j); babyRows.push([j, gj]); gj = gj * g % p; }
        const gm = math.powmod(g, m, p), gmi = math.modinv(gm, p), giant = []; let cur = y % p, x = null;
        for (let i = 0n; i <= m + 1n && x == null; i++) { const hit = baby.get(cur); giant.push([i,
          cur, hit != null ? "j = " + hit + " ✓" : "không có"]); if (hit != null) x = i * m + hit; else cur = cur * gmi % p; }
        kids.push(ui.title("Baby-step giant-step (slide 6.3.3)", "x = i·m + j, m = " + m),
          h("div", { class: "cols" }, h("div", { class: "stack" }, ui.title("Baby steps g^j", "j = 0 … m − 1"), ui.table(["j",
            { html: sup(String(g), "j") + " mod " + p }], babyRows.slice(0, 40), { mono: true, cls: "tight" }),
              babyRows.length > 40 ? ui.note("… " + babyRows.length + " dòng",
            "mut") : null),
            h("div", { class: "stack" }, ui.title("Giant steps y·(g^−m)^i", "g<sup>m</sup> = " + gm + ", (g<sup>m</sup>)<sup>−1</sup> ≡ " + gmi + " (mod " + p + ")"),
              ui.table(["i", "giá trị", "trùng bảng?"], giant.slice(0, 40), { mono: true, cls: "tight",
                rowCls: r => (String(r[2]).includes("✓") ? "good" : null) }))),
          x != null ? ui.readouts([{ k: "x = i·m + j", v: x, kind: "key", big: true }, { k: "Kiểm tra g^x mod p", v: math.powmod(g,
            x, p) + (math.powmod(g, x, p) === y % p ? " = y ✓" : " ✗"), kind: "ok" }, { k: "Chi phí",
              v: babyRows.length + " + " + giant.length + " phép (thay vì ≤ " + (p - 1n) + ")",
            kind: "aqua" }])
            : bad("Không tìm thấy x: y không thuộc nhóm sinh bởi g (hoặc m quá nhỏ)."),
          ui.note("Chi phí ≈ √p thời gian và bộ nhớ: với p 2048 bit vẫn cần ~2<sup>1024</sup> bước. Pohlig–Hellman nhanh hơn khi p − 1 chỉ có ước nhỏ → chọn p − 1 có ước nguyên tố lớn.",
            "mut"));
        outDlp.render(kids);
      }
      draw(); drawDlp(); pane.appendChild(root);
    } },

  /* ------------------------------------------------------------------ 4. ElGamal ------------------------------------------------------------------ */
  { id: "elgamal", title: "Mã hóa ElGamal", intro: "Khóa (p, α, β = α<sup>a</sup>); mã hóa m với k mới: (r, t) = (α<sup>k</sup>, β<sup>k</sup>·m); giải mã m = t·(r<sup>a</sup>)<sup>−1</sup> mod p. Dùng lại k là lộ thông điệp (slide 6.3.7 – 6.3.9).",
    build(pane) {
      const { root, ctrl, view } = ui.sim();
      const out = ui.slot();
      const F = fields("m3eg", [{ k: "p", label: "Số nguyên tố p", v: 467 }, { k: "al", label: "Căn nguyên thủy α", v: 2 },
        { k: "a", label: "Bí mật của Bob a", v: 127 }, { k: "m", label: "Thông điệp m", v: 100 },
          { k: "k", label: "Số ngẫu nhiên k (Alice)",
        v: 53 },
        { k: "m1", label: "Dùng lại k: m₁ (Eve đã biết)", v: 100 }, { k: "m2", label: "Dùng lại k: m₂ (bí mật)", v: 250 }], draw);
      ctrl.append(...F.els.slice(0, 5), ui.presets([
        { label: "p = 467, α = 2, a = 127, m = 100, k = 53 (slide 6.3.8)", apply: () => F.set({ p: 467,
          al: 2, a: 127, m: 100, k: 53, m1: 100, m2: 250 }) },
        { label: "Bài tập 3.3: p = 23, α = 5, a = 6, m = 10, k = 3", apply: () => F.set({ p: 23,
          al: 5, a: 6, m: 10, k: 3, m1: 10, m2: 15 }) },
        { label: "BTVN: p = 2579, α = 2, a = 765, m = 1299, k = 853", apply: () => F.set({ p: 2579,
          al: 2, a: 765, m: 1299, k: 853, m1: 1299, m2: 2000 }) }
      ]), ui.title("Tấn công dùng lại k (slide 6.3.9)"), ...F.els.slice(5));
      view.append(out);
      function draw() {
        const p = pint(F.S.p), al = pint(F.S.al), a = pint(F.S.a), m = pint(F.S.m), k = pint(F.S.k), m1 = pint(F.S.m1), m2 = pint(F.S.m2);
        if ([p, al, a, m, k].some(x => x == null)) return out.render(bad("p, α, a, m, k phải là số nguyên."));
        if (p > 1000000000000n || !math.isPrime(p)) return out.render(bad("p phải là số nguyên tố ≤ 10¹²."));
        const errs = [];
        if (al <= 1n || al >= p) errs.push("Cần 1 < α < p."); if (a < 1n || a > p - 2n) errs.push("Bí mật a ∈ [1, p − 2]."); if (k < 1n || k > p - 2n) errs.push("k ∈ [1, p − 2]."); if (m >= p) errs.push("m phải < p (chia khối nếu dài).");
        if (errs.length) return out.render(bad(errs.join("<br>")));
        const be = math.powmod(al, a, p), r = math.powmod(al, k, p), bk = math.powmod(be, k, p), t = bk * m % p, ra = math.powmod(r,
          a, p), rai = math.modinv(ra, p), md = t * rai % p;
        const r2 = math.powmod(al, k + 1n, p), t2 = math.powmod(be, k + 1n, p) * m % p;
        const kids = [ui.readouts([{ k: "β = α^a mod p (công khai)", v: be, kind: "aqua" }, { k: "r = α^k mod p", v: r,
          kind: "ct" }, { k: "t = β^k·m mod p", v: t, kind: "ct", big: true }, { k: "Giải mã m", v: md, kind: md === m ? "ok" : "eve" }]),
          flow([[who("Alice", "a"), msg("⟵ công khai (p, α, β) = (" + p + ", " + al + ", " + be + ")"), who("Bob", "b")],
            [side("chọn k = " + k + " <b>mới mỗi lần</b>"), msg("(r, t) = (" + r + ", " + t + ") ⟶"), side("bí mật a = " + a)]]),
          ui.table(["Bước", "Phép tính", "Kết quả"], [
            ["Khóa công khai", { html: "β = " + al + "<sup>" + a + "</sup> mod " + p }, be], ["Mã hóa m = " + m + ", k = " + k,
              { html: "r = " + al + "<sup>" + k + "</sup> mod " + p }, r], ["", { html: "β<sup>k</sup> = " + be + "<sup>" + k + "</sup> mod " + p + " = " + bk + "; t = " + bk + " · " + m + " mod " + p },
              t],
            ["Giải mã", { html: "r<sup>a</sup> = " + r + "<sup>" + a + "</sup> mod " + p }, ra], ["",
              { html: "(r<sup>a</sup>)<sup>−1</sup> mod " + p + " (Euclid mở rộng)" },
              rai], ["", { html: "m = t · (r<sup>a</sup>)<sup>−1</sup> = " + t + " · " + rai + " mod " + p },
                { html: "<b>" + md + "</b> " + (md === m ? "✓" : "✗") }]],
              { mono: true, cls: "tight", rowCls: (x, i) => (i === 5 ? "hi" : null) }),
          ui.note("Vì sao đúng: t·r<sup>−a</sup> ≡ β<sup>k</sup>m·(α<sup>k</sup>)<sup>−a</sup> ≡ α<sup>ak</sup>m·α<sup>−ak</sup> ≡ m. β<sup>k</sup> = α<sup>ak</sup> là \"khóa DH dùng một lần\" che m. Bản mã dài gấp đôi bản rõ; cùng m với k′ = " + (k + 1n) + " cho bản mã khác: (" + r2 + ", " + t2 + ") — <b>xác suất</b>, an toàn ngữ nghĩa dưới DDH.",
            "mut"),
          ui.title("Kiểm tra α là căn nguyên thủy"), ...primRootView(al, p)];
        /* dùng lại k */
        if (m1 == null || m2 == null || m1 >= p || m2 >= p || m1 === 0n) kids.push(bad("m₁, m₂ phải là số nguyên < p, m₁ ≠ 0."));
        else { const t1 = bk * m1 % p, tt2 = bk * m2 % p, t1i = math.modinv(t1, p), eve = t1i ? tt2 * t1i % p * m1 % p : null;
          kids.push(ui.panel("Dùng lại k: Eve biết m₁ suy ra m₂ (slide 6.3.9)",
            ui.readouts([{ k: "t₁ = β^k·m₁", v: t1, kind: "ct" }, { k: "t₂ = β^k·m₂", v: tt2, kind: "ct" }, { k: "Eve tính m₂",
              v: eve == null ? "—" : eve, kind: "eve", big: true }]),
            ui.steps([{ t: "Cùng k ⇒ cùng r = " + r + " (Eve nhận ra ngay) và cùng β<sup>k</sup> = " + bk + " ⇒ t₁/t₂ = m₁/m₂",
              r: "t₁ = " + t1 + ", t₂ = " + tt2 }, { t: "t₁<sup>−1</sup> mod p", r: String(t1i) }, { t: "m₂ = t₂ · t₁<sup>−1</sup> · m₁ mod p = " + tt2 + " · " + t1i + " · " + m1 + " mod " + p,
              r: "<b>" + eve + "</b>" + (eve === m2 ? " = m₂ ✓ lộ thông điệp!" : ""), hi: true }]),
            ui.note("Tuyệt đối không dùng lại k. Cũng vì đồng cấu nhân: (r₁r₂, t₁t₂) là bản mã của m₁m₂ → ElGamal chỉ bảo mật, không bảo đảm toàn vẹn.",
              "eve"))); }
        out.render(kids);
      }
      draw(); pane.appendChild(root);
    } },

  /* ------------------------------------------------------------------ 5. Hàm băm ------------------------------------------------------------------ */
  { id: "hash", title: "Hàm băm SHA-256", intro: "SHA-256 cài thuần JS: hiệu ứng tuyết lở, khối đệm, nghịch lý ngày sinh, tấn công ngày sinh mô phỏng và bằng chứng công việc (slide 6.2.1 – 6.2.13).",
    build(pane) {
      const { root, view } = ui.sim({ wide: true });
      /* --- tuyết lở + đệm --- */
      const oAv = ui.slot(), oPad = ui.slot();
      const FA = fields("m3hs-av", [{ k: "s1", label: "Thông điệp 1", v: "abc" }, { k: "s2", label: "Thông điệp 2", v: "abd" }], drawAv);
      function drawAv() {
        const s1 = FA.S.s1, s2 = FA.S.s2, h1 = sha256hex(s1), h2 = sha256hex(s2), b1 = hex2bits(h1), b2 = hex2bits(h2);
        const kinds = [], chars = []; let diff = 0;
        for (let i = 0; i < 256; i++) { const d = b1[i] !== b2[i]; if (d) diff++; kinds.push(d ? "eve" : null); chars.push(b2[i]); }
        const u1 = enc.encode(s1), u2 = enc.encode(s2); let inDiff = null;
        if (u1.length === u2.length) { inDiff = 0; for (let i = 0; i < u1.length; i++) inDiff += math.popcount(u1[i] ^ u2[i]); }
        oAv.render(ui.readouts([{ k: "SHA-256(\"" + esc(s1) + "\")", v: LAB.grp(h1, 8, " "), kind: "pt" },
          { k: "SHA-256(\"" + esc(s2) + "\")",
          v: LAB.grp(h2, 8, " "), kind: "ct" }]),
          ui.bits(chars, { group: 8, label: "H(M₂) — đỏ: bit khác H(M₁)", kinds }),
          ui.readouts([{ k: "Số bit khác nhau ở đầu ra", v: diff + " / 256 (" + LAB.pct(diff / 256) + ")", kind: "eve", big: true },
            { k: "Khác nhau ở đầu vào", v: inDiff == null ? "độ dài khác nhau" : inDiff + " bit",
              kind: "key" }, { k: "Kỳ vọng với hàm lý tưởng",
            v: "≈ 128 bit", kind: "aqua" }]),
          ui.note("Hiệu ứng tuyết lở: đổi vài bit đầu vào → ≈ 50 % bit đầu ra thay đổi, không đoán được quan hệ giữa hai giá trị băm. Slide: \"abc\"→\"abd\" đổi 122 bit; \"hello\"→\"hell0\" đổi 139 bit.",
            "mut"));
        drawPad(s1);
      }
      function drawPad(s) {
        const bytes = enc.encode(s), padded = shaPad(bytes), L = bytes.length, bits = L * 8, zeros = ((448 - (bits + 1)) % 512 + 512) % 512,
          blocks = padded.length / 64;
        const rows = []; const show = Math.min(padded.length, 4 * 64);
        for (let r = 0; r < show; r += 16) rows.push([(r) + "–" + (r + 15), ...Array.from(padded.slice(r, r + 16)).map((v,
          j) => { const i = r + j; const cls = i < L ? "pt-c" : i === L ? "key-c" : i >= padded.length - 8 ? "ct-c" : null; return { html: v.toString(16).padStart(2,
          "0"), cls }; })]);
        oPad.render(ui.readouts([{ k: "Độ dài thông điệp", v: L + " byte = " + bits + " bit", kind: "pt" }, { k: "Bit 1 + số bit 0 thêm",
          v: "1 + " + zeros, kind: "key" }, { k: "64 bit cuối (độ dài)", v: "0x" + bits.toString(16).toUpperCase(), kind: "ct" },
          { k: "Số khối 512 bit", v: blocks, kind: "aqua" }]),
          ui.table(["Byte", ...Array.from({ length: 16 }, (_, i) => "+" + i)], rows, { mono: true, cls: "tight" }),
          padded.length > show ? ui.note("Chỉ hiện 4 khối đầu trong " + blocks + " khối.", "mut") : null,
          ui.note("Thông điệp (xanh) ‖ byte <span class='key-c'>80</span> (bit 1) ‖ bit 0 ‖ độ dài 64 bit big-endian (tím). Độ dài sau đệm ≡ 0 (mod 512). Với \"abc\": 61 62 63 80 00 … 18 (slide 6.2.7).",
            "mut"));
      }
      /* --- nghịch lý ngày sinh --- */
      const oBd = ui.slot(); const Sb = { n: 32 };
      const pts = []; { let P = 1; for (let k = 1; k <= 70; k++) { P *= (1 - (k - 1) / 365); pts.push([k, 1 - P]); } }
      const box = chart.box(b => chart.line(b, { series: [{ name: "P(k), N = 365", color: "pt", points: pts, area: true }],
        xlabel: "k (số người)", ylabel: "P(có hai người trùng)", xmin: 0, xmax: 70, ymin: 0, ymax: 1, fmtY: v => Math.round(100 * v) + " %",
        fmtTip: v => (100 * v).toFixed(1) + " %", vlines: [{ x: 23, label: "k = 23 → 50,7 %", color: LAB.colors().key }],
        hlines: [{ y: 0.5, label: "50 %" }], aspect: 0.42 }));
      const rN = ui.range({ id: "m3hs-nbits", label: "Độ dài băm n (bit), N = 2^n", min: 8,
        max: 256, step: 8, value: 32, onInput: v => { Sb.n = v; drawBd(); } });
      function drawBd() {
        const n = Sb.n, k50 = 1.1774 * Math.sqrt(pow2(n));
        const tb = [10, 20, 23, 30, 41, 57, 70].map(k => [k, (100 * pts[k - 1][1]).toFixed(1).replace(".", ",") + " %"]);
        oBd.render(ui.table(["k người", ...tb.map(r => r[0])], [["P(trùng)", ...tb.map(r => ({ html: r[0] === 23 ? "<span class='hl'>" + r[1] + "</span>" : r[1] }))]],
          { mono: true, cls: "tight" }),
          ui.readouts([{ k: "N = 2^" + n, v: h("span", { html: sci(pow2(n)) }), kind: "key" }, { k: "k cho 50 % ≈ 1,1774·√N",
            v: h("span", { html: sci(k50) }), kind: "eve", big: true }, { k: "2^(n/2)", v: h("span", { html: sci(pow2(n / 2)) }),
            kind: "aqua" }]),
          ui.note("Với 365 ngày chỉ cần 23 người (√365 ≈ 19, cùng bậc). Hàm băm n bit: va chạm sau ≈ 2<sup>n/2</sup> lần băm → SHA-256 cho an toàn 128 bit; MD5 (2<sup>64</sup>) và SHA-1 (2<sup>80</sup>) đã bị phá thực tế. <b>Bài tập 2.1:</b> băm 32 bit → ≈ 77 000 thông điệp.",
            "mut"));
      }
      /* --- tấn công ngày sinh mô phỏng --- */
      const oBa = ui.slot(); const Sa = { t: 16, run: 0, prefix: "COM608-" };
      const rT = ui.range({ id: "m3hs-t", label: "Số bit đầu t của SHA-256", min: 8, max: 24,
        step: 1, value: 16, onInput: v => { Sa.t = v; drawBa(); } });
      const fPre = ui.field({ id: "m3hs-bpre", label: "Tiền tố thông điệp", value: "COM608-",
        mono: true, onInput: v => { Sa.prefix = v; Sa.run = 0; drawBa(); } });
      function drawBa() {
        const t = Sa.t, pre = Sa.prefix + (Sa.run ? "r" + Sa.run + "-" : ""), seen = new Map(),
          LIM = 60000, nh = Math.ceil(t / 4); let found = null, i = 0;
        for (; i < LIM; i++) { const hx = sha256hex(pre + i); const key = parseInt(hx.slice(0,
          nh), 16) >>> (nh * 4 - t); if (seen.has(key)) { found = { i,
          j: seen.get(key), hx, hy: sha256hex(pre + seen.get(key)) }; break; } seen.set(key, i); }
        const cnt = found ? found.i + 1 : LIM, exp = Math.sqrt(Math.PI / 2 * pow2(t));
        oBa.render(ui.readouts([{ k: "Số lần băm đến khi va chạm", v: found ? cnt : "> " + LIM, kind: "eve", big: true },
          { k: "2^(t/2)", v: Math.round(pow2(t / 2)), kind: "aqua" }, { k: "Kỳ vọng √(π/2 · 2^t)", v: Math.round(exp), kind: "key" },
          { k: "Tỷ lệ so với 2^(t/2)", v: found ? (cnt / pow2(t / 2)).toFixed(2).replace(".", ",") + "×" : "—", kind: "pt" }]),
          found ? ui.table(["Thông điệp", "SHA-256 (" + t + " bit đầu tô vàng)"], [[esc(pre + found.j),
            { html: "<span class='hl'>" + found.hy.slice(0,
            nh) + "</span>" + found.hy.slice(nh) }], [esc(pre + found.i), { html: "<span class='hl'>" + found.hx.slice(0,
              nh) + "</span>" + found.hx.slice(nh) }]],
            { mono: true, cls: "tight" }) : bad("Không gặp va chạm trong " + LIM + " lần băm."),
          ui.note("Băm \"" + esc(pre) + "0\", \"" + esc(pre) + "1\", … và lưu " + t + " bit đầu; dừng khi một giá trị lặp lại. Số lần băm ~2<sup>t/2</sup> chứ không phải 2<sup>t</sup> — đó là nghịch lý ngày sinh (bài tập lập trình: t = 32 → ≈ 2<sup>16</sup>). Lưu ý: với t ≤ 8 chỉ có " + pow2(t) + " giá trị nên va chạm cực nhanh.",
            "mut"));
      }
      /* --- bằng chứng công việc --- */
      const oPw = ui.slot(); const Sp = { d: 12, prefix: "COM608-", timer: null, nonce: 0, best: 0, bestHex: "" };
      const rD = ui.range({ id: "m3hs-d", label: "Số bit 0 đầu d", min: 1, max: 20, step: 1,
        value: 12, onInput: v => { Sp.d = v; stopPow(); drawPw(null); } });
      const fPw = ui.field({ id: "m3hs-ppre", label: "Tiền tố", value: "COM608-", mono: true,
        onInput: v => { Sp.prefix = v; stopPow(); drawPw(null); } });
      const btnPw = ui.btn("Tìm nonce", () => startPow(), "pri");
      function stopPow() { if (Sp.timer) { clearTimeout(Sp.timer); Sp.timer = null; } btnPw.textContent = "Tìm nonce"; }
      function startPow() {
        if (Sp.timer) { stopPow(); return; }
        Sp.nonce = 0; Sp.best = 0; Sp.bestHex = ""; btnPw.textContent = "Dừng";
        const LIM = 200000, step = () => {
          const end = Math.min(Sp.nonce + 2500, LIM); let hit = null;
          for (; Sp.nonce < end; Sp.nonce++) { const hx = sha256hex(Sp.prefix + Sp.nonce); const z = leadZeroBits(hx); if (z > Sp.best) { Sp.best = z; Sp.bestHex = hx; Sp.bestNonce = Sp.nonce; } if (z >= Sp.d) { hit = { nonce: Sp.nonce,
            hx }; Sp.nonce++; break; } }
          drawPw(hit);
          if (hit || Sp.nonce >= LIM) { stopPow(); if (!hit) oPw.appendChild(bad("Không tìm thấy trong " + LIM + " lần băm (kỳ vọng 2<sup>" + Sp.d + "</sup> = " + sci(pow2(Sp.d)) + ") — giảm d hoặc đổi tiền tố.")); return; }
          Sp.timer = setTimeout(step, 0);
        };
        Sp.timer = setTimeout(step, 0);
      }
      function drawPw(hit) {
        const nh = Math.ceil(Sp.d / 4), mark = hx => "<span class='hl'>" + hx.slice(0, nh) + "</span>" + hx.slice(nh);
        oPw.render(ui.readouts([{ k: "Đã thử", v: Sp.nonce.toLocaleString("vi-VN"), kind: "pt" },
          { k: "Kỳ vọng 2^d", v: Math.round(pow2(Sp.d)).toLocaleString("vi-VN"),
          kind: "aqua" }, { k: "Tiến độ", v: LAB.pct(Math.min(1, Sp.nonce / pow2(Sp.d)), 0), kind: "key" },
            { k: hit ? "Nonce tìm được" : "Tốt nhất tới nay",
          v: hit ? hit.nonce : (Sp.bestHex ? Sp.bestNonce + " (" + Sp.best + " bit 0)" : "—"), kind: hit ? "ok" : "key",
          big: !!hit }]),
          (hit || Sp.bestHex) ? ui.table(["Thông điệp", "SHA-256"], [[esc(Sp.prefix + (hit ? hit.nonce : Sp.bestNonce)),
            { html: mark(hit ? hit.hx : Sp.bestHex) }]], { mono: true, cls: "tight" }) : null,
          ui.note("Blockchain / PoW: tìm nonce để SHA-256(tiền tố ‖ nonce) bắt đầu bằng d bit 0 — trung bình 2<sup>d</sup> lần băm; kiểm tra chỉ cần 1 lần băm. Slide 6.2.13: \"COM608-36217\" → 0000e3e0… (d = 16). Chạy theo lô 2 500 băm/nhịp để trang không treo.",
            "mut"));
      }
      view.append(
        ui.panel("Hiệu ứng tuyết lở (slide 6.2.1, 6.2.12)", h("div", { class: "row" }, ...FA.els),
          ui.presets([{ label: "\"abc\" / \"abd\" → 122 bit",
          apply: () => FA.set({ s1: "abc", s2: "abd" }) }, { label: "\"hello\" / \"hell0\" → 139 bit", apply: () => FA.set({ s1: "hello",
          s2: "hell0" }) }, { label: "\"\" / \"a\"", apply: () => FA.set({ s1: "", s2: "a" }) }, { label: "\"123456\" (mật khẩu yếu)",
          apply: () => FA.set({ s1: "123456", s2: "123457" }) }]), oAv),
        h("div", { class: "cols" },
          ui.panel("Đệm Merkle–Damgård của thông điệp 1 (slide 6.2.6 – 6.2.7; bài tập 2.2: \"hello\")", oPad),
          ui.panel("Nghịch lý ngày sinh (slide 6.2.4)", box, rN, oBd)),
        h("div", { class: "cols" },
          ui.panel("Tấn công ngày sinh mô phỏng trên t bit đầu (slide 6.2.5)", h("div", { class: "row" },
            fPre, ui.btn("Chạy lại với tiền tố khác",
            () => { Sa.run++; drawBa(); }, "sm")), rT, oBa),
          ui.panel("Bằng chứng công việc (Proof-of-Work, slide 6.2.13)", h("div", { class: "row" },
            fPw, btnPw, ui.btn("d = 16, \"COM608-\" (slide)",
            () => { Sp.prefix = "COM608-"; fPw.input.value = "COM608-"; Sp.d = 16; rD.set(16); stopPow(); drawPw(null); },
            "sm")), rD, oPw)),
        ui.note("Kiểm chứng cài đặt: SHA-256(\"abc\") = ba7816bf…15ad, SHA-256(\"\") = e3b0c442…b855, SHA-256(\"hello\") = 2cf24dba…9824 (so với hashlib). Ba tính chất: kháng tiền ảnh (2<sup>n</sup>), tiền ảnh thứ hai (2<sup>n</sup>), va chạm (2<sup>n/2</sup>).",
          "key"));
      drawAv(); drawBd(); drawBa(); drawPw(null); pane.appendChild(root);
    } },

  /* ------------------------------------------------------------------ 6. Chữ ký số ------------------------------------------------------------------ */
  { id: "sign", title: "Chữ ký số", intro: "Chữ ký RSA (giả mạo tồn tại khi không băm), lược đồ ElGamal, DSA số nhỏ và thảm họa dùng lại k (slide 6.4.3 – 6.4.8, 6.4.11).",
    build(pane) {
      const { root, view } = ui.sim({ wide: true });
      /* (a) RSA */
      const oA = ui.slot();
      const FA = fields("m3sg-r", [{ k: "n", label: "n", v: 33 }, { k: "e", label: "e", v: 3 }, { k: "d", label: "d",
        v: 7 }, { k: "h", label: "h = H(m)", v: 5 }, { k: "h2", label: "Sửa thông điệp sau khi ký: h′", v: 6 }, { k: "sf",
        label: "Giả mạo tồn tại: chọn s", v: 5 }], drawA);
      function drawA() {
        const n = pint(FA.S.n), e = pint(FA.S.e), d = pint(FA.S.d), hv = pint(FA.S.h), h2 = pint(FA.S.h2), sf = pint(FA.S.sf);
        if ([n, e, d, hv, h2, sf].some(x => x == null) || n < 2n) return oA.render(bad("Nhập n, e, d, h, h′, s là số nguyên."));
        if (hv >= n || h2 >= n) return oA.render(bad("h, h′ phải < n."));
        const kids = [];
        if (n < 1000000000000n) { const fs = math.factor(n); if (fs.length === 2 && fs[0] !== fs[1]) { const phi = (fs[0] - 1n) * (fs[1] - 1n); if (e * d % phi !== 1n) kids.push(bad("n = " + fs[0] + "·" + fs[1] + ", φ(n) = " + phi + " nhưng e·d mod φ(n) = " + (e * d % phi) + " ≠ 1 → cặp (e, d) sai, xác minh sẽ thất bại.")); } }
        const s = math.powmod(hv, d, n), v = math.powmod(s, e, n), v2 = math.powmod(s, e, n), mf = math.powmod(sf, e, n);
        kids.push(ui.readouts([{ k: "s = h^d mod n (Bob ký)", v: s, kind: "ct", big: true }, { k: "s^e mod n",
          v: v + (v === hv ? " = h ✓" : " ≠ h ✗"),
          kind: v === hv ? "ok" : "eve" }]),
          ui.steps([{ t: "Ký: s = " + hv + "<sup>" + d + "</sup> mod " + n, r: String(s) }, { t: "Xác minh: s<sup>e</sup> = " + s + "<sup>" + e + "</sup> mod " + n,
            r: v + (v === hv ? " = h ✓ hợp lệ" : " ✗"), hi: v === hv },
            { t: "Sửa thông điệp sau khi ký: h′ = " + h2 + " nhưng s<sup>e</sup> mod n vẫn = " + v2,
              r: v2 === h2 ? "h′ = h → không đổi" : "<span class='eve-c'>" + v2 + " ≠ h′ = " + h2 + " → chữ ký <b>mất hiệu lực</b> ✗</span>" }]),
          ui.panel("Giả mạo tồn tại khi ký trực tiếp m (không băm)", ui.steps([{ t: "Eve chọn s = " + sf + " bất kỳ, đặt m = s<sup>e</sup> mod n = " + sf + "<sup>" + e + "</sup> mod " + n,
            r: "m = <b>" + mf + "</b>" }, { t: "Cặp (m, s) = (" + mf + ", " + sf + ") qua xác minh dù Eve không có d",
              r: "s<sup>e</sup> mod n = " + mf + " = m ✓ (với Bob đây là chữ ký \"hợp lệ\")",
            hi: true }]),
            ui.note("Eve không kiểm soát được m (vô nghĩa) — nhưng nếu ký H(m) thì phải tìm tiền ảnh của m, không làm được. Thực tế: RSA-PSS. Slide 6.4.3: n = 33, e = 3, s = 5 ⇒ m = 26.",
              "eve")));
        oA.render(kids);
      }
      /* (b) ElGamal */
      const oB = ui.slot();
      const FB = fields("m3sg-e", [{ k: "p", label: "p", v: 467 }, { k: "al", label: "α", v: 2 }, { k: "a", label: "a (bí mật)",
        v: 127 }, { k: "m", label: "m", v: 100 }, { k: "k", label: "k, gcd(k, p−1) = 1", v: 213 }], drawB);
      function drawB() {
        const p = pint(FB.S.p), al = pint(FB.S.al), a = pint(FB.S.a), m = pint(FB.S.m), k = pint(FB.S.k);
        if ([p, al, a, m, k].some(x => x == null) || p < 3n || !math.isPrime(p) || p > 1000000000000n) return oB.render(bad("p phải là số nguyên tố ≤ 10¹²; α, a, m, k là số nguyên."));
        if (al <= 1n || al >= p || a < 1n || a >= p - 1n || k < 1n || k >= p - 1n) return oB.render(bad("Cần 1 < α < p, 1 ≤ a, k ≤ p − 2."));
        const g = math.gcd(k, p - 1n);
        if (g !== 1n) return oB.render(bad("gcd(k, p − 1) = gcd(" + k + ", " + (p - 1n) + ") = " + g + " ≠ 1 → k không khả nghịch mod (p − 1); chọn k khác."));
        const be = math.powmod(al, a, p), r = math.powmod(al, k, p), ki = math.modinv(k, p - 1n), s = math.mod(ki * (m - a * r),
          p - 1n), v1 = math.powmod(be, r, p) * math.powmod(r, s, p) % p, v2 = math.powmod(al, m, p);
        oB.render(ui.readouts([{ k: "β = α^a mod p", v: be, kind: "aqua" }, { k: "Chữ ký (r, s)", v: "(" + r + ", " + s + ")",
          kind: "ct", big: true }, { k: "v₁ = β^r·r^s mod p", v: v1, kind: v1 === v2 ? "ok" : "eve" }, { k: "v₂ = α^m mod p",
          v: v2, kind: v1 === v2 ? "ok" : "eve" }]),
          ui.table(["Bước", "Phép tính", "Kết quả"], [["Khóa", { html: "β = " + al + "<sup>" + a + "</sup> mod " + p }, be],
            ["Chọn k", "k = " + k + ", gcd(" + k + ", " + (p - 1n) + ") = 1", "–"], ["r", { html: al + "<sup>" + k + "</sup> mod " + p },
            r],
            [{ html: "k<sup>−1</sup>" }, { html: k + "<sup>−1</sup> mod " + (p - 1n) + " (theo mod p − 1!)" },
              ki], ["s", { html: ki + "·(" + m + " − " + a + "·" + r + ") mod " + (p - 1n) },
              s], ["v₁", { html: be + "<sup>" + r + "</sup> · " + r + "<sup>" + s + "</sup> mod " + p },
                v1], ["v₂", { html: al + "<sup>" + m + "</sup> mod " + p },
              { html: v2 + (v1 === v2 ? " ✓" : " ✗") }]], { mono: true, cls: "tight", rowCls: (x, i) => (i === 4 ? "hi" : i === 6 ? (v1 === v2 ? "good" : "bad") : null) }),
          ui.note("Chứng minh: s·k ≡ m − a·r (mod p − 1) ⇒ m ≡ a·r + k·s ⇒ α<sup>m</sup> ≡ (α<sup>a</sup>)<sup>r</sup>(α<sup>k</sup>)<sup>s</sup> = β<sup>r</sup>r<sup>s</sup>. Nghịch đảo và phép trừ theo mod (p − 1), lũy thừa theo mod p.",
            "mut"));
      }
      /* (c) DSA */
      const oC = ui.slot();
      const FC = fields("m3sg-d", [{ k: "p", label: "p", v: 607 }, { k: "q", label: "q | p − 1", v: 101 }, { k: "g",
        label: "g (bậc q)", v: 64 }, { k: "x", label: "x (bí mật)", v: 17 }, { k: "H", label: "H(m)", v: 41 }, { k: "k",
        label: "k", v: 23 }], drawC);
      function drawC() {
        const p = pint(FC.S.p), q = pint(FC.S.q), g = pint(FC.S.g), x = pint(FC.S.x), Hm = pint(FC.S.H), k = pint(FC.S.k);
        if ([p, q, g, x, Hm, k].some(v => v == null) || p > 1000000000000n || !math.isPrime(p) || !math.isPrime(q)) return oC.render(bad("p, q phải là số nguyên tố (p ≤ 10¹²); g, x, H, k là số nguyên."));
        const errs = [];
        if ((p - 1n) % q !== 0n) errs.push("q = " + q + " không chia hết p − 1 = " + (p - 1n) + "."); else if (math.powmod(g,
          q, p) !== 1n || g <= 1n) errs.push("g = " + g + " không có bậc q (g<sup>q</sup> mod p = " + math.powmod(g, q, p) + " ≠ 1).");
        if (x < 1n || x >= q) errs.push("0 < x < q."); if (k < 1n || k >= q) errs.push("0 < k < q.");
        if (errs.length) return oC.render(bad(errs.join("<br>")));
        const y = math.powmod(g, x, p), gk = math.powmod(g, k, p), r = gk % q, ki = math.modinv(k, q), s = ki * (Hm + x * r) % q;
        if (r === 0n || s === 0n) return oC.render(bad("r hoặc s = 0 → phải chọn k khác."));
        const w = math.modinv(s, q), u1 = Hm * w % q, u2 = r * w % q, gu = math.powmod(g, u1, p) * math.powmod(y, u2, p) % p, v = gu % q;
        oC.render(ui.readouts([{ k: "y = g^x mod p", v: y, kind: "aqua" }, { k: "Chữ ký (r, s)", v: "(" + r + ", " + s + ")",
          kind: "ct", big: true }, { k: "v", v: v + (v === r ? " = r ✓" : " ≠ r ✗"), kind: v === r ? "ok" : "eve" }]),
          h("div", { class: "stack" },
            ui.table(["Ký H = " + Hm + ", k = " + k, "Kết quả"], [[{ html: "g<sup>k</sup> mod p = " + g + "<sup>" + k + "</sup> mod " + p },
              gk], [{ html: "r = " + gk + " mod " + q }, r], [{ html: "k<sup>−1</sup> mod " + q }, ki],
                [{ html: "s = " + ki + "·(" + Hm + " + " + x + "·" + r + ") mod " + q },
              s]], { mono: true, cls: "tight", rowCls: (z, i) => (i === 3 ? "hi" : null) }),
            ui.table(["Xác minh (r, s) = (" + r + ", " + s + ")", "Kết quả"], [[{ html: "w = s<sup>−1</sup> mod " + q }, w],
              [{ html: "u₁ = H·w = " + Hm + "·" + w + " mod " + q }, u1], [{ html: "u₂ = r·w = " + r + "·" + w + " mod " + q },
              u2], [{ html: "g<sup>u₁</sup>·y<sup>u₂</sup> mod p = " + math.powmod(g, u1, p) + "·" + math.powmod(y, u2, p) + " mod " + p },
              gu], [{ html: "v = " + gu + " mod " + q }, { html: v + (v === r ? " = r ✓" : " ✗") }]], { mono: true, cls: "tight",
              rowCls: (z, i) => (i === 4 ? (v === r ? "good" : "bad") : null) })),
          ui.note("Tính trong nhóm con bậc q → chữ ký chỉ 2 × |q| bit dù p lớn; dấu \"+\" thay cho \"−\" của ElGamal. FIPS 186-5 (2023) không còn dùng DSA tạo chữ ký mới (thay bằng ECDSA, EdDSA).",
            "mut"));
      }
      /* (d) dùng lại k */
      const oD = ui.slot();
      const FD = fields("m3sg-k", [{ k: "q", label: "q", v: 101 }, { k: "r", label: "r (chung)", v: 2 }, { k: "H1", label: "H₁",
        v: 41 }, { k: "s1", label: "s₁", v: 34 }, { k: "H2", label: "H₂", v: 77 }, { k: "s2", label: "s₂", v: 18 }], drawD);
      function drawD() {
        const q = pint(FD.S.q), r = pint(FD.S.r), H1 = pint(FD.S.H1), s1 = pint(FD.S.s1), H2 = pint(FD.S.H2), s2 = pint(FD.S.s2);
        if ([q, r, H1, s1, H2, s2].some(v => v == null) || q < 2n) return oD.render(bad("Nhập sáu số nguyên."));
        const ds = math.mod(s1 - s2, q), dsi = math.modinv(ds, q), ri = math.modinv(r, q);
        if (dsi == null || ri == null) return oD.render(bad("s₁ − s₂ hoặc r không khả nghịch mod q (s₁ = s₂ ⇒ H₁ = H₂)."));
        const k = math.mod((H1 - H2) * dsi, q), x = math.mod((s1 * k - H1) * ri, q);
        oD.render(ui.readouts([{ k: "k (số ngẫu nhiên bị lộ)", v: k, kind: "eve" }, { k: "x = khóa bí mật bị lộ",
          v: x, kind: "eve", big: true }]),
          ui.steps([{ t: "Cùng k ⇒ cùng r = " + r + ": s₁ = k<sup>−1</sup>(H₁ + xr), s₂ = k<sup>−1</sup>(H₂ + xr) ⇒ s₁ − s₂ = k<sup>−1</sup>(H₁ − H₂)",
            r: "s₁ − s₂ ≡ " + ds + " (mod " + q + ")" },
            { t: "(s₁ − s₂)<sup>−1</sup> mod q = " + ds + "<sup>−1</sup> mod " + q, r: String(dsi) },
              { t: "k = (H₁ − H₂)(s₁ − s₂)<sup>−1</sup> = (" + H1 + " − " + H2 + ")·" + dsi + " mod " + q,
              r: "<b>" + k + "</b>", hi: true },
            { t: "x = (s₁k − H₁)·r<sup>−1</sup> = (" + s1 + "·" + k + " − " + H1 + ")·" + ri + " mod " + q,
              r: "<b>" + x + "</b> ← khóa bí mật", hi: true }]),
          ui.note("Sự cố thật: Sony PS3 (2010) dùng k cố định trong ECDSA; ví Bitcoin Android (2013). Phòng chống: k tất định theo RFC 6979, hoặc EdDSA. Với tham số mục (c): k = 23, x = 17.",
            "eve"));
      }
      const fromC = () => { const p = pint(FC.S.p), q = pint(FC.S.q), g = pint(FC.S.g), x = pint(FC.S.x), k = pint(FC.S.k),
        H1 = pint(FC.S.H); if ([p, q, g, x, k, H1].some(v => v == null) || !q || !k) return; const H2 = pint(FD.S.H2) == null ? 77n : pint(FD.S.H2); const r = math.powmod(g,
        k, p) % q, ki = math.modinv(k, q); if (ki == null) return; FD.set({ q, r, H1, s1: ki * (H1 + x * r) % q,
          H2, s2: ki * (H2 + x * r) % q }); };
      view.append(h("div", { class: "cols" },
        ui.panel("(a) Chữ ký RSA (slide 6.4.3; bài tập 4.1)", h("div", { class: "row" }, ...FA.els),
          ui.presets([{ label: "n = 33, e = 3, d = 7, h = 5 → s = 14",
          apply: () => FA.set({ n: 33, e: 3, d: 7, h: 5, h2: 6, sf: 5 }) }, { label: "h = 4 → s = 16 (slide)", apply: () => FA.set({ n: 33,
          e: 3, d: 7, h: 4, h2: 5, sf: 5 }) }, { label: "n = 3233, e = 17, d = 2753, m = 100 → 1391 (slide 5.4.9)",
            apply: () => FA.set({ n: 3233,
          e: 17, d: 2753, h: 100, h2: 101, sf: 5 }) }, { label: "BTVN: h = 123", apply: () => FA.set({ n: 3233, e: 17, d: 2753,
          h: 123, h2: 124, sf: 7 }) }]), oA),
        ui.panel("(b) Lược đồ chữ ký ElGamal (slide 6.4.4 – 6.4.5; bài tập 4.2)", h("div", { class: "row" }, ...FB.els),
          ui.presets([{ label: "p = 467, α = 2, a = 127, m = 100, k = 213 → (29, 51)", apply: () => FB.set({ p: 467, al: 2,
          a: 127, m: 100, k: 213 }) }, { label: "Bài tập 4.2: p = 23, α = 5, a = 6, m = 7, k = 5", apply: () => FB.set({ p: 23,
          al: 5, a: 6, m: 7, k: 5 }) }]), oB)),
        h("div", { class: "cols" },
          ui.panel("(c) DSA với số nhỏ (slide 6.4.7; bài tập 4.3)", h("div", { class: "row" }, ...FC.els),
            ui.presets([{ label: "H = 41, k = 23 → (2, 34)",
            apply: () => FC.set({ p: 607, q: 101, g: 64, x: 17, H: 41, k: 23 }) }, { label: "H = 77, k = 23 → (2, 18)",
              apply: () => FC.set({ p: 607,
            q: 101, g: 64, x: 17, H: 77, k: 23 }) }, { label: "Bài tập 4.3: H = 77, k = 30", apply: () => FC.set({ p: 607,
            q: 101, g: 64, x: 17, H: 77, k: 30 }) }]), oC),
          ui.panel("(d) Thảm họa dùng lại k trong DSA (slide 6.4.8; bài tập 4.4)", h("div", { class: "row" }, ...FD.els),
            h("div", { class: "row" }, ui.btn("(2, 34) cho H₁ = 41 và (2, 18) cho H₂ = 77", () => FD.set({ q: 101, r: 2, H1: 41,
            s1: 34, H2: 77, s2: 18 }), "sm"), ui.btn("Lấy hai chữ ký từ khối (c) với cùng k", fromC, "sm")), oD)),
        ui.panel("So sánh các lược đồ chữ ký số (slide 6.4.11)", ui.table(["Lược đồ", "Bài toán khó",
          "Khóa công khai", "Chữ ký", "Ghi chú"], [
          ["RSA-PSS (3072)", "Phân tích thừa số", "384 byte", "384 byte", "Xác minh rất nhanh"], ["DSA", "DLP", "~384 byte",
            "64 byte", "Không dùng cho chữ ký mới"], ["ECDSA P-256", "ECDLP", "64 byte", "64 byte", "Cần k ngẫu nhiên tốt"],
          ["Ed25519", "ECDLP", "32 byte", "64 byte", "k tất định, nhanh"], ["ML-DSA-44", "Lưới (MLWE)", "1312 byte", "2420 byte",
            "Hậu lượng tử (FIPS 204)"]], { cls: "tight", rowCls: (r, i) => (i === 1 ? "bad" : i === 3 ? "good" : null) }),
          ui.note("Mô hình \"băm rồi ký\" (slide 6.4.2): ký H(m) để chữ ký ngắn, nhanh, chống giả mạo tồn tại và tấn công đồng cấu; H phải kháng va chạm (tấn công ngày sinh ở tab Hàm băm). Xu hướng: Ed25519/ECDSA và chuẩn bị ML-DSA.",
            "key")));
      drawA(); drawB(); drawC(); drawD(); pane.appendChild(root);
    } }
  ]
});
})();
