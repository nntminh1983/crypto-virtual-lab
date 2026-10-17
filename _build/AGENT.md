# Brief cho subagent — viết một mô-đun mô phỏng của Phòng Lab Mã hóa COM608

Bạn viết **một tệp JavaScript duy nhất** `assets/mN.js` (N do nhiệm vụ giao) cho website mô phỏng tĩnh tại
`G:\A. Personal Data\4-External Courses\4.2-ĐH Mở\4.2.3-Mã hoá thông tin\MaHoa_VirtualLab\`.
Không sửa `index.html`, `assets/core.js`, `assets/style.css` hay tệp của mô-đun khác. Nếu thấy core thiếu gì, tự viết hàm riêng trong tệp của bạn.

## Bối cảnh
- Giảng viên (TS. Nguyễn Ngọc Trường Minh) dùng trang này để **demo trên lớp** cho học viên cao học môn COM608 "Mã hóa thông tin nâng cao". Toàn bộ chữ trên giao diện bằng **tiếng Việt có dấu**, thuật ngữ đúng như slide (bản rõ, bản mã, khóa, hội chứng, lưới, khoảng cách tự do…).
- Nội dung slide đã trích sẵn ở `C:\Users\ADMIN\AppData\Local\Temp\claude\C--Users-ADMIN\1c66db17-0098-45ac-af46-6a8f0f852e3a\scratchpad\lectures.txt` (mỗi dòng `--- slide k: ...`). Lọc theo bài bằng `py -3.13 -X utf8 ex.py 'Bài 5' 'từ khóa1,từ khóa2' 500 1 99` trong cùng thư mục scratchpad (tham số: tên bài, từ khóa phân cách phẩy hoặc '' để lấy hết, số ký tự tối đa, slide đầu, slide cuối). **Hãy đọc các slide của bài mình phụ trách trước khi viết.**
- **Ví dụ mặc định (preset) của mỗi tab phải là đúng ví dụ số trong slide**, và kết quả hiển thị phải khớp số trên slide. Kiểm chứng bằng Python (`py -3.13 -X utf8`) trước khi ghi vào JS. Nếu slide có lỗi số liệu, dùng kết quả đúng và ghi chú nhỏ.
- Mọi thứ hiển thị phải **được tính**, không phải hình vẽ/tĩnh. Người dùng đổi tham số → bảng bước tính, hình, biểu đồ cập nhật ngay (`input`/`change`).

## Cách một mô-đun đăng ký (API bắt buộc)
```js
(function(){ "use strict";
const { h, ui, math, txt, chart } = LAB;
LAB.module({
  id: "m2",                       // đúng id section trong index.html
  tabs: [
    { id: "threepass", title: "Giao thức ba bước",
      intro: "Một câu giới thiệu tab (HTML được phép).",
      build(pane) { /* dựng DOM vào pane; chạy lười khi tab mở lần đầu */ } },
    // 4–6 tab cho mỗi mô-đun
  ]
});
})();
```
Deep link `#m2-threepass` mở đúng tab. id tab chỉ gồm chữ thường/số, không gạch ngang.

## Thư viện lõi `assets/core.js` (đọc tệp này để biết chi tiết)
- `h(tag, attrs, ...children)` tạo phần tử; attrs: `class`, `html`, `style:{}`, `onclick`, `dataset:{}`.
  `LAB.svg(tag, attrs, ...children)` cho SVG. `LAB.clear(el)`.
- `ui.sim({wide})` → `{root, ctrl, view}`: khung chuẩn, `ctrl` cột trái (điều khiển), `view` cột phải (kết quả). Gắn `pane.appendChild(root)`.
- Điều khiển: `ui.field({id,label,value,type:'text'|'number'|'textarea',mono,min,max,step,hint,onInput})` (`.input` là input),
  `ui.range({id,label,min,max,step,value,fmt,onInput})` (`.set(v)`, `.get()`), `ui.select({id,label,options:[[val,label]],value,onChange})`,
  `ui.check({id,label,value,onChange})`, `ui.seg({id,label,options,value,onChange})` (`.get()/.set()`), `ui.btn(label,onClick,'pri'|'sm')`,
  `ui.presets([{label,apply}], 'Ví dụ trong bài giảng')`.
  **Mọi id điều khiển phải duy nhất toàn trang → tiền tố theo mô-đun và tab, ví dụ `m2tp-p`.**
