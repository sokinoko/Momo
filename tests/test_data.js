/* 데이터 회귀 테스트 — node tests/test_data.js
   확인하는 것
     1) id 중복 · 빠진 항목 · 답 표기
     2) 본문 규칙 (줄바꿈 · 굽은 따옴표 · 마침표)
     3) 자체 제작 선지의 근거 id 가 실재하고 그 사상가를 다루는지
     4) fix 는 X선지에만 · 자체 제작 X선지에는 반드시
     5) psid 와 quote 가 짝을 이루고 원전 본문에 그대로 있는지
     6) 주제 id 가 실재하는지
     7) 같은 본문에 답이 둘인 선지가 없는지
     8) 한 사람에게 같은 문장이 O 와 X 로 동시에 매겨져 있지 않은지
        (3중 벤·비판이 그 문장을 통째로 버리게 된다)
*/
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..');
const rd = (f)=> JSON.parse(fs.readFileSync(path.join(APP, f), 'utf8'));
const OX = rd('ox_items.json'), CMP = rd('cmp_items.json');
const PS = rd('passages.json'), TOPICS = rd('topics_all.json');
const CURLY = '‘’“”';

let fail = 0;
function ok(cond, msg){ if(!cond){ console.error('  ✕ ' + msg); fail++; } }

