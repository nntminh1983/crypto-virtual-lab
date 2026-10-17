# Phòng Lab Mã hóa COM608

Website mô phỏng tĩnh cho môn **Mã hóa thông tin nâng cao (COM608)**, dùng để demo trên lớp và cho học viên tự luyện tập. Sáu mô-đun gom trọn mười bài giảng; mọi ví dụ mặc định là đúng ví dụ số trong slide.

| Mô-đun | Bài giảng | Nội dung mô phỏng |
|---|---|---|
| 01 Số học modulo & mật mã cổ điển | Bài 1, 2, 3 | Euclid mở rộng, φ(n), Euler–Fermat; Caesar, Affine, Vigenère, Hill (kèm tấn công bản rõ đã biết); phân tích tần suất; Playfair; One-Time Pad; LCG, BBS, LFSR và tấn công LFSR |
| 02 Mã khối | Bài 4, 5A | Giao thức ba bước; Feistel rút gọn; S-DES từng bước, hiệu ứng thác lũ, vét cạn khóa; AES-128 từng lớp trên vector FIPS-197; ECB/CBC/CTR |
| 03 Khóa công khai | Bài 5B, 6 | RSA và CRT; tấn công RSA; Diffie–Hellman và MITM; ElGamal; SHA-256 và nghịch lý ngày sinh; chữ ký RSA, ElGamal, DSA |
| 04 Mô hình Shannon | Bài 7, 8 | Entropy; Shannon–Fano, Huffman, LZW; kênh BSC; mã tuyến tính G, H, hội chứng; Hamming [7, 4]; McEliece thu nhỏ |
| 05 Mã chập | Bài 9 | Bộ mã hóa (7, 5); sơ đồ trạng thái, lưới; khoảng cách tự do; Viterbi; BER |
| 06 Lượng tử | Bài 10 | Ba kính phân cực; qubit; BB84 với Eve; Shor; Grover |

## Cách dùng
- Mở `index.html` bằng trình duyệt (không cần máy chủ, không cần mạng sau khi tải phông chữ lần đầu).
- Đường dẫn sâu: `index.html#m2-sdes` mở thẳng tab S-DES của mô-đun 2. Nút **Tối/Sáng** đổi giao diện; trang nhớ tab và mô-đun đang mở.
- Mỗi tab có nút **Ví dụ trong bài giảng** (preset khớp slide) và bảng **các bước tính** dưới hình.

## Cấu trúc
```
index.html            trang duy nhất (6 section, mỗi section là một mô-đun)
assets/style.css      giao diện (token màu theo vai trò: bản rõ, khóa, bản mã, Eve, đúng, kênh)
assets/core.js        thư viện lõi: tạo DOM, điều khiển, bảng/bit/ma trận, số học BigInt, biểu đồ canvas, điều hướng
assets/m1.js … m6.js  sáu mô-đun, mỗi tệp tự đăng ký các tab bằng LAB.module({...})
_build/               công cụ phát triển: AGENT.md (brief), jscheck.py (kiểm cú pháp), selftest.sh (dựng mọi tab),
                      build_artifact.py (tạo bản artifact không khung HTML), shots/ (ảnh chụp)
```

## Kiểm tra sau khi sửa
```
py -3.13 -X utf8 _build/jscheck.py assets/m1.js      # lỗi cú pháp / lỗi nạp
_build/selftest.sh                                   # dựng mọi tab, báo FAIL và phần tử tràn ngang
```
