#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""제시문 병합 공용 모듈.

앞으로 제시문 배치는 데이터만 쓰고 이 모듈을 부르면 된다.

    from ps_add import add
    add([('ps-yihwang', '이황', 'yiiyi', [(출처, 본문, [단서...]), ...]), ...])
    항목에 네 번째 값을 주면 정답 화면에 괄호로 붙는다: (출처, 본문, [단서], '최제우')

하는 일
  · 이름·aliases·topic 은 기존 항목에서 물려받는다
  · id 는 접두사별 마지막 번호 다음으로 자동 부여
  · 단서가 본문에 실제로 있는지 검사
  · 본문과 출처가 모두 같으면 같은 제시문으로 보고 건너뛴다(규칙 4)
  · 백업을 남기고 저장
"""
import json, os, shutil, datetime

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(APP, 'passages.json')


def add(batch, dry=False):
    ps = json.load(open(PATH, encoding='utf-8'))
    added, dup = [], []

    for prefix, name, topic, items in batch:
        same = [p for p in ps if p['name'] == name]
        aliases = same[0]['aliases'] if same else [name]
        nums = [int(p['id'].rsplit('-', 1)[1]) for p in ps + added if p['id'].startswith(prefix + '-')]
        nxt = max(nums) if nums else 0
        have = {(p['text'], p['source']) for p in ps + added}
        ids = {p['id'] for p in ps + added}
        n0 = len(added)
        for item in items:
            by = None
            if len(item) == 4:
                src, text, clues, by = item
            else:
                src, text, clues = item
            assert text.strip() and clues, '빈 제시문: ' + text[:20]
            for c in clues:
                assert c in text, '본문에 없는 단서: ' + c
            if (text, src) in have:
                dup.append('%s / %s' % (name, src))
                continue
            nxt += 1
            pid = '%s-%d' % (prefix, nxt)
            assert pid not in ids, '이미 있는 id: ' + pid
            ids.add(pid)
            rec = {'id': pid, 'text': text, 'topic': topic, 'name': name,
                   'aliases': aliases, 'source': src, 'clues': clues}
            if by:
                rec['by'] = by     # 정답 화면에 괄호로 붙는 출처 (예: 동학 (최제우))
            added.append(rec)
        print('%-8s %2d편%s' % (name, len(added) - n0, '' if same else '  (새 이름)'))

    if dry:
        print('[dry] 저장하지 않음 · %d편 준비됨' % len(added))
        return

    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M')
    shutil.copy(PATH, PATH.replace('.json', '.backup-%s.json' % stamp))
    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump(ps + added, f, ensure_ascii=False, indent=1)
    print('합계 %d편 추가 · 전체 %d편' % (len(added), len(ps) + len(added)))
    if dup:
        print('이미 있어 건너뜀:', ', '.join(dup))
