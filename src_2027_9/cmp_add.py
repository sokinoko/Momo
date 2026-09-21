#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""자체 제작 비교 선지 병합 모듈 — 모의고사 전용.

기출이 아니라 우리가 만든 선지다. 그래서 기출 OX 탭에는 절대 들어가지 않고
모의고사 출제기만 읽는다(cmp_items.json → CMP_ITEMS).

    from cmp_add import add
    add([{ 'id':'cmp-001',
           'text':'노자와 장자는 모두 ~라고 본다.',
           'answer':'O',
           'topics':['laozi','zhuangzi'],
           'note':'왜 그런지 설명 (필수)',
           'basis':['ox-1-1','ox-2-3'] }], dry=True)

검사하는 것
  · 형식이 「A와 B는 모두 ~」 「A는 B와 달리 ~」 「A는 ~」로 파싱되는지 (출제기 파서와 동일)
  · 단독 선지는 topics 가 한 개, 비교 선지는 두 개
  · fix(이렇게 고치면 맞는 선지)는 X선지에만
  · 「~와 달리」는 O선지만 (출제기가 diffs에 O만 담는다)
  · 이름이 실제 제시문 사상가인지, topics 가 실제 주제인지
  · note(해설)가 반드시 있고 충분히 긴지 — 자체 제작이라 해설 없는 선지는 금지
  · basis(근거 기출 id)가 1개 이상이고 모두 실재하는지
  · 기존 기출 선지와 본문이 겹치면서 답이 반대인 것이 없는지
  · 줄바꿈 · 굽은 따옴표 · id 중복

출제 예상 선지(기출에 아직 안 나온 원전 대목으로 만든 것)는 여기에 두 가지를 더 단다.

    'psid':  'ps-kant-20',            # 근거가 된 제시문 id
    'quote': '지성, 기지, 판단력',      # 그 제시문 본문에 그대로 있는 구절

  · psid 는 실재해야 하고, 그 제시문의 사상가가 이 쌍의 한쪽이어야 한다
  · quote 는 제시문 본문에 글자 그대로 들어 있어야 한다 (ps_add 의 clues 규칙과 같다)
  · 둘은 함께 온다. 하나만 오면 거부한다. psid 가 달린 것은 set 이 「비교-원전」이 된다
  · 이름을 psid 로 둔 것은 출제기가 쓰는 src(출처 문자열)와 겹치지 않게 하기 위해서다
