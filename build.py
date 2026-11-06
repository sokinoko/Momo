#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
윤리와 사상 노트 — 빌드

  app.js / views.js / style.css + icons/*.png  →  ethics_note.html (껍데기, 0.4 MB)
  topics_all.json / ox_items.json / passages.json / cmp_items.json  →  data.js (3.7 MB)
  + sw.js (서비스 워커 — 받아 둔 것을 캐시에 넣어 두 번째부터는 받지 않는다)

**데이터를 html 안에 넣지 않는다.** 전에는 한 파일에 다 넣어 4.5 MB였고,
앱을 열 때마다 그걸 통째로 다시 받느라 폰에서 첫 화면까지 20초가 넘었다.
껍데기만 먼저 받아 그리고, 데이터는 뒤따라 받되 캐시에 남긴다.

데이터를 고칠 때는 json만 고치고 이 스크립트를 다시 돌린다.
ethics_note.html · data.js · sw.js 는 직접 수정하지 않는다.

    python3 build.py            # → ethics_note.html · data.js · sw.js
    python3 build.py --out _site/index.html
"""

import argparse
import base64
import hashlib
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
    # 자체 제작 비교 선지. 기출이 아니므로 모의고사 출제기만 읽는다(기출 OX 탭에는 안 나온다)
    ('CMP_ITEMS', 'cmp_items.json'),
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

<!-- PWA: 매니페스트. 아이콘(192·512)까지 넣으면 0.23 MB라 따로 뺀다 — 브라우저가
     필요할 때만 받고, 서비스 워커가 캐시에 남긴다 -->
<link rel="manifest" href="manifest.webmanifest"/>
<meta name="theme-color" content="{theme}"/>

<!-- 글꼴 한 번에 — 흐름으로 읽기 노토 세리프 / 시험지 나눔고딕·나눔명조 / 필기 IBM Plex Sans KR
     / 홈 첫 카드 손글씨 개구. 전에는 요청이 셋이라 왕복을 세 번 했다.
     네트워크가 없으면 시스템 글꼴로 폴백된다 -->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&amp;family=Nanum+Gothic:wght@400;700;800&amp;family=Nanum+Myeongjo:wght@400;700&amp;family=IBM+Plex+Sans+KR:wght@400;500;700&amp;family=Gaegu:wght@400;700&amp;display=swap"/>

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
<script>
/* data.js 를 못 받았을 때. 처음 열 때는 인터넷이 있어야 한다 —
   한 번 받아 두면 서비스 워커가 캐시에 남겨 그다음부터는 없어도 열린다 */
function dataFailed(){{
  var el = document.querySelector('#screen .boot');
  if(el) el.innerHTML = '학습 자료를 받지 못했어요<span>처음 열 때는 인터넷이 있어야 해요. ' +
    '연결을 확인하고 새로 고쳐 주세요</span>';
}}
</script>
</head>
<body>
<div id="app">
  <div id="topbar" class="topbar"></div>
  <div id="scrollArea">
    <div id="screen"><div class="boot">불러오는 중…<span>처음 한 번만 받아 두면 다음부터는 바로 열려요</span></div></div>
  </div>
  <div id="tabbar" class="tabbar"></div>
</div>
'''

SW_REG = '''<script>
/* 서비스 워커 등록 — 받아 둔 것을 캐시에 남겨 두 번째부터는 바로 열리게 한다.
   file:// 로 열었거나 브라우저가 지원하지 않으면 그냥 건너뛴다 (앱은 그대로 돈다) */
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  });
}
</script>
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