- Hiển thị: `ui.readouts([{k,v,kind:'pt'|'key'|'ct'|'eve'|'ok'|'aqua',big}])`, `ui.note(html,'key'|'eve'|'ok'|'mut')`, `ui.title(text, small)`,
  `ui.steps([{t: html, r: html, hi}])` (danh sách bước tính), `ui.table(headers, rows, {mono, cls:'tight'|'grid', rowCls:(row,i)=>'hi'|'bad'|'good'})`
  (ô có thể là chuỗi, Node, hoặc `{html, cls:'c mono', colspan}`), `ui.bits(str|array, {group, kind, kinds:[…], label, onClick(i), wide, dim:Set})`,
  `ui.matrix(rows, {cls:(i,j,v)=>'hi'|'pt'|'ct'|'eve', fmt})`, `ui.panel(title, ...kids)`, `ui.tag(text, kind)`,
  `ui.slot()` → phần tử có `.render(...kids)` để vẽ lại một vùng.
- Toán (BigInt): `math.gcd, egcd(a,b)→{g,s,t,steps}, modinv, powmod, sqm(b,e,m)→{r,bits,steps}, isPrime, factor, phi, order, isPrimitiveRoot, crt(rs,ms), primes(n), isqrt, H2(p), entropy(ps), gf2mul/gf2mod/gf2gcd, xtime, gmul (GF(2^8) AES), matmul/det2/inv2 (mod m), popcount, contFrac(num,den)→{a,conv}`. `math.B(x)` ép BigInt; `txt.mod(a,m)` cho số thường.
- Chữ: `txt.clean(s)` (A–Z, bỏ dấu), `txt.n('A')=0`, `txt.c(0)='A'`, `txt.freqEN`, `txt.count(s)`.
- Định dạng: `LAB.fmt(v,d)`, `LAB.bin(n,w)`, `LAB.hex(n,w)`, `LAB.grp(s,4,' ')`, `LAB.pct(v)`. `LAB.rng(seed)` → PRNG có mầm (dùng để kết quả ngẫu nhiên tái lập được; luôn có nút "Chạy lại" đổi mầm).
- Biểu đồ: `const box = chart.box(b => chart.line(b, {...}))` rồi gắn `box` vào DOM; gọi `box.draw()` khi dữ liệu đổi.
  `chart.line(box, {series:[{name,color:'pt'|'key'|'ct'|'eve'|'ok'|'aqua',points:[[x,y]],dash:[4,4],marker,markerOnly,area}], xlabel,ylabel,xmin,xmax,ymin,ymax,ylog,fmtX,fmtY,title,vlines:[{x,label,color}],hlines:[{y,label}],aspect})`
  `chart.bars(box, {labels, series:[{name,color,values,colors:[per-bar]}], ylabel, ymax, fmtY, hi:index, title, aspect})`. Tối đa 3–4 chuỗi, dùng màu theo vai trò.
- Màu CSS: dùng biến `var(--pt)` (bản rõ/Alice, xanh), `var(--key)` (khóa, đồng thau), `var(--ct)` (bản mã, tím), `var(--eve)` (kẻ tấn công/lỗi, đỏ), `var(--ok)` (đúng, lục), `var(--aqua)` (Bob/kênh), `var(--ink)`, `var(--soft)`, `var(--faint)`, `var(--line)`, `var(--sunk)`, `var(--panel)`. Trong SVG dùng `fill="var(--pt)"`; trong canvas dùng `LAB.colors().pt`. **Không viết mã màu hex cứng** (trang có chế độ sáng/tối).
- Lớp CSS có sẵn: `.stack` (cột, gap 12), `.row` (hàng wrap), `.cols` (lưới tự động), `.kv` (dl), `.small`, `.err`, `.hl`, `.pt-c .key-c .ct-c .eve-c .ok-c` (tô chữ), `.flow` (lưới Alice | mũi tên | Bob: `.who.a/.b/.e`, `.msg`, `.arrow`, `.side`), `svg.diag` (SVG rộng 100%, text tự lấy màu chủ đề; dùng `class="lbl"` cho nhãn).

