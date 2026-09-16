#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""선지 병합 공용 모듈.

앞으로 OX 선지 배치는 데이터만 쓰고 이 모듈을 부르면 된다.

    from ox_add import add
    add([{'id':'ox-pf1-1', 'no':1, 'text':'…', 'answer':'X',
          'topics':['confucius'], 'source':'2027 출제예상',
          'set':'프리파이널-1-동양심화', 'fix':'…', 'note':'…'}], dry=True)

하는 일
  · id 중복 · 정답 표기 · fix 위치(X 선지만) 를 검사한다
  · topics 가 실제 주제(또는 OX 전용 주제)인지 확인한다 — id 추측 금지(규칙 3)
  · 본문과 출처가 모두 같으면 같은 선지로 보고 건너뛴다(규칙 4)
  · 줄바꿈 · 굽은 따옴표를 막는다
  · 백업을 남기고 저장
"""
import json, os, re, shutil, datetime

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(APP, 'ox_items.json')
TOPICS = os.path.join(APP, 'topics_all.json')
APPJS = os.path.join(APP, 'app.js')
CURLY = '‘’“”'


def known_topics():
    ids = {t['id'] for t in json.load(open(TOPICS, encoding='utf-8'))}
    # OX 전용 세부 주제는 app.js 의 OX_TOPIC_EXTRA 에만 있다(규칙 6)
    src = open(APPJS, encoding='utf-8').read()
    blk = src.split('const OX_TOPIC_EXTRA = {', 1)[1].split('};', 1)[0]
    ids |= set(re.findall(r"'([a-z-]+)':\s*\{", blk))
    return ids


def add(batch, dry=False):
    ox = json.load(open(PATH, encoding='utf-8'))
    ok_topics = known_topics()
    ids = {i['id'] for i in ox}
    have = {(i['text'], i['source']) for i in ox}
    added, dup = [], []

    for rec in batch:
        for k in ('id', 'no', 'text', 'answer', 'topics', 'source', 'set'):
            assert rec.get(k) not in (None, '', []), '빠진 항목 %s: %s' % (k, rec.get('id'))
        t = rec['text']
        assert rec['answer'] in ('O', 'X'), '정답 표기 오류: ' + rec['id']
        assert '\n' not in t, '본문에 줄바꿈: ' + rec['id']
        assert not set(t) & set(CURLY), '굽은 따옴표: ' + rec['id']
        assert t.rstrip().endswith('.'), '문장이 잘렸다: ' + rec['id']
        if rec.get('fix'):
            assert rec['answer'] == 'X', 'fix 는 X 선지에만: ' + rec['id']
        if rec.get('plain') or rec.get('same'):
            assert rec['answer'] == 'O', 'plain/same 은 O 선지에만: ' + rec['id']
        for tp in rec['topics']:
            assert tp in ok_topics, '없는 주제 id: %s (%s)' % (tp, rec['id'])
        assert rec['id'] not in ids, '이미 있는 id: ' + rec['id']
        if (t, rec['source']) in have:            # 본문+출처가 둘 다 같을 때만 중복(규칙 4)
            dup.append(rec['id'])
            continue
        ids.add(rec['id'])
        have.add((t, rec['source']))
        added.append(rec)

    n_x = sum(1 for r in added if r['answer'] == 'X')
    print('준비된 선지 %d개 (O %d / X %d) · 수정문 있는 X %d개'
          % (len(added), len(added) - n_x, n_x, sum(1 for r in added if r.get('fix'))))
    if dry:
        print('[dry] 저장하지 않음')
        return added

    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M')
    shutil.copy(PATH, PATH.replace('.json', '.backup-%s.json' % stamp))
    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump(ox + added, f, ensure_ascii=False, indent=1)
    print('합계 %d개 추가 · 전체 %d개' % (len(added), len(ox) + len(added)))
    if dup:
        print('이미 있어 건너뜀:', ', '.join(dup))
    return added
