/* 모의고사 출제기 회귀 테스트
   node tests/test_mock.js
   확인하는 것
     1) 출제 가능 사상가가 20명 이상
     2) 한 세트 20문항 · 사상가 중복 없음
     3) 정답/오답의 O·X 구조가 유형과 맞음   ← 이게 깨지면 답이 둘인 문제가 나온다
     4) 제시문 사상가 = 선지 사상가
     5) 한 문항 안에 같은 문장이 두 번 나오지 않음
     6) 같은 날 · 같은 세트 번호면 항상 같은 문제
     7) 자동 별표 · 문항별 시간 기록
     8) OMR 채점 · 마킹 실수 · 제한 시간 30분 자동 제출 · 빈 OMR 제출 두 번 누르기
*/
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
const start = appSrc.indexOf('const MOCK_N');
const end   = appSrc.indexOf('/* ---------- 학습 기록 백업 · 복원 ---------- */');
if(start < 0 || end < 0 || end < start){ console.error('app.js 에서 모의고사 구간을 찾지 못했습니다'); process.exit(1); }
eval(appSrc.slice(start, end)
  .replace(/^const (MOCK_N|MOCK_RIGHT_RATE|MOCK_LIMIT_MS|MOCK_SPREAD_TYPES|MOCK_QUOTA|MOCK_MUST|MOCK_MUST_SOLO)\b/gm, 'global.$1')
  .replace(/^let MOCK_CACHE/m, 'global.MOCK_CACHE')
  .replace(/^let MOCK_CLOCK/m, 'global.MOCK_CLOCK'));

let fail = 0;
function ok(cond, msg){ if(!cond){ console.error('  ✕ ' + msg); fail++; } }

const oxById = {};
// 출제기가 읽는 것과 같은 범위(기출 + 자체 제작 비교 선지)로 인덱스를 만든다
OX_ITEMS.concat(CMP_ITEMS).forEach(o=>{ oxById[o.id] = o; });

const pool = mockPool();
ok(pool.usable.length >= MOCK_N, '출제 가능 사상가 ' + pool.usable.length + '명 (최소 ' + MOCK_N + ')');

