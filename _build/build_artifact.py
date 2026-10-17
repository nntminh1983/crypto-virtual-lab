# -*- coding: utf-8 -*-
"""Tạo bản artifact (không có khung <!doctype>/<html>/<head>/<body>) từ index.html chuẩn.
Nền tảng artifact tự bọc khung; GitHub Pages / mở tệp cục bộ dùng index.html gốc.
Dùng: py -3.13 -X utf8 _build/build_artifact.py <thư mục đích>
"""
import re, sys, shutil, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
dst = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "_build" / "artifact"
dst.mkdir(parents=True, exist_ok=True)
(dst / "assets").mkdir(exist_ok=True)

src = (ROOT / "index.html").read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", src, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", src, re.S).group(1)
title = re.search(r"<title>.*?</title>", head).group(0)
desc = re.search(r'<meta name="description"[^>]*>', head).group(0)
links = "\n".join(re.findall(r'<link rel="(?:preconnect|stylesheet)"[^>]*>', head))
out = f"""{title}
<meta name="claude:viewport-fit-sides" content="cover">
{desc}
{links}
{body.strip()}
"""
(dst / "index.html").write_text(out, encoding="utf-8")
for f in (ROOT / "assets").glob("*.*"):
    shutil.copy2(f, dst / "assets" / f.name)
print("Đã tạo", dst / "index.html", "và", len(list((dst / 'assets').glob('*'))), "tệp assets")
