/* 사상가별 약점 통계 테스트
   node tests/test_weak.js */
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..');

global.DATA = JSON.parse(fs.readFileSync(path.join(__dirname,'..','topics_all.json'),'utf8'));
global.PASSAGES = JSON.parse(fs.readFileSync(path.join(APP,'passages.json'),'utf8'));
global.OX_ITEMS = JSON.parse(fs.readFileSync(path.join(APP,'ox_items.json'),'utf8'));
// 자체 제작 비교 선지(모의고사 전용). 출제기가 이것도 읽으므로 테스트에서도 함께 건다
global.CMP_ITEMS = JSON.parse(fs.readFileSync(path.join(APP,'cmp_items.json'),'utf8'));
global.STATE = { quiz:{ setNo:0, run:null }, streak:{} };

let TODAY = '2026-09-11';
global.todayStr = function(){ return TODAY; };
global.seedFromDate = function(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return h||1; };
global.mulberry32 = function(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; };
global.shuffleSeeded = function(arr,rng){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
global.saveStore = function(){};
global.markDailyActivity = function(){};

// app.js 에서 모의고사 부분만 떼어 전역에서 실행한다
const appSrc = fs.readFileSync(path.join(APP,'app.js'),'utf8');
const start = appSrc.indexOf('const MOCK_SIZES');
const end   = appSrc.indexOf('/* ---------- 학습 기록 백업 · 복원 ---------- */');
if(start < 0 || end < 0 || end < start){ console.error('app.js 에서 모의고사 구간을 찾지 못했습니다'); process.exit(1); }
global.NAV = { view:'mock' };
global.render = function(){};
global.go = function(v){ NAV.view = v; };
global.escHtml = x=> String(x);
global.ensureOxState = function(){ return STATE.ox; };
// 최상위 const/let 은 eval 안에만 갇히므로 전부 전역으로 꺼낸다
eval(appSrc.slice(start, end).replace(/^(?:const|let) (\w+)\b/gm, 'global.$1'));

let fail = 0;
function ok(cond, msg){ if(!cond){ console.error('  ✕ ' + msg); fail++; } }
const oxById = {};
OX_ITEMS.concat(CMP_ITEMS).forEach(o=>{ oxById[o.id] = o; });

/* ---------- 기출 OX 선지 → 사상가 ---------- */
{
  const idx = weakOxIndex();
  const total = OX_ITEMS.length, hit = OX_ITEMS.filter(it=> idx[it.id]).length;
  console.log('기출 OX ' + total + '개 중 사상가를 읽은 것 ' + hit + '개 (' + Math.round(hit / total * 100) + '%)');
  ok(hit / total >= 0.6, '기출 OX 선지의 사상가 인식률이 너무 낮음 ' + hit + '/' + total);
  const known = new Set(Object.keys(mockPool().byName));
  const strays = {};
  Object.keys(idx).forEach(id=> idx[id].forEach(n=>{ if(!known.has(n)) strays[n] = (strays[n] || 0) + 1; }));
  console.log('출제 풀에 없는 이름으로 읽힌 것 ' + JSON.stringify(strays));
  // 갑을·달리 선지는 둘 다, 단독은 한 사람
  const two = OX_ITEMS.find(it=> /^이황과 이이는 모두/.test(it.text));
  ok(two && idx[two.id].join() === '이황,이이', '「이황과 이이는 모두」 선지는 두 사람에게');
  const solo = OX_ITEMS.find(it=> /^정약용은 /.test(it.text) && idx[it.id] && idx[it.id].length === 1);
  ok(solo && idx[solo.id][0] === '정약용', '단독 선지는 한 사람에게');
  // 양명 별칭 · 범주 · 밀 분리가 그대로 따라온다
  const yang = OX_ITEMS.find(it=> /^양명은 /.test(it.text));
  ok(yang && idx[yang.id][0] === '왕수인', '양명 선지는 왕수인으로');
  const sto = OX_ITEMS.find(it=> /^에픽테토스는 /.test(it.text));
  ok(!sto || idx[sto.id][0] === '스토아학파', '에픽테토스 선지는 스토아학파로');
  const libMil = OX_ITEMS.filter(it=> /^밀은 /.test(it.text) && (it.topics || []).indexOf('state-role') >= 0);
  ok(libMil.length > 10 && libMil.every(it=> idx[it.id] && idx[it.id][0] === '자유주의'), '자유주의 밀 선지는 자유주의로');
  const utilMil = OX_ITEMS.filter(it=> /^밀은 /.test(it.text) && (it.topics || []).indexOf('state-role') < 0 && idx[it.id]);
  ok(utilMil.length > 5 && utilMil.every(it=> idx[it.id][0] === '밀'), '공리주의 밀 선지는 밀로');
  // 제시문
  const pi = weakPsIndex();
  ok(PASSAGES.every(p=> pi[p.id]), '모든 제시문이 사상가에 묶여야 함');
  const milLib = PASSAGES.find(p=> p.name === '밀' && p.topic === 'state-role');
  ok(milLib && pi[milLib.id] === '자유주의', '자유주의 밀 제시문은 자유주의로');
}

/* ---------- 기출 OX · 제시문 통계 ---------- */
{
  const idx = weakOxIndex();
  const kant = OX_ITEMS.filter(it=> idx[it.id] && idx[it.id].length === 1 && idx[it.id][0] === '칸트').slice(0, 3);
  const hume = OX_ITEMS.filter(it=> idx[it.id] && idx[it.id].length === 1 && idx[it.id][0] === '흄').slice(0, 3);
  const pair = OX_ITEMS.find(it=> /^이황과 이이는 모두/.test(it.text));
  STATE.ox = { stars:{}, hist:{}, rec:{} };
  kant.forEach(it=>{ STATE.ox.rec[it.id] = { seen:4, wrong:3, due:0, streak:0 }; });      // 칸트 12번 중 9번 틀림
  hume.forEach(it=>{ STATE.ox.rec[it.id] = { seen:4, wrong:1, due:0, streak:0 }; });      // 흄 12번 중 3번
  STATE.ox.rec[pair.id] = { seen:6, wrong:2, due:0, streak:0 };                         // 이황·이이 각 6번 중 2번
  STATE.quiz = { setNo:0, run:null };
  STATE.ps = { stars:{}, hist:{}, rec:{} };
  const kp = PASSAGES.filter(p=> p.name === '칸트').slice(0, 2);
  kp.forEach(p=>{ STATE.ps.rec[p.id] = { seen:2, wrong:2, due:0, streak:0 }; });        // 칸트 제시문 4번 중 4번

  const ox = weakRows('ox');
  ok(ox[0].name === '칸트' && ox[0].n === 12 && ox[0].w === 9 && Math.round(ox[0].rate * 100) === 75, 'OX 1위 칸트 9/12 (' + JSON.stringify(ox[0]) + ')');
  ok(ox.find(r=> r.name === '흄').w === 3, '흄 3/12');
  const hw = ox.find(r=> r.name === '이황'), iw = ox.find(r=> r.name === '이이');
  ok(hw && iw && hw.n === 6 && hw.w === 2 && iw.n === 6 && iw.w === 2, '갑을 선지는 두 사람 모두에게 세어야 함');
  const ps = weakRows('ps');
  ok(ps.length === 1 && ps[0].name === '칸트' && ps[0].w === 4 && ps[0].n === 4, '제시문 통계 ' + JSON.stringify(ps));
  const all = weakRows('all');
  const k = all.find(r=> r.name === '칸트');
  ok(k.n === 16 && k.w === 13, '전체 = OX + 제시문 합산 ' + JSON.stringify(k));
  // 최소 횟수에 못 미치면 순위에 안 오른다
  STATE.ox.rec = {}; const one = OX_ITEMS.find(it=> idx[it.id] && idx[it.id][0] === '묵자');
  if(one){ STATE.ox.rec[one.id] = { seen:1, wrong:1, due:0, streak:0 }; ok(!weakRows('ox').some(r=> r.name === '묵자'), '한 번 풀고 틀린 학자가 순위에 오름'); }
}

/* ---------- 모의고사 기록 ---------- */
{
  global.NAV = { view:'mock' }; global.render = function(){}; global.go = function(v){ NAV.view = v; };
  STATE.ox = { stars:{}, hist:{}, rec:{} }; STATE.ps = { stars:{}, hist:{}, rec:{} };
  TODAY = '2026-11-02';
  STATE.quiz = { setNo:0, run:null, history:{}, mode:'formal' };
  const run = ensureMockRun();
  startMock();
  const set = buildMockSet();
  // 0번 맞힘 · 1번 틀림 · 2번 비움 · 나머지는 정답
  set.forEach((q, i)=>{ run.picks[i] = q.ans; });
  run.picks[1] = (set[1].ans + 1) % 5;
  run.picks[2] = null;
  if(run.omr) set.forEach((q, i)=>{ run.omr[i] = run.picks[i]; });
  submitMock(true);
  const w = STATE.quiz.who;
  const names = i=> mockQNames(set[i]);
  ok(names(0).length >= 1 && names(0).every(n=> w[n] && w[n].n >= 1), '푼 문항의 사상가가 기록됨');
  names(1).forEach(n=> ok(w[n].w >= 1, '틀린 문항에 나온 사람 모두에게 오답이 셈: ' + n));
  names(2).forEach(n=>{
    const inOthers = set.some((q, i)=> i !== 2 && mockQNames(q).indexOf(n) >= 0);
    ok(inOthers || !w[n], '답을 안 한 문항은 세지 않음: ' + n);
  });
  const totalN = Object.keys(w).reduce((s, n)=> s + w[n].n, 0);
  const expect = set.reduce((s, q, i)=> s + (i === 2 ? 0 : mockQNames(q).length), 0);
  ok(totalN === expect, '푼 횟수 합이 문항별 사상가 수와 같아야 함 (' + totalN + '/' + expect + ')');
  const wrongW = Object.keys(w).reduce((s, n)=> s + w[n].w, 0);
  ok(wrongW === mockQNames(set[1]).length, '틀린 횟수 합 = 틀린 문항의 사상가 수');
  // 같은 시험지를 다시 제출해도 두 번 세지 않는다
  const before = JSON.stringify(STATE.quiz.who);
  submitMock(true); submitMock(true);
  ok(JSON.stringify(STATE.quiz.who) === before, '제출을 거듭해도 한 번만 세어야 함');
  // 다음 시험지는 이어서 쌓인다
  newMockSet(); startMock();
  const run2 = ensureMockRun(), set2 = buildMockSet();
  set2.forEach((q, i)=>{ run2.picks[i] = q.ans; if(run2.omr) run2.omr[i] = q.ans; });
  submitMock(true);
  const t2 = Object.keys(STATE.quiz.who).reduce((s, n)=> s + STATE.quiz.who[n].n, 0);
  ok(t2 === totalN + set2.reduce((s, q)=> s + mockQNames(q).length, 0), '두 번째 시험지가 이어서 쌓임');
  const rows = weakRows('mock');
  ok(rows.length > 5 && rows[0].rate >= rows[rows.length - 1].rate, '모의고사 순위 정렬 (' + rows.length + '명)');
  ok(rows.every(r=> r.n >= WEAK_MIN.mock), '최소 횟수 미만은 순위에 안 오름');
  // 테마별·자유 출제도 같다
  STATE.quiz.mode = 'free'; setMockSize(5); startMock();
  const run3 = ensureMockRun(), set3 = buildMockSet();
  set3.forEach((q, i)=>{ run3.picks[i] = (q.ans + 1) % 5; if(run3.omr) run3.omr[i] = run3.picks[i]; });
  const pre = Object.keys(STATE.quiz.who).reduce((s, n)=> s + STATE.quiz.who[n].w, 0);
  submitMock(true);
  const post = Object.keys(STATE.quiz.who).reduce((s, n)=> s + STATE.quiz.who[n].w, 0);
  ok(post === pre + set3.reduce((s, q)=> s + mockQNames(q).length, 0), '자유 출제 전부 오답이면 오답이 문항별 사상가 수만큼 늘어남');
}

console.log(fail ? '실패 ' + fail + '건' : '=== 약점 통계 테스트 완료 ===');
if(fail) process.exit(1);
