# -*- coding: utf-8 -*-
"""Kiểm tra cú pháp / lỗi nạp của một tệp JS bằng Chrome headless.
Dùng: py -3.13 -X utf8 _build/jscheck.py assets/m2.js [assets/m3.js ...]
In ra 'OK <tệp>' hoặc thông báo lỗi kèm dòng:cột."""
import sys, os, subprocess, tempfile, re, html, pathlib, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def check(js_rel):
    js = (ROOT / js_rel).resolve()
    if not js.exists():
        return f"KHONG TON TAI {js_rel}"
    page = ROOT / "_build" / "_jscheck.html"
    core = (ROOT / "assets" / "core.js").as_uri()
    page.write_text(f"""<!doctype html><meta charset="utf-8"><title>jscheck</title>
<pre id="log"></pre>
<script>
window.__errs=[];
window.onerror=function(m,src,line,col,err){{ window.__errs.push(m+' @ '+(src||'').split('/').pop()+':'+line+':'+col+(err&&err.stack?'\\n'+err.stack:'')); document.getElementById('log').textContent=window.__errs.join('\\n---\\n'); }};
</script>
<nav id="rail"></nav><div id="cards"></div><button id="theme"></button>
<section class="mod" id="m0"></section><section class="mod" id="m1"></section><section class="mod" id="m2"></section><section class="mod" id="m3"></section><section class="mod" id="m4"></section><section class="mod" id="m5"></section><section class="mod" id="m6"></section>
<script src="{core}"></script>
<script src="{js.as_uri()}"></script>
<script>
try {{ LAB.boot([]); }} catch(e) {{ window.onerror(String(e), 'boot', 0, 0, e); }}
if(!window.__errs.length) document.getElementById('log').textContent='OK';
</script>""", encoding="utf-8")
    out = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--window-size=1200,900", "--virtual-time-budget=2000",
                          "--dump-dom", page.as_uri()], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
    m = re.search(r'<pre id="log">(.*?)</pre>', out, re.S)
    txt = html.unescape(m.group(1)).strip() if m else "(khong doc duoc DOM)"
    return ("OK " + js_rel) if txt == "OK" else (js_rel + ":\n" + txt)

if __name__ == "__main__":
    for f in sys.argv[1:] or ["assets/core.js"]:
        print(check(f))
