// 3중 벤다이어그램 재료 점검.
//
// 평가원 3중 벤은 일곱 영역을 두고 그 가운데 넷을 골라 A~D 로 이름 붙인다.
//   갑만 · 을만 · 병만 · 갑을 · 을병 · 갑병 · 모두
// 가운데(셋 모두)는 반드시 배당된다. 나머지 셋은 여섯 자리에서 고른다.
// 그러므로 한 조합이 쓸모 있으려면 「모두」가 있어야 하고, 그 밖의 자리가
// 많을수록 뽑을 수 있는 문항 모양이 늘어난다.
//
// 재료는 cmp_items.json 에서 set 이 「삼중-자체」인 단독 선지다.
// 같은 문장을 세 사람에게 각각 O/X 로 매겨 두면 어느 영역인지 저절로 정해진다.
const fs = require('fs');
const APP = __dirname + '/..';
const PASSAGES = JSON.parse(fs.readFileSync(APP + '/passages.json', 'utf8'));
const CMP = JSON.parse(fs.readFileSync(APP + '/cmp_items.json', 'utf8'));
const names = [...new Set(PASSAGES.map(p => p.name))].sort((a, b) => b.length - a.length);

// app.js mockSplit 과 같은 규칙
function split(text){
  for(const n of names){
    if(text.indexOf(n) !== 0) continue;
    let rest = text.slice(n.length);
    const m = rest.match(/^(은|는)\s*/);
    if(m) rest = rest.slice(m[0].length); else return null;
    if(rest.length < 8) return null;
    for(const k of names) if(k !== n && rest.indexOf(k) >= 0) return null;
    return { name:n, body:rest };
  }
  return null;
}

let fail = 0;
const byBody = new Map();
for(const r of CMP){
  if(r.set !== '삼중-자체') continue;
  const s = split(r.text);
  if(!s){ console.log('  ✕ 파싱 실패 ' + r.id); fail++; continue; }
  if(!byBody.has(s.body)) byBody.set(s.body, new Map());
  byBody.get(s.body).set(s.name, r.answer);
}

const groups = new Map();
for(const [body, m] of byBody){
  if(m.size !== 3){ console.log('  ✕ 세 판정이 안 갖춰짐 — ' + body.slice(0,44)); fail++; continue; }
  const key = [...m.keys()].sort().join(' · ');
  if(!groups.has(key)) groups.set(key, []);
  groups.get(key).push({ body, ans:Object.fromEntries(m) });
}

const C3 = n => n < 3 ? 0 : n*(n-1)*(n-2)/6;
console.log('삼중 명제 ' + byBody.size + '개 · 조합 ' + groups.size + '개\n');
let usable = 0, shapes = 0;
for(const [key, list] of groups){
  const who = key.split(' · ');
  const [x, y, z] = who;
  const label = {
    OXX: x + '만', XOX: y + '만', XXO: z + '만',
    OOX: x + '+' + y, XOO: y + '+' + z, OXO: x + '+' + z, OOO: '모두',
  };
  const got = new Map();
  for(const it of list){
    const p = it.ans[x] + it.ans[y] + it.ans[z];
    if(!label[p]) continue;                       // XXX(셋 다 아님)은 벤에 자리가 없다
    if(!got.has(p)) got.set(p, []);
    got.get(p).push(it.body);
  }
  const hasAll = got.has('OOO');
  const others = [...got.keys()].filter(p => p !== 'OOO').length;
  const n = hasAll ? C3(others) : 0;
  if(hasAll && others >= 3){ usable++; shapes += n; }
  console.log((hasAll && others >= 3 ? '  ✓ ' : '  · ') + key
    + '  ' + list.length + '명제 · 영역 ' + got.size + '/7 · 문항 모양 ' + n + '가지');
  const order = ['OOO','OXX','XOX','XXO','OOX','XOO','OXO'];
  for(const p of order){
    if(got.has(p)) console.log('      ' + (p==='OOO'?'★':' ') + ' ' + label[p].padEnd(14) + got.get(p)[0].slice(0,44));
  }
  const miss = order.filter(p => !got.has(p)).map(p => label[p]);
  if(miss.length) console.log('        빈 자리 — ' + miss.join(' · '));
}
console.log('\n쓸 수 있는 조합 ' + usable + ' / ' + groups.size + ' · 뽑을 수 있는 문항 모양 합계 ' + shapes + '가지');
if(fail){ console.log('문제 ' + fail + '건'); process.exitCode = 1; }
