/* 테마별 · 정형화 · 크기 고르기 · 범주/별칭 회귀 테스트
   node tests/test_modes.js */
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
const pool = mockPool();
const namesOf = q=> q.who ? q.who : (q.a ? [q.a, q.b] : [q.name]);
const unitOfName = n=> MOCK_FORMAL_UNIT[n] || mockMainUnit(n);
const bucketOfName = n=> MOCK_FORMAL_BUCKET[unitOfName(n)];
const itemIds = q=>{ const o = mockQIds(q, {}); return Object.keys(o).filter(k=> oxById[k]); };

/* ---------- 이름 별칭 · 범주 ---------- */
ok(mockCanon('양명') === '왕수인' && mockCanon('에픽테토스') === '스토아학파' && mockCanon('벌린') === '자유주의', '별칭·범주 변환');
const CAT_STRICT = ['스토아학파', '공화주의', '자유주의'];          // 선지가 넉넉한 범주
Object.keys(MOCK_CATS).forEach(c=>{
  MOCK_CATS[c].forEach(m=> ok(!pool.byName[m], m + ' 이(가) 범주 ' + c + ' 로 합쳐지지 않고 따로 남음'));
  const b = pool.byName[c];
  if(c === '급진개화파'){ ok(!b, '제시문 없는 급진개화파가 출제 풀에 들어옴'); return; }   // 제시문이 생기면 이 줄을 지운다
  ok(b && b.ps.length >= 1, c + ' 범주에 제시문이 없음');
  if(CAT_STRICT.indexOf(c) >= 0) ok(b.O.length >= 10 && b.X.length >= 4 && b.ps.length >= 10, c + ' 범주 재료가 모자람');
  if(!b) return;
  const inO = {}; b.O.forEach(x=>{ inO[x.body] = 1; });
  ok(b.X.every(x=> !inO[x.body]), c + ' 범주에 같은 문장이 O와 X로 동시에 있음');
});
// 근대 한국 사상: 이름이 제각각이던 선지가 한 범주로 모인다
ok(pool.byName['위정척사'].O.length >= 10 && pool.byName['동학'].O.length >= 15 && pool.byName['온건개화파'].ps.length >= 8, '근대 범주 재료');
ok(pool.pairs[mockPairKey('위정척사', '온건개화파')] && !pool.pairs[mockPairKey('온건개화파', '온건개화파')], '근대 범주 짝');
ok(pool.byName['왕수인'].O.length >= 30, '양명 선지가 왕수인으로 안 읽힘 (' + pool.byName['왕수인'].O.length + ')');
ok(pool.pairs[mockPairKey('주자', '왕수인')].O.length >= 5, '주자·양명 짝 선지가 안 읽힘');
ok(pool.venn.some(p=> p.indexOf('주자') >= 0 && p.indexOf('왕수인') >= 0), '주자·양명 벤 재료가 없음');
ok(!pool.pairs[mockPairKey('스토아학파', '스토아학파')], '같은 범주끼리 짝이 만들어짐');