## Mẫu một tab (sao chép cấu trúc này)
```js
{ id: "caesar", title: "Caesar", intro: "Mã dịch chuyển: E<sub>k</sub>(x) = (x + k) mod 26.",
  build(pane) {
    const S = { msg: "HELLO", k: 3 };
    const { root, ctrl, view } = ui.sim();
    const fMsg = ui.field({ id: "m1cs-msg", label: "Bản rõ", value: S.msg, mono: true, onInput: v => { S.msg = v; draw(); } });
    const fK = ui.range({ id: "m1cs-k", label: "Khóa k", min: 0, max: 25, value: S.k, onInput: v => { S.k = v; draw(); } });
    ctrl.append(fMsg, fK, ui.presets([
      { label: "HELLO, k = 3 (slide 49)", apply: () => { S.msg = "HELLO"; S.k = 3; fMsg.input.value = S.msg; fK.set(3); draw(); } },
      { label: "Bài tập: INFORMATION, k = 6", apply: () => { S.msg = "INFORMATION"; S.k = 6; fMsg.input.value = S.msg; fK.set(6); draw(); } }
    ]));
    const out = ui.slot(); view.append(out);
    function draw() {
      const p = txt.clean(S.msg); const c = p.split("").map(ch => txt.c(txt.n(ch) + S.k)).join("");
      out.render(
        ui.readouts([{ k: "Bản rõ", v: p, kind: "pt" }, { k: "Khóa", v: S.k, kind: "key" }, { k: "Bản mã", v: c, kind: "ct", big: true }]),
        ui.table(["Chữ", "x", "x + k", "mod 26", "Mã"], p.split("").map((ch, i) => [ch, txt.n(ch), txt.n(ch) + S.k, txt.mod(txt.n(ch) + S.k, 26), c[i]]), { mono: true, cls: "tight" }),
        ui.note("Chỉ có 26 khóa: thử hết 25 dịch chuyển là phá được. <b>Tần suất chữ cái được giữ nguyên.</b>", "mut")
      );
    }
    draw();
    pane.appendChild(root);
  } }
```

## Yêu cầu chất lượng
1. **Đúng số.** Mỗi preset khớp slide; kiểm tra bằng Python trước. Ghi trong `intro` hoặc nhãn preset số slide tham chiếu (ví dụ "slide 4.5.10").
2. **Có bước tính.** Mỗi kết quả chính kèm `ui.steps` hoặc bảng từng bước với ký hiệu như slide.
3. **Tương tác có ý nghĩa**: lật bit, kéo tham số, bật/tắt kẻ tấn công, chạy lại ngẫu nhiên, bước tiếp/lùi khi mô phỏng theo nhịp (nút «Bước ‹ ›» và «Chạy hết»).
4. **Xử lý đầu vào sai**: hiện `ui.note(..., 'eve')` thay vì ném lỗi (ví dụ a không khả nghịch, p không nguyên tố, chuỗi không phải bit).
5. **Hiệu năng**: không vòng lặp quá ~2·10^6 phép mỗi lần vẽ; mô phỏng Monte Carlo giới hạn số mẫu (≤ 20 000) và dùng `LAB.rng`.
6. **Không dùng** `alert/confirm/prompt`, không fetch, không thư viện ngoài, không innerHTML với dữ liệu người dùng chưa escape (dùng `h()` hoặc textContent cho chuỗi người dùng nhập).
7. **Kích thước**: 500–1100 dòng. Viết gọn, có chú thích tiếng Việt ngắn ở đầu mỗi tab.
8. Viết tệp bằng công cụ Write (không dùng heredoc bash để tránh hỏng ký tự `\n` và tiếng Việt).

## Kiểm tra trước khi báo cáo
Chạy trong Git Bash:
```
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --window-size=1400,1000 --virtual-time-budget=4000 --dump-dom "file:///G:/A.%20Personal%20Data/4-External%20Courses/4.2-%C4%90H%20M%E1%BB%9F/4.2.3-M%C3%A3%20ho%C3%A1%20th%C3%B4ng%20tin/MaHoa_VirtualLab/index.html#selftest" 2>/dev/null | py -3.13 -X utf8 -c "import sys,re,html;d=sys.stdin.read();m=re.search(r'<pre id=\"selftest\">(.*?)</pre>',d,re.S);print(html.unescape(m.group(1)) if m else 'KHONG THAY selftest (co the loi cu phap JS) ');print('JS syntax errors?', 'FAIL' in (m.group(1) if m else ''))"
```
Mọi tab của bạn phải `OK`. Nếu in ra "KHONG THAY selftest", có lỗi cú pháp: kiểm tra bằng `py -3.13 -X utf8 _build/jscheck.py assets/mN.js` (báo vị trí lỗi thô) hoặc đọc lại tệp. Các mô-đun khác có thể chưa tồn tại (404) — không sao.

Khi xong, báo cáo ngắn: danh sách tab, preset và số đã đối chiếu với slide, các hạn chế còn lại.