def build_manifest():
    meta = json.loads(read(MANIFEST_META))
    meta['icons'] = [
        {'src': 'data:image/png;base64,' + b64(ICONS['192']),
         'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'data:image/png;base64,' + b64(ICONS['512']),
         'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
    ]
    return json.dumps(meta, ensure_ascii=False)


def check_files():
    missing = [p for p in SRC_JS + [SRC_CSS, MANIFEST_META]
               + [f for _, f in DATA_FILES] + list(ICONS.values())
               if not os.path.exists(os.path.join(HERE, p))]
    if missing:
        sys.exit('빠진 파일: ' + ', '.join(missing))


SW_JS = """/* 윤리와 사상 노트 — 서비스 워커.
   받아 둔 것을 캐시에 넣어 두 번째 여는 순간부터는 네트워크를 쓰지 않는다.
   빌드할 때마다 VER 가 바뀌고, 바뀌면 옛 캐시를 버리고 새로 받는다.
   build.py 가 만든다 — 손으로 고치지 않는다. */
const VER = '%(ver)s';
const CACHE = 'ethics-' + VER;
const FILES = %(files)s;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* 캐시에 있으면 그것을 먼저 준다 — 이게 두 번째부터 바로 열리는 이유다.
   주는 동안 뒤에서 새 것을 받아 캐시를 갈아 둔다. */
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;   /* 글꼴은 브라우저에 맡긴다 */
  e.respondWith(caches.open(CACHE).then(c => c.match(r).then(hit => {
    const live = fetch(r).then(res => {
      if (res && res.status === 200) c.put(r, res.clone());
      return res;
    }).catch(() => hit);
    return hit || live;
  })));
});
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(HERE, 'ethics_note.html'))
    args = ap.parse_args()

    check_files()

    out = os.path.abspath(args.out)
    outdir = os.path.dirname(out)
    os.makedirs(outdir, exist_ok=True)

    # ── 데이터는 따로 뺀다 ─────────────────────────────────
    # 한 파일에 다 넣으면 앱을 열 때마다 3.7 MB를 다시 받는다. 따로 두면
    # 서비스 워커가 캐시에 남겨 두고, 코드만 고쳤을 때 데이터를 다시 받지 않는다.
    data_lines = []
    counts = []
    for name, fn in DATA_FILES:
        obj = json.loads(read(fn))
        # off 가 붙은 것은 아직 풀지 않은 회차다 — 저장소에는 두되 앱에는 넣지 않는다.
        # 다 풀고 나면 그 회차의 off 만 지우면 바로 나온다.
        off = sum(1 for x in obj if isinstance(x, dict) and x.get('off'))
        if off:
            obj = [x for x in obj if not (isinstance(x, dict) and x.get('off'))]
        counts.append('%s %d%s' % (fn, len(obj), (' (+꺼둠 %d)' % off) if off else ''))
        # separators 로 쓸데없는 공백을 뺀다 (-130 KB)
        data_lines.append('const %s = %s;'
                          % (name, json.dumps(obj, ensure_ascii=False, separators=(',', ':'))))
    data_js = '\n'.join(data_lines) + '\n'

    # ── 껍데기 ───────────────────────────────────────────
    parts = [HEAD.format(
        theme=THEME_COLOR,
        icon180=b64(ICONS['180']),
        icon32=b64(ICONS['32']),
        css=read(SRC_CSS),
    )]
    # 데이터가 app.js 보다 먼저 와야 한다. 따로 받되 순서는 그대로다.
    # 못 받으면 「불러오는 중」에서 멈춰 버리므로 그 자리에 까닭을 적어 준다
    parts.append('<script src="data.js" onerror="dataFailed()"></script>\n')
    for fn in SRC_JS:
        parts.append('<script>\n' + read(fn) + '\n</script>\n')
    parts.append(SW_REG)
    parts.append(TAIL)
    html = ''.join(parts)

    # ── 서비스 워커 ──────────────────────────────────────
    page = os.path.basename(out)
    ver = hashlib.sha256((html + data_js).encode('utf-8')).hexdigest()[:12]
    files = [page, 'data.js', 'manifest.webmanifest'] + (['./'] if page == 'index.html' else [])
    sw = SW_JS % {'ver': ver, 'files': json.dumps(files)}

    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    with open(os.path.join(outdir, 'data.js'), 'w', encoding='utf-8') as f:
        f.write(data_js)
    with open(os.path.join(outdir, 'sw.js'), 'w', encoding='utf-8') as f:
        f.write(sw)
    with open(os.path.join(outdir, 'manifest.webmanifest'), 'w', encoding='utf-8') as f:
        f.write(build_manifest())

    mb = lambda t: len(t.encode('utf-8')) / 1048576
    print('%s  %.2f MB + data.js %.2f MB (%s)  · sw %s'
          % (out, mb(html), mb(data_js), ' / '.join(counts), ver))


if __name__ == '__main__':
    main()