/* ---------- 밀: 공리주의의 밀 ≠ 자유주의의 밀 ---------- */
{
  const mil = pool.byName['밀'], lib = pool.byName['자유주의'];
  const allTopics = x=> (oxById[x.id] || {}).topics || [];
  ok(mil.O.concat(mil.X).every(x=> allTopics(x).indexOf('state-role') < 0), '공리주의 밀에 국가의 역할 선지가 섞임');
  const libMil = lib.O.concat(lib.X).filter(x=> oxById[x.id] && oxById[x.id].text.indexOf('밀') === 0);
  ok(libMil.length >= 25 && libMil.every(x=> allTopics(x).indexOf('state-role') >= 0), '자유주의 범주의 밀 선지는 전부 국가의 역할 주제여야 함 (' + libMil.length + ')');
  ok(mil.ps.every(p=> p.topic !== 'state-role') && mil.ps.length >= 15, '공리주의 밀 제시문에 국가의 역할 제시문이 섞임');
  ok(lib.ps.some(p=> p.name === '밀' && p.topic === 'state-role') && lib.ps.filter(p=> p.name === '밀').every(p=> p.topic === 'state-role'), '자유주의 범주의 밀 제시문은 국가의 역할 주제만');
  ok(mockMainUnit('밀') === '서양' && mockMainUnit('자유주의') === '이데올로기', '밀은 서양, 자유주의는 이데올로기');
  // 어떤 문항에서도 두 밀의 선지·제시문이 섞이지 않는다
  const bad = [];
  for(let d=1; d<=20; d++){
    STATE.quiz = { setNo:0, run:null, mode:'formal' }; TODAY = '2026-12-' + String(d).padStart(2, '0');
    buildMockSet().forEach(q=>{
      const chk = (n, items, pss)=>{
        (items || []).forEach(c=>{
          const o = oxById[c.id]; if(!o) return;
          const isLibMil = o.text.indexOf('밀') === 0 && (o.topics || []).indexOf('state-role') >= 0;
          if(n === '밀' && isLibMil) bad.push(TODAY + ' 공리주의 밀 자리에 자유주의 밀 선지 ' + c.id);
          if(n === '자유주의' && o.text.indexOf('밀') === 0 && !isLibMil) bad.push(TODAY + ' 자유주의 자리에 공리주의 밀 선지 ' + c.id);
        });
        (pss || []).forEach(p=>{
          if(p && p.name === '밀' && n === '밀' && p.topic === 'state-role') bad.push(TODAY + ' 공리주의 밀 자리에 자유주의 밀 제시문 ' + p.id);
          if(p && p.name === '밀' && n === '자유주의' && p.topic !== 'state-role') bad.push(TODAY + ' 자유주의 자리에 공리주의 밀 제시문 ' + p.id);
        });
      };
      if(q.type === 'right' || q.type === 'wrong') chk(q.name, q.choices, [q.ps]);
      else if(q.type === 'pair' || q.type === 'box'){
        const side = L=> (q.choices || q.items).filter(c=> c.label === L).map(c=> c);
        if(q.choices){ q.choices.forEach(c=>{ if(c.who === q.a) chk(q.a, [c]); if(c.who === q.b) chk(q.b, [c]); }); }
        else { q.items.forEach(c=>{ if(c.label === q.L1) chk(q.a, [c]); else if(c.label === q.L2) chk(q.b, [c]); }); }
        chk(q.a, [], [q.psA]); chk(q.b, [], [q.psB]);
      }
    });
  }
  ok(bad.length === 0, '밀 구분 위반 ' + bad.slice(0, 3).join(' / '));
  // 정형화에서 공리주의 밀과 자유주의가 한 시험지에 같이 나오는 날도 있다 (둘은 다른 사람)
  let both = 0;
  for(let d=1; d<=60; d++){
    STATE.quiz = { setNo:d % 4, run:null, mode:'formal' }; TODAY = '2026-12-' + String(1 + d % 28).padStart(2, '0');
    const all = []; buildMockSet().forEach(q=> namesOf(q).forEach(n=> all.push(n)));
    if(all.indexOf('밀') >= 0 && all.indexOf('자유주의') >= 0) both++;
  }
  ok(both > 0, '공리주의 밀과 자유주의가 한 시험지에 같이 나오는 경우가 없음');
  console.log('밀(공리주의)+자유주의 동시 출제 ' + both + '/60세트');
}

/* ---------- 자유 출제 크기 고르기 ---------- */
{
  STATE.quiz = { setNo:0, run:null };
  ok(mockMode() === 'free' && mockSetN() === 20, '기본은 자유 · 20문항');
  setMockSize(5);  ok(buildMockSet().length === 5, '5문항');
  setMockSize(10); ok(buildMockSet().length === 10, '10문항');
  ok(STATE.quiz.run.n === 10 && STATE.quiz.run.limit === 15, '크기를 바꾸면 새 시험지');
  setMockSize(20); ok(buildMockSet().length === 20, '20문항');
}