// 삼중 판정 색인 — 조합별로 {문장: {사람: O/X}}
const ZONE_PAT = {
  '갑과 을과 병의 공통 입장':'OOO', '갑만의 입장':'OXX', '을만의 입장':'XOX',
  '병만의 입장':'XXO', '갑과 을만의 공통 입장':'OOX',
  '을과 병만의 공통 입장':'XOO', '갑과 병만의 공통 입장':'OXO',
};
const ARROW = { A:[0,1], B:[1,0], C:[1,2], D:[2,1], E:[2,0], F:[0,2] };
let TRIO_IDX = null;
function trioSet(who){
  if(!TRIO_IDX){
    TRIO_IDX = {};
    const names = mockNameList();
    // app.js 의 mockTrioSets 와 같은 규칙으로 판정을 모은다(단독 · 「모두」O · 「~와 달리」O)
    const put = (body, name, ans)=>{
      const m = TRIO_IDX[body] || (TRIO_IDX[body] = {});
      if(m[name] && m[name] !== ans) m.bad = 1;
      m[name] = ans;
    };
    mockSourceItems().forEach(it=>{
      const pr = mockSplitPair(it.text, names);
      if(pr){
        if(it.answer === 'O'){
          const body = pr.body.replace(/^모두\s*/, '');
          put(body, pr.a, 'O'); put(body, pr.b, 'O');
        }
        return;
      }
      const df = mockSplitDiff(it.text, names);
      if(df){
        if(it.answer === 'O'){ put(df.body, df.a, 'O'); put(df.body, df.b, 'X'); }
        return;
      }
      const sp = mockSplit(it.text, names);
      if(sp) put(sp.body, sp.name, it.answer);
    });
  }
  const out = {};
  Object.keys(TRIO_IDX).forEach(b=>{
    const m = TRIO_IDX[b];
    if(m.bad) return;
    if(who.every(n=> m[n])) out[b] = m;
  });
  return out;
}
let totalQ = 0, pairQ = 0, soloQ = 0, boxQ = 0, vennQ = 0, trioQ = 0, algoQ = 0;
let trioVennQ = 0, critQ = 0;
const algoHist = {}, vennHist = {};
for(let d=1; d<=40; d++){
  TODAY = '2026-' + String((d % 12) + 1).padStart(2,'0') + '-' + String((d % 28) + 1).padStart(2,'0');
  const set = buildMockSet();
  ok(set.length === MOCK_N, TODAY + ' 문항 수 ' + set.length);
  const names = [];
  set.forEach(q=>{
    if(q.type === 'trio') names.push.apply(names, q.who);
    else if(q.type === 'trioVenn' || q.type === 'critique') names.push(q.who[0], q.who[1], q.who[2]);
    else if(q.type === 'pair' || q.type === 'box' || q.type === 'venn' || q.type === 'algo') names.push(q.a, q.b);
    else names.push(q.name);
  });
  ok(new Set(names).size === names.length, TODAY + ' 사상가 중복 (' + names.length + '명 중 ' + new Set(names).size + '명)');
  // 반드시 나와야 하는 사상가는 세트마다 한 번은 들어간다
  MOCK_MUST.forEach(m=>{
    if(pool.usable.indexOf(m) < 0) return;
    ok(names.indexOf(m) >= 0, TODAY + ' ' + m + '이(가) 시험지에 없다');
  });
  // 단독으로만 내는 사람은 언제나 단독 문항이어야 한다
  MOCK_MUST_SOLO.forEach(m=>{
    if(pool.usable.indexOf(m) < 0) return;
    const mine = set.filter(q=> q.name === m || q.a === m || q.b === m ||
                               (q.who && q.who.indexOf(m) >= 0));
    ok(mine.length === 1, TODAY + ' ' + m + ' 문항이 ' + mine.length + '개');
    if(mine.length) ok(mine[0].type === 'right' || mine[0].type === 'wrong',
       TODAY + ' ' + m + '이(가) 단독이 아닌 ' + mine[0].type + ' 문항에 나왔다');
  });
  // 시험지 구성 — 순서도·벤다이어그램(2중이든 3중이든)은 세트마다 개수가 다르다
  const nAlgo = set.filter(q=> q.type === 'algo').length;
  const nVenn = set.filter(q=> q.type === 'venn' || q.type === 'trioVenn').length;
  // 개수는 고정하지 않는다. 다만 둘 다 한 문항 이상, 상한을 넘지 않아야 한다
  ok(nAlgo >= MOCK_QUOTA.algo[0] && nAlgo <= MOCK_QUOTA.algo[1],
     TODAY + ' 순서도가 ' + nAlgo + '문항 (' + MOCK_QUOTA.algo.join('~') + '문항이어야 한다)');
  ok(nVenn >= MOCK_QUOTA.anyVenn[0] && nVenn <= MOCK_QUOTA.anyVenn[1],
     TODAY + ' 벤다이어그램이 ' + nVenn + '문항 (' + MOCK_QUOTA.anyVenn.join('~') + '문항이어야 한다)');
  algoHist[nAlgo] = (algoHist[nAlgo] || 0) + 1;
  vennHist[nVenn] = (vennHist[nVenn] || 0) + 1;
  set.forEach((q,qi)=>{
    totalQ++;
    const tag = TODAY + ' ' + (qi+1) + '번';
    if(q.choices) ok(new Set(q.choices.map(c=>c.body)).size === 5, tag + ' 선지 중복');
    if(q.type === 'pair'){
      pairQ++;
      ok(q.psA.name === q.a, tag + ' 갑 제시문 불일치');
      ok(q.psB.name === q.b, tag + ' 을 제시문 불일치');
      ok(q.a !== q.b, tag + ' 갑·을이 같은 사람');
      // 같은 라벨끼리 붙어 있어야 한다 (갑 → 을 → 갑과 을 순서)
      const seq = q.choices.map(c=>c.label);
      const seen = [];
      seq.forEach(l=>{ if(seen[seen.length-1] !== l) seen.push(l); });
      ok(new Set(seen).size === seen.length, tag + ' 라벨이 뒤섞임 (' + seq.join('/') + ')');
      q.choices.forEach((c,ci)=>{
        const real = oxById[c.id].answer;
        ok(real === (ci === q.ans ? 'O' : 'X'), tag + ' ' + (ci+1) + '선지 구조 오류');
        ok(!!c.label, tag + ' ' + (ci+1) + '선지 라벨 없음');
        // 라벨이 가리키는 사람의 선지가 맞는지 — 이게 이 유형의 핵심 안전장치
        const txt = oxById[c.id].text;
        if(c.label === '갑') ok(txt.indexOf(q.a) === 0, tag + ' 갑 라벨에 다른 사람 선지');
        else if(c.label === '을') ok(txt.indexOf(q.b) === 0, tag + ' 을 라벨에 다른 사람 선지');
        else ok(txt.indexOf(q.a) === 0 || txt.indexOf(q.b) === 0, tag + ' 갑과 을 라벨 오류');
      });
    } else if(q.type === 'box'){
      boxQ++;
      ok(q.items.length === 4, tag + ' 보기 개수');
      const nTrue = q.items.filter(x=>x.ok).length;
      ok(nTrue === 2 || nTrue === 3, tag + ' 참인 보기가 2~3개가 아님');
      const trueMarks = q.opts[q.ans].slice().sort().join(',');
      const realTrue = q.items.map((x,ix)=>x.ok?ix:-1).filter(x=>x>=0).sort().join(',');
      ok(trueMarks === realTrue, tag + ' 정답 조합 불일치');
      ok(new Set(q.items.map(x=>x.body)).size === 4, tag + ' 보기 문장 중복');
      q.items.forEach(it=>{
        ok(oxById[it.id].answer === (it.ok ? 'O' : 'X'), tag + ' 보기 ' + it.mark + ' O/X 불일치');
        const txt = oxById[it.id].text;
        if(it.label === '갑' || it.label === '(가)') ok(txt.indexOf(q.a) === 0, tag + ' ' + it.mark + ' 갑 라벨 오류');
        else if(it.label === '을' || it.label === '(나)') ok(txt.indexOf(q.b) === 0, tag + ' ' + it.mark + ' 을 라벨 오류');
      });
    } else if(q.type === 'venn'){
      vennQ++;
      ok(q.items.length === 4, tag + ' 보기 개수');
      const nT = q.items.filter(x=>x.ok).length;
      ok(nT === 2 || nT === 3, tag + ' 참인 보기가 2~3개가 아님');
      ok(q.opts[q.ans].join(',') === q.items.map((x,ix)=>x.ok?ix:-1).filter(x=>x>=0).join(','), tag + ' 정답 조합 불일치');
      ok(new Set(q.items.map(x=>x.body)).size === 4, tag + ' 보기 문장 중복');
      q.items.forEach(it=>{
        const txt = oxById[it.id].text;
        const ans = oxById[it.id].answer;
        if(it.zone === 'A'){
          // 참이면 「갑은 을과 달리」 O선지, 거짓이면 「을은 갑과 달리」 O선지(=을만의 입장)
          ok(ans === 'O', tag + ' A영역 재료 오류');
          ok(txt.indexOf(it.ok ? q.a : q.b) === 0, tag + ' A영역 주체 오류');
        } else if(it.zone === 'C'){
          ok(ans === 'O', tag + ' C영역 재료 오류');
          ok(txt.indexOf(it.ok ? q.b : q.a) === 0, tag + ' C영역 주체 오류');
        } else {
          ok(ans === (it.ok ? 'O' : 'X'), tag + ' B영역 O/X 불일치');
        }
      });
    } else if(q.type === 'algo'){
      algoQ++;
      ok(q.items.length === 4, tag + ' 보기 개수');
      ok(new Set(q.items.map(x=>x.body)).size === 4, tag + ' 보기 문장 중복');
      const t = q.items.map((x,ix)=>x.ok?ix:-1).filter(x=>x>=0).join(',');
      ok(q.opts[q.ans].join(',') === t, tag + ' 정답 조합 불일치');
      q.items.forEach(it=>{
        ok(/(는가\?|인가\?)$/.test(it.body), tag + ' ' + it.mark + ' 질문형이 아님');
        const txt = oxById[it.id].text, ans = oxById[it.id].answer;
        if(it.zone === 'A'){
          // 참이면 「갑은 을과 달리」 O선지, 거짓이면 을만의 입장이거나 갑의 X선지
          if(it.ok){ ok(ans === 'O' && txt.indexOf(q.a) === 0, tag + ' A자리 참 재료 오류'); }
          else { ok(txt.indexOf(q.b) === 0 || ans === 'X', tag + ' A자리 거짓 재료 오류'); }
        } else if(it.zone === 'B'){
          ok(txt.indexOf(q.a) === 0 && ans === (it.ok ? 'O' : 'X'), tag + ' B자리 오류');
        } else {
          ok(txt.indexOf(q.b) === 0 && ans === (it.ok ? 'O' : 'X'), tag + ' C자리 오류');
        }
      });
    } else if(q.type === 'trio'){
      trioQ++;
      ok(new Set(q.who).size === 3, tag + ' 갑·을·병 중복');
      const L = {'갑':q.who[0], '을':q.who[1], '병':q.who[2]};
      const rank = { '갑':0, '을':1, '병':2 };
      for(let ci=1;ci<q.choices.length;ci++){
        ok(rank[q.choices[ci-1].label] <= rank[q.choices[ci].label], tag + ' 갑·을·병 순서가 아님');
      }
      q.choices.forEach((c,ci)=>{
        ok(oxById[c.id].answer === (ci === q.ans ? 'O' : 'X'), tag + ' ' + (ci+1) + '선지 구조 오류');
        ok(oxById[c.id].text.indexOf(L[c.label]) === 0, tag + ' ' + (ci+1) + '선지 라벨 오류');
      });
    } else if(q.type === 'trioVenn'){
      trioVennQ++;
      ok(new Set(q.who).size === 3, tag + ' 갑·을·병 중복');
      ok(q.items.length === 4, tag + ' 보기 개수');
      ok(new Set(q.items.map(x=>x.body)).size === 4, tag + ' 보기 문장 중복');
      ok(q.zones.length === 4 && q.zones[3].lab.indexOf('갑과 을과 병') === 0,
         tag + ' D는 언제나 셋 모두여야 한다');
      const tset = trioSet(q.who);
      q.items.forEach(it=>{
        const p = tset[it.body];
        ok(!!p, tag + ' ' + it.mark + ' 삼중 판정이 없는 문장');
        if(!p) return;
        const pat = p[q.who[0]] + p[q.who[1]] + p[q.who[2]];
        const want = ZONE_PAT[q.zones.find(z=>z.letter === it.zone).lab];
        ok((pat === want) === it.ok, tag + ' ' + it.mark + ' 영역 배정과 O/X 불일치');
      });
      const t = q.items.map((x,ix)=>x.ok?ix:-1).filter(x=>x>=0).join(',');
      ok(q.opts[q.ans].join(',') === t, tag + ' 정답 조합 불일치');
    } else if(q.type === 'critique'){
      critQ++;
      ok(new Set(q.who).size === 3, tag + ' 갑·을·병 중복');
      ok(q.choices.length === 5, tag + ' 선지 개수');
      ok(new Set(q.choices.map(c=>c.arrow)).size === 5, tag + ' 화살표 중복');
      ok(new Set(q.choices.map(c=>c.crit)).size === 5, tag + ' 비판 문장 중복');
      const tset = trioSet(q.who);
      q.choices.forEach((c,ci)=>{
        const p = tset[c.body];
        ok(!!p, tag + ' ' + (ci+1) + '선지 삼중 판정 없음');
        if(!p) return;
        // X 가 Y 를 비판할 수 있는 것은 X 가 O 이고 Y 가 X 일 때뿐이다
        const valid = p[c.from] === 'O' && p[c.to] === 'X';
        ok(valid === (ci === q.ans), tag + ' ' + (ci+1) + '선지 비판 성립 여부가 정답과 어긋남');
        const ar = ARROW[c.arrow];
        ok(c.from === q.who[ar[0]] && c.to === q.who[ar[1]], tag + ' ' + (ci+1) + '선지 화살표 방향 오류');
      });
    } else {
      soloQ++;
      ok(q.ps.name === q.name, tag + ' 제시문 사상가 불일치');
      q.choices.forEach((c,ci)=>{
        const real = oxById[c.id].answer;
        const want = (ci === q.ans)
          ? (q.type === 'right' ? 'O' : 'X')
          : (q.type === 'right' ? 'X' : 'O');
        ok(real === want, tag + ' ' + (ci+1) + '선지 구조 오류');
        ok(oxById[c.id].text.indexOf(q.name) === 0, tag + ' ' + (ci+1) + '선지 사상가 불일치');
      });
    }
  });
}

