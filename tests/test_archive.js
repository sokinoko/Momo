/* 사상가 아카이브 테스트
   node tests/test_archive.js */
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
const arcStart = appSrc.indexOf('/* ---------- 사상가 아카이브');
const exStart = appSrc.indexOf('const OX_TOPIC_EXTRA');
const exEnd = appSrc.indexOf('};', exStart) + 2;
eval((appSrc.slice(exStart, exEnd) + '\n' + appSrc.slice(start, end) + '\n' + appSrc.slice(arcStart)).replace(/^(?:const|let) (\w+)\b/gm, 'global.$1'));


let fail = 0;
function ok(cond, msg){ if(!cond){ console.error('  ✕ ' + msg); fail++; } }
const A = arcIndex();
const P = n=> A.people[n];

// 제시문은 하나도 빠지지 않고 어느 사람에게든 들어간다
const nPs = A.list.reduce((a, r)=> a + r.ps.length, 0);
ok(nPs === PASSAGES.length, '제시문 ' + PASSAGES.length + '편 중 ' + nPs + '편만 아카이브에 있음');

// 핵심 사상가
['칸트', '왕수인', '주자', '하이에크', '홉스', '스토아학파', '원불교', '동학', '정약용', '이황', '이이'].forEach(n=>{
  const r = P(n);
  ok(r, n + ' 이(가) 아카이브에 없음');
  if(!r) return;
  ok(r.ps.length >= 5, n + ' 제시문이 너무 적음 ' + r.ps.length);
  ok(r.ox.length >= 10, n + ' 선지가 너무 적음 ' + r.ox.length);
  ok(arcTopics(r).length >= 1, n + ' 필기 주제가 없음');
  ok(r.unit, n + ' 단원을 모름');
});

// 별칭 검색
const names = q=> arcSearch(q).map(r=> r.name);
ok(names('양명')[0] === '왕수인', '양명 → ' + names('양명'));
ok(names('주희').indexOf('주자') >= 0, '주희 → 주자');
ok(names('에픽테토스').indexOf('스토아학파') >= 0, '에픽테토스 → 스토아학파');
ok(names('칸트')[0] === '칸트', '칸트 검색');
ok(names('칸 트')[0] === '칸트', '공백이 섞인 검색');
ok(arcSearch('zzzz').length === 0 && arcSearch('').length === 0, '없는 이름·빈 검색');

// 샤프 모의고사 1회 선지가 사상가 쪽에 들어와 있다
const sharp = OX_ITEMS.filter(o=> o.source === '2027 샤프 모의고사 1회(실전편)');
const shown = {};
A.list.forEach(r=> r.ox.forEach(x=>{ shown[x.it.id] = 1; }));
ok(sharp.length >= 90 && sharp.every(o=> shown[o.id]), '샤프 선지 ' + sharp.length + '개 중 ' + sharp.filter(o=> !shown[o.id]).length + '개가 어느 사상가에도 안 들어감');

// 자체 제작은 표시되고, 비교 선지는 양쪽 사람에게 다 들어간다
const kt = P('칸트');
ok(kt.ox.some(x=> x.self) && kt.ox.some(x=> x.kind === 'pair') && kt.ox.some(x=> x.kind === 'solo'), '칸트 선지 종류');
const pair = OX_ITEMS.find(o=> o.id === 'ox-sh1-52') || sharp.find(o=> /와 /.test(o.text.split(' ')[0]));
ok(pair, '비교 선지 표본');

// 단원이 없는 사람이 얼마나 되는지(경고)
const noUnit = A.list.filter(r=> !r.unit).map(r=> r.name);
if(noUnit.length) console.log('단원 미상 ' + noUnit.length + '명: ' + noUnit.join(', '));
console.log('아카이브 사상가 ' + A.list.length + '명 · 선지 연결 ' + A.list.reduce((a, r)=> a + r.ox.length, 0) + '건 · 제시문 ' + nPs + '편');
console.log(fail ? '실패 ' + fail + '건' : '=== 아카이브 테스트 완료 ===');
if(fail) process.exit(1);