// 사상가 이름 · 주제 id
const NAMES = Array.from(new Set(PS.map(p=> p.name))).sort((a,b)=> b.length - a.length);
const TOPIC_IDS = new Set(TOPICS.map(t=> t.id));
{
  const src = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
  const blk = src.split('const OX_TOPIC_EXTRA = {')[1].split('};')[0];
  (blk.match(/'[a-z0-9-]+':\s*\{/g) || []).forEach(m=> TOPIC_IDS.add(m.split("'")[1]));
}

// 1) id · 빠진 항목 · 답
[['ox', OX], ['cmp', CMP], ['ps', PS]].forEach(([nm, arr])=>{
  const seen = {};
  arr.forEach(x=>{
    ok(!!x.id, nm + ' id 없음');
    ok(!seen[x.id], nm + ' id 중복: ' + x.id);
    seen[x.id] = 1;
    ok(!!x.text, nm + ' 본문 없음: ' + x.id);
  });
});
[['ox', OX], ['cmp', CMP]].forEach(([nm, arr])=> arr.forEach(x=>{
  ok(x.answer === 'O' || x.answer === 'X', nm + ' 답 표기 오류: ' + x.id);
  // 2) 본문 규칙
  ok(x.text.indexOf('\n') < 0, nm + ' 본문에 줄바꿈: ' + x.id);
  ok(!Array.from(x.text).some(c=> CURLY.indexOf(c) >= 0), nm + ' 본문에 굽은 따옴표: ' + x.id);
  ok(/\.$/.test(x.text.trim()), nm + ' 본문이 마침표로 끝나지 않음: ' + x.id);
  // 4) fix
  if(x.answer === 'O') ok(!x.fix, nm + ' O선지에 fix: ' + x.id);
}));

const OX_BY_ID = {}; OX.forEach(x=> OX_BY_ID[x.id] = x);
const PS_BY_ID = {}; PS.forEach(p=> PS_BY_ID[p.id] = p);

CMP.forEach(x=>{
  ok(!!x.note && x.note.length >= 40, '자체 제작 해설이 없거나 짧다: ' + x.id);
  ok(x.answer !== 'X' || !!x.fix, '자체 제작 X선지에 fix 가 없다: ' + x.id);
  ok((x.basis || []).length >= 1, '근거가 없다: ' + x.id);
  // 3) 근거
  (x.basis || []).forEach(b=>{
    const it = OX_BY_ID[b];
    ok(!!it, '없는 근거 id: ' + b + ' (' + x.id + ')');
    if(it) ok(x.pair.some(n=> it.text.indexOf(n) >= 0),
              '근거가 이 사상가와 무관: ' + x.id + ' ← ' + b);
  });
  // 5) 원전
  ok(!!x.psid === !!x.quote, 'psid 와 quote 는 함께 온다: ' + x.id);
  if(x.psid){
    const p = PS_BY_ID[x.psid];
    ok(!!p, '없는 제시문 id: ' + x.psid + ' (' + x.id + ')');
    if(p){
      ok(x.pair.indexOf(p.name) >= 0, '제시문이 이 사상가와 무관: ' + x.id);
      ok(p.text.indexOf(x.quote) >= 0, '인용이 원전에 그대로 있지 않다: ' + x.id);
    }
  }
  // 6) 주제
  x.topics.forEach(t=> ok(TOPIC_IDS.has(t), '없는 주제 id: ' + t + ' (' + x.id + ')'));
  if(x.crit) ok(/간과한다\.$/.test(x.crit), '비판 문구 형식: ' + x.id);
});

// 7) 같은 본문에 답이 둘
{
  const by = {};
  OX.concat(CMP).forEach(x=>{ (by[x.text] || (by[x.text] = new Set())).add(x.answer); });
  Object.keys(by).forEach(t=> ok(by[t].size === 1, '같은 본문에 답이 둘: ' + t.slice(0, 40)));
}

// 8) 한 사람 · 한 문장에 O 와 X 가 동시에
//    「A는 P」 / 「A와 B는 모두 P」O / 「A는 B와 달리 P」O 를 모두 풀어 본다
function splitSolo(t){
  for(const n of NAMES){
    if(t.indexOf(n) !== 0) continue;
    let r = t.slice(n.length);
    const m = /^(은|는)\s*/.exec(r);
    if(!m) return null;
    r = r.slice(m[0].length);
    if(r.length < 8) return null;
    if(NAMES.some(k=> k !== n && r.indexOf(k) >= 0)) return null;
    return { a:n, body:r };
  }
  return null;
}
function splitPair(t){
  for(const a of NAMES){
    if(t.indexOf(a) !== 0) continue;
    let r = t.slice(a.length);
    if('와과'.indexOf(r[0]) < 0) return null;
    r = r.slice(1).replace(/^\s+/, '');
    for(const b of NAMES){
      if(b === a || r.indexOf(b) !== 0) continue;
      const r2 = r.slice(b.length);
      const m = /^(은|는)\s*/.exec(r2);
      if(!m) return null;
      return { a:a, b:b, body:r2.slice(m[0].length).replace(/^모두\s*/, '') };
    }
    return null;
  }
  return null;
}
function splitDiff(t){
  for(const a of NAMES){
    if(t.indexOf(a) !== 0) continue;
    let r = t.slice(a.length);
    const m = /^(은|는)\s*/.exec(r);
    if(!m) return null;
    r = r.slice(m[0].length);
    for(const b of NAMES){
      if(b === a || r.indexOf(b) !== 0) continue;
      const m2 = /^(와|과)\s*달리\s*/.exec(r.slice(b.length));
      if(!m2) return null;
      return { a:a, b:b, body:r.slice(b.length + m2[0].length) };
    }
    return null;
  }
  return null;
}
// 아직 확인하지 못한 기출 충돌을 적어 두는 자리. 지금은 비어 있다 —
// 새 충돌이 생기면 그대로 실패로 떨어진다
const KNOWN = {};
{
  const idx = {};
  const put = (body, name, id, ans)=>{
    const m = idx[body] || (idx[body] = {});
    (m[name] || (m[name] = [])).push({ id:id, ans:ans });
  };
  OX.concat(CMP).forEach(it=>{
    const pr = splitPair(it.text);
    if(pr){ if(it.answer === 'O'){ put(pr.body, pr.a, it.id, 'O'); put(pr.body, pr.b, it.id, 'O'); } return; }
    const df = splitDiff(it.text);
    if(df){ if(it.answer === 'O'){ put(df.body, df.a, it.id, 'O'); put(df.body, df.b, it.id, 'X'); } return; }
    const sp = splitSolo(it.text);
    if(sp) put(sp.body, sp.a, it.id, it.answer);
  });
  let conflicts = 0;
  Object.keys(idx).forEach(body=>{
    Object.keys(idx[body]).forEach(name=>{
      const v = idx[body][name];
      if(new Set(v.map(x=> x.ans)).size < 2) return;
      conflicts++;
      const ids = v.map(x=> x.id + ' ' + x.ans).join(' / ');
      const known = v.some(x=> KNOWN[x.id]);
      if(known) console.log('  ⚠ 확인 대기 — ' + name + ' 「' + body.slice(0, 34) + '」 · ' + ids);
      else ok(false, '판정 충돌 — ' + name + ' 「' + body.slice(0, 34) + '」 · ' + ids);
    });
  });
  console.log('판정이 모인 문장 ' + Object.keys(idx).length + '개 · 충돌 ' + conflicts + '건');
}

console.log('기출 ' + OX.length + ' · 자체 제작 ' + CMP.length + ' · 제시문 ' + PS.length +
            ' · 사상가 ' + NAMES.length + '명');
if(fail){ console.error('실패 ' + fail + '건'); process.exit(1); }
console.log('=== 데이터 테스트 완료 ===');