/* ---------- 자동 별표 ---------- */
{
  TODAY = '2026-10-05';
  const set = buildMockSet();
  const bi = set.findIndex(q=> q.type === 'box' || q.type === 'venn' || q.type === 'algo');
  // 보기형이 늘었으니 5지선다는 choices 를 가진 것으로 고른다
  // 순서도·벤다이어그램·비판처럼 그림이 들어가는 문항은 붙여 놓지 않는다
  const figAt = [];
  set.forEach((q,i)=>{ if(MOCK_SPREAD_TYPES[q.type]) figAt.push(i); });
  for(let i=1;i<figAt.length;i++){
    ok(figAt[i] - figAt[i-1] >= 2,
       TODAY + ' 그림 문항 ' + (figAt[i-1]+1) + '번과 ' + (figAt[i]+1) + '번이 붙어 있다');
  }

  const si = set.findIndex(q=> !!q.choices && q.choices.length === 5);
  ok(bi >= 0 && si >= 0, '별표 테스트용 문항 없음');
  const run = { picks:[], guess:[] };
  set.forEach((q,i)=>{ run.picks[i] = q.ans; });          // 전부 맞힘
  ok(mockStarIds(set, run).length === 0, '다 맞히고 찍지도 않았는데 별표가 붙음');

  run.picks[si] = (set[si].ans + 1) % 5;                  // 5지선다 하나 틀림
  let ids = mockStarIds(set, run);
  ok(ids.length === 2 && ids.indexOf(set[si].choices[run.picks[si]].id) >= 0
     && ids.indexOf(set[si].choices[set[si].ans].id) >= 0, '틀린 5지선다 별표 = 고른 것 + 정답');
  run.picks[si] = set[si].ans;

  const qb = set[bi];
  const wrongOpt = (qb.ans + 1) % qb.opts.length;
  run.picks[bi] = wrongOpt;                               // 보기형 하나 틀림
  ids = mockStarIds(set, run);
  const diff = qb.items.filter((it,k)=> (qb.opts[wrongOpt].indexOf(k) >= 0) !== (qb.opts[qb.ans].indexOf(k) >= 0));
  ok(ids.length === diff.length && diff.every(it=> ids.indexOf(it.id) >= 0), '틀린 보기형 별표 = 판단이 갈린 보기');
  run.picks[bi] = qb.ans;

  run.guess[si] = true;                                   // 찍어서 맞힘
  ids = mockStarIds(set, run);
  ok(ids.length === set[si].choices.length, '찍은 문항은 선지 전부 별표');
  run.guess[si] = false;

  run.picks[bi] = null;                                   // 안 고름
  ids = mockStarIds(set, run);
  ok(ids.length === qb.items.length, '안 고른 문항은 보기 전부 별표');
}