"""
import json, os, re, shutil, datetime

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(APP, 'cmp_items.json')
OX = os.path.join(APP, 'ox_items.json')
TOPICS = os.path.join(APP, 'topics_all.json')
PASS = os.path.join(APP, 'passages.json')
APPJS = os.path.join(APP, 'app.js')
CURLY = '‘’“”'
NOTE_MIN = 40


def names():
    ps = json.load(open(PASS, encoding='utf-8'))
    return sorted({p['name'] for p in ps}, key=len, reverse=True)


def known_topics():
    ids = {t['id'] for t in json.load(open(TOPICS, encoding='utf-8'))}
    src = open(APPJS, encoding='utf-8').read()
    blk = src.split('const OX_TOPIC_EXTRA = {', 1)[1].split('};', 1)[0]
    ids |= set(re.findall(r"'([a-z-]+)':\s*\{", blk))
    return ids


def split_pair(text, ns):
    """「A와 B는 모두 ~」 — app.js mockSplitPair 와 같은 규칙"""
    for a in ns:
        if not text.startswith(a):
            continue
        rest = text[len(a):]
        if rest[:1] not in ('와', '과'):
            return None
        rest = rest[1:].lstrip()
        for b in ns:
            if b == a or not rest.startswith(b):
                continue
            r2 = rest[len(b):]
            m = re.match(r'^(은|는)\s*', r2)
            if not m:
                return None
            r2 = r2[m.end():]
            if len(r2) < 8:
                return None
            for k in ns:
                if k not in (a, b) and k in r2:
                    return None
            return ('pair', a, b, r2)
        return None
    return None


def split_diff(text, ns):
    """「A는 B와 달리 ~」 — app.js mockSplitDiff 와 같은 규칙"""
    for a in ns:
        if not text.startswith(a):
            continue
        rest = text[len(a):]
        m = re.match(r'^(은|는)\s*', rest)
        if not m:
            return None
        rest = rest[m.end():]
        for b in ns:
            if b == a or not rest.startswith(b):
                continue
            m2 = re.match(r'^(와|과)\s*달리\s*', rest[len(b):])
            if not m2:
                return None
            body = rest[len(b) + m2.end():]
            if len(body) < 8:
                return None
            for k in ns:
                if k not in (a, b) and k in body:
                    return None
            return ('diff', a, b, body)
        return None
    return None


def split_solo(text, ns):
    """「A는 ~라고 본다」 — app.js mockSplit 과 같은 규칙"""
    for n in ns:
        if not text.startswith(n):
            continue
        rest = text[len(n):]
        m = re.match(r'^(은|는)\s*', rest)
        if m:
            rest = rest[m.end():]
        elif rest.startswith('에 따르면'):
            rest = rest[5:].lstrip()
        elif rest.startswith('의 입장에서'):
            rest = rest[6:].lstrip()
        else:
            return None
        if len(rest) < 8:
            return None
        for k in ns:
            if k != n and k in rest:
                return None
        return ('solo', n, None, rest)
    return None


def parse(text, ns):
    return split_pair(text, ns) or split_diff(text, ns) or split_solo(text, ns)


def add(batch, dry=False):
    cur = json.load(open(PATH, encoding='utf-8')) if os.path.exists(PATH) else []
    ox = json.load(open(OX, encoding='utf-8'))
    ns = names()
    ps_by_id = {p['id']: p for p in json.load(open(PASS, encoding='utf-8'))}
    ok_topics = known_topics()
    ox_ids = {i['id'] for i in ox}
    ox_by_text = {i['text']: i for i in ox}
    ox_by_id = {i['id']: i for i in ox}
    ids = {i['id'] for i in cur}
    have = {i['text'] for i in cur}
    added, dup = [], []

    for rec in batch:
        rid = rec.get('id')
        for k in ('id', 'text', 'answer', 'topics', 'note', 'basis'):
            assert rec.get(k) not in (None, '', []), '빠진 항목 %s: %s' % (k, rid)
        t = rec['text']
        assert rec['answer'] in ('O', 'X'), '정답 표기 오류: ' + rid
        assert '\n' not in t, '본문에 줄바꿈: ' + rid
        assert not set(t) & set(CURLY), '굽은 따옴표: ' + rid
        assert t.rstrip().endswith('.'), '문장이 잘렸다: ' + rid
        assert '\n' not in rec['note'], '해설에 줄바꿈: ' + rid
        assert not set(rec['note']) & set(CURLY), '해설에 굽은 따옴표: ' + rid
        assert len(rec['note']) >= NOTE_MIN, '해설이 너무 짧다(%d자): %s' % (len(rec['note']), rid)

        p = parse(t, ns)
        assert p, '비교 형식으로 파싱되지 않는다: ' + rid
        kind, a, b, body = p
        if kind == 'diff':
            assert rec['answer'] == 'O', '「~와 달리」는 O선지만: ' + rid

        want = 1 if kind == 'solo' else 2
        assert len(rec['topics']) == want, \
            'topics 개수가 맞지 않는다(%s 는 %d개): %s' % (kind, want, rid)
        for tp in rec['topics']:
            assert tp in ok_topics, '없는 주제 id: %s (%s)' % (tp, rid)
        # fix(이렇게 고치면 맞는 선지)는 X선지에만 단다
        if rec.get('fix'):
            assert rec['answer'] == 'X', 'fix 는 X선지에만: ' + rid
            assert '\n' not in rec['fix'] and not set(rec['fix']) & set(CURLY), \
                'fix 에 줄바꿈이나 굽은 따옴표: ' + rid

        # 근거는 반드시 이 쌍의 두 사상가 가운데 한쪽을 다루는 기출이어야 한다.
        # id 가 있기만 하면 통과시키면 엉뚱한 사상가의 선지를 근거로 달아도 걸리지 않는다.
        for bid in rec['basis']:
            assert bid in ox_ids, '없는 근거 id: %s (%s)' % (bid, rid)
            bt = ox_by_id[bid]['text']
            who = [x for x in (a, b) if x]
            assert any(x in bt for x in who), \
                '근거가 이 사상가와 무관하다: %s ← %s (%s)' % (rid, bid, bt[:40])

        assert rid not in ids, '이미 있는 id: ' + rid
        if t in have:
            dup.append(rid)
            continue
        old = ox_by_text.get(t)
        assert not (old and old['answer'] != rec['answer']), \
            '기출과 본문은 같은데 답이 반대다: %s (%s)' % (rid, old['id'] if old else '')

        # 원전 근거. 제시문 id 가 실재하고, 그 제시문이 이 쌍의 사상가 것이고,
        # 인용 구절이 제시문 본문에 글자 그대로 있어야 한다.
        src, quote = rec.get('psid'), rec.get('quote')
        assert bool(src) == bool(quote), 'psid 와 quote 는 함께 온다: ' + rid
        if src:
            assert src in ps_by_id, '없는 제시문 id: %s (%s)' % (src, rid)
            sp = ps_by_id[src]
            assert sp['name'] in [x for x in (a, b) if x], \
                '제시문이 이 사상가와 무관하다: %s ← %s (%s)' % (rid, src, sp['name'])
            assert quote in sp['text'], \
                '인용이 제시문 본문에 그대로 있지 않다: %s ← %s' % (rid, src)

        rec = dict(rec)
        rec.setdefault('source', '자체 제작')
        rec.setdefault('set', '비교-원전' if src else '비교-자체')
        rec['kind'] = kind
        rec['pair'] = [a] if kind == 'solo' else [a, b]
        ids.add(rid); have.add(t)
        added.append(rec)

    src_n = sum(1 for r in added if r.get('psid'))
    o = sum(1 for r in added if r['answer'] == 'O')
    kd = {}
    for r in added:
        kd[r['kind']] = kd.get(r['kind'], 0) + 1
    print('준비된 비교 선지 %d개 (O %d / X %d) · %s · 원전 근거 %d · 중복 %d'
          % (len(added), o, len(added) - o, kd, src_n, len(dup)))
    if dry:
        print('[dry] 저장하지 않음')
        return added
    if os.path.exists(PATH):
        shutil.copy(PATH, PATH.replace('.json', '.backup-%s.json'
                    % datetime.datetime.now().strftime('%Y%m%d-%H%M')))
    out = cur + added
    json.dump(out, open(PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('합계 %d개 추가 · 전체 %d개' % (len(added), len(out)))
    return added