/* ---------- 정형화 ---------- */
{
  const unitBy = ['east', 'west', 'ideo'];
  let sets = 0;
  const kHist = {};
  const stat = { pairIn:0, vennAlgo:0 };
  for(let d=1; d<=28; d++){
    for(let no=0; no<3; no++){
      STATE.quiz = { setNo:no, run:null, mode:'formal' };
      TODAY = '2026-11-' + String(d).padStart(2, '0');
      const set = buildMockSet();
      const tag = TODAY + '#' + no;
      sets++;
      ok(set.length === 20, tag + ' 정형화는 20문항 고정 (' + set.length + ')');
      // 단원 배치 8·8·4, 순서는 동양 → 서양 → 이데올로기
      const bs = set.map(q=> bucketOfName(namesOf(q)[0]));
      ok(bs.slice(0, 8).every(b=> b === 'east') && bs.slice(8, 16).every(b=> b === 'west') && bs.slice(16).every(b=> b === 'ideo'),
         tag + ' 8·8·4 단원 배치가 아님 ' + bs.join(','));
      // 한 사람은 한 문항
      const all = []; set.forEach(q=> namesOf(q).forEach(n=> all.push(n)));
      ok(new Set(all).size === all.length, tag + ' 같은 사상가가 두 번 나옴');
      const has = n=> all.indexOf(n) >= 0;
      const together = (a, b)=> set.some(q=> namesOf(q).indexOf(a) >= 0 && namesOf(q).indexOf(b) >= 0);
      ok(together('이황', '이이'), tag + ' 이황·이이 비교가 한 문항에 없음');
      ok(together('주자', '왕수인'), tag + ' 주자·양명 비교가 한 문항에 없음');
      MOCK_FORMAL_SOLO.forEach(n=>{
        const q = set.find(x=> namesOf(x).indexOf(n) >= 0);
        ok(q && (q.type === 'right' || q.type === 'wrong') && q.name === n, tag + ' ' + n + ' 단독 문항이 아님');
      });
      MOCK_FORMAL_MUST.forEach(n=> ok(has(n), tag + ' ' + n + ' 이(가) 안 나옴'));
      ok(has('벤담') !== has('밀'), tag + ' 공리주의는 둘 중 한 사람만 (벤담 ' + has('벤담') + ' · 밀 ' + has('밀') + ')');
      const con = set.filter(q=> namesOf(q).some(n=> MOCK_FORMAL_CONTRACT.indexOf(n) >= 0));
      ok(con.length === 1, tag + ' 사회계약설은 정확히 한 문항 (' + con.length + ')');
      if(con.length){
        const k = namesOf(con[0]).filter(n=> MOCK_FORMAL_CONTRACT.indexOf(n) >= 0).length;
        ok(namesOf(con[0]).every(n=> MOCK_FORMAL_CONTRACT.indexOf(n) >= 0), tag + ' 사회계약설 문항에 다른 학자가 섞임');
        kHist[k] = (kHist[k] || 0) + 1;
      }
      ok(!set.some(q=> q.type === 'trioVenn' || q.type === 'critique'), tag + ' 3중 벤·비판은 안 씀');
      const nf = set.filter(q=> q.type === 'algo').length, nv = set.filter(q=> q.type === 'venn').length;
      ok(nf <= 2 && nv <= 2, tag + ' 그림 문항이 너무 많음 ' + nf + '/' + nv);
      stat.vennAlgo += nf + nv;
      // 구조 검사 — 단독은 O/X 개수, 갑을 라벨은 그 사람의 선지만
      set.forEach((q, i)=>{
        const t = tag + ' ' + (i + 1) + '번(' + q.type + ')';
        const ids = itemIds(q);
        ok(new Set(ids).size === ids.length, t + ' 한 문항에 같은 선지가 두 번');
        if(q.type === 'right' || q.type === 'wrong'){
          q.choices.forEach((c, ci)=>{
            const want = ci === q.ans ? (q.type === 'right' ? 'O' : 'X') : (q.type === 'right' ? 'X' : 'O');
            ok(oxById[c.id].answer === want, t + ' ' + (ci + 1) + '선지 O/X 구조 오류');
          });
        }
      });
    }
  }
  ok(kHist[1] > 0 && kHist[2] > 0 && kHist[3] > 0, '사회계약설 1·2·3명이 모두 나와야 함 ' + JSON.stringify(kHist));
  console.log('사회계약설 인원 분포 ' + JSON.stringify(kHist));
  console.log('정형화 ' + sets + '세트 검사 · 그림 문항 평균 ' + (stat.vennAlgo / sets).toFixed(1) + '개');
  // 같은 날·같은 세트 번호면 같은 문제, 방식이 다르면 다른 시험지
  STATE.quiz = { setNo:0, run:null, mode:'formal' }; TODAY = '2026-11-03';
  const a = JSON.stringify(buildMockSet()), b = JSON.stringify(buildMockSet());
  ok(a === b, '정형화가 같은 날 같은 세트인데 달라짐');
  STATE.quiz.mode = 'free';
  ok(JSON.stringify(buildMockSet()) !== a, '자유와 정형화가 같은 시험지');
}

