/* Mô-đun 1 — Số học modulo và các hệ mật mã cổ điển (Bài 1, 2, 3) */
(function () {
"use strict";
const { h, ui, math, txt, chart } = LAB;
const B = math.B;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sup = s => "<sup>" + s + "</sup>";

/* Giải hệ tuyến tính trên GF(2): A (n×m) x = b ; trả về {x, singular, inconsistent} */
function gf2solve(A, b) {
  const n = A.length, m = A[0].length;
  const M = A.map((r, i) => r.concat([b[i]]));
  let row = 0; const piv = [];
  for (let col = 0; col < m && row < n; col++) {
    let p = -1; for (let i = row; i < n; i++) if (M[i][col]) { p = i; break; }
    if (p < 0) continue;
    [M[row], M[p]] = [M[p], M[row]];
    for (let i = 0; i < n; i++) if (i !== row && M[i][col]) for (let j = col; j <= m; j++) M[i][j] ^= M[row][j];
    piv.push(col); row++;
  }
  for (let i = row; i < n; i++) if (M[i][m]) return { x: null, singular: piv.length < m, inconsistent: true };
  if (piv.length < m) return { x: null, singular: true, inconsistent: false };
  const x = new Array(m).fill(0); piv.forEach((c, i) => { x[c] = M[i][m]; });
  return { x, singular: false, inconsistent: false };
}

LAB.module({
  id: "m1",
  tabs: [
  /* ===================================================== 0. MÔ HÌNH HỆ MẬT & TẤN CÔNG (Bài 1) ===================================================== */
  { id: "model", title: "Mô hình & tấn công", intro: "Alice gửi cho Bob qua kênh không an toàn có Eve. Chọn hành vi của Eve và các cơ chế bảo vệ đang bật để thấy mục tiêu nào (bí mật, toàn vẹn, xác thực, chống chối bỏ, sẵn sàng) còn đứng vững (Bài 1, mục 2–7).",
    build(pane) {
      const S = { attack: "eaves", enc: false, mac: false, sig: false, nonce: false, msg: "CHUYEN 100 TRIEU CHO BOB" };
      const { root, ctrl, view } = ui.sim();
      const fMsg = ui.field({ id: "m1mo-msg", label: "Thông điệp của Alice", value: S.msg, mono: true, onInput: v => { S.msg = v; draw(); } });
      const att = ui.seg({ id: "m1mo-att", label: "Hành vi của Eve", options: [["none", "Không"], ["eaves", "Nghe lén"], ["modify", "Sửa đổi"], ["forge", "Giả mạo Alice"], ["replay", "Phát lại"], ["dos", "Từ chối dịch vụ"]], value: S.attack, onChange: v => { S.attack = v; draw(); } });
      const cEnc = ui.check({ id: "m1mo-enc", label: "Mã hóa (AES / RSA)", value: S.enc, onChange: v => { S.enc = v; draw(); } });
      const cMac = ui.check({ id: "m1mo-mac", label: "MAC (HMAC, khóa chung Alice–Bob)", value: S.mac, onChange: v => { S.mac = v; draw(); } });
      const cSig = ui.check({ id: "m1mo-sig", label: "Chữ ký số (khóa bí mật của Alice)", value: S.sig, onChange: v => { S.sig = v; draw(); } });
      const cNon = ui.check({ id: "m1mo-non", label: "Nonce / dấu thời gian trong thông điệp", value: S.nonce, onChange: v => { S.nonce = v; draw(); } });
      const setP = o => { Object.assign(S, o); att.querySelector(".seg").set(S.attack); cEnc.input.checked = S.enc; cMac.input.checked = S.mac; cSig.input.checked = S.sig; cNon.input.checked = S.nonce; draw(); };
      ctrl.append(fMsg, att, h("div", { class: "fld" }, h("label", null, h("b", null, "Cơ chế bảo vệ đang bật")), cEnc, cMac, cSig, cNon), ui.presets([
        { label: "Kênh trần, Eve nghe lén", apply: () => setP({ attack: "eaves", enc: false, mac: false, sig: false, nonce: false }) },
        { label: "Chỉ mã hóa, Eve sửa đổi", apply: () => setP({ attack: "modify", enc: true, mac: false, sig: false, nonce: false }) },
        { label: "Mã hóa + MAC, Alice chối bỏ", apply: () => setP({ attack: "forge", enc: true, mac: true, sig: false, nonce: false }) },
        { label: "Mã hóa + chữ ký, Eve phát lại", apply: () => setP({ attack: "replay", enc: true, mac: false, sig: true, nonce: false }) },
        { label: "Đầy đủ cơ chế", apply: () => setP({ attack: "replay", enc: true, mac: true, sig: true, nonce: true }) }
      ], "Kịch bản"));
      const out = ui.slot(); view.append(out);
      const scramble = s => { const r = LAB.rng(7); return s.split("").map(ch => /[A-Z0-9]/.test(ch) ? "0123456789ABCDEF"[Math.floor(r() * 16)] : ch).join(""); };
      function draw() {
        const m = S.msg.toUpperCase();
        const wire = S.enc ? scramble(m) : m;
        const authOK = S.mac || S.sig;
        /* mục tiêu: [tên, bị vi phạm?, cơ chế chống] */
        const goals = [
          ["Bí mật", S.attack !== "none" && S.attack !== "dos" && !S.enc, "mã hóa"],
          ["Toàn vẹn", S.attack === "modify" && !authOK, "MAC hoặc chữ ký số (mã hóa không đủ: bản mã vẫn sửa được)"],
          ["Xác thực nguồn gốc", (S.attack === "forge" && !authOK) || (S.attack === "replay" && !S.nonce), S.attack === "replay" ? "nonce / dấu thời gian (MAC và chữ ký không ngăn phát lại)" : "MAC hoặc chữ ký số"],
          ["Chống chối bỏ", S.attack !== "dos" && !S.sig, "chữ ký số (MAC không đủ vì Bob cũng giữ khóa nên không chứng minh được với bên thứ ba)"],
          ["Sẵn sàng", S.attack === "dos", "dự phòng, giới hạn tốc độ, giám sát – ngoài phạm vi mật mã"]
        ];
        let eveSees, bobGets, verdict;
        switch (S.attack) {
          case "none": eveSees = "—"; bobGets = m; verdict = ui.note("Không có tấn công: Bob nhận đúng thông điệp.", "ok"); break;
          case "eaves": eveSees = wire; bobGets = m; verdict = S.enc ? ui.note(`Eve chỉ thấy bản mã <span class="ct-c">${esc(wire)}</span>; không có khóa thì vô nghĩa. Tấn công thụ động không để lại dấu vết, nên <b>chỉ mã hóa mới chống được</b>.`, "ok") : ui.note(`Eve đọc được toàn bộ: <span class="eve-c">${esc(m)}</span>. Mất tính bí mật.`, "eve"); break;
          case "modify": { const bad = m.replace(/100/, "900").replace(/BOB/, "EVE"); eveSees = wire; bobGets = authOK ? bad + " ✗ (MAC/chữ ký không khớp – Bob loại bỏ)" : bad; verdict = authOK ? ui.note("Eve sửa được bit trên đường truyền, nhưng thẻ MAC/chữ ký tính trên nội dung gốc không còn khớp ⇒ Bob phát hiện và loại bỏ. Toàn vẹn được bảo đảm.", "ok") : ui.note(S.enc ? "Mã hóa <b>không</b> bảo đảm toàn vẹn: Eve lật bit bản mã (CBC, CTR, OTP đều “dẻo”) và Bob giải mã ra nội dung đã bị sửa mà không hay biết." : "Không có gì ngăn Eve sửa nội dung; Bob nhận thông điệp giả.", "eve"); break; }
          case "forge": eveSees = "(tự tạo)"; bobGets = "CHUYEN 500 TRIEU CHO EVE" + (authOK ? " ✗ (không có khóa để tạo thẻ hợp lệ)" : ""); verdict = authOK ? ui.note("Eve không có khóa MAC chung hay khóa bí mật của Alice nên không tạo được thẻ/chữ ký hợp lệ ⇒ Bob loại bỏ." + (S.sig ? "" : " Lưu ý: với MAC, Bob cũng có khóa nên Alice vẫn <b>chối bỏ</b> được trước trọng tài."), S.sig ? "ok" : "key") : ui.note("Không có xác thực nguồn gốc: Bob không phân biệt được thông điệp của Alice với của Eve.", "eve"); break;
          case "replay": eveSees = wire + " (ghi lại)"; bobGets = m + (S.nonce ? " ✗ (nonce đã dùng – loại bỏ)" : " (lần 2!)"); verdict = S.nonce ? ui.note("Thông điệp phát lại mang nonce/dấu thời gian cũ ⇒ Bob nhận ra và loại bỏ.", "ok") : ui.note("Eve không cần đọc hay sửa: chỉ gửi lại bản ghi hợp lệ (kể cả có MAC/chữ ký) và lệnh chuyển tiền được thực hiện lần nữa. Cần <b>nonce, bộ đếm hoặc dấu thời gian</b>.", "eve"); break;
          case "dos": eveSees = "—"; bobGets = "(không nhận được gì)"; verdict = ui.note("Eve làm nghẽn kênh/máy chủ: mật mã không giúp gì cho tính sẵn sàng – cần phòng thủ theo chiều sâu.", "eve"); break;
        }
        out.render(
          h("div", { class: "flow" },
            h("div", { class: "who a" }, "Alice"), h("div", { class: "arrow" }, "→"), h("div", { class: "who b" }, "Bob"),
            h("div", { class: "msg pt-c" }, esc(m)), h("div", { class: "msg" }, h("span", { class: S.enc ? "ct-c" : "pt-c" }, wire), S.mac ? h("span", { class: "tag key", style: { marginLeft: "6px" } }, "MAC") : null, S.sig ? h("span", { class: "tag key", style: { marginLeft: "6px" } }, "chữ ký") : null, S.nonce ? h("span", { class: "tag aqua", style: { marginLeft: "6px" } }, "nonce") : null), h("div", { class: "msg", html: esc(bobGets).replace("✗", '<span class="eve-c">✗</span>') }),
            h("div", { class: "side" }, "Bản rõ gốc"), h("div", { class: "who e" }, "Eve: " + { none: "theo dõi", eaves: "nghe lén", modify: "sửa đổi", forge: "giả mạo", replay: "phát lại", dos: "làm nghẽn" }[S.attack]), h("div", { class: "side" }, "Bob nhận và kiểm tra"),
            h("div"), h("div", { class: "msg eve-c" }, "Eve thấy: " + eveSees), h("div")),
          verdict,
          ui.table(["Mục tiêu", "Trạng thái", "Cơ chế bảo vệ cần có"], goals.map(g => [g[0], g[1] ? ui.tag("bị vi phạm", "eve") : ui.tag("bảo đảm", "ok"), g[2]]), { cls: "tight wrap", rowCls: r => r[1].classList.contains("eve") ? "bad" : null }),
          h("div", { class: "cols" },
            ui.panel("Mô hình tấn công theo dữ liệu kẻ tấn công có (slide 56)", ui.table(["Mô hình", "Eve có gì", "Ví dụ trong mô-đun này"], [
              ["Chỉ có bản mã (COA)", "Bản mã", "Caesar: vét cạn 25 khóa; thay thế đơn bảng: tần suất; Vigenère: Kasiski"],
              ["Bản rõ đã biết (KPA)", "Một số cặp (bản rõ, bản mã)", "Hill: FRIDAY → CDTHUM lộ khóa; LFSR: 2m bit khóa lộ hệ số"],
              ["Bản rõ chọn trước (CPA)", "Mã hóa bản rõ tùy chọn", "Hill: chọn BA, CA…; textbook RSA tất định (mô-đun 3)"],
              ["Bản mã chọn trước (CCA)", "Giải mã bản mã tùy chọn", "Bleichenbacher lên RSA PKCS#1 v1.5 (mô-đun 3)"]], { cls: "tight wrap" })),
            ui.panel("Nguyên lý Kerckhoffs (slide 41)", ui.note("Độ an toàn chỉ được phụ thuộc vào <b>khóa</b>, không phụ thuộc vào việc giữ bí mật thuật toán. Mọi mô phỏng trong lab này đều công khai thuật toán; câu hỏi luôn là: không gian khóa bao lớn và cấu trúc nào còn lộ ra?", "key"),
              ui.note("“An toàn” chỉ có nghĩa khi nêu rõ mô hình: đối thủ biết gì, làm được gì, với bao nhiêu tài nguyên. One-Time Pad an toàn tuyệt đối (mọi đối thủ); AES, RSA an toàn tính toán (đối thủ bị giới hạn thời gian).", "mut"))));
      }
      draw(); pane.appendChild(root);
    } },

  /* ===================================================== 1. SỐ HỌC MODULO ===================================================== */
  { id: "modular", title: "Số học modulo", intro: "Nhóm Z<sub>n</sub> và U(n), thuật toán Euclid mở rộng tìm nghịch đảo, hàm Euler φ(n) và định lý Euler–Fermat để rút gọn lũy thừa (Bài 2, mục 1; Bài 4, mục 1–2).",
    build(pane) {
      const S = { a: 7, n: 1000, e: 803 };
      const { root, ctrl, view } = ui.sim();
      const fA = ui.field({ id: "m1md-a", label: "a (cơ số / phần tử)", type: "number", value: S.a, min: 0, onInput: v => { S.a = parseInt(v) || 0; draw(); } });
      const fN = ui.field({ id: "m1md-n", label: "n (modulo)", type: "number", value: S.n, min: 2, onInput: v => { S.n = parseInt(v) || 2; draw(); } });
      const fE = ui.field({ id: "m1md-e", label: "Số mũ e (tính a^e mod n)", type: "number", value: S.e, min: 0, onInput: v => { S.e = parseInt(v) || 0; draw(); } });
      const setAll = (a, n, e) => { S.a = a; S.n = n; S.e = e; fA.input.value = a; fN.input.value = n; fE.input.value = e; draw(); };
      ctrl.append(fA, fN, fE, ui.presets([
        { label: "7^803 mod 1000 (slide 27)", apply: () => setAll(7, 1000, 803) },
        { label: "3⁻¹ mod 7 = 3^5 (slide 32)", apply: () => setAll(3, 7, 5) },
        { label: "11⁻¹ mod 26 (Bài 4, 4.1.8)", apply: () => setAll(11, 26, 1) },
        { label: "3 sinh Z₇* (slide 16)", apply: () => setAll(3, 7, 6) },
        { label: "U(10) và φ(10) (slide 18)", apply: () => setAll(3, 10, 4) },
        { label: "7^53 mod 23 (Bài 4, 4.2.3)", apply: () => setAll(7, 23, 53) },
        { label: "Phản ví dụ gcd ≠ 1: 2^6 mod 8", apply: () => setAll(2, 8, 6) }
      ]));
      const out = ui.slot(); view.append(out);
      function draw() {
        const a = B(S.a), n = B(S.n), e = B(S.e);
        if (n < 2n) { out.render(ui.note("n phải ≥ 2.", "eve")); return; }
        const eg = math.egcd(math.mod(a, n), n), g = eg.g;
        const inv = g === 1n ? math.mod(eg.s, n) : null;
        const phi = math.phi(n), fs = math.factor(n);
        const uniq = [...new Set(fs.map(String))].map(BigInt);
        const ord = math.order(a, n);
        const pw = math.powmod(a, e, n);
        const red = g === 1n ? e % phi : null;
        const sq = math.sqm(a, e, n);
        /* bảng Euclid */
        const eucl = ui.table(["Bước", "a = q·b + r"], eg.steps.map((s, i) => [i + 1, { html: `${s.a} = <b>${s.q}</b>·${s.b} + <span class="hl">${s.r}</span>`, cls: "mono" }]), { cls: "tight" });
        /* nhóm U(n) */
        let unit = null;
        if (n <= 60n) {
          const els = []; for (let x = 1n; x < n; x++) if (math.gcd(x, n) === 1n) els.push(x);
          unit = ui.table(["x ∈ U(" + n + ")", ...els.map(String)], [["x⁻¹", ...els.map(x => String(math.modinv(x, n)))], ["ord(x)", ...els.map(x => String(math.order(x, n)))]], { mono: true, cls: "tight" });
        }
        /* lũy thừa của a */
        let cyc = null;
        if (g === 1n && ord && ord <= 60n) {
          const row1 = [], row2 = []; let x = 1n;
          for (let k = 1n; k <= ord; k++) { x = x * math.mod(a, n) % n; row1.push("a^" + k); row2.push(String(x)); }
          cyc = ui.table(["k", ...row1.map(s => ({ html: s.replace(/\^(\d+)/, sup("$1")) }))], [["a^k mod n", ...row2]], { mono: true, cls: "tight" });
        }
        out.render(
          ui.readouts([
            { k: "gcd(a, n)", v: String(g), kind: g === 1n ? "ok" : "eve" },
            { k: "a⁻¹ mod n", v: inv == null ? "không tồn tại" : String(inv), kind: inv == null ? "eve" : "key" },
            { k: "φ(n)", v: String(phi), kind: "aqua" },
            { k: "ord(a) trong U(n)", v: ord == null ? "—" : String(ord) + (ord === phi ? " = φ(n): sinh U(n)" : ""), kind: ord === phi ? "ok" : "pt" },
            { k: "a^e mod n", v: String(pw), kind: "ct", big: true }
          ]),
          h("div", { class: "cols" },
            ui.panel("Euclid mở rộng: gcd và nghịch đảo", eucl,
              g === 1n ? ui.note(`Lần ngược lại: a·s + n·t = 1 với s = ${eg.s}, t = ${eg.t} ⇒ a⁻¹ ≡ s ≡ <b>${inv}</b> (mod ${n}). Kiểm tra: ${math.mod(a, n)}·${inv} = ${math.mod(a, n) * inv} ≡ ${math.mod(math.mod(a, n) * inv, n)} (mod ${n}).`, "ok")
                : ui.note(`gcd = ${g} ≠ 1 nên a <b>không khả nghịch</b> modulo n: không được “chia cho a” trong Z<sub>${n}</sub>, và không được rút gọn số mũ theo φ(n).`, "eve")),
            ui.panel("Hàm Euler và rút gọn lũy thừa",
              ui.steps([
                { t: `Phân tích n = ${uniq.map(p => p + (fs.filter(q => q === p).length > 1 ? sup(fs.filter(q => q === p).length) : "")).join("·")}`, r: `φ(n) = n·∏(1 − 1/p) = ${n}·${uniq.map(p => "(1 − 1/" + p + ")").join("")} = <b>${phi}</b>` },
                g === 1n ? { t: `Định lý Euler: a${sup("φ(n)")} ≡ 1 ⇒ rút gọn số mũ e mod φ(n)`, r: `${e} ≡ <b>${red}</b> (mod ${phi}) ⇒ a${sup(String(e))} ≡ a${sup(String(red))} ≡ <b>${math.powmod(a, red, n)}</b>` } : { t: "gcd(a, n) ≠ 1: không áp dụng được định lý Euler", r: `Tính trực tiếp a${sup(String(e))} mod n = ${pw}` },
                math.isPrime(n) ? { t: `n nguyên tố ⇒ Fermat: a${sup("p−1")} ≡ 1 và a⁻¹ ≡ a${sup("p−2")}`, r: `a${sup(String(n - 2n))} ≡ ${math.powmod(a, n - 2n, n)} (mod ${n})` } : null
              ].filter(Boolean)),
              ui.title("Bình phương – nhân", `e = ${sq.bits}₂, ${sq.bits.length} bước`),
              ui.table(["Bit", "r² mod n", "× a?", "r"], sq.steps.map(s => [s.bit, String(s.sq), s.bit === "1" ? "có" : "—", String(s.r)]), { mono: true, cls: "tight", rowCls: (r, i) => i === sq.steps.length - 1 ? "hi" : null }))
          ),
          unit ? ui.panel(`Nhóm nhân U(${n}) — cấp |U(n)| = φ(n) = ${phi}`, unit) : ui.note(`n lớn: bỏ qua bảng U(n) (chỉ hiện khi n ≤ 60).`, "mut"),
          cyc ? ui.panel(`Chu kỳ lũy thừa của a = ${math.mod(a, n)}`, cyc, ui.note(`ord(a) = ${ord} là ước của φ(n) = ${phi} (định lý Lagrange).${ord === phi ? " a là <b>căn nguyên thủy</b>: lũy thừa của a sinh toàn bộ U(n)." : ""}`, "mut")) : null
        );
      }
      draw(); pane.appendChild(root);
    } },

  /* ===================================================== 2. CAESAR / AFFINE / VIGENÈRE ===================================================== */
  { id: "shift", title: "Caesar · Affine · Vigenère", intro: "Ba hệ mật là phép cộng và phép nhân trong Z<sub>26</sub>. Bảng từng chữ cho thấy phép tính; biểu đồ cho thấy tần suất chữ cái chỉ bị <em>hoán vị</em>, không bị che (Bài 2, mục 2).",
    build(pane) {
      const S = { mode: "caesar", dir: "enc", msg: "HELLO", k: 3, a: 5, b: 8, kw: "LEMON" };
      const { root, ctrl, view } = ui.sim();
      const seg = ui.seg({ id: "m1sh-mode", label: "Hệ mật", options: [["caesar", "Caesar"], ["affine", "Affine"], ["vig", "Vigenère"]], value: S.mode, onChange: v => { S.mode = v; refreshCtrl(); draw(); } });
      const dir = ui.seg({ id: "m1sh-dir", label: "Chiều", options: [["enc", "Mã hóa"], ["dec", "Giải mã"]], value: S.dir, onChange: v => { S.dir = v; draw(); } });
      const fMsg = ui.field({ id: "m1sh-msg", label: "Văn bản vào", value: S.msg, mono: true, hint: "Chỉ giữ A–Z, bỏ dấu và khoảng trắng", onInput: v => { S.msg = v; draw(); } });
      const fK = ui.range({ id: "m1sh-k", label: "Khóa k", min: 0, max: 25, value: S.k, onInput: v => { S.k = v; draw(); } });
      const fA = ui.range({ id: "m1sh-a", label: "a", min: 1, max: 25, value: S.a, onInput: v => { S.a = v; draw(); } });
      const fB = ui.range({ id: "m1sh-b", label: "b", min: 0, max: 25, value: S.b, onInput: v => { S.b = v; draw(); } });
      const fKw = ui.field({ id: "m1sh-kw", label: "Từ khóa", value: S.kw, mono: true, onInput: v => { S.kw = v; draw(); } });
      const pre = ui.presets([
        { label: "HELLO, k = 3 → KHOOR", apply: () => set("caesar", "enc", { msg: "HELLO", k: 3 }) },
        { label: "Bài tập: INFORMATION, k = 6", apply: () => set("caesar", "enc", { msg: "INFORMATION", k: 6 }) },
        { label: "Affine HELLO, a = 5, b = 8 → RCLLA", apply: () => set("affine", "enc", { msg: "HELLO", a: 5, b: 8 }) },
        { label: "Giải mã RCLLA", apply: () => set("affine", "dec", { msg: "RCLLA", a: 5, b: 8 }) },
        { label: "Bài tập: TECHNOLOGY, a = 7, b = 12", apply: () => set("affine", "enc", { msg: "TECHNOLOGY", a: 7, b: 12 }) },
        { label: "Affine a = 4 (không hợp lệ)", apply: () => set("affine", "enc", { msg: "HELLO", a: 4, b: 8 }) },
        { label: "Vigenère ATTACKATDAWN / LEMON", apply: () => set("vig", "enc", { msg: "ATTACKATDAWN", kw: "LEMON" }) },
        { label: "Bài tập: INFORMATIONSECURITY / SUNDAY", apply: () => set("vig", "enc", { msg: "INFORMATIONSECURITY", kw: "SUNDAY" }) },
        { label: "Bài tập 3.3: SECURITY / KEY", apply: () => set("vig", "enc", { msg: "SECURITY", kw: "KEY" }) }
      ]);
      function set(mode, d, o) { S.mode = mode; S.dir = d; Object.assign(S, o); seg.querySelector(".seg").set(mode); dir.querySelector(".seg").set(d); fMsg.input.value = S.msg; fK.set(S.k); fA.set(S.a); fB.set(S.b); fKw.input.value = S.kw; refreshCtrl(); draw(); }
      function refreshCtrl() { fK.hidden = S.mode !== "caesar"; fA.hidden = fB.hidden = S.mode !== "affine"; fKw.hidden = S.mode !== "vig"; }
      ctrl.append(seg, dir, fMsg, fK, fA, fB, fKw, pre); refreshCtrl();
      const out = ui.slot(); view.append(out);
      const fbox = chart.box(b => { if (b._data) chart.bars(b, b._data); });
      function draw() {
        const p = txt.clean(S.msg); if (!p) { out.render(ui.note("Nhập ít nhất một chữ cái A–Z.", "eve")); return; }
        const enc = S.dir === "enc"; const rows = []; let outS = ""; let head, note, extra = null;
        if (S.mode === "caesar") {
          head = ["Chữ", "x", enc ? "x + k" : "y − k", "mod 26", "Ra"];
          for (const ch of p) { const x = txt.n(ch), y = enc ? x + S.k : x - S.k, r = txt.mod(y, 26); outS += txt.c(r); rows.push([ch, x, y, r, txt.c(r)]); }
          note = ui.note(`Không gian khóa chỉ có <b>26</b> giá trị (k = 0 không tạo bí mật). Vét cạn 25 phép dịch rồi nhận diện ngôn ngữ là đủ phá mã.`, "mut");
          const bf = []; for (let k = 1; k < 26; k++) bf.push([k, p.split("").map(c => txt.c(txt.n(c) - k)).join("")]);
          extra = ui.panel("Vét cạn 25 khóa (đọc văn bản vào như bản mã)", ui.table(["k", "Giải mã"], bf, { mono: true, cls: "tight", rowCls: r => r[0] === S.k ? "hi" : null }));
        } else if (S.mode === "affine") {
          const ai = math.modinv(S.a, 26);
          if (ai == null) { out.render(ui.note(`gcd(${S.a}, 26) = ${math.gcd(S.a, 26)} ≠ 1 nên a = ${S.a} <b>không hợp lệ</b>: nhiều chữ sẽ cùng ánh xạ vào một chữ bản mã và không giải mã được duy nhất. Các a hợp lệ: 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25.`, "eve"), ui.table(["Chữ", "x", `${S.a}x + ${S.b}`, "mod 26", "Ra"], p.split("").map(ch => { const x = txt.n(ch), y = S.a * x + S.b; return [ch, x, y, txt.mod(y, 26), txt.c(y)]; }), { mono: true, cls: "tight" })); return; }
          const ainv = Number(ai);
          head = ["Chữ", enc ? "x" : "y", enc ? `${S.a}x + ${S.b}` : `${ainv}(y − ${S.b})`, "mod 26", "Ra"];
          for (const ch of p) { const x = txt.n(ch), y = enc ? S.a * x + S.b : ainv * (x - S.b), r = txt.mod(y, 26); outS += txt.c(r); rows.push([ch, x, y, r, txt.c(r)]); }
          note = ui.note(`a⁻¹ ≡ <b>${ainv}</b> (mod 26) vì ${S.a}·${ainv} = ${S.a * ainv} ≡ 1. Giải mã: x = a⁻¹(y − b) mod 26. Tổng số khóa 12·26 = <b>312</b>; tần suất chữ vẫn được giữ.`, "key");
        } else {
          const kw = txt.clean(S.kw); if (!kw) { out.render(ui.note("Từ khóa cần ít nhất một chữ cái.", "eve")); return; }
          head = ["Vị trí", "Chữ", "Khóa", "k", enc ? "x + k" : "y − k", "mod 26", "Ra"];
          p.split("").forEach((ch, i) => { const kc = kw[i % kw.length], k = txt.n(kc), x = txt.n(ch), y = enc ? x + k : x - k, r = txt.mod(y, 26); outS += txt.c(r); rows.push([i + 1, ch, kc, k, y, r, txt.c(r)]); });
          note = ui.note(`Khóa lặp với chu kỳ t = ${kw.length}: chữ ở các vị trí cùng lớp i mod t được dịch cùng một lượng → mỗi lớp là một mã Caesar. Phân tích: Kasiski/chỉ số trùng hợp để tìm t, rồi tần suất cho từng lớp.`, "mut");
          extra = ui.panel("Khóa lặp theo bản rõ", h("div", { class: "bitrows" }, ui.bits(p.split(""), { label: enc ? "Bản rõ" : "Bản mã", kind: enc ? "pt" : "ct" }), ui.bits(p.split("").map((_, i) => kw[i % kw.length]), { label: "Khóa", kind: "key" }), ui.bits(outS.split(""), { label: enc ? "Bản mã" : "Bản rõ", kind: enc ? "ct" : "pt" })));
        }
        /* biểu đồ tần suất vào/ra */
        const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""); const fi = txt.count(p), fo = txt.count(outS);
        fbox._data = { title: "Tần suất chữ cái: văn bản vào và văn bản ra (cùng tập giá trị, chỉ đổi chỗ)", labels: L, series: [{ name: enc ? "Bản rõ" : "Bản mã vào", color: enc ? "pt" : "ct", values: L.map(c => fi[c] || 0) }, { name: enc ? "Bản mã" : "Bản rõ ra", color: enc ? "ct" : "pt", values: L.map(c => fo[c] || 0) }], aspect: 0.32, fmtY: v => String(Math.round(v)) };
        out.render(
          ui.readouts([{ k: enc ? "Bản rõ" : "Bản mã", v: p, kind: enc ? "pt" : "ct" }, { k: "Khóa", v: S.mode === "caesar" ? "k = " + S.k : S.mode === "affine" ? `(a, b) = (${S.a}, ${S.b})` : txt.clean(S.kw), kind: "key" }, { k: enc ? "Bản mã" : "Bản rõ", v: outS, kind: enc ? "ct" : "pt", big: true }]),
          ui.table(head, rows, { mono: true, cls: "tight" }), note, fbox, extra);
        fbox.draw();
      }
      draw(); pane.appendChild(root);
    } },

  /* ===================================================== 3. HILL ===================================================== */
  { id: "hill", title: "Mã Hill", intro: "Mã khối đầu tiên dùng đại số tuyến tính: C = P·M (mod 26), khóa là ma trận 2×2 có det khả nghịch modulo 26. Một cặp bản rõ – bản mã đã biết đủ để lộ khóa (Bài 2 slide 61; Bài 3 mục 3.5).",
    build(pane) {
      const S = { m: [[11, 8], [3, 7]], msg: "JULY", dir: "enc", kp: "FRID", kc: "CDTH" };
      const { root, ctrl, view } = ui.sim();
      const cells = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([i, j]) => ui.field({ id: `m1hl-m${i}${j}`, label: `M[${i + 1},${j + 1}]`, type: "number", value: S.m[i][j], onInput: v => { S.m[i][j] = parseInt(v) || 0; draw(); } }));
      const dir = ui.seg({ id: "m1hl-dir", label: "Chiều", options: [["enc", "Mã hóa"], ["dec", "Giải mã"]], value: S.dir, onChange: v => { S.dir = v; draw(); } });
      const fMsg = ui.field({ id: "m1hl-msg", label: "Văn bản vào", value: S.msg, mono: true, hint: "Lẻ chữ thì đệm X", onInput: v => { S.msg = v; draw(); } });
      const fKp = ui.field({ id: "m1hl-kp", label: "Bản rõ đã biết (4 chữ)", value: S.kp, mono: true, onInput: v => { S.kp = v; drawAttack(); } });
      const fKc = ui.field({ id: "m1hl-kc", label: "Bản mã tương ứng (4 chữ)", value: S.kc, mono: true, onInput: v => { S.kc = v; drawAttack(); } });
      function set(m, msg, d) { S.m = m.map(r => r.slice()); S.msg = msg; S.dir = d; cells.forEach((c, k) => { c.input.value = S.m[Math.floor(k / 2)][k % 2]; }); fMsg.input.value = msg; dir.querySelector(".seg").set(d); draw(); }
      ctrl.append(dir, h("div", { class: "grp" }, ...cells), fMsg, ui.presets([
        { label: "M = [11 8; 3 7], JULY → DELW", apply: () => set([[11, 8], [3, 7]], "JULY", "enc") },
        { label: "Giải mã DELW", apply: () => set([[11, 8], [3, 7]], "DELW", "dec") },
        { label: "M = [3 3; 2 5], HE → HI (Bài 2)", apply: () => set([[3, 3], [2, 5]], "HE", "enc") },
        { label: "Bài tập 5.1: HELP với [3 3; 2 5]", apply: () => set([[3, 3], [2, 5]], "HELP", "enc") },
        { label: "Bài tập: MATH với [2 3; 1 4]", apply: () => set([[2, 3], [1, 4]], "MATH", "enc") },
        { label: "[2 1; 4 7]: có dùng được không?", apply: () => set([[2, 1], [4, 7]], "HELP", "enc") }
      ]), h("div", { class: "presets" }, h("div", { class: "lbl" }, "Tấn công bản rõ đã biết"), fKp, fKc, h("div", { class: "row" }, ui.btn("FRIDAY → CDTHUM (slide 37)", () => { S.kp = "FRID"; S.kc = "CDTH"; fKp.input.value = S.kp; fKc.input.value = S.kc; drawAttack(); }, "sm"), ui.btn("Bài tập: dont → BLNI", () => { S.kp = "DONT"; S.kc = "BLNI"; fKp.input.value = S.kp; fKc.input.value = S.kc; drawAttack(); }, "sm"))));
      const out = ui.slot(), atk = ui.slot(); view.append(out, atk);
      const fmtM = M => `[${M[0][0]} ${M[0][1]}; ${M[1][0]} ${M[1][1]}]`;
      function draw() {
        const M = S.m.map(r => r.map(v => txt.mod(v, 26)));
        const det = math.det2(M, 26), dinv = math.modinv(det, 26), Minv = math.inv2(M, 26);
        const p = txt.clean(S.msg); let s = p.length % 2 ? p + "X" : p;
        const enc = S.dir === "enc"; const K = enc ? M : Minv;
        const rows = [], outS = [];
        if (K) for (let i = 0; i < s.length; i += 2) {
          const v = [txt.n(s[i]), txt.n(s[i + 1])];
          const r0 = v[0] * K[0][0] + v[1] * K[1][0], r1 = v[0] * K[0][1] + v[1] * K[1][1];
          const c = [txt.mod(r0, 26), txt.mod(r1, 26)]; outS.push(txt.c(c[0]) + txt.c(c[1]));
          rows.push([s[i] + s[i + 1], `(${v[0]}, ${v[1]})`, `(${v[0]}·${K[0][0]} + ${v[1]}·${K[1][0]}, ${v[0]}·${K[0][1]} + ${v[1]}·${K[1][1]}) = (${r0}, ${r1})`, `(${c[0]}, ${c[1]})`, txt.c(c[0]) + txt.c(c[1])]);
        }
        const valid = dinv != null;
        out.render(
          h("div", { class: "matrow" }, h("div", null, h("div", { class: "small" }, "Khóa M"), ui.matrix(M, { cls: () => "key" })), h("span", { class: "op" }, "det"), h("div", null, h("div", { class: "small" }, "det M mod 26"), h("div", { class: "ro " + (valid ? "ok" : "eve") }, h("div", { class: "v" }, String(det)))), valid ? h("span", { class: "op" }, "⇒") : null, valid ? h("div", null, h("div", { class: "small" }, `M⁻¹ = ${dinv}·adj(M) mod 26`), ui.matrix(Minv, { cls: () => "ct" })) : null),
          valid ? ui.steps([
            { t: `det M = ${M[0][0]}·${M[1][1]} − ${M[0][1]}·${M[1][0]} = ${M[0][0] * M[1][1] - M[0][1] * M[1][0]} ≡ <b>${det}</b> (mod 26); gcd(${det}, 26) = 1 ✓` },
            { t: `(det M)⁻¹ ≡ <b>${dinv}</b> vì ${det}·${dinv} = ${det * Number(dinv)} ≡ 1 (mod 26)` },
            { t: `Ma trận phụ hợp adj(M) = [${M[1][1]} −${M[0][1]}; −${M[1][0]} ${M[0][0]}] ⇒ M⁻¹ = ${dinv}·adj(M) mod 26 = ${fmtM(Minv)}` },
            { t: `Kiểm tra M·M⁻¹ ≡ I: ${fmtM(math.matmul(M, Minv, 26))}`, hi: true }
          ]) : ui.note(`det M ≡ ${det} (mod 26) và gcd(${det}, 26) = ${math.gcd(det, 26)} ≠ 1 ⇒ M <b>không khả nghịch</b>: không dùng làm khóa được (det phải lẻ và không chia hết cho 13). Hai bản rõ khác nhau có thể cho cùng bản mã.`, "eve"),
          valid && p ? ui.readouts([{ k: enc ? "Bản rõ (đệm X)" : "Bản mã", v: s, kind: enc ? "pt" : "ct" }, { k: enc ? "Bản mã" : "Bản rõ", v: outS.join(""), kind: enc ? "ct" : "pt", big: true }]) : null,
          valid && p ? ui.table(["Khối", "Vectơ hàng P", enc ? "P·M" : "C·M⁻¹", "mod 26", "Ra"], rows, { mono: true, cls: "tight" }) : null,
          valid ? ui.note(`Mỗi chữ ra phụ thuộc <b>cả hai</b> chữ trong khối (khuếch tán): tần suất chữ đơn không còn hữu ích, nhưng tần suất cặp chữ vẫn còn. Với n = 2 có 157 248 ma trận khóa hợp lệ.`, "mut") : null
        );
      }
      function drawAttack() {
        const P = txt.clean(S.kp), C = txt.clean(S.kc);
        if (P.length < 4 || C.length < 4) { atk.render(ui.note("Cần đúng 4 chữ bản rõ và 4 chữ bản mã (hai khối).", "mut")); return; }
        const Pm = [[txt.n(P[0]), txt.n(P[1])], [txt.n(P[2]), txt.n(P[3])]], Cm = [[txt.n(C[0]), txt.n(C[1])], [txt.n(C[2]), txt.n(C[3])]];
        const dP = math.det2(Pm, 26), Pi = math.inv2(Pm, 26);
        if (!Pi) { atk.render(ui.panel("Tấn công bản rõ đã biết", ui.note(`det P ≡ ${dP} (mod 26) không khả nghịch: chọn cặp khối khác (ví dụ khối thứ 1 và 3).`, "eve"))); return; }
        const M = math.matmul(Pi, Cm, 26);
        atk.render(ui.panel("Tấn công bản rõ đã biết: C = P·M ⇒ M = P⁻¹·C",
          h("div", { class: "matrow" }, h("div", null, h("div", { class: "small" }, `P (${P.slice(0, 2)}, ${P.slice(2, 4)})`), ui.matrix(Pm, { cls: () => "pt" })), h("span", { class: "op" }, "·M ="), h("div", null, h("div", { class: "small" }, `C (${C.slice(0, 2)}, ${C.slice(2, 4)})`), ui.matrix(Cm, { cls: () => "ct" })), h("span", { class: "op" }, "⇒"), h("div", null, h("div", { class: "small" }, `det P = ${dP}, P⁻¹ = ${fmtM(Pi)}`), ui.matrix(M, { cls: () => "key" }))),
          ui.note(`Khóa lộ hoàn toàn: M = ${fmtM(M)}. Eve chỉ cần biết hai khối bản rõ – bản mã có det P khả nghịch; tấn công bản rõ chọn trước (dùng BA, CA…) còn nhanh hơn.`, "eve"),
          ui.btn("Dùng ma trận này làm khóa", () => set(M, S.msg, S.dir), "sm")));
      }
      draw(); drawAttack(); pane.appendChild(root);
    } },

  /* ===================================================== 4. PHÂN TÍCH TẦN SUẤT ===================================================== */
  { id: "freq", title: "Thay thế & tần suất", intro: "Mã thay thế đơn bảng có 26! ≈ 2<sup>88</sup> khóa nhưng vẫn bị phá chỉ với bản mã: biểu đồ tần suất bản mã là một hoán vị của biểu đồ tiếng Anh. Gán dần từng chữ và xem văn bản hiện ra (Bài 3, mục 3.1).",
    build(pane) {
      const SLIDE = "RTH HQHPE UZXX JRRJWN RTH HJDRHLQ OJRH JR IJUQ DA RTH DAXIZHLD PCDR PHHR QHJL RTH LZBHL JQI UJZR RTHLH CQRZX RTH DHWLHR DZOQJX ZD DHQR";
      const HW = "UEGSRLFEOSMG DB RMA OER LQ YEDRDKF OKH BLINDKF ULHAB RMOR SELRAUR DKQLEJORDLK QELJ RMA AGAB LQ OK AKAJG";
      const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      const S = { ct: SLIDE, map: {}, kw: "SECURITY", pt: "ATTACK AT DAWN" };
      const { root, ctrl, view } = ui.sim();
      const fCt = ui.field({ id: "m1fq-ct", label: "Bản mã (chỉ có bản mã)", type: "textarea", rows: 5, value: S.ct, onInput: v => { S.ct = v; draw(); } });
      ctrl.append(fCt, ui.presets([
        { label: "Ví dụ 3.1.3 (109 chữ)", apply: () => { S.ct = SLIDE; S.map = {}; fCt.input.value = SLIDE; draw(); } },
        { label: "Bài về nhà 1.2", apply: () => { S.ct = HW; S.map = {}; fCt.input.value = HW; draw(); } }
      ]), h("div", { class: "row" },
        ui.btn("Gợi ý theo hạng tần suất", () => { const cnt = txt.count(txt.clean(S.ct)); const order = L.slice().sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0)); const en = Object.keys(txt.freqEN).sort((a, b) => txt.freqEN[b] - txt.freqEN[a]); S.map = {}; order.forEach((c, i) => { if (cnt[c]) S.map[c] = en[i]; }); draw(); }, "sm"),
        ui.btn("Chỉ E và T", () => { const cnt = txt.count(txt.clean(S.ct)); const order = L.slice().sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0)); S.map = { [order[0]]: "E", [order[1]]: "T" }; draw(); }, "sm"),
        ui.btn("Xóa hết", () => { S.map = {}; draw(); }, "sm"),
        ui.btn("Lời giải slide", () => { const sol = "THE ENEMY WILL ATTACK THE EASTERN GATE AT DAWN SO THE SOLDIERS MUST MEET NEAR THE RIVER AND WAIT THERE UNTIL THE SECRET SIGNAL IS SENT"; S.ct = SLIDE; fCt.input.value = SLIDE; S.map = {}; const c = txt.clean(SLIDE), p = txt.clean(sol); for (let i = 0; i < c.length; i++) S.map[c[i]] = p[i]; draw(); }, "sm")),
        h("div", { class: "presets" }, h("div", { class: "lbl" }, "Mã hóa bằng khóa từ từ khóa (ví dụ 3.1.2)"),
          ui.field({ id: "m1fq-kw", label: "Từ khóa", value: S.kw, mono: true, onInput: v => { S.kw = v; drawKey(); } }),
          ui.field({ id: "m1fq-pt", label: "Bản rõ", value: S.pt, mono: true, onInput: v => { S.pt = v; drawKey(); } })));
      const chartBox = chart.box(b => { if (b._d) chart.bars(b, b._d); });
      const mapBox = ui.slot(), textBox = ui.slot(), ngBox = ui.slot(), keyBox = ui.slot();
      view.append(chartBox, mapBox, textBox, ngBox, keyBox);
      function draw() {
        const c = txt.clean(S.ct), n = c.length || 1, cnt = txt.count(c);
        chartBox._d = { title: `Tần suất bản mã (${c.length} chữ) so với tiếng Anh kỳ vọng`, labels: L, series: [{ name: "Bản mã", color: "ct", values: L.map(x => cnt[x] || 0) }, { name: "Tiếng Anh (kỳ vọng)", color: "pt", values: L.map(x => txt.freqEN[x] / 100 * n) }], aspect: 0.32, fmtY: v => String(Math.round(v)), fmtTip: v => v.toFixed(1) };
        chartBox.draw();
        const order = L.slice().sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0));
        const used = {}; Object.values(S.map).forEach(v => { used[v] = (used[v] || 0) + 1; });
        mapBox.render(ui.title("Bảng gán: chữ bản mã → chữ bản rõ đoán", "theo thứ tự tần suất giảm dần; chữ trùng gán sẽ tô đỏ"),
          h("div", { class: "row" }, order.filter(x => cnt[x]).map(x => h("div", { class: "fld", style: { width: "58px" } },
            h("label", { for: "m1fq-m" + x }, h("b", { class: "ct-c" }, x), h("span", { class: "small" }, cnt[x])),
            h("input", { id: "m1fq-m" + x, type: "text", maxlength: 1, class: "mono" + (S.map[x] && used[S.map[x]] > 1 ? " bad" : ""), value: S.map[x] || "", style: { textAlign: "center", padding: "5px" }, oninput: ev => { const v = txt.clean(ev.target.value).slice(0, 1); if (v) S.map[x] = v; else delete S.map[x]; ev.target.value = v; draw(); const el = document.getElementById("m1fq-m" + x); if (el) el.focus(); } })))));
        /* văn bản giải mã */
        const words = S.ct.toUpperCase().split(/(\s+)/);
        textBox.render(ui.title("Bản rõ đang hiện ra", "chữ đã gán tô xanh, chữ chưa gán giữ nguyên bản mã màu tím"),
          h("div", { class: "mono", style: { fontSize: "15px", lineHeight: "1.9", wordBreak: "break-word" } }, words.map(w => /^\s+$/.test(w) ? " " : h("span", { style: { marginRight: "2px" } }, w.split("").map(ch => /[A-Z]/.test(ch) ? h("span", { class: S.map[ch] ? "pt-c" : "ct-c", style: S.map[ch] ? null : { opacity: .55 } }, S.map[ch] || ch.toLowerCase()) : ch)))));
        /* n-gram */
        const big = {}, tri = {}; const ws = S.ct.toUpperCase().replace(/[^A-Z\s]/g, "").split(/\s+/).filter(Boolean);
        ws.forEach(w => { for (let i = 0; i + 1 < w.length; i++) big[w.slice(i, i + 2)] = (big[w.slice(i, i + 2)] || 0) + 1; for (let i = 0; i + 2 < w.length; i++) tri[w.slice(i, i + 3)] = (tri[w.slice(i, i + 3)] || 0) + 1; });
        const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const wc = {}; ws.forEach(w => { wc[w] = (wc[w] || 0) + 1; });
        ngBox.render(h("div", { class: "cols" },
          ui.panel("Cặp chữ hay gặp", ui.table(["Cặp", "Số lần"], top(big), { mono: true, cls: "tight" }), h("div", { class: "small" }, "Tiếng Anh: TH HE IN ER AN RE")),
          ui.panel("Bộ ba hay gặp", ui.table(["Bộ ba", "Số lần"], top(tri), { mono: true, cls: "tight" }), h("div", { class: "small" }, "Tiếng Anh: THE AND ING")),
          ui.panel("Từ lặp lại", ui.table(["Từ", "Số lần"], Object.entries(wc).filter(e => e[1] > 1).sort((a, b) => b[1] - a[1]).slice(0, 8), { mono: true, cls: "tight" }), h("div", { class: "small" }, "Từ 3 chữ lặp nhiều ⇒ ứng viên THE"))));
      }
      function drawKey() {
        const kw = txt.clean(S.kw); const seen = new Set(); const perm = [];
        for (const ch of kw + L.join("")) if (!seen.has(ch)) { seen.add(ch); perm.push(ch); }
        const pt = txt.clean(S.pt); const ct = pt.split("").map(ch => perm[txt.n(ch)]).join("");
        keyBox.render(ui.panel("Lập khóa từ từ khóa và mã hóa",
          ui.table(["p", ...L], [["π(p)", ...perm.map(x => ({ text: x, cls: kw.includes(x) ? "hl" : null }))]], { mono: true, cls: "tight" }),
          ui.readouts([{ k: "Bản rõ", v: pt, kind: "pt" }, { k: "Bản mã", v: ct, kind: "ct" }]),
          ui.note(`Từ khóa “${esc(kw)}” bỏ chữ lặp rồi nối các chữ còn lại theo A–Z. Không gian khóa tổng quát 26! ≈ 4·10<sup>26</sup> ≈ 2<sup>88</sup>, nhưng cấu trúc tần suất không đổi nên <b>khóa lớn là điều kiện cần, không phải điều kiện đủ</b>.`, "mut")));
      }
      draw(); drawKey(); pane.appendChild(root);
    } },

  /* ===================================================== 5. PLAYFAIR ===================================================== */
  { id: "playfair", title: "Playfair", intro: "Mã theo cặp chữ với bảng khóa 5×5 (I/J chung ô): ẩn tần suất chữ đơn nhưng vẫn lộ tần suất cặp chữ (Bài 3, mục 3.3).",
    build(pane) {
      const S = { kw: "MONARCHY", msg: "BALLOON", dir: "enc" };
      const { root, ctrl, view } = ui.sim();
      const dir = ui.seg({ id: "m1pf-dir", label: "Chiều", options: [["enc", "Mã hóa"], ["dec", "Giải mã"]], value: S.dir, onChange: v => { S.dir = v; draw(); } });
      const fKw = ui.field({ id: "m1pf-kw", label: "Từ khóa", value: S.kw, mono: true, onInput: v => { S.kw = v; draw(); } });
      const fMsg = ui.field({ id: "m1pf-msg", label: "Văn bản vào", value: S.msg, mono: true, hint: "Cặp chữ trùng chèn X; lẻ chữ đệm X; J → I", onInput: v => { S.msg = v; draw(); } });
      const set = (kw, msg, d) => { S.kw = kw; S.msg = msg; S.dir = d; fKw.input.value = kw; fMsg.input.value = msg; dir.querySelector(".seg").set(d); draw(); };
      ctrl.append(dir, fKw, fMsg, ui.presets([
        { label: "MONARCHY: BALLOON → IBSUPMNA", apply: () => set("MONARCHY", "BALLOON", "enc") },
        { label: "Giải mã IBSUPMNA", apply: () => set("MONARCHY", "IBSUPMNA", "dec") },
        { label: "Bài tập 3.1: HIDE THE GOLD", apply: () => set("MONARCHY", "HIDE THE GOLD", "enc") },
        { label: "Bài tập 3.2: giải CLKLCLRSANNA", apply: () => set("MONARCHY", "CLKLCLRSANNA", "dec") },
        { label: "Bài tập 3.3: HELLO", apply: () => set("MONARCHY", "HELLO", "enc") },
        { label: "PLAYFAIR: giải BKLBPGQXKGFQTNQOKU", apply: () => set("PLAYFAIR", "BKLBPGQXKGFQTNQOKU", "dec") }
      ]));
      const out = ui.slot(); view.append(out);
      function draw() {
        const kw = txt.clean(S.kw).replace(/J/g, "I"); const seen = new Set(); const sq = [];
        for (const ch of kw + "ABCDEFGHIKLMNOPQRSTUVWXYZ") if (!seen.has(ch)) { seen.add(ch); sq.push(ch); }
        const pos = {}; sq.forEach((c, i) => { pos[c] = [Math.floor(i / 5), i % 5]; });
        const enc = S.dir === "enc"; const raw = txt.clean(S.msg).replace(/J/g, "I");
        const pairs = [];
        if (enc) { let i = 0; while (i < raw.length) { const a = raw[i], b = raw[i + 1]; if (!b) { pairs.push([a, "X", "đệm"]); i++; } else if (a === b) { pairs.push([a, "X", "chèn"]); i++; } else { pairs.push([a, b, ""]); i += 2; } } }
        else { for (let i = 0; i + 1 < raw.length; i += 2) pairs.push([raw[i], raw[i + 1], ""]); }
        const d = enc ? 1 : 4; const rows = []; let outS = ""; const hi = new Set();
        pairs.forEach(([a, b, tagx]) => {
          const [ra, ca] = pos[a], [rb, cb] = pos[b]; let x, y, rule;
          if (ra === rb) { x = sq[ra * 5 + (ca + d) % 5]; y = sq[rb * 5 + (cb + d) % 5]; rule = enc ? "Cùng hàng → dịch phải" : "Cùng hàng → dịch trái"; }
          else if (ca === cb) { x = sq[((ra + d) % 5) * 5 + ca]; y = sq[((rb + d) % 5) * 5 + cb]; rule = enc ? "Cùng cột → dịch xuống" : "Cùng cột → dịch lên"; }
          else { x = sq[ra * 5 + cb]; y = sq[rb * 5 + ca]; rule = "Hình chữ nhật → đổi cột"; }
          outS += x + y; hi.add(a); hi.add(b);
          rows.push([a + b + (tagx ? " (" + tagx + " X)" : ""), `${a}(${ra + 1},${ca + 1}) ${b}(${rb + 1},${cb + 1})`, rule, { text: x + y, cls: "mono" }]);
        });
        const grid = ui.matrix([0, 1, 2, 3, 4].map(r => sq.slice(r * 5, r * 5 + 5)), { cls: (i, j, v) => kw.includes(v) ? (hi.has(v) ? "hi" : "pt") : (hi.has(v) ? "hi" : ""), fmt: v => v === "I" ? "I/J" : v });
        out.render(
          h("div", { class: "cols" }, h("div", { class: "stack" }, ui.title("Bảng khóa 5×5", "ô xanh: chữ từ khóa; ô vàng: chữ đang dùng"), grid),
            ui.readouts([{ k: enc ? "Bản rõ (tách cặp)" : "Bản mã", v: pairs.map(p => p[0] + p[1]).join(" "), kind: enc ? "pt" : "ct" }, { k: enc ? "Bản mã" : "Bản rõ", v: LAB.grp(outS, 2, " "), kind: enc ? "ct" : "pt", big: true }])),
          ui.table(["Cặp", "Tọa độ (hàng, cột)", "Trường hợp", "Kết quả"], rows, { cls: "tight" }),
          ui.note(enc ? "Một chữ bản rõ có nhiều cách mã (600 cặp thay vì 26 chữ) nên tần suất chữ đơn bị ẩn; nhưng nếu AB → XY thì BA → YX và một chữ không bao giờ mã thành chính nó – người phá mã dùng tần suất cặp chữ (TH, HE, ER…)." : "Giải mã xong cần tự bỏ các chữ X chèn giữa cặp trùng và X đệm cuối.", "mut")
        );
      }
      draw(); pane.appendChild(root);
    } },

  /* ===================================================== 6. ONE-TIME PAD ===================================================== */
  { id: "otp", title: "One-Time Pad", intro: "Khóa ngẫu nhiên, dài bằng bản tin và chỉ dùng một lần cho bí mật tuyệt đối (Shannon 1949): cùng một bản mã khớp với mọi bản rõ. Dùng lại khóa thì c₁ ⊕ c₂ = m₁ ⊕ m₂ và khóa biến mất (Bài 3, mục 3.6).",
    build(pane) {
      const S = { m: "HELLO", k: "XMCKL", want: "APPLE", m1: "01001000 01001001", kb: "11010110 00111010", c1: "1111110010101100", c2: "1111101010101010", known: "HI" };
      const { root, ctrl, view } = ui.sim();
      const fM = ui.field({ id: "m1ot-m", label: "Bản rõ (chữ)", value: S.m, mono: true, onInput: v => { S.m = v; drawL(); } });
      const fK = ui.field({ id: "m1ot-k", label: "Khóa (chữ, dài ≥ bản rõ)", value: S.k, mono: true, onInput: v => { S.k = v; drawL(); } });
      const fW = ui.field({ id: "m1ot-w", label: "Bản rõ “mong muốn” khác", value: S.want, mono: true, hint: "Tìm khóa để cùng bản mã giải ra bản rõ này", onInput: v => { S.want = v; drawL(); } });
      const fM1 = ui.field({ id: "m1ot-m1", label: "Bản rõ bit", value: S.m1, mono: true, onInput: v => { S.m1 = v; drawB(); } });
      const fKb = ui.field({ id: "m1ot-kb", label: "Khóa bit", value: S.kb, mono: true, onInput: v => { S.kb = v; drawB(); } });
      const fC1 = ui.field({ id: "m1ot-c1", label: "c₁ (chung khóa)", value: S.c1, mono: true, onInput: v => { S.c1 = v; drawR(); } });
      const fC2 = ui.field({ id: "m1ot-c2", label: "c₂ (chung khóa)", value: S.c2, mono: true, onInput: v => { S.c2 = v; drawR(); } });
      const fKn = ui.field({ id: "m1ot-kn", label: "Biết m₁ (ASCII)", value: S.known, mono: true, onInput: v => { S.known = v; drawR(); } });
      ctrl.append(h("div", { class: "presets" }, h("div", { class: "lbl" }, "Trên chữ cái"), fM, fK, fW, h("div", { class: "row" }, ui.btn("HELLO ⊕ XMCKL → EQNVZ", () => { S.m = "HELLO"; S.k = "XMCKL"; S.want = "APPLE"; fM.input.value = S.m; fK.input.value = S.k; fW.input.value = S.want; drawL(); }, "sm"), ui.btn("Bài tập 6.2: EQNVZ → MONEY", () => { S.want = "MONEY"; fW.input.value = S.want; drawL(); }, "sm"), ui.btn("Khóa ngẫu nhiên", () => { const r = LAB.rng(Date.now() & 0xffff); S.k = txt.clean(S.m).split("").map(() => txt.c(Math.floor(r() * 26))).join(""); fK.input.value = S.k; drawL(); }, "sm"))),
        h("div", { class: "presets" }, h("div", { class: "lbl" }, "Trên bit"), fM1, fKb, h("div", { class: "row" }, ui.btn("“HI” với khóa slide", () => { S.m1 = "01001000 01001001"; S.kb = "11010110 00111010"; fM1.input.value = S.m1; fKb.input.value = S.kb; drawB(); }, "sm"), ui.btn("Bài tập 6.1: “OK”", () => { S.m1 = "01001111 01001011"; S.kb = "10110100 11100101"; fM1.input.value = S.m1; fKb.input.value = S.kb; drawB(); }, "sm"))),
        h("div", { class: "presets" }, h("div", { class: "lbl" }, "Dùng lại khóa (bài về nhà 6.1)"), fC1, fC2, fKn));
      const outL = ui.slot(), outB = ui.slot(), outR = ui.slot(); view.append(outL, outB, outR);
      const bitsOf = s => String(s).replace(/[^01]/g, "");
      function drawL() {
        const m = txt.clean(S.m), k = txt.clean(S.k), w = txt.clean(S.want);
        if (!m) { outL.render(ui.note("Nhập bản rõ.", "eve")); return; }
        if (k.length < m.length) { outL.render(ui.note(`Khóa phải dài ít nhất ${m.length} chữ (hiện ${k.length}). Khóa ngắn hơn bản tin thì không còn là One-Time Pad.`, "eve")); return; }
        const c = m.split("").map((ch, i) => txt.c(txt.n(ch) + txt.n(k[i]))).join("");
        const rows = [["Bản rõ m", ...m.split("")], ["m (số)", ...m.split("").map(txt.n)], ["Khóa k", ...k.slice(0, m.length).split("")], ["k (số)", ...k.slice(0, m.length).split("").map(txt.n)], ["m + k", ...m.split("").map((ch, i) => txt.n(ch) + txt.n(k[i]))], ["mod 26", ...c.split("").map(txt.n)], ["Bản mã c", ...c.split("")]];
        let alt = null;
        if (w.length === m.length) { const k2 = c.split("").map((ch, i) => txt.c(txt.n(ch) - txt.n(w[i]))).join(""); alt = ui.note(`Cùng bản mã <b class="ct-c">${c}</b> giải thành <b class="pt-c">${w}</b> với khóa <b class="key-c">${k2}</b> (k = c − m). Mỗi bản rõ cùng độ dài đều có đúng một khóa phù hợp ⇒ bản mã không cho thêm thông tin nào về bản rõ (P(M | C) = P(M)).`, "ok"); }
        else if (w) alt = ui.note(`Bản rõ “mong muốn” phải dài đúng ${m.length} chữ.`, "mut");
        outL.render(ui.panel("One-Time Pad trên chữ cái: c = (m + k) mod 26", ui.readouts([{ k: "Bản rõ", v: m, kind: "pt" }, { k: "Khóa", v: k.slice(0, m.length), kind: "key" }, { k: "Bản mã", v: c, kind: "ct", big: true }]), ui.table(null, rows, { mono: true, cls: "tight" }), alt));
      }
      function drawB() {
        const m = bitsOf(S.m1), k = bitsOf(S.kb);
        if (!m || k.length < m.length) { outB.render(ui.note("Bản rõ bit cần khác rỗng và khóa bit dài ít nhất bằng bản rõ.", "eve")); return; }
        const c = m.split("").map((b, i) => (b ^ k[i]) + "").join(""), back = c.split("").map((b, i) => (b ^ k[i]) + "").join("");
        const asc = s => s.match(/.{8}/g)?.map(b => { const v = parseInt(b, 2); return v >= 32 && v < 127 ? String.fromCharCode(v) : "·"; }).join("") || "";
        outB.render(ui.panel("One-Time Pad trên bit: c = m ⊕ k, m = c ⊕ k", h("div", { class: "bitrows" }, ui.bits(m, { label: "m = " + asc(m), kind: "pt", group: 8 }), ui.bits(k.slice(0, m.length), { label: "k", kind: "key", group: 8 }), ui.bits(c, { label: "c = m ⊕ k", kind: "ct", group: 8 }), ui.bits(back, { label: "c ⊕ k = " + asc(back), kind: "ok", group: 8 })), ui.note("Khóa ngẫu nhiên đều ⇒ mỗi bit bản mã là 0 hay 1 với xác suất ½, độc lập với bản rõ. Giải mã là XOR lại với cùng khóa.", "mut")));
      }
      function drawR() {
        const c1 = bitsOf(S.c1), c2 = bitsOf(S.c2); const n = Math.min(c1.length, c2.length);
        if (!n) { outR.render(ui.note("Nhập hai bản mã bit.", "mut")); return; }
        const x = []; for (let i = 0; i < n; i++) x.push((c1[i] ^ c2[i]) + "");
        const xs = x.join("");
        let m1 = ""; for (const ch of String(S.known)) m1 += ch.charCodeAt(0).toString(2).padStart(8, "0");
        let m2 = null; if (m1.length >= n) m2 = xs.split("").map((b, i) => (b ^ m1[i]) + "").join("");
        const asc = s => s.match(/.{8}/g)?.map(b => { const v = parseInt(b, 2); return v >= 32 && v < 127 ? String.fromCharCode(v) : "·"; }).join("") || "";
        outR.render(ui.panel("Tái sử dụng khóa: c₁ ⊕ c₂ = (m₁ ⊕ k) ⊕ (m₂ ⊕ k) = m₁ ⊕ m₂", h("div", { class: "bitrows" }, ui.bits(c1.slice(0, n), { label: "c₁", kind: "ct", group: 8 }), ui.bits(c2.slice(0, n), { label: "c₂", kind: "ct", group: 8 }), ui.bits(xs, { label: "c₁ ⊕ c₂ = m₁ ⊕ m₂", kind: "eve", group: 8 }), m2 ? ui.bits(m1.slice(0, n), { label: "m₁ = “" + esc(S.known) + "”", kind: "pt", group: 8 }) : null, m2 ? ui.bits(m2, { label: "m₂ = “" + asc(m2) + "”", kind: "pt", group: 8 }) : null),
          m2 ? ui.note(`Khóa triệt tiêu: biết m₁ ⇒ m₂ = c₁ ⊕ c₂ ⊕ m₁ = <b>“${esc(asc(m2))}”</b>. Đây là cách dự án VENONA đọc được điện tín Liên Xô dùng lại khóa.`, "eve") : ui.note(`m₁ (ASCII) cần ít nhất ${Math.ceil(n / 8)} ký tự để suy ra m₂.`, "mut")));
      }
      drawL(); drawB(); drawR(); pane.appendChild(root);
    } },

  /* ===================================================== 7. PRBG: LCG, BBS, LFSR ===================================================== */
  { id: "prbg", title: "LCG · BBS · LFSR", intro: "One-Time Pad cần quá nhiều bit ngẫu nhiên, nên mã dòng dùng bộ sinh giả ngẫu nhiên từ một mầm ngắn. LFSR rất nhanh nhưng tuyến tính: một đoạn khóa 2m bit đủ để khôi phục toàn bộ (Bài 3, mục 3.7–3.8).",
    build(pane) {
      const S = { m: 5, c: [1, 0, 1, 0, 0], seed: "01000", N: 40, pt: "1011001110001111", ks: "011010111100", lcg: { a: 5, c: 1, m: 16, x0: 7 }, bbs: { p: 11, q: 19, x: 3 } };
      const { root, ctrl, view } = ui.sim();
      const fm = ui.range({ id: "m1pr-m", label: "Độ dài LFSR m", min: 2, max: 8, value: S.m, onInput: v => { S.m = v; S.c = Array.from({ length: v }, (_, i) => S.c[i] || 0); S.seed = (S.seed + "00000000").slice(0, v); fSeed.input.value = S.seed; buildCoef(); drawLFSR(); } });
      const coefBox = h("div", { class: "fld" }); const fSeed = ui.field({ id: "m1pr-seed", label: "Bit khởi tạo x₁…x_m", value: S.seed, mono: true, onInput: v => { S.seed = v; drawLFSR(); } });
      const fN = ui.range({ id: "m1pr-N", label: "Số bit sinh", min: 10, max: 300, step: 10, value: S.N, onInput: v => { S.N = v; drawLFSR(); } });
      const fPt = ui.field({ id: "m1pr-pt", label: "Bản rõ bit để mã dòng", value: S.pt, mono: true, onInput: v => { S.pt = v; drawLFSR(); } });
      const fKs = ui.field({ id: "m1pr-ks", label: "Đoạn dòng khóa đã biết (tấn công)", value: S.ks, mono: true, onInput: v => { S.ks = v; drawAttack(); } });
      function buildCoef() { LAB.clear(coefBox); coefBox.append(h("label", null, h("b", null, "Hệ số hồi tiếp cᵢ: x", h("sub", null, "n+m"), " = Σ cᵢ·x", h("sub", null, "n+i"))), h("div", { class: "row" }, S.c.map((v, i) => { const l = ui.check({ id: "m1pr-c" + i, label: "c" + i, value: !!v, onChange: on => { S.c[i] = on ? 1 : 0; drawLFSR(); } }); return l; }))); }
      buildCoef();
      const setL = (m, c, seed) => { S.m = m; S.c = c.slice(); S.seed = seed; fm.set(m); fSeed.input.value = seed; buildCoef(); drawLFSR(); };
      ctrl.append(ui.title("LFSR"), fm, coefBox, fSeed, fN, fPt, ui.presets([
        { label: "m = 5: x_{n+5} = x_n + x_{n+2}, seed 01000 (slide 53)", apply: () => setL(5, [1, 0, 1, 0, 0], "01000") },
        { label: "x⁴ + x + 1, seed 1000 (chu kỳ 15)", apply: () => setL(4, [1, 1, 0, 0], "1000") },
        { label: "x⁴ + x² + 1 (khả quy, chu kỳ 6)", apply: () => setL(4, [1, 0, 1, 0], "1000") },
        { label: "x⁴ + x³ + x² + x + 1 (chu kỳ 5)", apply: () => setL(4, [1, 1, 1, 1], "1000") },
        { label: "Bài tập 8.1: m = 3, x_{n+3} = x_n + x_{n+1}, 100", apply: () => setL(3, [1, 1, 0], "100") }
      ]), h("div", { class: "presets" }, h("div", { class: "lbl" }, "Tấn công bản rõ đã biết lên LFSR"), fKs, h("div", { class: "row" }, ui.btn("Slide 55: 011010111100", () => { S.ks = "011010111100"; fKs.input.value = S.ks; drawAttack(); }, "sm"), ui.btn("Bài tập 8.3: 100101", () => { S.ks = "100101"; fKs.input.value = S.ks; drawAttack(); }, "sm"), ui.btn("Bài về nhà: 20 bit", () => { S.ks = "10101110000111010101"; fKs.input.value = S.ks; drawAttack(); }, "sm"))));
      /* LCG & BBS */
      const lc = ["a", "c", "m", "x0"].map(k => ui.field({ id: "m1pr-lcg" + k, label: k === "x0" ? "X₀" : k, type: "number", value: S.lcg[k], onInput: v => { S.lcg[k] = parseInt(v) || 0; drawLCG(); } }));
      const bb = ["p", "q", "x"].map(k => ui.field({ id: "m1pr-bbs" + k, label: k, type: "number", value: S.bbs[k], onInput: v => { S.bbs[k] = parseInt(v) || 0; drawBBS(); } }));
      ctrl.append(ui.title("LCG: Xₙ = (a·Xₙ₋₁ + c) mod m"), h("div", { class: "grp" }, ...lc), h("div", { class: "row" }, ui.btn("5X+1 mod 16, X₀=7 (slide 49)", () => { Object.assign(S.lcg, { a: 5, c: 1, m: 16, x0: 7 }); lc.forEach((f, i) => { f.input.value = S.lcg[["a", "c", "m", "x0"][i]]; }); drawLCG(); }, "sm"), ui.btn("Bài tập 7.1: 3X+5 mod 16, X₀=1", () => { Object.assign(S.lcg, { a: 3, c: 5, m: 16, x0: 1 }); lc.forEach((f, i) => { f.input.value = S.lcg[["a", "c", "m", "x0"][i]]; }); drawLCG(); }, "sm")),
        ui.title("BBS: xⱼ = xⱼ₋₁² mod pq"), h("div", { class: "grp3" }, ...bb), h("div", { class: "row" }, ui.btn("p=11, q=19, x=3 (slide 50)", () => { Object.assign(S.bbs, { p: 11, q: 19, x: 3 }); bb.forEach((f, i) => { f.input.value = S.bbs[["p", "q", "x"][i]]; }); drawBBS(); }, "sm"), ui.btn("Bài tập 7.3: p=7, q=11, x=4", () => { Object.assign(S.bbs, { p: 7, q: 11, x: 4 }); bb.forEach((f, i) => { f.input.value = S.bbs[["p", "q", "x"][i]]; }); drawBBS(); }, "sm")));
      const outL = ui.slot(), outA = ui.slot(), outC = ui.slot(), outB = ui.slot(); view.append(outL, outA, h("div", { class: "cols" }, outC, outB));
      function lfsrRun(m, c, seed, N) { const x = seed.split("").map(Number); const rows = []; for (let n = 0; x.length < N; n++) { let s = 0; const terms = []; for (let i = 0; i < m; i++) if (c[i]) { s ^= x[n + i]; terms.push(`x${n + i + 1}`); } x.push(s); rows.push({ idx: n + m + 1, terms, v: s }); } return { x: x.slice(0, N), rows }; }
      function period(m, c, seed) { const st0 = seed; let st = seed; for (let k = 1; k <= (1 << m); k++) { let s = 0; for (let i = 0; i < m; i++) if (c[i]) s ^= +st[i]; st = st.slice(1) + s; if (st === st0) return k; } return null; }
      function drawLFSR() {
        const m = S.m, seed = S.seed.replace(/[^01]/g, "");
        if (seed.length !== m) { outL.render(ui.note(`Cần đúng ${m} bit khởi tạo.`, "eve")); return; }
        if (!S.c[0]) { outL.render(ui.note("c₀ nên bằng 1, nếu không bit đầu không tham gia hồi tiếp và bộ sinh suy biến về độ dài nhỏ hơn.", "eve")); }
        const { x, rows } = lfsrRun(m, S.c, seed, S.N); const per = /^0+$/.test(seed) ? 1 : period(m, S.c, seed);
        const poly = "x" + sup(m) + " + " + S.c.map((v, i) => v ? (i ? "x" + (i > 1 ? sup(i) : "") : "1") : null).filter(Boolean).reverse().join(" + ");
        const pt = S.pt.replace(/[^01]/g, ""); const ct = pt.split("").map((b, i) => (b ^ x[i % x.length]) + "").join("");
        const kinds = x.map((_, i) => i < m ? "key" : (per && i >= per ? "dim" : "aqua"));
        outL.render(ui.panel("Dòng khóa LFSR",
          ui.readouts([{ k: "Đa thức đặc trưng", v: { toString: () => poly }, kind: "key" }, { k: "Chu kỳ", v: per == null ? "—" : per + (per === (1 << m) - 1 ? " = 2^m − 1 (tối đa)" : " (< 2^m − 1 = " + ((1 << m) - 1) + ")"), kind: per === (1 << m) - 1 ? "ok" : "eve" }, { k: "Khóa thực = hệ số + mầm", v: S.c.join("") + " | " + seed, kind: "key" }]),
          ui.bits(x, { label: "x₁…", kind: "aqua", kinds, group: 10, titles: x.map((_, i) => "x" + (i + 1)) }),
          ui.table(["n", "Công thức", "Giá trị"], rows.slice(0, 8).map(r => [{ html: `x<sub>${r.idx}</sub>`, cls: "mono" }, { html: r.terms.map(t => t.replace(/x(\d+)/, "x<sub>$1</sub>")).join(" + "), cls: "mono" }, r.v]), { cls: "tight" }),
          pt ? h("div", { class: "bitrows" }, ui.bits(pt, { label: "Bản rõ", kind: "pt", group: 8 }), ui.bits(x.slice(0, pt.length).map(String), { label: "Dòng khóa", kind: "key", group: 8 }), ui.bits(ct, { label: "Bản mã ⊕", kind: "ct", group: 8 })) : null,
          ui.note(`Chu kỳ tối đa 2<sup>m</sup> − 1 đạt được khi và chỉ khi đa thức đặc trưng là <b>đa thức nguyên thủy</b> trên GF(2). Với m = 31 ta có hơn 2 tỉ bit từ 62 bit khóa, nhưng xem tấn công bên dưới.`, "mut")));
        const el = outL.querySelector(".ro.key .v"); if (el) el.innerHTML = poly;
      }
      function drawAttack() {
        const k = S.ks.replace(/[^01]/g, "").split("").map(Number);
        if (k.length < 4) { outA.render(ui.note("Cần ít nhất 4 bit dòng khóa.", "mut")); return; }
        const tries = [];
        let found = null;
        for (let m = 1; m <= Math.min(8, Math.floor(k.length / 2)); m++) {
          const A = [], b = []; for (let n = 0; n < m; n++) { A.push(k.slice(n, n + m)); b.push(k[n + m]); }
          const sol = gf2solve(A, b);
          if (sol.singular || sol.inconsistent) { tries.push({ m, txt: sol.singular ? "định thức = 0 – loại" : "vô nghiệm", ok: false }); continue; }
          let okAll = true, firstBad = -1; for (let n = 0; n + m < k.length; n++) { let s = 0; for (let i = 0; i < m; i++) if (sol.x[i]) s ^= k[n + i]; if (s !== k[n + m]) { okAll = false; firstBad = n + m + 1; break; } }
          tries.push({ m, txt: `nghiệm (${sol.x.join(",")})` + (okAll ? " – khớp toàn bộ đoạn khóa ✓" : ` – sai khi kiểm tra bit x<sub>${firstBad}</sub>`), ok: okAll, x: sol.x });
          if (okAll && !found) found = { m, x: sol.x };
        }
        outA.render(ui.panel("Khôi phục hệ số LFSR từ đoạn dòng khóa (bản rõ đã biết: k = m ⊕ c)",
          ui.table(["Thử m", "Giải hệ m phương trình mod 2 từ m bit đầu", "Kết quả"], tries.map(t => [t.m, { html: t.txt }, t.ok ? ui.tag("đúng", "ok") : ui.tag("loại", "eve")]), { cls: "tight", rowCls: r => r[2] && r[2].classList.contains("ok") ? "good" : null }),
          found ? ui.note(`Quan hệ truy hồi: x<sub>n+${found.m}</sub> = ${found.x.map((v, i) => v ? `x<sub>n${i ? "+" + i : ""}</sub>` : null).filter(Boolean).join(" + ")} ⇒ Eve sinh được <b>toàn bộ dòng khóa</b> từ ${2 * found.m} bit đã biết. Một LFSR đơn lẻ không bao giờ được dùng trực tiếp làm mã dòng.`, "eve") : ui.note("Không tìm được LFSR độ dài ≤ 8 sinh đúng đoạn khóa này (hoặc đoạn quá ngắn).", "mut"),
          found ? ui.btn("Nạp vào bộ sinh LFSR phía trên", () => setL(found.m, found.x, k.slice(0, found.m).join("")), "sm") : null));
      }
      function drawLCG() {
        const { a, c, m, x0 } = S.lcg; if (m < 2) { outC.render(ui.note("m ≥ 2", "eve")); return; }
        const rows = []; let x = x0; const seen = new Map(); let per = null;
        for (let n = 1; n <= Math.min(m + 1, 40); n++) { const nx = (a * x + c) % m; rows.push([n, x, `${a}·${x} + ${c} = ${a * x + c}`, nx, nx & 1]); if (seen.has(nx) && per == null) per = n - seen.get(nx); seen.set(nx, n); x = nx; }
        outC.render(ui.panel("Bộ sinh đồng dư tuyến tính", ui.readouts([{ k: "Chu kỳ quan sát", v: per == null ? "> " + rows.length : per + (per === m ? " (tối đa)" : ""), kind: per === m ? "ok" : "eve" }]), ui.table(["n", "Xₙ₋₁", "a·Xₙ₋₁ + c", "Xₙ", "bit thấp"], rows, { mono: true, cls: "tight" }), ui.note("Bit thấp nhất của LCG với m = 2ᵏ luân phiên 0, 1 – vượt kiểm định thống kê thì chưa đủ; biết vài giá trị liên tiếp là đoán được a, c.", "mut")));
      }
      function drawBBS() {
        const { p, q, x } = S.bbs; const n = p * q; const warn = [];
        if (!math.isPrime(p) || !math.isPrime(q)) warn.push("p, q phải nguyên tố"); if (p % 4 !== 3 || q % 4 !== 3) warn.push("cần p ≡ q ≡ 3 (mod 4)"); if (Number(math.gcd(x, n)) !== 1) warn.push("gcd(x, n) phải bằng 1");
        const rows = []; let xj = (x * x) % n; rows.push([0, `${x}² mod ${n}`, xj, "–"]);
        for (let j = 1; j <= 8; j++) { const nx = (xj * xj) % n; rows.push([j, `${xj}² mod ${n}`, nx, nx & 1]); xj = nx; }
        outB.render(ui.panel("Blum–Blum–Shub", ui.readouts([{ k: "n = p·q", v: n, kind: "key" }, { k: "x₀ = x² mod n", v: rows[0][2], kind: "aqua" }]), warn.length ? ui.note(warn.join("; ") + ".", "eve") : null, ui.table(["j", "xⱼ", "Giá trị", "bⱼ = bit thấp"], rows, { mono: true, cls: "tight" }), ui.note("An toàn dựa trên độ khó phân tích n (như RSA) nhưng chậm: mỗi bit một phép bình phương modulo n.", "mut")));
      }
      drawLFSR(); drawAttack(); drawLCG(); drawBBS(); pane.appendChild(root);
    } }
  ]
});
})();
