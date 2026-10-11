/* 발문(문제 문장) 테스트 — 사람마다 시대를 따로 적는다
   node tests/test_stem.js */
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

// views.js 의 발문 만드는 부분(MOCK_TRIO_LB ~ mockPsBox 앞)만 떼어 온다
const viewsSrc = fs.readFileSync(path.join(__dirname, '..', 'views.js'), 'utf8');
const vs = viewsSrc.indexOf("const MOCK_MARK"), ve = viewsSrc.indexOf('// 제시문 박스');
eval(viewsSrc.slice(vs, ve).replace(/^(?:const|let) (\w+)\b/gm, 'global.$1'));

let fail = 0;
function ok(cond, msg){ if(!cond){ console.error('  ✕ ' + msg); fail++; } }
const eq = (got, want, msg)=> ok(got === want, msg + '\n      got : ' + got + '\n      want: ' + want);

/* ---------- 사람마다 시대를 따로, 같은 시대가 이어지면 「과」로 ---------- */
eq(mockStemText({ type:'trioVenn', who:['에피쿠로스', '칸트', '스피노자'] }),
   '(가)의 고대 서양 사상가 갑, 근대 서양 사상가 을과 병의 입장을 (나) 그림으로 표현할 때, A~D에 해당하는 진술로 적절한 것만을 <보기>에서 고른 것은?',
   '실제 시험지 발문 그대로');
eq(mockStemText({ type:'pair', a:'맹자', b:'이황' }), '고대 동양 사상가 갑, 한국 유교 사상가 을의 입장으로 옳은 것은?', '시대가 다른 갑·을');
eq(mockStemText({ type:'pair', a:'이황', b:'이이' }), '한국 유교 사상가 갑, 을의 입장으로 옳은 것은?', '같은 시대 갑·을');
eq(mockStemText({ type:'box', a:'주자', b:'왕수인' }), '중국 유교 사상가 갑, 을의 입장으로 옳은 것만을 <보기>에서 고른 것은?', '보기형');
eq(mockStemText({ type:'trio', who:['소크라테스', '에피쿠로스', '칸트'] }), '고대 서양 사상가 갑과 을, 근대 서양 사상가 병의 입장으로 옳은 것은?', '앞의 둘이 같은 시대');
eq(mockStemText({ type:'trio', who:['홉스', '로크', '루소'] }), '사회사상가 갑, 을, 병의 입장으로 옳은 것은?', '사회사상가 셋');
eq(mockStemText({ type:'venn', a:'홉스', b:'로크' }), '(가)의 사상가 갑, 을의 입장을 (나) 그림으로 표현할 때, A~C에 해당하는 적절한 진술만을 <보기>에서 있는 대로 고른 것은?', '그림 유형의 사회사상가는 「사상가」만');
eq(mockStemText({ type:'algo', a:'원효', b:'지눌' }), '(가)의 한국 불교 사상가 갑, 을의 입장을 (나) 그림으로 탐구하고자 할 때, A~C에 들어갈 적절한 질문만을 <보기>에서 있는 대로 고른 것은?', '순서도');
eq(mockStemText({ type:'critique', who:['플라톤', '흄', '칸트'] }), '(가)의 고대 서양 사상가 갑, 근대 서양 사상가 을과 병의 입장에서 서로에게 제기할 수 있는 비판을 (나) 그림으로 표현할 때, A~F에 해당하는 내용으로 가장 적절한 것은?', '비판');
eq(mockStemText({ type:'pair', a:'자유주의', b:'공화주의', ism:true }), '사회사상 (가), (나)의 입장으로 가장 적절한 것은?', '사상끼리는 (가)(나)');

/* ---------- 실제로 만들어진 시험지 — 한 문항에 서로 다른 시대를 한 이름으로 뭉뚱그리지 않는다 ---------- */
let n = 0, mixed = 0;
for(const mode of ['formal', 'free']){
  for(let d=1; d<=25; d++){
    STATE.quiz = { setNo:d % 3, run:null, mode:mode }; TODAY = '2026-12-' + String(d).padStart(2, '0');
    buildMockSet().forEach(q=>{
      const names = q.who || (q.a ? [q.a, q.b] : null);
      if(!names || q.ism) return;
      n++;
      const stem = mockStemText(q);
      const eras = names.map(x=> mockEra(x));
      const runs = eras.filter((e, i)=> i === 0 || e !== eras[i - 1]).length;
      if(runs > 1) mixed++;
      // 시대 수식어가 나온 횟수 = 시대가 바뀌는 횟수 (사회사상가는 그림 유형에서 수식어 없음)
      const labelled = (stem.match(/사상가 (갑|을|병)/g) || []).length;
      ok(labelled === runs, '시대 구간 수와 수식어 수가 다름: ' + stem + ' ' + eras.join('/'));
      ok(!/서양 사상가 갑, 을, 병|동양 사상가 갑, 을, 병/.test(stem) || runs === 1, '서로 다른 시대를 하나로 묶음: ' + stem);
      ok(names.every((x, i)=> stem.indexOf(MOCK_TRIO_LB[i]) >= 0), '갑·을·병 표시 누락: ' + stem);
    });
  }
}
console.log('발문 ' + n + '개 검사 · 시대가 섞인 문항 ' + mixed + '개');

console.log(fail ? '실패 ' + fail + '건' : '=== 발문 테스트 완료 ===');
if(fail) process.exit(1);