/* ---------- 테마별 ---------- */
{
  const cases = [['이황'], ['지눌'], ['이황', '이이'], ['칸트', '정약용', '지눌'], ['스토아학파', '공화주의', '벤담', '왕수인'], ['원효', '홉스', '에피쿠로스', '순자']];
  let sets = 0;
  cases.forEach(names=>{
    for(let d=1; d<=10; d++){
      STATE.quiz = { setNo:d % 3, run:null, mode:'theme', theme:names.slice() };
      TODAY = '2026-11-' + String(d).padStart(2, '0');
      const set = buildMockSet();
      const tag = names.join('·') + ' ' + TODAY;
      sets++;
      ok(mockSetN() === names.length * 5 && set.length === names.length * 5, tag + ' 학자당 5문항 (' + set.length + ')');
      names.forEach((n, k)=>{
        const mine = set.slice(k * 5, k * 5 + 5);
        ok(mine.every(q=> namesOf(q).indexOf(n) >= 0), tag + ' ' + n + ' 구간에 다른 학자 문항이 섞임');
        ok(mine.some(q=> q.type === 'right' || q.type === 'wrong'), tag + ' ' + n + ' 단독 문항 없음');
        ok(new Set(mine.map(q=> q.type)).size >= 3, tag + ' ' + n + ' 유형이 단조로움 ' + mine.map(q=> q.type).join(','));
        mine.forEach(q=>{
          namesOf(q).forEach(m=> ok(m === n || names.indexOf(m) < 0, tag + ' ' + n + ' 문항에 다른 선택 학자 ' + m + ' 가 짝으로 들어감'));
        });
      });
      const ids = []; set.forEach(q=> itemIds(q).forEach(id=> ids.push(id)));
      ok(new Set(ids).size === ids.length, tag + ' 같은 선지가 시험지에 두 번 나옴 (' + (ids.length - new Set(ids).size) + ')');
      set.forEach((q, i)=>{
        if(q.type === 'right' || q.type === 'wrong'){
          q.choices.forEach((c, ci)=>{
            const want = ci === q.ans ? (q.type === 'right' ? 'O' : 'X') : (q.type === 'right' ? 'X' : 'O');
            ok(oxById[c.id].answer === want, tag + ' ' + (i + 1) + '번 O/X 구조 오류');
          });
        }
      });
    }
  });
  console.log('테마별 ' + sets + '세트 검사');
  // 최대 4명 · 학자 선택 보존
  STATE.quiz = { setNo:0, run:null, mode:'theme', theme:[] };
  ['이황', '이이', '칸트', '지눌', '맹자'].forEach(n=> toggleMockTheme(n));
  ok(STATE.quiz.theme.length === 4 && mockSetN() === 20, '테마는 최대 4명');
  toggleMockTheme('이황');
  ok(STATE.quiz.theme.length === 3 && mockSetN() === 15 && STATE.quiz.run.n === 15 && STATE.quiz.run.limit === 22, '학자를 빼면 15문항 22분');
}

/* ---------- 테마 후보 전부 — 한 명만 골라도 5문항 · 겹침 없음 ---------- */
{
  const cands = mockThemeCandidates();
  ok(cands.length >= 40, '테마 후보가 너무 적음 ' + cands.length);
  ok(['이황', '이이', '칸트', '지눌', '원효', '왕수인', '주자', '스토아학파', '공화주의', '홉스'].every(n=> cands.some(c=> c.n === n)), '핵심 학자가 후보에 없음');
  cands.forEach(c=>{
    for(let d=1; d<=4; d++){
      STATE.quiz = { setNo:0, run:null, mode:'theme', theme:[c.n] };
      TODAY = '2026-12-' + String(d).padStart(2, '0');
      const set = buildMockSet();
      ok(set.length === 5, c.n + ' 5문항이 안 나옴 (' + set.length + ')');
      const ids = []; set.forEach(q=> itemIds(q).forEach(id=> ids.push(id)));
      ok(new Set(ids).size === ids.length, c.n + ' ' + TODAY + ' 선지 겹침');
    }
  });
  STATE.quiz = { setNo:0, run:null, mode:'theme', theme:['동학'] };
  ok(mockThemeNames().length === 0, '선지가 모자란 학자는 고를 수 없음');
}

/* ---------- 방식 바꾸기 · 기록 · 새 세트 흐름 ---------- */
{
  STATE.ox = { rec:{}, stars:{} };
  TODAY = '2026-11-20';
  STATE.quiz = { setNo:0, run:null, history:{} };
  setMockMode('formal');
  ok(STATE.quiz.run.mode === 'formal' && STATE.quiz.run.n === 20 && STATE.quiz.run.limit === 30, '정형화 시험지 20문항 30분');
  setMockMode('theme'); toggleMockTheme('칸트'); toggleMockTheme('이이');
  ok(STATE.quiz.run.mode === 'theme' && STATE.quiz.run.n === 10 && STATE.quiz.run.names.join() === '칸트,이이', '테마 시험지 이름표');
  startMock();
  const set = buildMockSet();
  submitMock(true);
  const keys = Object.keys(STATE.quiz.history);
  ok(keys.length === 1 && /~t$/.test(keys[0]) && STATE.quiz.history[keys[0]].mode === 'theme', '테마 기록 키 ' + keys.join());
  newMockSet();
  ok(NAV.view === 'mock' && !STATE.quiz.run.submitted && STATE.quiz.run.mode === 'theme', '새 세트 → 설정 화면, 같은 방식 유지');
  setMockMode('free'); setMockSize(5);
  ok(STATE.quiz.run.n === 5 && STATE.quiz.run.limit === 7 && STATE.quiz.run.mode === 'free', '새 세트에서 5문항으로 다시 고름');
  startMock(); submitMock(true);
  const hl = mockHistoryList();
  ok(hl.length === 2 && hl[0].setNo === 1 && hl[0].mode === 'free' && hl[1].mode === 'theme', '기록 목록 ' + JSON.stringify(hl));
}

console.log(fail ? '실패 ' + fail + '건' : '=== 모드 테스트 완료 ===');
if(fail) process.exit(1);
