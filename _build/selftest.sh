#!/bin/bash
# Dùng: _build/selftest.sh [rộng]  -> chạy #selftest ở độ rộng cho trước (mặc định 1400)
W=${1:-1400}
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --window-size=$W,1000 --virtual-time-budget=6000 --dump-dom "file:///G:/A.%20Personal%20Data/4-External%20Courses/4.2-%C4%90H%20M%E1%BB%9F/4.2.3-M%C3%A3%20ho%C3%A1%20th%C3%B4ng%20tin/MaHoa_VirtualLab/index.html#selftest" 2>/dev/null | py -3.13 -X utf8 -c "import sys,re,html;d=sys.stdin.read();m=re.search(r'<pre id=\"selftest\">(.*?)</pre>',d,re.S);print(html.unescape(m.group(1)) if m else 'KHONG THAY selftest (loi cu phap JS?)')"
