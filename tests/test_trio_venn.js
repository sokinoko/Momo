// 3중 벤다이어그램 재료 점검.
// 평가원 3중 벤은 일곱 영역을 다 쓰지 않는다. 범례가 넷이다.
//   A 갑만 · B 갑과 을만 · C 을과 병만 · D 갑과 을과 병 모두
// B 와 C 가 을을 함께 물고 있으므로 을이 허브다. 한 조합으로 문항을 만들려면
// 갑·을·병을 어떻게 놓든 네 자리가 다 채워지는 배치가 하나는 있어야 한다.
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

const byBody = new Map();
for(const r of CMP){
  if(r.set !== '삼중-자체') continue;
  const s = split(r.text);
  if(!s){ console.log('✕ 파싱 실패 ' + r.id); process.exitCode = 1; continue; }
  if(!byBody.has(s.body)) byBody.set(s.body, new Map());
  byBody.get(s.body).set(s.name, r.answer);
}

// 세 판정이 다 있는 명제만 쓴다
const groups = new Map();                       // 조합 -> [{body, ans:{name:'O'|'X'}}]
for(const [body, m] of byBody){
  if(m.size !== 3){ console.log('✕ 세 판정이 안 갖춰짐 — ' + body); process.exitCode = 1; continue; }
  const key = [...m.keys()].sort().join(' · ');
  if(!groups.has(key)) groups.set(key, []);
  groups.get(key).push({ body, ans:Object.fromEntries(m) });
}

const perm = (a,b,c) => [[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]];
let ready = 0;
console.log('삼중 명제 ' + byBody.size + '개 · 조합 ' + groups.size + '개\n');
for(const [key, list] of groups){
  const who = key.split(' · ');
  let best = null;
  for(const [g, e, b] of perm(...who)){
    const need = { A:[ 'O','X','X' ], B:['O','O','X'], C:['X','O','O'], D:['O','O','O'] };
    const fill = {};
    for(const zone of ['A','B','C','D']){
      const w = need[zone];
      const hit = list.find(x => x.ans[g]===w[0] && x.ans[e]===w[1] && x.ans[b]===w[2]);
      if(hit) fill[zone] = hit.body;
    }
    const n = Object.keys(fill).length;
    if(!best || n > best.n) best = { n, g, e, b, fill };
    if(n === 4) break;
  }
  const ok = best.n === 4;
  if(ok) ready++;
  console.log((ok ? '  ✓ ' : '  · ') + key + '  ' + list.length + '명제 · 최선 배치 ' + best.n + '/4');
  if(ok){
    console.log('      갑 ' + best.g + ' · 을 ' + best.e + '(허브) · 병 ' + best.b);
    for(const z of ['A','B','C','D']) console.log('      ' + z + ' ' + best.fill[z].slice(0, 46));
  } else {
    const miss = ['A','B','C','D'].filter(z => !best.fill[z]);
    console.log('      빈 자리 ' + miss.join(' · ') + ' (갑 ' + best.g + ' · 을 ' + best.e + ' · 병 ' + best.b + ' 기준)');
  }
}
console.log('\n3중 벤을 바로 그릴 수 있는 조합 ' + ready + ' / ' + groups.size);