/* ---------- 문항별 시간 ---------- */
{
  global.NAV = { view:'mockExam' };
  global.setTimeout = function(f){ f(); };      // 시간 종료 채점을 바로 돌린다
  global.render = function(){ mockClockSync(); };
  global.ensureOxState = function(){ return (STATE.ox = STATE.ox || { stars:{} }); };
  global.go = function(v){ NAV.view = v; render(); };
  let clock = 1000000;
  mockNow = function(){ return clock; };
  TODAY = '2026-10-06';
  STATE.quiz = { setNo:0, run:null };
  startMock();
  clock += 90000;  pickMock(0, 1);      // 1번 1분 30초
  clock += 30000;  pickMock(1, 2);      // 2번 30초
  NAV.view = 'mock'; render();          // 화면을 떠나면 멈춘다
  clock += 600000;
  go('mockExam');
  clock += 45000;  pickMock(0, 3);      // 1번으로 돌아가 45초 더
  const r = STATE.quiz.run;
  ok(r.per[0] === 135000, '1번 시간 ' + r.per[0]);
  ok(r.per[1] === 30000, '2번 시간 ' + r.per[1]);
  ok(r.picks[0] === 3, '답 바꾸기');
  clock += 20000;
  const set6 = buildMockSet();
  markOmr(0, set6[0].ans);              // 1번은 OMR에 정답
  markOmr(1, 4); markOmr(1, 4);         // 2번은 칠했다 지움 → 빈칸
  submitMock();                         // OMR에 빈칸이 있으면 첫 번째 누름은 제출하지 않는다
  ok(!r.submitted && NAV.mockSubmitArm, '빈 OMR인데 한 번 눌러 제출됨');
  submitMock();
  ok(r.submitted, '두 번 눌러도 제출 안 됨');
  ok(r.ms === 185000, '총 시간 ' + r.ms + ' (떠나 있던 10분은 빠져야 함)');
  ok(r.score === 1, 'OMR로 채점하지 않음 (점수 ' + r.score + ')');
  const mm = mockMismatch(r);
  // 1번: 시험지 ④(3) · OMR 정답 → 정답이 ④가 아니면 마킹 실수 / 2번: 시험지 ③ · OMR 빈칸 → 마킹 실수
  ok((mm.indexOf(0) >= 0) === (set6[0].ans !== 3) && mm.length === (set6[0].ans !== 3 ? 2 : 1), '마킹 실수 목록 ' + mm.join(','));
  ok(mm.indexOf(1) >= 0, '시험지에 표시했는데 OMR이 빈 문항이 마킹 실수로 안 잡힘');
  ok(r.review === 20000, '검토 시간 ' + r.review);
  const h = STATE.quiz.history['2026-10-06'];
  ok(h && h.sec === 185 && h.per[0] === 135 && h.per[1] === 30 && h.slip === mm.length, '기록 저장');
  ok(!MOCK_CLOCK.on, '제출 후에도 시계가 돎');
  ok(r.starred.length > 0 && r.starred.every(id=> STATE.ox.stars[id]), '제출 때 별표가 안 붙음');
  // 별표는 OMR 답 기준 — 2번(빈칸)은 선지 전부
  const q2 = set6[1];
  const boxy = { box:1, venn:1, algo:1 };
  const list2 = boxy[q2.type] ? q2.items : q2.choices;
  ok(list2.every(c=> STATE.ox.stars[c.id]), 'OMR 빈칸 문항 선지가 별표 안 됨 (' + list2.length + ')');

  newMockSet();
  ok(STATE.quiz.history['2026-10-06'] && mockHistoryList().length === 1, '새 세트가 이전 기록을 지움');
  ok(Array.isArray(STATE.quiz.run.omr) && STATE.quiz.run.omr.length === 0, '새 세트 OMR이 비어 있지 않음');

  /* 제한 시간 30분 */
  const r2 = STATE.quiz.run;
  const set7 = buildMockSet();
  clock += 60000; pickMock(0, set7[0].ans); markOmr(0, set7[0].ans);
  clock += MOCK_LIMIT_MS - 60000 - 1000;
  mockClockTick();
  ok(!r2.submitted && r2.warned && r2.warned[0] && r2.warned[1], '5분·1분 알림이 안 됨');
  clock += 1500;
  mockClockTick();
  ok(r2.submitted && r2.timeUp, '30분이 지나도 자동 제출 안 됨');
  ok(r2.ms === MOCK_LIMIT_MS, '자동 제출 시간 ' + r2.ms);
  ok(r2.score === 1, '자동 제출도 OMR로 채점해야 함');
  ok(!MOCK_CLOCK.on, '자동 제출 후 시계가 돎');
  ok(STATE.quiz.history['2026-10-06#1'].timeUp === 1, '시간 종료가 기록에 안 남음');

  /* 시간을 다 쓴 시험지를 다시 열면 바로 채점 */
  newMockSet();
  const r3 = STATE.quiz.run;
  r3.ms = MOCK_LIMIT_MS + 5;
  NAV.view = 'mock'; render();
  go('mockExam');
  ok(r3.submitted && r3.timeUp, '시간을 넘긴 시험지를 열었는데 채점 안 됨');

  /* 옛 기록(OMR 없음)은 시험지 표시로 채점된 것으로 본다 */
  const old = { picks:[2, null], submitted:true };
  mockRunDefaults(old);
  ok(!old.omr && mockAns(old, 0) === 2 && mockAns(old, 1) === null && mockMismatch(old).length === 0, '옛 기록 호환');
  mockClockStop();
}

TODAY = '2026-12-01';
const a = JSON.stringify(buildMockSet().map(q=>[q.name,q.type,q.ans]));
const b = JSON.stringify(buildMockSet().map(q=>[q.name,q.type,q.ans]));
ok(a === b, '같은 날 재생성 결과가 다름');

console.log('검사한 문항 ' + totalQ + '개 — 단독 ' + soloQ + ' · 갑을 ' + pairQ + ' · 보기 ' + boxQ +
            ' · 벤 ' + vennQ + ' · 순서도 ' + algoQ + ' · 삼중 ' + trioQ +
            ' · 3중벤 ' + trioVennQ + ' · 비판 ' + critQ);
const hist = (h)=> Object.keys(h).sort().map(k=> k + '문항 ' + h[k] + '세트').join(' · ');
console.log('세트별 순서도 — ' + hist(algoHist));
console.log('세트별 벤     — ' + hist(vennHist));
console.log('출제 가능 사상가 ' + pool.usable.length + '명 · 벤다이어그램 쌍 ' + pool.venn.length + '개');
if(fail){ console.error('실패 ' + fail + '건'); process.exit(1); }
console.log('=== 모의고사 테스트 완료 ===');
