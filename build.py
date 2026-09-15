#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
윤리와 사상 노트 — 단일 HTML 빌드

  app.js / views.js / style.css / topics_all.json / ox_items.json / passages.json
  + icons/*.png (192, 512, 180, 32)  →  ethics_note.html

데이터를 고칠 때는 json만 고치고 이 스크립트를 다시 돌린다.
ethics_note.html 은 직접 수정하지 않는다.

    python3 build.py            # → ethics_note.html
    python3 build.py --out /mnt/user-data/outputs/index.html
"""

import argparse
import base64
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

SRC_JS = ['app.js', 'views.js']
SRC_CSS = 'style.css'
DATA_FILES = [
    ('DATA', 'topics_all.json'),
    ('OX_ITEMS', 'ox_items.json'),
    ('PASSAGES', 'passages.json'),
]
ICONS = {
    '192': 'icons/icon-192x192.png',
    '512': 'icons/icon-512x512.png',
    '180': 'icons/apple-180.png',
    '32':  'icons/favicon-32.png',
}
MANIFEST_META = 'manifest_meta.json'
THEME_COLOR = '#F6F1E6'

HEAD = '''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
<title>윤리와 사상 노트 — 동양 윤리</title>

<!-- PWA: 매니페스트 (data URI로 임베드, 단일 HTML 유지) -->
<link rel="manifest" href="data:application/manifest+json;base64,{manifest}"/>
<meta name="theme-color" content="{theme}"/>

<!-- 흐름으로 읽기 본문용 노토 세리프. 네트워크가 없으면 시스템 명조로 폴백된다 -->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&amp;display=swap"/>
<!-- 모의고사 시험지용 — 발문·선지 나눔고딕, 제시문 나눔명조 / 필기노트 — IBM Plex Sans KR -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&amp;family=Nanum+Myeongjo:wght@400;700&amp;family=IBM+Plex+Sans+KR:wght@400;500;700&amp;display=swap"/>

<!-- PWA: iOS 홈 화면 추가 시 독립 실행(standalone) -->
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="윤사노트"/>
<link rel="apple-touch-icon" href="data:image/png;base64,{icon180}"/>
<link rel="icon" type="image/png" href="data:image/png;base64,{icon32}"/>

<style>
{css}
</style>
</head>
<body>
<div id="app">
  <div id="topbar" class="topbar"></div>
  <div id="scrollArea">
    <div id="screen"></div>
  </div>
  <div id="tabbar" class="tabbar"></div>
</div>
'''

TAIL = '''</body>
</html>
'''


def read(path):
    with open(os.path.join(HERE, path), encoding='utf-8') as f:
        return f.read()


def b64(path):
    with open(os.path.join(HERE, path), 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')


def js_safe(s):
    """스크립트 안에 </script> 같은 문자열이 들어가도 태그가 닫히지 않게."""
    return s.replace('</', r'<\/')


def build_manifest():
    meta = json.loads(read(MANIFEST_META))
    meta['icons'] = [
        {'src': 'data:image/png;base64,' + b64(ICONS['192']),
         'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'data:image/png;base64,' + b64(ICONS['512']),
         'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
    ]
    raw = json.dumps(meta, ensure_ascii=False)
    return base64.b64encode(raw.encode('utf-8')).decode('ascii')


def check_files():
    missing = [p for p in SRC_JS + [SRC_CSS, MANIFEST_META]
               + [f for _, f in DATA_FILES] + list(ICONS.values())
               if not os.path.exists(os.path.join(HERE, p))]
    if missing:
        sys.exit('빠진 파일: ' + ', '.join(missing))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(HERE, 'ethics_note.html'))
    args = ap.parse_args()

    check_files()

    parts = [HEAD.format(
        manifest=build_manifest(),
        theme=THEME_COLOR,
        icon180=b64(ICONS['180']),
        icon32=b64(ICONS['32']),
        css=read(SRC_CSS),
    )]

    # 데이터 주입 — app.js 보다 먼저 와야 한다
    data_lines = []
    counts = []
    for name, fn in DATA_FILES:
        obj = json.loads(read(fn))
        counts.append('%s %d' % (fn, len(obj)))
        data_lines.append('const %s = %s;' % (name, js_safe(json.dumps(obj, ensure_ascii=False))))
    parts.append('<script>\n' + '\n'.join(data_lines) + '\n</script>\n')

    for fn in SRC_JS:
        parts.append('<script>\n' + read(fn) + '\n</script>\n')

    parts.append(TAIL)
    html = ''.join(parts)

    out = args.out
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)

    print('%s  %.1f MB  (%s)' % (out, len(html.encode('utf-8')) / 1048576, ' / '.join(counts)))


if __name__ == '__main__':
    main()
