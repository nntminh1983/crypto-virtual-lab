/* COM608 — Phòng Lab Mã hóa — Mô-đun 6 (Bài 10): Lượng tử
   Tab: polar (ba kính phân cực), qubit (qubit và phép đo), bb84 (phân phối khóa BB84),
        shor (giải thuật Shor: chu kỳ, QFT, liên phân số), grover (khuếch đại biên độ, Mosca).
   Mọi preset lấy đúng ví dụ số trong slide Bài 10; đã đối chiếu bằng Python trước khi ghi. */
(function () {
"use strict";
const { h, ui, math, chart } = LAB;
const svg = LAB.svg, fmt = LAB.fmt, pct = LAB.pct;
const D2R = Math.PI / 180;
const cos2 = deg => { const c = Math.cos(deg * D2R); return c * c; };
/* hiển thị phân số quen thuộc (½, ¼, ⅛, 3/32…) khi giá trị khớp, nếu không thì số thập phân */
const KNOWN = [[0, "0"], [1, "1"], [0.5, "½"], [0.25, "¼"], [0.125, "⅛"], [0.75, "¾"], [1 / 16, "1/16"], [3 / 32, "3/32"], [1 / 3, "⅓"], [2 / 3, "⅔"], [0.2, "1/5"], [0.8, "4/5"]];
const nice = (v, d = 4) => { for (const [x, s] of KNOWN) if (Math.abs(v - x) < 1e-9) return s; return fmt(v, d); };
const sup = s => "<sup>" + s + "</sup>";
const sci = x => { if (!(x > 0)) return "0"; const e = Math.floor(Math.log10(x)); return (x / Math.pow(10, e)).toFixed(1) + "·10" + sup(e); };
const aquaSpan = t => '<span style="color:var(--aqua);font-weight:600">' + t + "</span>";

/* ============================================================================
   TAB 1 — Ba kính phân cực: định luật Malus I = I₀·cos²(α − θ)
   ============================================================================ */
const tabPolar = {
  id: "polar", title: "Ba kính phân cực",
  intro: "Mỗi kính lọc góc θ là một <b>phép đo</b>: photon phân cực α đi qua với xác suất cos²(α − θ) rồi mang phân cực θ (định luật Malus). A (0°) rồi C (90°) ⇒ tường tối; chèn B (45°) ⇒ tường sáng lại ⅛ (slide 1.1–1.2).",
  build(pane) {
    const S = { A: 0, B: 45, C: 90, useB: true, n: 10 };
    const { root, ctrl, view } = ui.sim();
    const deg = v => v + "°";
    const fA = ui.range({ id: "m6po-a", label: "Góc kính A", min: 0, max: 180, value: S.A, fmt: deg, onInput: v => { S.A = v; draw(); } });
    const fB = ui.range({ id: "m6po-b", label: "Góc kính B", min: 0, max: 180, value: S.B, fmt: deg, onInput: v => { S.B = v; draw(); } });
    const fC = ui.range({ id: "m6po-c", label: "Góc kính C", min: 0, max: 180, value: S.C, fmt: deg, onInput: v => { S.C = v; draw(); } });
    const cB = ui.check({ id: "m6po-useb", label: "Chèn kính B giữa A và C", value: S.useB, onChange: v => { S.useB = v; draw(); } });
    const fN = ui.range({ id: "m6po-n", label: "Số kính n cách đều từ 0° đến 90°", min: 1, max: 30, value: S.n, onInput: v => { S.n = v; drawN(); } });
    const set = (A, B, C, useB) => { Object.assign(S, { A, B, C, useB }); fA.set(A); fB.set(B); fC.set(C); cB.input.checked = useB; draw(); };
    ctrl.append(fA, fB, fC, cB, ui.presets([
      { label: "A 0°, B 45°, C 90° (slide 1.1)", apply: () => set(0, 45, 90, true) },
      { label: "Bỏ kính B: tường tối", apply: () => set(0, 45, 90, false) },
      { label: "Bài tập 1.1: B = 30°", apply: () => set(0, 30, 90, true) },
      { label: "B = 135° (cũng ⅛)", apply: () => set(0, 135, 90, true) }
    ]), ui.title("Nhiều kính cách đều", "giới hạn ½ khi n → ∞"), fN);
    const out = ui.slot();
    const boxB = chart.box(b => drawBox(b));
    const outN = ui.slot();
    const boxN = chart.box(b => drawBoxN(b));
    view.append(out, boxB, ui.title("n kính cách đều từ 0° đến 90°", "xoay phân cực bằng nhiều phép đo nhỏ"), outN, boxN);

    function intens() {
      const I1 = 0.5, tAB = cos2(S.B - S.A), tBC = cos2(S.C - S.B), tAC = cos2(S.C - S.A);
      const I2 = S.useB ? I1 * tAB : I1, I3 = S.useB ? I2 * tBC : I1 * tAC;
      return { I1, I2, I3, tAB, tBC, tAC };
    }
    /* hình: đèn → A → B → C → tường; độ rộng và độ mờ của chùm tỷ lệ với cường độ */
    function beamSvg(I) {
      const W = 700, H = 236, cy = 112, xs = [46, 190, 350, 510, 660];
      const s = svg("svg", { class: "diag", viewBox: "0 0 " + W + " " + H });
      const beam = (x1, x2, v) => svg("line", { x1, y1: cy, x2, y2: cy, stroke: "var(--key)", "stroke-width": (2 + 34 * v).toFixed(1), "stroke-opacity": (0.12 + 0.88 * v).toFixed(2) });
      const lbl = (x, y, t, cls) => svg("text", { x, y, "text-anchor": "middle", class: cls || null }, t);
      s.append(svg("circle", { cx: xs[0], cy, r: 24, fill: "var(--key)", "fill-opacity": 0.2 }), svg("circle", { cx: xs[0], cy, r: 15, fill: "var(--key)" }), lbl(xs[0], cy + 50, "Đèn", "lbl"));
      s.append(beam(xs[0] + 18, xs[1] - 12, 1));
      if (S.useB) s.append(beam(xs[1] + 12, xs[2] - 12, I.I1), beam(xs[2] + 12, xs[3] - 12, I.I2), beam(xs[3] + 12, xs[4] - 8, I.I3));
      else s.append(beam(xs[1] + 12, xs[3] - 12, I.I1), beam(xs[3] + 12, xs[4] - 8, I.I3));
      const filt = (x, ang, name, on) => {
        const g = svg("g", { opacity: on ? 1 : 0.3 });
        g.append(svg("rect", { x: x - 11, y: cy - 62, width: 22, height: 124, rx: 5, fill: "var(--sunk)", stroke: on ? "var(--pt)" : "var(--faint)", "stroke-width": 2, "stroke-dasharray": on ? null : "5 4" }));
        const dx = 26 * Math.cos(ang * D2R), dy = 26 * Math.sin(ang * D2R);
        g.append(svg("line", { x1: x - dx, y1: cy + dy, x2: x + dx, y2: cy - dy, stroke: "var(--pt)", "stroke-width": 3, "stroke-linecap": "round" }));
        g.append(lbl(x, cy + 86, name + ": " + ang + "°", "lbl"));
        return g;
      };
      s.append(filt(xs[1], S.A, "A", true), filt(xs[2], S.B, "B", S.useB), filt(xs[3], S.C, "C", true));
      const il = (x, v) => s.append(svg("text", { x, y: cy - 74, "text-anchor": "middle", style: "fill:var(--key);font-weight:600" }, nice(v)));
      il((xs[1] + xs[2]) / 2, I.I1); if (S.useB) il((xs[2] + xs[3]) / 2, I.I2); il((xs[3] + xs[4]) / 2, I.I3);
      s.append(svg("rect", { x: xs[4] - 4, y: cy - 82, width: 16, height: 164, rx: 3, fill: "var(--line)" }));
      s.append(svg("circle", { cx: xs[4] - 4, cy, r: (8 + 44 * I.I3).toFixed(1), fill: "var(--key)", "fill-opacity": (0.1 + 0.8 * I.I3).toFixed(2) }));
      s.append(lbl(xs[4], cy + 104, "Tường: " + nice(I.I3), "lbl"));
      return s;
    }
    function draw() {
      const I = intens();
      const stp = [{ t: "Đèn → <b>A</b> (" + S.A + "°): ánh sáng tự nhiên, một nửa đi qua và mang phân cực " + S.A + "°", r: "I₁ = ½" }];
      if (S.useB) {
        stp.push({ t: "A → <b>B</b>: cos²(" + S.B + "° − " + S.A + "°) = cos²(" + (S.B - S.A) + "°) = " + nice(I.tAB), r: "I₂ = ½ × " + nice(I.tAB) + " = " + nice(I.I2) });
        stp.push({ t: "B → <b>C</b>: cos²(" + S.C + "° − " + S.B + "°) = cos²(" + (S.C - S.B) + "°) = " + nice(I.tBC), r: "I₃ = " + nice(I.I2) + " × " + nice(I.tBC) + " = " + nice(I.I3), hi: true });
      } else stp.push({ t: "A → <b>C</b> (không có B): cos²(" + S.C + "° − " + S.A + "°) = cos²(" + (S.C - S.A) + "°) = " + nice(I.tAC), r: "I₃ = ½ × " + nice(I.tAC) + " = " + nice(I.I3), hi: true });
      const noB = 0.5 * I.tAC;
      let note;
      if (I.I3 < 1e-9) note = ui.note("Tường <b>tối hoàn toàn</b>: hai kính vuông góc liên tiếp (cos² 90° = 0) chặn hết ánh sáng.", "eve");
      else if (S.useB && I.I3 > noB + 1e-9) note = ui.note("Nghịch lý: thêm kính B lại làm tường <b>sáng hơn</b> (" + nice(I.I3) + " so với " + nice(noB) + " khi không có B). B là một phép đo: nó “xóa” thông tin phân cực cũ và tạo trạng thái mới theo góc B — đo là can thiệp (slide 1.2).", "key");
      else note = ui.note("Mỗi kính là một phép đo với hai kết quả (đi qua / bị chặn); sau khi đi qua, photon mang đúng phân cực của kính đó.", "mut");
      /* bảng Malus như slide 1.2, tô dòng ứng với các chênh lệch góc đang dùng */
      const used = new Set(S.useB ? [Math.abs(S.B - S.A), Math.abs(S.C - S.B)] : [Math.abs(S.C - S.A)]);
      const malus = [0, 30, 45, 60, 90].map(d => [d + "°", "cos²(" + d + "°)", nice(cos2(d))]);
      out.render(beamSvg(I),
        ui.readouts([
          { k: "Sau A", v: nice(I.I1), kind: "key" },
          { k: "Sau B", v: S.useB ? nice(I.I2) : "—", kind: "key" },
          { k: "Tới tường", v: nice(I.I3), kind: "key", big: true },
          { k: "Công thức", v: S.useB ? "½·cos²(B−A)·cos²(C−B)" : "½·cos²(C−A)" }
        ]),
        ui.steps(stp), note,
        h("div", { class: "cols" },
          ui.table(["Chênh lệch góc", "Định luật Malus", "Xác suất qua"], malus, { mono: true, cls: "tight", rowCls: (row, i) => (used.has([0, 30, 45, 60, 90][i]) ? "hi" : null) }),
          ui.note("Mô hình vectơ (slide 1.3): |→⟩ = (|↗⟩ − |↖⟩)/√2 nên qua B (|↗⟩) với xác suất (1/√2)² = ½; |↗⟩ = (|→⟩ + |↑⟩)/√2 nên qua C (|↑⟩) lại với ½ ⇒ tổng ⅛ kể cả ½ của A. Sau mỗi phép đo, trạng thái <b>sụp đổ</b> về kết quả đo.", "mut")));
      boxB.draw();
    }
    function drawBox(box) {
      const I = intens(); const pts = [];
      for (let t = 0; t <= 180; t++) pts.push([t, 0.5 * cos2(t - S.A) * cos2(S.C - t)]);
      chart.line(box, { title: "Cường độ tới tường theo góc kính B (A = " + S.A + "°, C = " + S.C + "°)", xlabel: "Góc kính B (°)", ylabel: "Cường độ", xmin: 0, xmax: 180, ymin: 0, ymax: 0.5, fmtY: v => v.toFixed(3),
        series: [{ name: "Có kính B", color: "key", points: pts, area: true }, { name: "Vị trí hiện tại", color: "pt", points: [[S.B, S.useB ? I.I3 : 0.5 * I.tAC]], markerOnly: true, r: 6 }],
        hlines: [{ y: 0.5 * I.tAC, label: "không có B: " + nice(0.5 * I.tAC) }], vlines: [{ x: 45, label: "45°" }, { x: 135, label: "135°" }] });
    }
    function drawN() {
      const n = S.n, step = 90 / n, c = cos2(step), I = 0.5 * Math.pow(c, n);
      outN.render(
        ui.readouts([{ k: "Chênh lệch mỗi kính", v: fmt(step, 2) + "°" }, { k: "cos²(90°/n)", v: nice(c) }, { k: "Cường độ ra", v: nice(I), kind: "key", big: true }, { k: "So với n = 1", v: "0" }]),
        ui.steps([
          { t: "n = " + n + " kính đặt tại " + Array.from({ length: Math.min(n, 6) }, (_, i) => fmt((i + 1) * step, 1) + "°").join(", ") + (n > 6 ? ", …" : "") + " sau kính A ngang", r: "mỗi lần quay thêm 90°/" + n + " = " + fmt(step, 2) + "°" },
          { t: "Mỗi kính cho qua cos²(" + fmt(step, 2) + "°)", r: "cos² = " + nice(c) },
          { t: "Qua n kính liên tiếp rồi nhân ½ của kính A", r: "I = ½ · " + nice(c) + sup(n) + " = " + nice(I), hi: true }
        ]),
        ui.note("Càng nhiều phép đo nhỏ, ánh sáng càng ít bị mất: ½·cos" + sup("2n") + "(90°/n) → ½ khi n → ∞ (hiệu ứng Zeno lượng tử). Với n = 1 (chỉ A rồi C) tường tối; n = 2 chính là thí nghiệm ba kính (⅛).", "mut"));
      boxN.draw();
    }
    function drawBoxN(box) {
      const pts = []; for (let n = 1; n <= 30; n++) pts.push([n, 0.5 * Math.pow(cos2(90 / n), n)]);
      chart.line(box, { title: "Cường độ ra theo số kính n", xlabel: "n", ylabel: "Cường độ", xmin: 1, xmax: 30, ymin: 0, ymax: 0.5, fmtY: v => v.toFixed(2),
        series: [{ name: "½·cos²ⁿ(90°/n)", color: "key", points: pts, marker: true, r: 3 }, { name: "n hiện tại", color: "pt", points: [[S.n, 0.5 * Math.pow(cos2(90 / S.n), S.n)]], markerOnly: true, r: 6 }],
        hlines: [{ y: 0.5, label: "giới hạn ½" }] });
    }
    draw(); drawN();
    pane.appendChild(root);
  }
};

/* ============================================================================
   TAB 2 — Qubit |ψ⟩ = α|0⟩ + β|1⟩, phép đo theo hai cơ sở, cổng X, Z, H
   ============================================================================ */
const tabQubit = {
  id: "qubit", title: "Qubit và phép đo",
  intro: "|ψ⟩ = α|0⟩ + β|1⟩ với α = cos θ, β = ±sin θ (α² + β² = 1). Đo theo cơ sở Z cho 0 với xác suất α²; đo theo cơ sở X cho |+⟩ với xác suất (α + β)²/2. Slide 1.4: α = √3/2, β = 1/2 ⇒ P(0) = 3/4, P(+) ≈ 0,933; 1000 lần đo ⇒ ~750 lần ra 0.",
  build(pane) {
    /* mầm 3: 1000 lần đo đầu tiên với P(0) = ¾ cho đúng 750 lần ra 0 như slide 1.4 */
    const S = { th: 30, neg: false, basis: "Z", seed: 3, cnt: [0, 0], shots: 0, last: null, tape: [] };
    let rng = LAB.rng(S.seed);
    const st = () => { const a = Math.cos(S.th * D2R), b = Math.sin(S.th * D2R) * (S.neg ? -1 : 1); return [a, b]; };
    const probs = ([a, b]) => ({ p0: a * a, p1: b * b, pp: (a + b) * (a + b) / 2, pm: (a - b) * (a - b) / 2 });
    const sgn = v => v < -1e-12 ? "−" : "+";
    const ket = (a, b) => fmt(Math.abs(a)) + "|0⟩ " + sgn(b) + " " + fmt(Math.abs(b)) + "|1⟩";
    const { root, ctrl, view } = ui.sim();
    const fTh = ui.range({ id: "m6qb-th", label: "Góc θ (α = cos θ, β = sin θ)", min: 0, max: 90, step: 0.01, value: S.th, fmt: v => v.toFixed(2) + "°", onInput: v => { S.th = v; resetCnt(); draw(); } });
    const cNeg = ui.check({ id: "m6qb-neg", label: "β âm (pha tương đối π)", value: false, onChange: v => { S.neg = v; resetCnt(); draw(); } });
    const sgB = ui.seg({ id: "m6qb-basis", options: [["Z", "Cơ sở Z {|0⟩, |1⟩}"], ["X", "Cơ sở X {|+⟩, |−⟩}"]], value: "Z", onChange: v => { S.basis = v; resetCnt(); draw(); } });
    function resetCnt() { S.cnt = [0, 0]; S.shots = 0; S.last = null; S.tape = []; }
    const setState = (a, b) => {
      if (a < 0 || (Math.abs(a) < 1e-12 && b < 0)) { a = -a; b = -b; }   /* pha toàn cục không quan sát được */
      S.th = Math.atan2(Math.abs(b), a) / D2R; S.neg = b < -1e-12;
      fTh.set(S.th.toFixed(2)); cNeg.input.checked = S.neg; resetCnt(); draw();
    };
    const measure = k => {
      const p = probs(st()); const q = S.basis === "Z" ? p.p0 : p.pp;
      for (let i = 0; i < k; i++) {
        const r = rng() < q ? 0 : 1;
        S.cnt[r]++; S.last = r; S.tape.push(r);
      }
      if (S.tape.length > 32) S.tape = S.tape.slice(-32);   /* băng ghi 32 kết quả gần nhất */
      S.shots += k; draw();
    };
    ctrl.append(fTh, cNeg, h("div", { class: "fld" }, h("label", null, h("b", null, "Cơ sở đo")), sgB),
      h("div", { class: "row" },
        ui.btn("Đo 1 lần", () => measure(1), "pri"),
        ui.btn("Đo 1000 lần", () => measure(1000), "pri"),
        ui.btn("Xóa", () => { resetCnt(); draw(); }),
        ui.btn("Chạy lại (mầm mới)", () => { S.seed = (S.seed * 7 + 13) % 100003; rng = LAB.rng(S.seed); resetCnt(); draw(); })),
      ui.presets([
        { label: "(√3/2, 1/2) — slide 1.4", apply: () => setState(Math.sqrt(3) / 2, 0.5) },
        { label: "Bài tập 1.2: (1/√5, 2/√5)", apply: () => setState(1 / Math.sqrt(5), 2 / Math.sqrt(5)) },
        { label: "|0⟩", apply: () => setState(1, 0) }, { label: "|1⟩", apply: () => setState(0, 1) },
        { label: "|+⟩ = H|0⟩", apply: () => setState(Math.SQRT1_2, Math.SQRT1_2) }, { label: "|−⟩ = H|1⟩", apply: () => setState(Math.SQRT1_2, -Math.SQRT1_2) }
      ]));
    const out = ui.slot();
    const box = chart.box(b => drawBox(b));
    const gates = ui.slot();
    view.append(out, box, gates,
      ui.note("<b>Không sao chép (no-cloning, slide 1.8):</b> không có U nào biến |ψ⟩|0⟩ thành |ψ⟩|ψ⟩ với mọi |ψ⟩ — vì U tuyến tính, sao chép được |0⟩ và |1⟩ thì với |+⟩ sẽ ra (|00⟩ + |11⟩)/√2 ≠ |+⟩|+⟩. Hệ quả: Eve không thể nhân bản photon để đo sau; muốn biết thì phải đo, mà đo thì để lại nhiễu.", "mut"),
      ui.note("<b>Trạng thái Bell (slide 1.7):</b> |Φ⁺⟩ = (|00⟩ + |11⟩)/√2 tạo bằng H rồi CNOT; đo qubit 1 được 0 thì qubit 2 chắc chắn là 0. Không viết được thành tích hai trạng thái riêng ⇒ rối; CHSH: biến ẩn cục bộ |S| ≤ 2, lượng tử đạt 2√2 ≈ 2,83 (Nobel 2022).", "mut"));

    /* vòng tròn đơn vị với hai cơ sở */
    function circleSvg(a, b) {
      const R = 96, cx = 132, cy = 132;
      const s = svg("svg", { class: "diag", viewBox: "0 0 264 264", style: "max-width:300px" });
      const line = (x1, y1, x2, y2, extra) => svg("line", Object.assign({ x1, y1, x2, y2 }, extra));
      s.append(svg("circle", { cx, cy, r: R, fill: "none", stroke: "var(--line)" }));
      s.append(line(cx - R - 16, cy, cx + R + 16, cy, { stroke: "var(--pt)", "stroke-width": 1.5 }), line(cx, cy + R + 16, cx, cy - R - 16, { stroke: "var(--pt)", "stroke-width": 1.5 }));
      const d = (R + 12) * Math.SQRT1_2;
      s.append(line(cx - d, cy + d, cx + d, cy - d, { stroke: "var(--ct)", "stroke-dasharray": "5 4" }), line(cx - d, cy - d, cx + d, cy + d, { stroke: "var(--ct)", "stroke-dasharray": "5 4" }));
      const txt = (x, y, t, col, anchor) => svg("text", { x, y, "text-anchor": anchor || "middle", style: "fill:" + col + ";font-weight:600" }, t);
      s.append(txt(cx + R + 14, cy - 6, "|0⟩", "var(--pt)", "end"), txt(cx + 12, cy - R - 6, "|1⟩", "var(--pt)", "start"));
      s.append(txt(cx + d + 2, cy - d - 4, "|+⟩", "var(--ct)", "start"), txt(cx - d - 2, cy - d - 4, "|−⟩", "var(--ct)", "end"));
      const tx = cx + a * R, ty = cy - b * R;
      s.append(line(tx, ty, tx, cy, { stroke: "var(--faint)", "stroke-dasharray": "3 3" }), line(tx, ty, cx, ty, { stroke: "var(--faint)", "stroke-dasharray": "3 3" }));
      s.append(line(cx, cy, tx, ty, { stroke: "var(--key)", "stroke-width": 3, "stroke-linecap": "round" }), svg("circle", { cx: tx, cy: ty, r: 5, fill: "var(--key)" }));
      s.append(txt(tx, cy + (b >= 0 ? 14 : -6), "α", "var(--key)"), txt(cx + (a >= 0.15 ? -8 : 10), ty + 4, "β", "var(--key)", a >= 0.15 ? "end" : "start"));
      if (S.th > 2) { const r0 = 30, ex = cx + r0 * a, ey = cy - r0 * b; s.append(svg("path", { d: "M " + (cx + r0) + " " + cy + " A " + r0 + " " + r0 + " 0 0 " + (b >= 0 ? 0 : 1) + " " + ex.toFixed(1) + " " + ey.toFixed(1), fill: "none", stroke: "var(--key)" }), txt(cx + 40, cy + (b >= 0 ? -10 : 18), "θ", "var(--key)")); }
      return s;
    }
    function draw() {
      const [a, b] = st(); const p = probs([a, b]);
      const Z = S.basis === "Z";
      const lab0 = Z ? "|0⟩" : "|+⟩", lab1 = Z ? "|1⟩" : "|−⟩";
      const q0 = Z ? p.p0 : p.pp, q1 = Z ? p.p1 : p.pm;
      const f0 = S.shots ? S.cnt[0] / S.shots : null;
      const sym0 = Z ? "0" : "+", sym1 = Z ? "1" : "−";
      out.render(
        h("div", { class: "cols" },
          circleSvg(a, b),
          h("div", { class: "stack" },
            ui.readouts([
              { k: "|ψ⟩", v: ket(a, b), kind: "key", big: true },
              { k: "α", v: fmt(a, 4), kind: "key" },
              { k: "β", v: fmt(b, 4), kind: "key" },
              { k: "α² + β²", v: fmt(a * a + b * b, 4), kind: "ok" }
            ]),
            ui.table(["Cơ sở", "Kết quả", "Công thức", "Xác suất"], [
              ["Z", "|0⟩", "α²", { html: nice(p.p0), cls: Z ? "key-c" : "" }],
              ["Z", "|1⟩", "β²", { html: nice(p.p1), cls: Z ? "key-c" : "" }],
              ["X", "|+⟩", "(α + β)²/2", { html: nice(p.pp), cls: Z ? "" : "key-c" }],
              ["X", "|−⟩", "(α − β)²/2", { html: nice(p.pm), cls: Z ? "" : "key-c" }]
            ], { mono: true, cls: "tight" }))),
        ui.steps([
          { t: "Trạng thái: α = cos " + fmt(S.th, 2) + "° = " + fmt(a, 4) + ", β = " + (S.neg ? "−" : "") + "sin " + fmt(S.th, 2) + "° = " + fmt(b, 4), r: "|ψ⟩ = " + ket(a, b) },
          { t: "Đo theo cơ sở " + S.basis + ": P(" + lab0 + ") = " + (Z ? "α²" : "(α + β)²/2"), r: fmt(q0, 4) + "  ;  P(" + lab1 + ") = " + fmt(q1, 4) + "  (tổng = 1 ✓)", hi: true },
          { t: "Mô phỏng " + S.shots + " lần đo (mỗi lần một bản sao mới; mầm " + S.seed + ")" + (S.last != null ? " — lần cuối ra <b>" + (S.last ? lab1 : lab0) + "</b>" : ""),
            r: S.shots ? lab0 + ": " + S.cnt[0] + " (" + pct(f0) + ")  ;  " + lab1 + ": " + S.cnt[1] + " (" + pct(1 - f0) + ")  — lý thuyết " + pct(q0) + " / " + pct(q1) : "chưa đo — bấm «Đo 1 lần» hoặc «Đo 1000 lần»" }
        ]),
        S.tape.length ? ui.bits(S.tape.map(r => (r ? sym1 : sym0)), { label: "Kết quả gần nhất", kinds: S.tape.map(r => (r ? "ct" : "pt")), group: 8 }) : null,
        ui.note("Một lần đo chỉ cho <b>một bit cổ điển</b> và trạng thái sụp đổ về kết quả; α, β không đọc trực tiếp được — chỉ ước lượng qua tần suất trên nhiều bản sao. Đo theo cơ sở X tương đương xoay kính lọc 45° (H biến Z ↔ X).", "mut"));
      box.draw();
      drawGates(a, b);
    }
    function drawBox(box) {
      const p = probs(st()); const Z = S.basis === "Z";
      const th = Z ? [p.p0, p.p1] : [p.pp, p.pm];
      const fr = S.shots ? [S.cnt[0] / S.shots, S.cnt[1] / S.shots] : [0, 0];
      chart.bars(box, { title: "Tần suất đo (" + S.shots + " lần) so với xác suất lý thuyết — cơ sở " + S.basis, labels: Z ? ["|0⟩", "|1⟩"] : ["|+⟩", "|−⟩"], ymax: 1, fmtY: v => v.toFixed(2), aspect: 0.32,
        series: [{ name: "Tần suất mô phỏng", color: "pt", values: fr }, { name: "Lý thuyết", color: "key", values: th }] });
    }
    const s2 = Math.SQRT1_2;
    const GATES = [
      { n: "X (NOT)", M: [[0, 1], [1, 0]], txt: [["0", "1"], ["1", "0"]], eff: "|0⟩ ↔ |1⟩" },
      { n: "Z", M: [[1, 0], [0, -1]], txt: [["1", "0"], ["0", "−1"]], eff: "|1⟩ → −|1⟩ (đổi pha)" },
      { n: "H (Hadamard)", M: [[s2, s2], [s2, -s2]], txt: [["1/√2", "1/√2"], ["1/√2", "−1/√2"]], eff: "|0⟩ → |+⟩, |1⟩ → |−⟩; H·H = I" }
    ];
    function drawGates(a, b) {
      gates.render(ui.title("Cổng một qubit (slide 1.5)", "ma trận unita: khả nghịch, bảo toàn độ dài"),
        ui.table(["Cổng", "Ma trận", "Tác dụng", "Áp dụng lên |ψ⟩ hiện tại", ""], GATES.map(g => {
          const na = g.M[0][0] * a + g.M[0][1] * b, nb = g.M[1][0] * a + g.M[1][1] * b;
          return [g.n, ui.matrix(g.txt), g.eff, { html: ket(na, nb) + (na < 0 ? " ≡ " + ket(-na, -nb) + " (pha toàn cục)" : ""), cls: "mono" }, ui.btn("Áp dụng", () => setState(na, nb), "sm")];
        }), { cls: "tight" }),
        ui.note("Ví dụ: H|0⟩ = (|0⟩ + |1⟩)/√2 = |+⟩ ⇒ đo được 0 hoặc 1 với xác suất ½ — bộ sinh bit ngẫu nhiên thật (QRNG). H|+⟩ = |0⟩: hai nhánh giao thoa, nền tảng của thuật toán lượng tử. Bài tập 1.3: H|1⟩ = |−⟩, H·H|0⟩ = |0⟩.", "mut"));
    }
    draw();
    pane.appendChild(root);
  }
};

/* ============================================================================
   TAB 3 — BB84: sàng lọc, Eve chặn – gửi lại, QBER, tốc độ khóa r = 1 − 2h(Q)
   ============================================================================ */
const PH = { "+0": "→", "+1": "↑", "×0": "↗", "×1": "↖" };
/* mô phỏng một phiên BB84; P = {N, seed, f, aBits, aBases, bBases, fix:{eveBasis, eveBit, bobBit}} (mảng cố định có thể null) */
function bb84(P) {
  const rng = LAB.rng(P.seed), rb = () => (rng() < 0.5 ? 0 : 1), fx = P.fix || {};
  const pick = (arr, i) => (arr && arr[i] != null ? arr[i] : null);
  const rows = [];
  for (let i = 0; i < P.N; i++) {
    const ab = pick(P.aBits, i) != null ? P.aBits[i] : rb();
    const aB = pick(P.aBases, i) != null ? P.aBases[i] : (rb() ? "×" : "+");
    let phB = aB, phBit = ab, eve = null;
    if (rng() < P.f) {
      const eB = pick(fx.eveBasis, i) != null ? fx.eveBasis[i] : (rb() ? "×" : "+");
      const eBit = eB === aB ? ab : (pick(fx.eveBit, i) != null ? fx.eveBit[i] : rb());
      eve = { basis: eB, bit: eBit, wrong: eB !== aB }; phB = eB; phBit = eBit;
    }
    const bB = pick(P.bBases, i) != null ? P.bBases[i] : (rb() ? "×" : "+");
    const bBit = bB === phB ? phBit : (pick(fx.bobBit, i) != null ? fx.bobBit[i] : rb());
    const keep = aB === bB;
    rows.push({ i, ab, aB, photon: PH[aB + ab], eve, bB, bBit, keep, err: keep && bBit !== ab });
  }
  const sift = rows.filter(r => r.keep);
  return { rows, sift, nErr: sift.filter(r => r.err).length };
}
const tabBB84 = {
  id: "bb84", title: "BB84 và QBER",
  intro: "Alice gửi photon theo bit và cơ sở ngẫu nhiên (+: → ↑, ×: ↗ ↖); Bob đo theo cơ sở ngẫu nhiên; công bố cơ sở và giữ vị trí trùng (sàng lọc). Eve chặn – gửi lại gây lỗi 25 % trên phần bị chặn; QBER > ~11 % ⇒ hủy phiên. Preset: ví dụ 10 photon slide 2.4 ⇒ khóa 110001; slide 2.6 với Eve ⇒ QBER 33 %.",
  build(pane) {
    const SL = { aBits: "1011001011".split("").map(Number), aBases: "+××++×+××+".split(""), bBases: "++××+×××++".split("") };
    /* preset slide 2.4: Bob đo sai cơ sở ở vị trí 2, 4, 7, 9 cho kết quả ngẫu nhiên 1, 0, 1, 0 như slide */
    const P24 = { N: 10, aBits: SL.aBits, aBases: SL.aBases, bBases: SL.bBases, fix: { bobBit: [null, 1, null, 0, null, null, 1, null, 0, null] } };
    /* preset slide 2.6: Eve dùng cơ sở + + × × + + tại các vị trí giữ 1, 3, 5, 6, 8, 10; kết quả ngẫu nhiên lấy đúng "ví dụ" của slide */
    const P26 = { N: 10, aBits: SL.aBits, aBases: SL.aBases, bBases: SL.bBases, fix: {
      eveBasis: ["+", null, "+", null, "×", "×", null, "+", null, "+"],
      eveBit: [null, null, 0, null, 1, null, null, 1, null, null],
      bobBit: [null, null, 0, null, 0, null, null, 1, null, null] } };
    const S = { N: 10, seed: 24, f: 0, chk: 0.5, pos: 3, fixed: P24 };
    const { root, ctrl, view } = ui.sim({ wide: false });
    const fN = ui.range({ id: "m6bb-n", label: "Số photon N", min: 10, max: 200, value: S.N, onInput: v => { S.N = v; S.fixed = null; draw(); } });
    const fSeed = ui.field({ id: "m6bb-seed", label: "Mầm ngẫu nhiên", type: "number", value: S.seed, onInput: v => { S.seed = parseInt(v) || 1; draw(); } });
    const fF = ui.range({ id: "m6bb-f", label: "Tỷ lệ photon Eve chặn", min: 0, max: 100, value: 0, fmt: v => v + " %", onInput: v => { S.f = v / 100; draw(); } });
    const sgChk = ui.seg({ id: "m6bb-chk", options: [["0", "0"], ["0.25", "¼"], ["0.5", "½"], ["1", "tất cả"]], value: "0.5", onChange: v => { S.chk = parseFloat(v); draw(); } });
    const fPos = ui.range({ id: "m6bb-pos", label: "Soi một photon: vị trí", min: 1, max: 10, value: S.pos, onInput: v => { S.pos = v; drawOne(); } });
    const preset = (fixed, f) => { S.fixed = fixed; S.N = fixed.N; S.f = f; fN.set(S.N); fF.set(Math.round(f * 100)); draw(); };
    ctrl.append(fN, fSeed, fF, h("div", { class: "fld" }, h("label", null, h("b", null, "Phần khóa sàng lọc đem công bố để kiểm tra")), sgChk), fPos,
      h("div", { class: "row" }, ui.btn("Chạy lại (mầm mới)", () => { S.seed = (S.seed * 31 + 7) % 100003; fSeed.input.value = S.seed; draw(); }, "pri")),
      ui.presets([
        { label: "10 photon, không có Eve (slide 2.4)", apply: () => preset(P24, 0) },
        { label: "Eve chặn tất cả (slide 2.6)", apply: () => preset(P26, 1) },
        { label: "Bài tập 2.1 (8 photon)", apply: () => preset({ N: 8, aBits: "01101001".split("").map(Number), aBases: "++××+×+×".split(""), bBases: "+××++++×".split(""), fix: {} }, 0) },
        { label: "Ngẫu nhiên N = 100, Eve 50 %", apply: () => { S.fixed = null; S.N = 100; S.f = 0.5; fN.set(100); fF.set(50); draw(); } },
        { label: "Bài tập 2.4: Eve chặn 20 %, N = 200", apply: () => { S.fixed = null; S.N = 200; S.f = 0.2; fN.set(200); fF.set(20); draw(); } }
      ]));
    const out = ui.slot();
    const one = ui.slot();
    const boxQ = chart.box(b => drawBoxQ(b));
    const boxR = chart.box(b => drawBoxR(b));
    view.append(out, one, h("div", { class: "cols" }, boxQ, boxR));
    let cur = null;
    /* soi đường đi của một photon: Alice → (Eve) → Bob, dùng lưới .flow của core */
    function drawOne() {
      if (!cur) return;
      const N = cur.rows.length;
      fPos.input.max = N; if (S.pos > N) { S.pos = N; fPos.set(N); }
      const r = cur.rows[S.pos - 1];
      const who = (cls, t) => h("div", { class: "who " + cls }, t);
      const msg = t => h("div", { class: "msg", html: t });
      const arrow = () => h("div", { class: "arrow" }, "→");
      const side = t => h("div", { class: "side", html: t });
      const flow = h("div", { class: "flow" });
      flow.append(who("a", "Alice"), arrow(), r.eve ? who("e", "Eve") : who("b", "Bob"));
      flow.append(side("bit " + r.ab + ", cơ sở " + r.aB), msg("photon " + r.photon), r.eve
        ? side("đo theo " + r.eve.basis + (r.eve.wrong ? " (sai cơ sở ⇒ kết quả ngẫu nhiên) ⇒ " : " (đúng cơ sở) ⇒ ") + r.eve.bit + ", gửi lại " + PH[r.eve.basis + r.eve.bit])
        : side("đo theo " + r.bB + (r.keep ? " (trùng cơ sở) ⇒ chắc chắn " : " (khác cơ sở) ⇒ ngẫu nhiên ") + r.bBit));
      if (r.eve) {
        flow.append(who("e", "Eve"), arrow(), who("b", "Bob"));
        flow.append(side("gửi lại " + PH[r.eve.basis + r.eve.bit]), msg("photon " + PH[r.eve.basis + r.eve.bit]), side("đo theo " + r.bB + (r.bB === r.eve.basis ? " (trùng cơ sở Eve) ⇒ " : " (khác cơ sở) ⇒ ngẫu nhiên ") + r.bBit));
      }
      let verdict;
      if (!r.keep) verdict = ui.note("Vị trí " + S.pos + ": Alice (" + r.aB + ") và Bob (" + r.bB + ") khác cơ sở ⇒ <b>bị loại khi sàng lọc</b>, kết quả của Bob không dùng.", "mut");
      else if (r.err) verdict = ui.note("Vị trí " + S.pos + ": trùng cơ sở nhưng Bob đo " + r.bBit + " ≠ bit Alice " + r.ab + " ⇒ <b>lỗi do Eve</b> (Eve đo sai cơ sở nên photon gửi lại đã đổi trạng thái).", "eve");
      else verdict = ui.note("Vị trí " + S.pos + ": trùng cơ sở, Bob đo đúng bit " + r.ab + " ⇒ vào khóa sàng lọc" + (r.eve && r.eve.wrong ? " (Eve sai cơ sở nhưng Bob vẫn may mắn đo đúng — xác suất ½)" : "") + ".", "ok");
      one.render(ui.title("Soi photon ở vị trí " + S.pos, "Alice → " + (r.eve ? "Eve → " : "") + "Bob"), flow, verdict);
    }
    function run() {
      const F = S.fixed;
      const N = F ? F.N : S.N;
      return bb84({ N, seed: S.seed, f: S.f, aBits: F && F.aBits, aBases: F && F.aBases, bBases: F && F.bBases, fix: F && F.fix });
    }
    function draw() {
      const R = run(); cur = R;
      const N = R.rows.length, sift = R.sift, n = sift.length;
      const step = S.chk > 0 ? Math.round(1 / S.chk) : 0;
      sift.forEach((r, k) => { r.chk = step > 0 && (k % step === step - 1); });
      const chkRows = sift.filter(r => r.chk), nChk = chkRows.length, eChk = chkRows.filter(r => r.err).length;
      const Qall = n ? R.nErr / n : 0, Qest = nChk ? eChk / nChk : null;
      const Qth = 0.25 * S.f;
      const hQ = math.H2(Qall), rate = Math.max(0, 1 - 2 * hQ);
      const left = Math.max(0, n - nChk), keyBits = Math.floor(left * rate);
      const anyEve = R.rows.some(r => r.eve);
      const C = (html, cls) => ({ html, cls: "c " + (cls || "") });
      const dim = t => '<span style="opacity:.45">' + t + "</span>";
      const hdr = ["Vị trí", ...R.rows.map(r => String(r.i + 1))];
      const tbl = [
        ["Bit Alice", ...R.rows.map(r => C(r.ab, "pt-c"))],
        ["Cơ sở Alice", ...R.rows.map(r => C(r.aB, "pt-c"))],
        ["Photon gửi", ...R.rows.map(r => C(r.photon, "pt-c"))]
      ];
      if (anyEve) {
        tbl.push(["Cơ sở Eve", ...R.rows.map(r => C(r.eve ? r.eve.basis : "·", r.eve ? (r.eve.wrong ? "eve-c" : "") : ""))]);
        tbl.push(["Eve gửi lại", ...R.rows.map(r => C(r.eve ? PH[r.eve.basis + r.eve.bit] : "·", r.eve ? "eve-c" : ""))]);
      }
      tbl.push(["Cơ sở Bob", ...R.rows.map(r => C(aquaSpan(r.bB)))]);
      tbl.push(["Bob đo được", ...R.rows.map(r => C(r.keep ? (r.err ? '<span class="eve-c">' + r.bBit + "</span>" : aquaSpan(r.bBit)) : dim(r.bBit)))]);
      tbl.push(["Giữ lại?", ...R.rows.map(r => C(r.keep ? "✓" : "", "ok-c"))]);
      tbl.push(["Khóa Alice", ...R.rows.map(r => C(r.keep ? r.ab : "", "pt-c"))]);
      tbl.push(["Khóa Bob", ...R.rows.map(r => C(r.keep ? r.bBit : "", r.err ? "eve-c" : ""))]);
      tbl.push(["Bit kiểm tra", ...R.rows.map(r => C(r.keep && r.chk ? (r.err ? "✗" : "✓") : "", r.err && r.chk ? "eve-c" : "key-c"))]);
      const keyA = sift.map(r => String(r.ab)), keyB = sift.map(r => String(r.bBit));
      const posList = sift.map(r => r.i + 1).join(", ");
      const sumNote = Qall > 0.11
        ? ui.note("<b>QBER = " + pct(Qall) + " > ngưỡng ≈ 11 %</b> ⇒ không trích được khóa an toàn — hủy phiên và thử lại (slide 2.6–2.7).", "eve")
        : (S.f > 0
          ? ui.note("QBER " + pct(Qall) + " dưới ngưỡng 11 %: Eve chặn một phần vẫn để lại lỗi; tăng số bit kiểm tra để phát hiện chắc hơn (bài tập 2.2: cần n ≥ 49 bit để 0,75ⁿ < 10⁻⁶).", "key")
          : ui.note("Không có Eve ⇒ khóa Alice và Bob trùng nhau; kênh thật vẫn có nhiễu nên cần sửa lỗi (Cascade/LDPC) và khuếch đại bảo mật. Bài tập 2.3: Q = 5 % ⇒ r = " + fmt(1 - 2 * math.H2(0.05), 3) + " ⇒ 10⁶ bit sàng lọc còn ≈ " + Math.floor((1 - 2 * math.H2(0.05)) * 1e6).toLocaleString("vi-VN") + " bit khóa.", "ok"));
      out.render(
        ui.readouts([
          { k: "Giữ lại (trùng cơ sở)", v: n + " / " + N + " = " + pct(n / N), kind: "ok" },
          { k: "QBER thực (trên khóa sàng lọc)", v: n ? R.nErr + "/" + n + " = " + pct(Qall) : "—", kind: Qall > 0.11 ? "eve" : "ok", big: true },
          { k: "QBER ước lượng (" + nChk + " bit công bố)", v: Qest == null ? "—" : eChk + "/" + nChk + " = " + pct(Qest), kind: "key" },
          { k: "Lý thuyết 25 % × tỷ lệ chặn", v: pct(Qth) + " (f = " + pct(S.f, 0) + ")", kind: "eve" },
          { k: "Tốc độ khóa r = 1 − 2h(Q)", v: fmt(rate, 3), kind: "ct" },
          { k: "Bit khóa còn lại", v: keyBits + " (từ " + left + " bit)", kind: "ct" }
        ]),
        ui.table(hdr, tbl, { cls: "grid tight", mono: true }),
        h("div", { class: "stack" }, ui.bits(keyA, { label: "Khóa Alice", kind: "pt", group: 8 }), ui.bits(keyB, { label: "Khóa Bob", kinds: sift.map(r => (r.err ? "eve" : "aqua")), group: 8 })),
        ui.steps([
          { t: "Sàng lọc: công bố cơ sở, giữ vị trí Alice và Bob trùng cơ sở" + (N <= 20 ? " (" + posList + ")" : ""), r: n + " bit giữ lại; khóa thô của Alice: " + (n <= 40 ? keyA.join(" ") : keyA.slice(0, 40).join(" ") + " …") },
          { t: "Eve chặn tỷ lệ f = " + pct(S.f, 0) + ": với mỗi bit giữ lại, Eve sai cơ sở ½, khi đó Bob sai ½ ⇒ lỗi kỳ vọng ¼·f", r: "QBER lý thuyết = 0,25 × " + fmt(S.f, 2) + " = " + pct(Qth) + " ; thực tế " + R.nErr + "/" + n + " = " + pct(Qall) },
          { t: "Công bố " + nChk + " bit kiểm tra (" + (S.chk === 1 ? "tất cả" : S.chk === 0 ? "không" : "1/" + step + " số bit") + ") để ước lượng lỗi; xác suất Eve (chặn hết) lọt lưới = 0,75" + sup(nChk), r: (Qest == null ? "QBER ước lượng: —" : "QBER ước lượng = " + pct(Qest)) + " ; 0,75^" + nChk + " = " + (nChk ? (Math.pow(0.75, nChk)).toExponential(2) : "1") },
          { t: "Tốc độ khóa (Shor–Preskill): h(Q) = −Q log₂Q − (1−Q) log₂(1−Q) với Q = " + fmt(Qall, 3), r: "h(Q) = " + fmt(hQ, 3) + " ⇒ r = 1 − 2·" + fmt(hQ, 3) + " = " + fmt(1 - 2 * hQ, 3) + (1 - 2 * hQ < 0 ? " < 0 ⇒ r = 0" : ""), hi: true },
          { t: "Khóa cuối sau sửa lỗi và khuếch đại bảo mật ≈ (số bit giữ lại − bit kiểm tra) × r", r: "(" + n + " − " + nChk + ") × " + fmt(rate, 3) + " ≈ " + keyBits + " bit" }
        ]),
        sumNote);
      drawOne();
      boxQ.draw(); boxR.draw();
    }
    function drawBoxQ(box) {
      const sim = [], th = [];
      for (let k = 0; k <= 10; k++) { const f = k / 10; const R = bb84({ N: 200, seed: S.seed + 101 * k + 7, f }); sim.push([f, R.sift.length ? R.nErr / R.sift.length : 0]); th.push([f, 0.25 * f]); }
      const curQ = cur && cur.sift.length ? cur.nErr / cur.sift.length : 0;
      chart.line(box, { title: "QBER theo tỷ lệ photon Eve chặn (mô phỏng N = 200 mỗi điểm)", xlabel: "Tỷ lệ chặn f", ylabel: "QBER", xmin: 0, xmax: 1, ymin: 0, ymax: 0.35, fmtY: v => pct(v, 0), fmtX: v => pct(v, 0),
        series: [{ name: "Lý thuyết 0,25·f", color: "eve", points: th, dash: [5, 4] }, { name: "Mô phỏng", color: "pt", points: sim, marker: true }, { name: "Phiên hiện tại", color: "key", points: [[S.f, curQ]], markerOnly: true, r: 6 }],
        hlines: [{ y: 0.11, label: "ngưỡng 11 %" }] });
    }
    function drawBoxR(box) {
      const pts = []; for (let q = 0; q <= 0.5 + 1e-9; q += 0.005) pts.push([q, Math.max(0, 1 - 2 * math.H2(q))]);
      const curQ = cur && cur.sift.length ? cur.nErr / cur.sift.length : 0;
      chart.line(box, { title: "Tốc độ khóa r = 1 − 2h(Q) (slide 2.7)", xlabel: "QBER Q", ylabel: "r", xmin: 0, xmax: 0.5, ymin: 0, ymax: 1, fmtX: v => pct(v, 0), fmtY: v => v.toFixed(1),
        series: [{ name: "r(Q)", color: "ct", points: pts, area: true }, { name: "Phiên hiện tại", color: "key", points: [[curQ, Math.max(0, 1 - 2 * math.H2(curQ))]], markerOnly: true, r: 6 }],
        vlines: [{ x: 0.11, label: "11 %", color: "var(--eve)" }, { x: 0.05, label: "5 %: r = 0,427" }] });
    }
    draw();
    pane.appendChild(root);
  }
};

/* ============================================================================
   TAB 4 — Giải thuật Shor: chu kỳ r, phân bố sau QFT, đo c, liên phân số
   ============================================================================ */
function order(a, N) { let v = a % N, r = 1; while (v !== 1 && r <= N) { v = (v * a) % N; r++; } return v === 1 ? r : null; }
function primePower(N) { for (let k = 2; k <= 14; k++) { const g = Math.round(Math.pow(N, 1 / k)); for (const b of [g - 1, g, g + 1]) if (b > 1 && Math.pow(b, k) === N && math.isPrime(b)) return [b, k]; } return null; }
/* P(c) = |Σ_{x≡x₀ (mod r), x<M} e^{2πi xc/M}|² / (M·A) bằng công thức tổng cấp số nhân: |Σ| = |sin(π r c A/M) / sin(π r c/M)| */
function qftProbs(M, r, x0) {
  const A = Math.floor((M - 1 - x0) / r) + 1, P = new Float64Array(M);
  for (let c = 0; c < M; c++) {
    const t = r * c / M; let s;
    if (Math.abs(t - Math.round(t)) < 1e-9) s = A;
    else s = Math.abs(Math.sin(Math.PI * r * c * A / M) / Math.sin(Math.PI * r * c / M));
    P[c] = s * s / (M * A);
  }
  return { A, P };
}
const tabShor = {
  id: "shor", title: "Giải thuật Shor",
  intro: "Phân tích N = tìm chu kỳ r của f(x) = a<sup>x</sup> mod N: nếu r chẵn và a<sup>r/2</sup> ≢ −1 thì gcd(a<sup>r/2</sup> ± 1, N) là thừa số (slide 3.1). Máy lượng tử tìm r bằng QFT trên M = 2<sup>m</sup> ≥ N²: đo được c ≈ j·M/r, rồi liên phân số của c/M cho r. Preset: N = 15, a = 7 (slide 3.2, 3.7) và N = 21, a = 11, c = 427 (slide 3.8–3.10).",
  build(pane) {
    const S = { N: 15, a: 7, m: 8, x0: 1, c: 64, seed: 5, hist: [] };
    let rng = LAB.rng(S.seed);
    const { root, ctrl, view } = ui.sim();
    const autoM = N => Math.min(14, Math.max(4, Math.ceil(Math.log2(N * N))));
    const fNn = ui.field({ id: "m6sh-n", label: "N (hợp số lẻ ≤ 10 000)", type: "number", value: S.N, min: 3, max: 10000, onInput: v => { S.N = parseInt(v); S.m = autoM(S.N || 15); fM.set(S.m); S.c = null; fCin.input.value = ""; S.hist = []; drawAll(); } });
    const fa = ui.field({ id: "m6sh-a", label: "a (1 < a < N)", type: "number", value: S.a, min: 2, onInput: v => { S.a = parseInt(v); S.c = null; fCin.input.value = ""; S.hist = []; drawAll(); } });
    const fM = ui.range({ id: "m6sh-m", label: "m qubit thanh ghi 1 (M = 2ᵐ)", min: 4, max: 14, value: S.m, fmt: v => v + " (M = " + Math.pow(2, v) + ")", onInput: v => { S.m = v; S.c = null; fCin.input.value = ""; drawAll(); } });
    const fX = ui.range({ id: "m6sh-x0", label: "x₀: đo thanh ghi 2 được u = aˣ⁰ mod N", min: 0, max: 3, value: S.x0, onInput: v => { S.x0 = v; S.c = null; fCin.input.value = ""; drawAll(); } });
    const fCin = ui.field({ id: "m6sh-c", label: "c đo được (nhập tay hoặc bấm «Đo c»)", type: "number", value: S.c, min: 0, onInput: v => { S.c = v === "" ? null : parseInt(v); drawPost(); } });
    const randA = () => { const N = S.N; if (!(N > 3)) return; let a; for (let t = 0; t < 50; t++) { a = 2 + Math.floor(rng() * (N - 3)); if (Number(math.gcd(a, N)) === 1) break; } S.a = a; fa.input.value = a; S.c = null; fCin.input.value = ""; S.hist = []; drawAll(); };
    const measureC = () => { if (!S.P) return; const u = rng(); let acc = 0, c = S.P.length - 1; for (let i = 0; i < S.P.length; i++) { acc += S.P[i]; if (u < acc) { c = i; break; } } S.c = c; fCin.input.value = c; drawPost(true); };
    const preset = (N, a, m, x0, c) => { S.N = N; S.a = a; S.m = m; S.x0 = x0; S.c = c; S.hist = []; fNn.input.value = N; fa.input.value = a; fM.set(m); fX.set(x0); fCin.input.value = c == null ? "" : c; drawAll(); };
    ctrl.append(fNn, fa, h("div", { class: "row" }, ui.btn("Chọn a ngẫu nhiên", randA)), fM, fX, fCin,
      h("div", { class: "row" },
        ui.btn("Đo c", measureC, "pri"),
        ui.btn("Xóa lịch sử đo", () => { S.hist = []; drawPost(); }),
        ui.btn("Mầm mới", () => { S.seed = (S.seed * 17 + 3) % 100003; rng = LAB.rng(S.seed); })),
      ui.presets([
        { label: "N = 15, a = 7, m = 8 (slide 3.2, 3.7)", apply: () => preset(15, 7, 8, 1, 64) },
        { label: "N = 21, a = 11, c = 427 (slide 3.8–3.10)", apply: () => preset(21, 11, 9, 5, 427) },
        { label: "Bài tập 3.3: c = 86", apply: () => preset(21, 11, 9, 5, 86) },
        { label: "Bài tập 3.1: N = 35, a = 2", apply: () => preset(35, 2, 11, 0, null) },
        { label: "Bài tập 3.2: N = 21, a = 2", apply: () => preset(21, 2, 9, 0, null) },
        { label: "Về nhà: N = 33, a = 5", apply: () => preset(33, 5, 11, 0, null) },
        { label: "Về nhà: N = 55, a = 2", apply: () => preset(55, 2, 12, 0, null) },
        { label: "Thất bại: N = 15, a = 14", apply: () => preset(15, 14, 8, 0, null) }
      ]));
    const outC = ui.slot(), boxX = chart.box(b => drawBoxX(b)), outQ = ui.slot(), boxP = chart.box(b => drawBoxP(b)), outM = ui.slot();
    /* khối trực giác DFT (slide 3.3): dãy 8 mẫu, |F(c)| chỉ khác 0 tại bội của M/r */
    const D = { seq: "1,3,7,2,1,3,7,2" };
    const outD = ui.slot();
    const fSeq = ui.field({ id: "m6sh-seq", label: "Dãy 8 mẫu a₀ … a₇", value: D.seq, mono: true, onInput: v => { D.seq = v; drawD(); } });
    const dftPanel = ui.panel("Trực giác: DFT phát hiện chu kỳ (slide 3.3)",
      h("div", { class: "cols" }, fSeq, h("div", { class: "row" }, ui.btn("Lấy 8 giá trị aˣ mod N hiện tại", () => { if (!K || !K.r) return; D.seq = Array.from({ length: 8 }, (_, x) => Number(math.powmod(K.a, x, K.N))).join(","); fSeq.input.value = D.seq; drawD(); }, "sm"))),
      outD);
    function drawD() {
      const a = D.seq.split(/[\s,;]+/).filter(x => x !== "").map(Number);
      if (a.length !== 8 || a.some(x => !isFinite(x))) { outD.render(ui.note("Nhập đúng 8 số, cách nhau bởi dấu phẩy.", "eve")); return; }
      const M = 8, F = [];
      for (let c = 0; c < M; c++) { let re = 0, im = 0; for (let x = 0; x < M; x++) { const ph = 2 * Math.PI * x * c / M; re += a[x] * Math.cos(ph); im += a[x] * Math.sin(ph); } F.push(Math.hypot(re, im) / Math.sqrt(M)); }
      const mx = Math.max(...F);
      outD.render(
        ui.table(["c", ...F.map((_, c) => String(c))], [
          [{ html: "|F(c)|" }, ...F.map(v => ({ html: fmt(v, 2), cls: "c " + (v > 1e-9 ? "key-c" : "") }))]
        ], { cls: "grid tight", mono: true }),
        ui.note("F(c) = (1/√M) Σₓ aₓ e" + sup("2πi xc/M") + ". Dãy có chu kỳ r trong M mẫu ⇒ |F| chỉ khác 0 tại bội của M/r (giao thoa tăng cường); tại c khác các số hạng x và x + r triệt tiêu từng cặp. Đỉnh lớn nhất " + fmt(mx, 2) + " tại c = " + F.indexOf(mx) + ". Với dãy 1, 3, 7, 2 lặp lại: 9,19; 4,30; 2,12; 4,30 tại c = 0, 2, 4, 6 ⇒ r = 8/2 = 4.", "mut"));
    }
    view.append(outC, boxX,
      ui.title("Phân bố sau QFT (slide 3.6–3.9)", "thanh ghi 1 sau khi đo thanh ghi 2 được u"), outQ, boxP,
      ui.title("Đo c và hậu xử lý bằng liên phân số (slide 3.10)"), outM,
      dftPanel,
      ui.panel("Độ phức tạp (slide 3.11)",
        ui.table(["Thuật toán", "Độ phức tạp (N có L bit)", "RSA-2048"], [
          ["Chia thử", "2" + sup("L/2"), "2" + sup("1024")],
          ["Sàng trường số (GNFS)", "exp(1,92·L" + sup("1/3") + "(ln L)" + sup("2/3") + ")", "~2" + sup("112")],
          ["Shor (lượng tử)", "O(L³) cổng; ~2L–3L qubit logic", "~10" + sup("10") + " cổng"]
        ].map(r => r.map(x => ({ html: x }))), { cls: "tight" }),
        ui.note("Nút cổ chai là lũy thừa modulo lượng tử aˣ mod N, không phải QFT. Hàm mũ con → đa thức: tăng L gấp đôi chỉ tốn ~8 lần. Qubit logic ≠ qubit vật lý: cần mã sửa lỗi (surface code), hàng trăm – nghìn qubit vật lý cho mỗi qubit logic. Bài tập 3.4: N = 91 ⇒ 91² = 8281 ⇒ m = 14 (2¹⁴ = 16 384).", "mut")));
    let K = null;
    function core() {
      const N = S.N, a = S.a, R = { N, a, errs: [], warns: [] };
      if (!(Number.isInteger(N) && N >= 3 && N <= 10000)) { R.errs.push("N phải là số nguyên, 3 ≤ N ≤ 10 000."); return R; }
      if (N % 2 === 0) R.warns.push("N chẵn: thừa số 2 là tầm thường — Shor dùng cho N lẻ.");
      if (math.isPrime(N)) { R.errs.push("N = " + N + " là số nguyên tố: không có gì để phân tích (kiểm tra bằng Miller–Rabin trước khi chạy Shor)."); return R; }
      const pp = primePower(N); if (pp) R.warns.push("N = " + pp[0] + sup(pp[1]) + " là lũy thừa nguyên tố: bước cổ điển thử căn bậc k đã tìm ra, Shor không cần thiết.");
      if (!(Number.isInteger(a) && a > 1 && a < N)) { R.errs.push("Cần 1 < a < N."); return R; }
      R.g = Number(math.gcd(a, N));
      if (R.g > 1) { R.lucky = true; return R; }
      R.r = order(a, N);
      if (!R.r) { R.errs.push("Không tìm được chu kỳ."); return R; }
      R.even = R.r % 2 === 0;
      if (R.even) { R.y = Number(math.powmod(a, R.r / 2, N)); R.minus1 = R.y === N - 1; if (!R.minus1) { R.p = Number(math.gcd(R.y - 1, N)); R.q = Number(math.gcd(R.y + 1, N)); } }
      return R;
    }
    function drawAll() {
      K = core(); S.P = null;
      const errs = K.errs.map(e => ui.note(e, "eve")), warns = K.warns.map(w => ui.note(w, "key"));
      if (K.errs.length) { outC.render(errs, warns); outQ.render(); outM.render(); boxX.draw(); boxP.draw(); return; }
      const N = K.N, a = K.a;
      if (K.lucky) {
        outC.render(warns, ui.readouts([{ k: "N", v: N }, { k: "a", v: a, kind: "key" }, { k: "gcd(a, N)", v: K.g, kind: "ok", big: true }]),
          ui.note("gcd(" + a + ", " + N + ") = " + K.g + " > 1 ⇒ <b>may mắn</b>: đã có thừa số " + K.g + " × " + (N / K.g) + " mà không cần bước lượng tử (slide 3.1).", "ok"));
        outQ.render(); outM.render(); boxX.draw(); boxP.draw(); return;
      }
      const r = K.r;
      fX.input.max = r - 1; if (S.x0 > r - 1) { S.x0 = 0; fX.set(0); }
      const L = Math.min(3 * r, 48);
      const xs = Array.from({ length: L }, (_, x) => x), vals = xs.map(x => Number(math.powmod(a, x, N)));
      const stp = [
        { t: "Chọn a = " + a + ", kiểm tra gcd(a, N)", r: "gcd(" + a + ", " + N + ") = 1 ⇒ tiếp tục" },
        { t: "Tìm chu kỳ r nhỏ nhất với a" + sup("r") + " ≡ 1 (mod N) — <b>bước lượng tử</b>", r: "r = " + r + (K.even ? " (chẵn)" : " (lẻ)"), hi: true }
      ];
      if (!K.even) stp.push({ t: "r lẻ ⇒ không tách được (x − 1)(x + 1)", r: "chọn a khác" });
      else {
        stp.push({ t: "a" + sup("r/2") + " = " + a + sup(r / 2) + " mod " + N, r: "= " + K.y + (K.minus1 ? " ≡ −1 ⇒ vô ích, chọn a khác" : " ≢ ±1 ✓") });
        if (!K.minus1) stp.push({ t: "(a" + sup("r/2") + " − 1)(a" + sup("r/2") + " + 1) ≡ 0 (mod N) ⇒ lấy gcd", r: "gcd(" + (K.y - 1) + ", " + N + ") = " + K.p + " ; gcd(" + (K.y + 1) + ", " + N + ") = " + K.q + " ⇒ " + N + " = " + K.p + " × " + K.q, hi: true });
      }
      const good = K.even && !K.minus1;
      outC.render(warns,
        ui.readouts([
          { k: "N", v: N },
          { k: "a", v: a, kind: "key" },
          { k: "Chu kỳ r", v: r, kind: "ct", big: true },
          { k: "a^(r/2) mod N", v: K.even ? K.y : "—", kind: "key" },
          { k: "Thừa số", v: good ? K.p + " × " + K.q : "thử a khác", kind: good ? "ok" : "eve", big: true }
        ]),
        ui.table(["x", ...xs.map(String)],
          [[{ html: "a" + sup("x") + " mod N" }, ...vals.map((v, x) => ({ html: String(v), cls: "c " + (x % r === 0 ? "key-c" : "") }))]],
          { cls: "grid tight", mono: true }),
        ui.steps(stp),
        ui.note("Bảng aˣ mod N dài ~r ≤ N phần tử: tìm r cổ điển là hàm mũ theo số bit của N; máy lượng tử tính mọi aˣ cùng lúc rồi dùng QFT để đọc chu kỳ. Với N = pq lẻ, xác suất một a ngẫu nhiên “tốt” ≥ ½.", "mut"));
      drawQ();
      boxX.draw();
    }
    function drawBoxX(box) {
      if (!K || !K.r) { chart.bars(box, { labels: ["—"], series: [{ color: "pt", values: [0] }] }); return; }
      const r = K.r, L = Math.min(3 * r, 48);
      const vals = Array.from({ length: L }, (_, x) => Number(math.powmod(K.a, x, K.N)));
      chart.bars(box, { title: "aˣ mod N theo x — mỗi màu một chu kỳ (r = " + r + ")", labels: vals.map((_, x) => x), ylabel: "aˣ mod N", aspect: 0.3, fmtY: v => String(Math.round(v)),
        series: [{ color: "pt", values: vals, colors: vals.map((_, x) => ["pt", "ct", "aqua"][Math.floor(x / r) % 3]) }] });
    }
    function drawQ() {
      const N = K.N, a = K.a, r = K.r, M = Math.pow(2, S.m), x0 = S.x0;
      const { A, P } = qftProbs(M, r, x0); S.P = P; S.M = M; S.A = A;
      const u = Number(math.powmod(a, x0, N));
      const exact = M % r === 0;
      const peaks = [];
      for (let j = 0; j < r; j++) { const ctr = j * M / r; const c1 = Math.floor(ctr), c2 = Math.min(M - 1, Math.ceil(ctr)); const c = P[c2] > P[c1] ? c2 : c1; peaks.push({ j, ctr, c, p: P[c] }); }
      const top = Array.from(P).map((p, c) => [p, c]).sort((x, y) => y[0] - x[0]).slice(0, r);
      const topSum = top.reduce((s, x) => s + x[0], 0);
      const okM = M >= N * N;
      /* bảng "nếu đo được c tại đỉnh j thì sao?" như slide 3.7 và 3.10: giản phân → r → kết quả */
      const outcome = peaks.map(p => {
        const cf = math.contFrac(p.c, M);
        const cands = cf.conv.filter(q => q.q < BigInt(N));
        const rc = cands.length ? Number(cands[cands.length - 1].q) : 1, jc = cands.length ? Number(cands[cands.length - 1].p) : 0;
        const ok = Number(math.powmod(a, rc, N)) === 1;
        let res = "thử lại";
        if (p.j === 0) res = "c = 0 ⇒ không có thông tin";
        else if (!ok) res = a + sup(rc) + " ≢ 1 (gcd(j, r) = " + Number(math.gcd(p.j, r)) + ")";
        else if (rc % 2) res = "r lẻ";
        else { const y = Number(math.powmod(a, rc / 2, N)); res = y === N - 1 ? "a" + sup("r/2") + " ≡ −1" : N + " = " + Number(math.gcd(y - 1, N)) + " × " + Number(math.gcd(y + 1, N)) + " ✓"; }
        return { p, jc, rc, ok, res, good: ok && rc % 2 === 0 && res.endsWith("✓") };
      });
      const nGood = outcome.filter(o => o.good).length;
      outQ.render(
        ui.readouts([
          { k: "M = 2ᵐ", v: M + (okM ? " ≥ N² = " + N * N + " ✓" : " < N² = " + N * N + " ✗"), kind: okM ? "ok" : "eve" },
          { k: "u = a^x₀ mod N", v: u, kind: "key" },
          { k: "Số x với aˣ ≡ u", v: "A = " + A, kind: "ct" },
          { k: "Đỉnh tại", v: exact ? "đúng bội của M/r = " + (M / r) : "gần j·M/r = " + fmt(M / r, 1) + "·j", kind: "ct" },
          { k: r + " đỉnh cao nhất chiếm", v: pct(topSum), kind: "key", big: true },
          { k: "Đỉnh cho thừa số", v: nGood + " / " + r + " ⇒ P(thành công) ≈ " + pct(outcome.filter(o => o.good).reduce((s, o) => s + o.p.p, 0)), kind: "ok" }
        ]),
        ui.steps([
          { t: "H trên thanh ghi 1 rồi U_f: (1/√M) Σ |x⟩|aˣ mod N⟩; đo thanh ghi 2 được u = " + u, r: "thanh ghi 1 còn x ≡ " + x0 + " (mod " + r + "): " + x0 + ", " + (x0 + r) + ", " + (x0 + 2 * r) + ", …, " + (x0 + (A - 1) * r) + " (" + A + " giá trị, biên độ 1/√" + A + ")" },
          { t: "QFT: |x⟩ ↦ (1/√M) Σ e" + sup("2πi xc/M") + "|c⟩ ⇒ P(c) = |Σ_x e" + sup("2πi xc/M") + "|² / (M·A), tổng là cấp số nhân", r: "|Σ| = |sin(π r c A / M) / sin(π r c / M)| (bằng A khi r·c/M nguyên)", hi: true },
          { t: exact ? "r = " + r + " chia hết M = " + M + " ⇒ chỉ c là bội của " + (M / r) + " có xác suất ≠ 0, mỗi giá trị 1/r" : M + " không chia hết cho " + r + " ⇒ đỉnh không chính xác, biên độ rò sang c lân cận (slide 3.8)", r: peaks.map(p => "P(" + p.c + ") = " + fmt(p.p, 3)).join(" ; ") }
        ]),
        ui.table(["j", "j·M/r", "c gần nhất", "c/M", "P(c)", "P(c ± 1)", "Giản phân j/r", "Kết quả nếu đo được c"], outcome.map(o => {
          const p = o.p;
          return [p.j, fmt(p.ctr, 2), { html: String(p.c), cls: "key-c" }, fmt(p.c / M, 3), fmt(p.p, 4),
            (p.c > 0 ? fmt(P[p.c - 1], 4) : "—") + " / " + (p.c < M - 1 ? fmt(P[p.c + 1], 4) : "—"),
            o.jc + "/" + o.rc, { html: o.res, cls: o.good ? "ok-c" : "eve-c" }];
        }), { mono: true, cls: "tight", rowCls: (row, i) => (outcome[i].good ? "good" : null) }),
        okM ? null : ui.note("Cần N² ≤ 2ᵐ để liên phân số tách được j/r một cách chắc chắn; m tối đa 14 trong mô phỏng này (M = 16 384) nên với N > 128 phân bố chỉ mang tính minh họa.", "key"));
      boxP.draw();
      drawPost();
    }
    function drawBoxP(box) {
      if (!S.P) { chart.bars(box, { labels: ["—"], series: [{ color: "pt", values: [0] }] }); return; }
      const M = S.M, r = K.r, P = Array.from(S.P);
      const near = c => { const t = c * r / M; return Math.abs(t - Math.round(t)) * M / r < 1; };
      chart.bars(box, {
        title: "P(c) sau QFT — M = " + M + ", r = " + r + ", A = " + S.A + " (đỉnh gần j·M/r tô vàng" + (S.c != null ? ", c đo được = " + S.c + " nổi bật" : "") + ")",
        labels: P.map((_, c) => c), ylabel: "P(c)", aspect: 0.32, fmtY: v => v.toFixed(3),
        series: [{ color: "pt", values: P, colors: P.map((_, c) => (near(c) ? "key" : "pt")) }],
        hi: S.c != null && S.c >= 0 && S.c < M ? S.c : null
      });
    }
    function drawPost(fromMeasure) {
      if (!K || !K.r || !S.P) { outM.render(); return; }
      const N = K.N, a = K.a, M = S.M, c = S.c;
      if (c == null || !(c >= 0 && c < M)) { outM.render(ui.note("Bấm <b>«Đo c»</b> để lấy mẫu c theo P(c), hoặc nhập c (0 ≤ c < " + M + ").", "mut")); boxP.draw(); return; }
      const cf = math.contFrac(c, M);
      const terms = cf.a.map(String);
      const cands = cf.conv.filter(q => q.q < BigInt(N));
      const rc = cands.length ? Number(cands[cands.length - 1].q) : 1;
      const jc = cands.length ? Number(cands[cands.length - 1].p) : 0;
      const ar = Number(math.powmod(a, rc, N));
      const ok = ar === 1;
      let res = null, tail = "";
      if (ok && rc % 2 === 0) { const y = Number(math.powmod(a, rc / 2, N)); if (y !== N - 1 && y !== 1) res = [Number(math.gcd(y - 1, N)), Number(math.gcd(y + 1, N)), y]; else tail = "a" + sup("r/2") + " ≡ " + (y === 1 ? "1" : "−1") + " ⇒ thử lại"; }
      else if (ok) tail = "r lẻ ⇒ thử lại";
      else tail = "a" + sup(rc) + " mod N = " + ar + " ≠ 1 ⇒ r sai (gcd(j, r) > 1 hoặc c lệch xa đỉnh) ⇒ thử lại";
      if (fromMeasure) S.hist.push({ c, r: rc, ok });
      const lcm = S.hist.filter(x => x.r > 1).reduce((l, x) => { const g = Number(math.gcd(l, x.r)); return l / g * x.r; }, 1);
      const lcmOk = lcm > 1 && Number(math.powmod(a, lcm, N)) === 1;
      outM.render(
        ui.readouts([
          { k: "c đo được", v: c, kind: "key", big: true },
          { k: "c/M", v: c + "/" + M + " = " + fmt(c / M, 4) },
          { k: "Giản phân chọn", v: jc + "/" + rc, kind: "ct" },
          { k: "r ứng viên", v: rc, kind: "ct", big: true },
          { k: "a^r mod N", v: ar + (ok ? " ✓" : " ✗"), kind: ok ? "ok" : "eve" },
          { k: "P(c)", v: fmt(S.P[c], 4) }
        ]),
        ui.table(["i", "aᵢ", "Giản phân pᵢ/qᵢ", "qᵢ < N?"], cf.conv.map((q, i) => [i, terms[i], q.p + "/" + q.q, q.q < BigInt(N) ? "✓" : "✗"]), { mono: true, cls: "tight", rowCls: (row, i) => (i === cands.length - 1 ? "hi" : (cf.conv[i].q >= BigInt(N) ? "bad" : null)) }),
        ui.steps([
          { t: "c/M ≈ j/r với r < N: khai triển liên phân số", r: c + "/" + M + " = [" + terms[0] + "; " + terms.slice(1).join(", ") + "]" },
          { t: "Các giản phân: " + cf.conv.map(q => q.p + "/" + q.q).join(", ") + " — chọn mẫu số < N = " + N + " lớn nhất", r: "j/r = " + jc + "/" + rc + " ⇒ r = " + rc, hi: true },
          { t: "Kiểm tra a" + sup("r") + " ≡ 1 (mod N)", r: a + sup(rc) + " mod " + N + " = " + ar + (ok ? " ✓" : " ✗ — " + tail) },
          res ? { t: "r chẵn, a" + sup("r/2") + " mod N = " + res[2] + " ≢ ±1 ⇒ gcd(a" + sup("r/2") + " ∓ 1, N)", r: "gcd(" + (res[2] - 1) + ", " + N + ") = " + res[0] + " ; gcd(" + (res[2] + 1) + ", " + N + ") = " + res[1] + " ⇒ " + N + " = " + res[0] + " × " + res[1], hi: true } : { t: "Kết luận", r: tail || "—" }
        ]),
        res ? ui.note("<b>Thành công:</b> " + N + " = " + res[0] + " × " + res[1] + ". Mỗi lần chạy thành công với xác suất khoảng ½ (c phải rơi vào đỉnh với gcd(j, r) = 1 và r chẵn).", "ok") : ui.note("Lần đo này <b>chưa cho thừa số</b>: " + tail + ". Chạy lại vài lần và lấy BCNN các r nhận được (slide 3.10: lcm(3, 2) = 6).", "eve"),
        S.hist.length ? h("div", { class: "stack" }, ui.title("Lịch sử các lần «Đo c»", S.hist.length + " lần"),
          ui.table(["Lần", "c", "c/M", "r ứng viên", "a^r ≡ 1?"], S.hist.map((x, i) => [i + 1, x.c, fmt(x.c / M, 3), x.r, x.ok ? "✓" : "✗"]), { mono: true, cls: "tight", rowCls: row => (row[4] === "✓" ? "good" : null) }),
          ui.note("BCNN các r ứng viên = " + lcm + (lcmOk ? " ⇒ a" + sup(lcm) + " ≡ 1 ✓ (ghép nhiều lần đo)" : " (chưa phải chu kỳ)"), lcmOk ? "ok" : "mut")) : null);
      boxP.draw();
    }
    drawAll(); drawD();
    pane.appendChild(root);
  }
};

/* ============================================================================
   TAB 5 — Grover: oracle đổi dấu + phản xạ quanh trung bình; định lý Mosca
   ============================================================================ */
const tabGrover = {
  id: "grover", title: "Grover và Mosca",
  intro: "Tìm phần tử đích trong N = 2ⁿ với ~(π/4)√N lần gọi oracle thay vì ~N/2. Mỗi vòng: oracle đổi dấu biên độ đích, rồi phản xạ mọi biên độ quanh trung bình (a ↦ 2·tb − a). Slide 4.2: N = 4 ⇒ chắc chắn sau 1 vòng; N = 8 ⇒ 0,781; 0,945; rồi giảm còn 0,330 nếu lặp quá.",
  build(pane) {
    const S = { n: 3, t: 5, k: 0, amps: [], hist: [], mosca: { x: 10, y: 5, z: 12 } };
    const { root, ctrl, view } = ui.sim();
    const Nof = () => Math.pow(2, S.n);
    const binL = x => "|" + LAB.bin(x, S.n) + "⟩";
    const kOpt = () => Math.floor(Math.PI / 4 * Math.sqrt(Nof()));
    const fa = v => (v < -1e-12 ? "−" : "") + nice(Math.abs(v), 3);
    const sgN = ui.seg({ id: "m6gr-n", options: [2, 3, 4, 5].map(n => [n, "n = " + n + " (N = " + Math.pow(2, n) + ")"]), value: 3, onChange: v => { S.n = parseInt(v); if (S.t >= Nof()) S.t = Nof() - 1; rebuildT(); init(); } });
    const tWrap = h("div");
    function rebuildT() { LAB.clear(tWrap); tWrap.appendChild(ui.select({ id: "m6gr-t", label: "Phần tử đích", options: Array.from({ length: Nof() }, (_, x) => [x, binL(x) + " (x = " + x + ")"]), value: S.t, onChange: v => { S.t = parseInt(v); init(); } })); }
    rebuildT();
    const mx = ui.field({ id: "m6gr-x", label: "x: số năm dữ liệu cần giữ bí mật", type: "number", value: 10, onInput: v => { S.mosca.x = parseFloat(v); drawMosca(); } });
    const my = ui.field({ id: "m6gr-y", label: "y: số năm chuyển đổi sang PQC", type: "number", value: 5, onInput: v => { S.mosca.y = parseFloat(v); drawMosca(); } });
    const mz = ui.field({ id: "m6gr-z", label: "z: số năm đến khi có máy lượng tử phá RSA", type: "number", value: 12, onInput: v => { S.mosca.z = parseFloat(v); drawMosca(); } });
    ctrl.append(h("div", { class: "fld" }, h("label", null, h("b", null, "Kích thước không gian tìm kiếm")), sgN), tWrap,
      h("div", { class: "row" },
        ui.btn("Bước ›", () => step(), "pri"),
        ui.btn("Chạy đến tối ưu", () => { while (S.k < kOpt()) step(false); draw(); }),
        ui.btn("Đặt lại", init)),
      ui.presets([
        { label: "N = 4, đích |10⟩ (slide 4.2)", apply: () => { S.n = 2; S.t = 2; sgN.set(2); rebuildT(); init(); } },
        { label: "N = 8, đích |101⟩ (bài tập 4.1)", apply: () => { S.n = 3; S.t = 5; sgN.set(3); rebuildT(); init(); } },
        { label: "N = 32, đích |10110⟩", apply: () => { S.n = 5; S.t = 22; sgN.set(5); rebuildT(); init(); } }
      ]),
      ui.title("Định lý Mosca (slide 4.6)", "x + y > z ⇒ nguy"), mx, my, mz,
      ui.presets([{ label: "Bệnh án: 10 + 5 so với 12", apply: () => setM(10, 5, 12) }, { label: "Bài tập 4.3: x = 7, y = 6, z = 13", apply: () => setM(7, 6, 13) }], "Ví dụ"));
    function setM(x, y, z) { S.mosca = { x, y, z }; mx.input.value = x; my.input.value = y; mz.input.value = z; drawMosca(); }
    const out = ui.slot(), boxP = chart.box(b => drawBoxP(b)), outT = ui.slot(), outM = ui.slot();
    view.append(out, boxP, outT, ui.title("Kết luận cho mật mã (slide 4.1, 4.3)"), impactPanel(), outM);
    function init() { const N = Nof(); S.k = 0; S.amps = Array(N).fill(1 / Math.sqrt(N)); S.hist = [{ lab: "Chồng chập đều", a: S.amps.slice(), mean: 1 / Math.sqrt(N) }]; draw(); }
    function step(redraw = true) {
      if (S.hist.length > 60) return;
      const a = S.amps.slice(); a[S.t] = -a[S.t];
      const mean = a.reduce((s, v) => s + v, 0) / a.length;
      S.hist.push({ lab: "Vòng " + (S.k + 1) + ": oracle đổi dấu", a: a.slice(), mean });
      const b = a.map(v => 2 * mean - v);
      S.hist.push({ lab: "Vòng " + (S.k + 1) + ": phản xạ 2·tb − a", a: b.slice(), mean: null });
      S.amps = b; S.k++;
      if (redraw) draw();
    }
    /* biểu đồ biên độ tự vẽ bằng SVG: biên độ âm vẽ xuống dưới trục 0, đường trung bình nét đứt */
    function ampSvg(a, t, mean) {
      const N = a.length, W = 680, H = 230, pl = 44, pr = 10, pt = 16, pb = 30, zero = pt + (H - pt - pb) / 2, sc = (H - pt - pb) / 2;
      const s = svg("svg", { class: "diag", viewBox: "0 0 " + W + " " + H });
      const slot = (W - pl - pr) / N, bw = Math.max(4, slot * 0.66);
      [1, 0.5, 0, -0.5, -1].forEach(v => { const y = zero - v * sc; s.append(svg("line", { x1: pl, y1: y, x2: W - pr, y2: y, stroke: v === 0 ? "var(--line)" : "var(--grid)", "stroke-width": v === 0 ? 1.5 : 1 }), svg("text", { x: pl - 6, y: y + 4, "text-anchor": "end", class: "lbl" }, String(v))); });
      a.forEach((v, i) => {
        const x = pl + slot * i + (slot - bw) / 2, y = zero - Math.max(v, 0) * sc, hgt = Math.abs(v) * sc;
        s.append(svg("rect", { x: x.toFixed(1), y: y.toFixed(1), width: bw.toFixed(1), height: Math.max(hgt, 0.5).toFixed(1), rx: 2, fill: i === t ? "var(--key)" : "var(--pt)", "fill-opacity": i === t ? 1 : 0.8 }));
        if (N <= 16 || i % 2 === 0) s.append(svg("text", { x: (x + bw / 2).toFixed(1), y: H - 10, "text-anchor": "middle", class: "lbl" }, N <= 16 ? binL(i) : String(i)));
      });
      if (mean != null) { const y = zero - mean * sc; s.append(svg("line", { x1: pl, y1: y, x2: W - pr, y2: y, stroke: "var(--ct)", "stroke-dasharray": "6 4", "stroke-width": 1.5 }), svg("text", { x: W - pr - 4, y: y - 5, "text-anchor": "end", style: "fill:var(--ct);font-weight:600" }, "trung bình = " + fa(mean))); }
      return s;
    }
    function draw() {
      const N = Nof(), th = Math.asin(1 / Math.sqrt(N)), p = S.amps[S.t] * S.amps[S.t];
      const cur = S.hist[S.hist.length - 1];
      const meanNow = S.amps.reduce((s, v) => s + v, 0) / N;
      const kBest = kOpt();
      out.render(
        ui.readouts([
          { k: "N = 2ⁿ", v: N },
          { k: "Đích", v: binL(S.t), kind: "key" },
          { k: "Số vòng đã chạy", v: S.k, kind: "ct" },
          { k: "Vòng tối ưu ⌊π/4·√N⌋", v: kBest, kind: "ct" },
          { k: "Xác suất đo được đích", v: pct(p), kind: p > 0.9 ? "ok" : "key", big: true },
          { k: "sin θ = 1/√N", v: fmt(1 / Math.sqrt(N), 4) + " (θ = " + fmt(th / D2R, 2) + "°)" }
        ]),
        ampSvg(S.amps, S.t, S.k < kBest + 2 ? meanNow : null),
        ui.steps([
          { t: "Chồng chập đều H" + sup("⊗n") + "|0…0⟩: mọi biên độ bằng 1/√N", r: "1/√" + N + " = " + fmt(1 / Math.sqrt(N), 4) + " ; xác suất đích ban đầu 1/N = " + nice(1 / N) },
          { t: "Mỗi vòng quay trạng thái một góc 2θ về phía đích (sin θ = 1/√N) ⇒ sau k vòng P = sin²((2k + 1)θ)", r: "k = " + S.k + ": sin²(" + (2 * S.k + 1) + "·" + fmt(th / D2R, 2) + "°) = " + fmt(Math.pow(Math.sin((2 * S.k + 1) * th), 2), 4) + " (khớp biên độ đích² = " + fmt(p, 4) + ")", hi: true },
          { t: "Số vòng tối ưu ≈ (π/4)√N = " + fmt(Math.PI / 4 * Math.sqrt(N), 2) + " ⇒ lấy " + kBest + "; lặp quá sẽ quay vượt đích và xác suất giảm", r: "cổ điển trung bình cần (N + 1)/2 = " + fmt((N + 1) / 2, 2) + " lần thử" }
        ]),
        S.k > kBest ? ui.note("Đã chạy " + S.k + " vòng > tối ưu " + kBest + ": xác suất <b>giảm</b> còn " + pct(p) + " — Grover không phải càng lặp càng tốt.", "eve") : (S.k === kBest ? ui.note("Đạt số vòng tối ưu: xác suất đo được đích " + pct(p) + (p > 0.999 ? " — chắc chắn" : "") + ".", "ok") : ui.note("Bấm «Bước ›» để thực hiện một vòng (oracle + phản xạ). Trạng thái hiện tại: " + cur.lab + ".", "mut")));
      outT.render(ui.title("Bảng biên độ từng bước (slide 4.2)", "cột vàng là phần tử đích"),
        ui.table(["Bước", ...Array.from({ length: N }, (_, x) => ({ html: binL(x), cls: x === S.t ? "key-c c" : "c" })), "Trung bình"],
          S.hist.map(hh => [hh.lab, ...hh.a.map((v, i) => ({ html: fa(v), cls: "c " + (i === S.t ? "key-c" : "") })), hh.mean == null ? "–" : fa(hh.mean)]), { mono: true, cls: "tight" }));
      boxP.draw();
    }
    function drawBoxP(box) {
      const N = Nof(), th = Math.asin(1 / Math.sqrt(N)), Kmax = Math.max(4, Math.ceil(Math.PI / 2 * Math.sqrt(N)) + 1);
      const pts = []; for (let k = 0; k <= Kmax; k++) pts.push([k, Math.pow(Math.sin((2 * k + 1) * th), 2)]);
      chart.line(box, { title: "Xác suất đo được đích theo số vòng k (N = " + N + ")", xlabel: "Số vòng k", ylabel: "P(đích)", xmin: 0, xmax: Kmax, ymin: 0, ymax: 1, fmtY: v => v.toFixed(2), xticks: pts.map(p => p[0]),
        series: [{ name: "sin²((2k+1)θ)", color: "pt", points: pts, marker: true }, { name: "Hiện tại", color: "key", points: [[S.k, S.amps[S.t] * S.amps[S.t]]], markerOnly: true, r: 6 }],
        vlines: [{ x: kOpt(), label: "tối ưu k = " + kOpt(), color: "var(--ok)" }] });
    }
    function impactPanel() {
      const keys = [40, 56, 128, 256].map(b => [b + " bit", "2" + sup(b - 1) + " ≈ " + sci(Math.pow(2, b - 1)), "⌊π/4·2" + sup(b / 2) + "⌋ ≈ " + sci(Math.PI / 4 * Math.pow(2, b / 2)), b / 2 + " bit"]);
      return h("div", { class: "stack" },
        ui.table(["Khóa", "Vét cạn cổ điển (trung bình)", "Số vòng Grover", "An toàn còn lại"], keys.map(r => r.map(x => ({ html: x }))), { mono: true, cls: "tight" }),
        ui.table(["Hệ mật (bài)", "Bài toán", "Tấn công lượng tử", "Kết luận"], [
          ["RSA (Bài 5)", "Phân tích thừa số", "Shor – đa thức", { html: "Bị phá", cls: "eve-c" }],
          ["DH, ElGamal, DSA (Bài 6)", "Logarit rời rạc Z<sub>p</sub>*", "Shor – đa thức", { html: "Bị phá", cls: "eve-c" }],
          ["ECDH, ECDSA", "Logarit rời rạc trên EC", "Shor – đa thức", { html: "Bị phá", cls: "eve-c" }],
          ["DES, 3DES (Bài 4)", "Tìm khóa", "Grover", { html: "Đã yếu sẵn", cls: "eve-c" }],
          ["AES-128 / 256 (Bài 5)", "Tìm khóa", "Grover: 2" + sup(64) + " / 2" + sup(128), { html: "Dùng AES-256", cls: "key-c" }],
          ["SHA-256, SHA-3 (Bài 6)", "Tiền ảnh / va chạm", "Grover 2" + sup(128) + " / BHT ~2" + sup(85), { html: "Vẫn an toàn", cls: "ok-c" }],
          ["McEliece (Bài 8)", "Giải mã mã tuyến tính", "Chỉ Grover-type", { html: "An toàn", cls: "ok-c" }]
        ].map(r => r.map(x => (typeof x === "string" ? { html: x } : x))), { cls: "tight" }),
        ui.note("Tăng tốc Grover chỉ là bậc hai: mật mã đối xứng và hàm băm <b>gấp đôi độ dài khóa</b> là đủ; mật mã khóa công khai phải <b>thay thuật toán</b> (ML-KEM, ML-DSA, SLH-DSA — FIPS 203–205). Grover khó song song hóa: K máy chỉ giảm √K.", "mut"));
    }
    function drawMosca() {
      const { x, y, z } = S.mosca;
      if (![x, y, z].every(v => isFinite(v) && v >= 0)) { outM.render(ui.note("Nhập x, y, z là số năm không âm.", "eve")); return; }
      const danger = x + y > z;
      outM.render(ui.title("Định lý Mosca: x + y > z ?"),
        ui.readouts([{ k: "x + y", v: fmt(x + y, 1) + " năm", kind: "key" }, { k: "z", v: fmt(z, 1) + " năm", kind: "ct" }, { k: "Kết luận", v: danger ? "NGUY: phải chuyển đổi ngay" : "Tạm an toàn", kind: danger ? "eve" : "ok", big: true }]),
        ui.note(danger
          ? "x + y = " + fmt(x + y, 1) + " > z = " + fmt(z, 1) + ": dữ liệu mã hóa hôm nay sẽ còn cần bí mật khi máy lượng tử xuất hiện (thu thập trước – giải mã sau). Chỉ an toàn nếu rút y xuống ≤ " + fmt(Math.max(0, z - x), 1) + " năm" + (z - x < 0 ? " — không thể: ngay cả chuyển đổi tức thì cũng muộn" : "") + "."
          : "x + y = " + fmt(x + y, 1) + " ≤ z = " + fmt(z, 1) + ": còn dư " + fmt(z - x - y, 1) + " năm, nhưng ước lượng z liên tục giảm (slide 4.4) nên vẫn nên bắt đầu kiểm kê và chuyển sang lai X25519 + ML-KEM.", danger ? "eve" : "ok"));
    }
    init(); drawMosca();
    pane.appendChild(root);
  }
};

LAB.module({ id: "m6", tabs: [tabPolar, tabQubit, tabBB84, tabShor, tabGrover] });
})();
