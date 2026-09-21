/* ===================================================================
   화면(뷰) 렌더링
   =================================================================== */

function go(view, extra){
  if(view === 'home' && NAV.view !== 'home') advanceHeroKao();
  NAV.view = view;
  if(extra) Object.assign(NAV, extra);
  render();
  const scrollEl = document.getElementById('scrollArea');
  if(scrollEl) scrollEl.scrollTop = 0;
  if(typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);   // 실제로는 문서 전체가 스크롤된다
}

function headerTitle(){
  const map = { home:['윤리와 사상 노트','1~3단원 · 동양·서양·이데올로기'], topics:['사상가별 정리','필기 원문 기반 정리'],
    topicDetail:['','' ], blankSetup:['빈칸학습','빨간펜 · 파란펜 가리개'], blankPractice:['빈칸학습',''],
    paperSetup:['백지복습','아무것도 안 보고 직접 써보기'], paperWrite:['백지복습',''],
    oxSetup:['기출 OX','최신 기출 선지 O/X 판단'], oxQuiz:['기출 OX',''],
    psSetup:['제시문','제시문 보고 사상가 맞히기'], psQuiz:['제시문',''], tables:['비교표 모아보기','헷갈리는 개념 한눈에'],
    mock:['모의고사','매일 20문항 · 전 범위 실력 점검'], mockExam:['모의고사',''], mockResult:['모의고사','채점 결과'],
    stats:['학습 통계','', ] };
  return map[NAV.view] || ['윤리와 사상 노트',''];
}

function render(){
  const root = document.getElementById('screen');
  let html = '';
  switch(NAV.view){
    case 'home': html = renderHome(); break;
    case 'topics': html = renderTopics(); break;
    case 'topicDetail': html = renderTopicDetail(); break;
    case 'blankSetup': html = renderBlankSetup(); break;
    case 'blankPractice': html = renderBlankPractice(); break;
    case 'paperSetup': html = renderPaperSetup(); break;
    case 'paperWrite': html = renderPaperWrite(); break;
    case 'psSetup': html = renderPsSetup(); break;
    case 'psQuiz': html = renderPsQuiz(); break;
    case 'oxSetup': html = renderOxSetup(); break;
    case 'oxQuiz': html = renderOxQuiz(); break;
    case 'tables': html = renderTables(); break;
    case 'mock': html = renderMockSetup(); break;
    case 'mockExam': html = renderMockExam(); break;
    case 'mockResult': html = renderMockResult(); break;
    case 'stats': html = renderStats(); break;
    default: html = renderHome();
  }
  root.innerHTML = html;
  renderTopbar();
  renderTabbar();
  if(NAV.view === 'paperWrite' && NAV.paperMode === 'draw'){
    initCanvas();
  }
  if(NAV.view === 'home') fitHeroKao();
  renderOmrLayer();
  mockClockSync();   // 시험지 화면일 때만 시간이 간다
}

// OMR 답안지는 #app 밖(body 바로 아래)에 둔다.
// 화면 안에 두면 조상 요소에 따라 position:fixed 가 화면이 아니라 그 요소에 붙어 안 보일 수 있다.
function renderOmrLayer(){
  let layer = document.getElementById('omrLayer');
  const run = STATE.quiz && STATE.quiz.run;
  const show = NAV.view === 'mockExam' && run && !run.submitted && run.omr;
  if(!show){
    if(layer) layer.remove();
    return;
  }
  const grid = layer && layer.querySelector('.omr-grid');
  const keep = grid ? grid.scrollTop : 0;
  if(!layer){
    layer = document.createElement('div');
    layer.id = 'omrLayer';
    document.body.appendChild(layer);
  }
  layer.innerHTML = renderOmrPanel(buildMockSet(), run);
  const g2 = layer.querySelector('.omr-grid');
  if(g2) g2.scrollTop = keep;
}

function renderTopbar(){
  const [t,s] = headerTitle();
  const bar = document.getElementById('topbar');
  if(NAV.view==='topicDetail'){ bar.style.display='none'; return; }
  bar.style.display='block';
  bar.innerHTML = `<h1><span class="seal">思</span>${t}</h1>${s?`<div class="sub">${s}</div>`:''}`;
  // 시험지의 시계 줄이 제목줄 바로 밑에 붙도록 높이를 알려 준다
  document.documentElement.style.setProperty('--topbar-h', bar.offsetHeight + 'px');
}

function renderTabbar(){
  const tabs = [
    {v:'home', ic:'家', label:'홈'},
    {v:'topics', ic:'卷', label:'정리'},
    {v:'blankSetup', ic:'空', label:'빈칸학습'},
    {v:'paperSetup', ic:'白', label:'백지복습'},
    {v:'psSetup', ic:'文', label:'제시문'},
    {v:'oxSetup', ic:'選', label:'기출OX'},
    {v:'mock', ic:'試', label:'모의고사'},
    {v:'tables', ic:'表', label:'비교표'},
    {v:'stats', ic:'計', label:'통계'},
  ];
  const activeSet = {
    topicDetail:'topics', blankPractice:'blankSetup', paperWrite:'paperSetup', oxQuiz:'oxSetup', psQuiz:'psSetup',
    mockExam:'mock', mockResult:'mock'
  };
  const active = activeSet[NAV.view] || NAV.view;
  document.getElementById('tabbar').innerHTML = tabs.map(t=>
    `<button class="${active===t.v?'active':''}" onclick="go('${t.v}')"><span class="ic">${t.ic}</span>${t.label}</button>`
  ).join('');
}

/* ---------- 홈 ---------- */
// 홈 첫 카드 그림 — 앞의 여섯 개는 형석이 준 것, 뒤는 같은 결로 더한 것. 홈에 들어올 때마다 다음 것으로 바뀌고, 누르면 바로 넘어간다.
// 백틱·꺾쇠가 들어 있어 템플릿 문자열이 아니라 JSON 문자열로 둔다. 줄바꿈·공백은 그대로 살려야 모양이 맞는다.
const HERO_KAO = [
 "ദ്ദി ˉ͈̀꒳ˉ͈́ )✧",
 "ദ്ദി*°ω°*ฅ)*",
 "⸜̑⸝͂˖໋⸰₍⸝⸝•ᢦ- ₎⸝⸝ި ʕᦏ´-　͙⋆",
 "＿人人人人人人人人＿\n＞　　아주좋아！ 　＜\n￣^Y^Y^Y^Y^Y^Y^Y￣",
 "    ᘏ⑅︎ᘏ\n（｡ɞ̴̶̷ ̫ ɞ̴̶̷｡)つ━☆☆*。\n⊂　　 ノ 　　　☆☆\n　し-Ｊ　　　°。+",
 "˚∧＿∧  　+        —̳͟͞͞💗\n(  •‿• )つ  —̳͟͞͞ 💗         —̳͟͞͞💗 +\n(つ　 <                —̳͟͞͞💗\n｜　 _つ      +  —̳͟͞͞💗         —̳͟͞͞💗 ˚\n`し´",
 "(๑•̀ㅂ•́)و✧",
 "٩(ˊᗜˋ*)و ♡",
 "( ˶ˆ꒳ˆ˵ ) ♡",
 "₍ᐢ. ̫.ᐢ₎ 오늘도 화이팅",
 "ʕ•̀ω•́ʔ✧",
 "(づ｡◕‿‿◕｡)づ 💗",
 "✧*.◟(ˊᗨˋ)◞.*✧",
 "( •̀ ω •́ )✧ 합격 가보자고",
 "⸜(｡˃ ᵕ ˂ )⸝♡",
 "ᕙ( •̀ ᗜ •́ )ᕗ 윤사 만점",
 "(｡•̀ᴗ-)✧",
 "૮ ˶ᵔ ᵕ ᵔ˶ ა",
 "₍₍ ◝(•̀ㅂ•́)◟ ⁾⁾",
 "(੭˙ᗜ˙)੭ 오늘 선지 가즈아",
 "ദ്ദി( ˶ᵔ ᵕ ᵔ˶ ) 잘하고 있어",
 "＿人人人人人人人人＿\n＞　　만점가자！ 　＜\n￣^Y^Y^Y^Y^Y^Y^Y￣",
 "　∧＿∧\n（｡•ω•｡)\n┏━∪∪━━━━━━━┓\n┃　오늘도　한　발짝　┃\n┗━━━━━━━━━━┛",
 "┏━━━━━━━┓\n┃　윤사　만점　┃\n┗━━━━━━━┛\n　ᐠ( ᐢ ᵕ ᐢ )ᐟ",
 "　 ∧∧\n（*・ω・）つ━☆・*。\n⊂　　 ノ 　　　・゜+.\n　しーＪ　　　°。+ ☆ 합격 마법",
 "　∩＿∩\n（ ･ω･ ）💌\n（つ　 と）　선지 하나 더!\n　しーＪ",
 "　 ∧＿∧\n　(　･ω･)\n　(つ👍つ　최고야\n　 しーＪ",
 "✧･ﾟ: *✧･ﾟ:*\n　(๑˃ᴗ˂)ﻭ\n　합격 기원\n*:･ﾟ✧*:･ﾟ✧",
 "　 ⋆｡°✩\n∧,,∧\n( ̳• ·̫ • ̳)\n/　 づ♡ 오늘 공부 끝!",
 "　 ∧_∧\n（ ˘ω˘ ）쿨쿨…\n　 (つ　つ　 쉬었다 가도 돼\n　 しーＪ",
 "　 ᘏ⑅ᘏ\n（  ˶'ᵕ'˶ ）💗\n（ っ 　 ）っ　　 잘했어\n　 ＵＵ"
];
// 그림 안의 한글만 손글씨로 바꾼다. HERO_KAO 자체는 손대지 않고 그릴 때만 감싼다.
// 기호·전각 공백·칸 맞춤 문자는 감싸지 않아야 모양이 덜 틀어진다.
function kaoHtml(s){
  return escHtml(s).replace(/[\uAC00-\uD7A3\u3131-\u318E]/g, function(m){
    return '<span class="kao-ko">' + m + '</span>';
  });
}
// 한 줄짜리는 크게, 여러 줄짜리는 보통 크기로
function heroKaoClass(){
  return 'hero-kao' + (HERO_KAO[heroKaoIdx()].indexOf('\n') < 0 ? ' one' : '');
}
function heroKaoIdx(){
  const n = HERO_KAO.length;
  return ((STATE.heroKao || 0) % n + n) % n;
}
// 홈에 들어올 때 · 그림을 누를 때 다음 것으로
function advanceHeroKao(){
  STATE.heroKao = (heroKaoIdx() + 1) % HERO_KAO.length;
  saveStore();
}
function nextHeroKao(){
  advanceHeroKao();
  const el = document.getElementById('heroKao');
  if(!el){ render(); return; }
  el.innerHTML = kaoHtml(HERO_KAO[heroKaoIdx()]);
  el.className = heroKaoClass();
  fitHeroKao();
}
// 긴 그림(6번)이 카드 폭을 넘으면 글자 크기를 줄여 한 줄이 꺾이지 않게 한다
function fitHeroKao(){
  const el = document.getElementById('heroKao');
  if(!el) return;
  el.style.fontSize = '';
  const box = el.parentElement.clientWidth;
  const w = el.scrollWidth;
  if(w > box && box > 0){
    const base = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = Math.max(8, Math.floor(base * box / w * 10) / 10) + 'px';
  }
}

function renderHome(){
  const prog = overallProgress();
  const streak = STATE.streak.count || 0;
  const c = oxCounts();
  const oxHist = (STATE.ox && STATE.ox.hist) || {};
  const oxToday = oxHist[todayStr()] || {done:0, correct:0};
  return `
  <div class="screen">
    <div class="hero hard-box">
      <button class="hero-kao-wrap" onclick="nextHeroKao()" aria-label="다음 그림">
        <pre id="heroKao" class="${heroKaoClass()}">${kaoHtml(HERO_KAO[heroKaoIdx()])}</pre>
      </button>
      <div class="hero-stats">
        <div class="hero-stat"><b>${prog.pct}%</b><span>전체 진도</span></div>
        <div class="hero-stat"><b>${streak}일</b><span>연속 학습</span></div>
        <div class="hero-stat"><b>${oxToday.done}</b><span>오늘 푼 선지</span></div>
      </div>
    </div>

    <div class="hard-box today-card mock-today" onclick="go('mock')">
      <div class="today-left">
        <div class="today-label">오늘의 모의고사</div>
        <div class="today-main">${mockTodayLine()}</div>
        <div class="note" style="margin-top:3px;">전 범위 20문항 · 사상가 중복 없음</div>
      </div>
      <div class="today-go">→</div>
    </div>

    ${c.total ? `
    <div class="hard-box today-card" onclick="go('oxSetup')">
      <div class="today-left">
        <div class="today-label">오늘의 복습</div>
        <div class="today-main">기출 OX <b>${c.due}</b>문항</div>
        <div class="note" style="margin-top:3px;">${c.star ? `★ 별표 ${c.star} · ` : ''}틀린 적 ${c.wrong}</div>
      </div>
      <div class="today-go">→</div>
    </div>` : ''}

    <div class="section-title">바로가기</div>
    <div class="grid2">
      <div class="hard-box nav-card" onclick="go('blankSetup')">
        <div class="ic">空</div><div class="t">빈칸학습</div>
        <div class="d">빨강 / 파랑 / 둘 다 가리기</div>
      </div>
      <div class="hard-box nav-card" onclick="go('oxSetup')">
        <div class="ic">選</div><div class="t">기출 OX</div>
        <div class="d">최신 기출 선지 O/X · 오답 자동 재출제</div>
      </div>
      <div class="hard-box nav-card" onclick="go('mock')">
        <div class="ic">試</div><div class="t">모의고사</div>
        <div class="d">선지 자동 조합 5지선다 · 매일 20문항</div>
      </div>
      <div class="hard-box nav-card" onclick="go('psSetup')">
        <div class="ic">文</div><div class="t">제시문</div>
        <div class="d">제시문 보고 사상가 맞히기 (단답형)</div>
      </div>
      <div class="hard-box nav-card" onclick="go('tables')">
        <div class="ic">表</div><div class="t">비교표 모아보기</div>
        <div class="d">계보 · 비교표 · 개념 층위 부록</div>
      </div>
      <div class="hard-box nav-card" onclick="go('topics')">
        <div class="ic">卷</div><div class="t">사상가별 정리</div>
        <div class="d">${DATA.length}개 주제 전체 보기</div>
      </div>
      <div class="hard-box nav-card" onclick="go('paperSetup')">
        <div class="ic">白</div><div class="t">백지복습</div>
        <div class="d">안 보고 직접 타이핑해서 써보기</div>
      </div>
    </div>

    <div class="section-title">단원별 진도</div>
    ${UNIT_ORDER.map(u=>{
      const topics = DATA.filter(t=>t.unit===u);
      let total=0, done=0;
      topics.forEach(t=>{ total+=topicLineCount(t); done+=topicCheckedCount(t); });
      const pct = total? Math.round(done/total*100):0;
      return `<div class="hard-box unit-card" onclick="go('topics')">
        <div class="unit-card-top">
          <span class="badge tag-${u}"><span class="seal-ch">${UNIT_ICON[u]}</span>${UNIT_LABEL[u]}</span>
          <span class="note">${topics.length}개 주제</span>
          <span class="unit-card-pct">${pct}%</span>
        </div>
        <div class="progress-bar" style="margin-top:0;"><div style="width:${pct}%"></div></div>
      </div>`;
    }).join('')}
  </div>`;
}

// 홈 카드에 쓸 오늘 모의고사 한 줄
function mockTodayLine(){
  const run = ensureMockRun();
  if(run.submitted) return `채점 완료 <b>${run.score} / ${MOCK_N}</b>`;
  const done = mockAnsweredCount();
  if(done > 0) return `풀던 시험지 <b>${done} / ${MOCK_N}</b>`;
  return `<b>${MOCK_N}</b>문항 대기 중`;
}

/* ---------- 사상가별 정리 : 목록 ---------- */
function renderTopics(){
  const q = NAV.searchQ.trim();
  let matches = null;
  if(q){
    matches = [];
    DATA.forEach(topic=>{
      ['outline','deep'].forEach(sec=>{
        (topic[sec]||[]).forEach(line=>{
          const plain = stripMarkup(line.t);
          if(plain.includes(q)){
            matches.push({topicId:topic.id, topicTitle:topic.title, snippet:plain});
          }
        });
      });
    });
  }
  let body = '';
  if(matches){
    body = matches.length ? matches.slice(0,40).map(m=>`
      <div class="hard-box topic-row" onclick="go('topicDetail',{topicId:'${m.topicId}'})">
        <div class="info"><div class="tt">${m.topicTitle}</div><div class="ss">${highlightQ(m.snippet,q)}</div></div>
      </div>`).join('') : `<div class="empty"><div class="ic">無</div>'${q}'에 대한 검색 결과가 없어요</div>`;
  } else {
    body = UNIT_ORDER.map(u=>{
      const topics = DATA.filter(t=>t.unit===u).sort((a,b)=>a.order-b.order);
      const hasEra = topics.some(t=>t.era);
      const header = `<div class="section-title">${UNIT_ICON[u]} ${UNIT_LABEL[u]}</div>`;
      if(!hasEra){
        return header + topics.map(t=>renderTopicRow(t)).join('');
      }
      const ERA_ORDER = ['고대','중세','근대','현대'];
      const byEra = ERA_ORDER.map(era=>({era, list: topics.filter(t=>t.era===era)})).filter(g=>g.list.length);
      return header + byEra.map(g=>`
        <div class="era-label">${g.era}</div>
        ${g.list.map(t=>renderTopicRow(t)).join('')}
      `).join('');
    }).join('');
  }
  return `<div class="screen">
    <div class="search-box">
      <input type="text" placeholder="개념·용어 검색 (예: 격물치지)" value="${escAttr(q)}" oninput="onSearchInput(this.value)"/>
    </div>
    ${body}
  </div>`;
}
function renderTopicRow(t){
  const total = topicLineCount(t), done = topicCheckedCount(t);
  const pct = total? Math.round(done/total*100):0;
  return `<div class="hard-box topic-row" onclick="go('topicDetail',{topicId:'${t.id}'})">
    <div class="num">${t.order}</div>
    <div class="info"><div class="tt">${t.title}</div><div class="ss">${t.subtitle}</div></div>
    <div class="prog"><b>${pct}%</b>${done}/${total}</div>
  </div>`;
}
function highlightQ(text, q){
  const i = text.indexOf(q);
  if(i<0) return text.slice(0,60);
  const s = Math.max(0, i-14);
  return (s>0?'…':'') + text.slice(s, i) + '<b style="background:#F4B400;">' + q + '</b>' + text.slice(i+q.length, i+q.length+30);
}
let searchDebounce = null;
function onSearchInput(v){
  NAV.searchQ = v;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(()=>{ render(); const el=document.querySelector('.search-box input'); if(el){el.focus(); el.setSelectionRange(v.length,v.length);} }, 120);
}

/* ---------- 사상가 상세 ---------- */
function renderTopicDetail(){
  const topic = DATA.find(t=>t.id===NAV.topicId);
  if(!topic) return `<div class="screen"><div class="empty">주제를 찾을 수 없어요</div></div>`;
  const total = topicLineCount(topic), done = topicCheckedCount(topic);
  const pct = total? Math.round(done/total*100):0;
  return `<div class="screen">
    <button class="btn btn-ghost btn-sm" onclick="go('topics')">← 목록으로</button>
    <div class="hard-box detail-head" style="margin-top:10px;">
      <span class="badge tag-${topic.unit}"><span class="seal-ch">${UNIT_ICON[topic.unit]}</span>${UNIT_LABEL[topic.unit]}</span>${topic.era?` <span class="badge" style="color:var(--ink-soft); border-color:var(--rule-strong);">${topic.era}</span>`:''}
      <h2>${topic.title}</h2>
      <div class="ss">${topic.subtitle}</div>
      <div class="progress-bar"><div style="width:${pct}%"></div></div>
      <div class="ss" style="margin-top:4px;">${done}/${total}줄 학습 완료 (${pct}%)</div>
      <div class="detail-tabs">
        <button class="btn btn-sm btn-gold" onclick="go('blankPractice',{blankTopic:'${topic.id}', blankMode:'both'})">이 주제 빈칸학습 →</button>
        <button class="btn btn-sm" onclick="NAV.paperTopic='${topic.id}'; NAV.paperMode='type'; NAV.paperRevealed=false; go('paperWrite')">백지복습 →</button>
        ${oxPool({topic:topic.id}).length ? `<button class="btn btn-sm" onclick="studyTopicOx('${topic.id}')">기출 OX (${oxPool({topic:topic.id}).length}) →</button>` : ''}
      </div>
    </div>

    <div class="hard-box" style="padding:14px;">
      ${renderOutline(topic, topic.outline, 'outline', null)}
    </div>

    ${topic.deep && topic.deep.length ? `
    <div class="hard-box deep-toggle" onclick="toggleDeep()">
      <span>심화 정리 ${NAV.detailShowDeep?'접기':'펼치기'} <span class="note">(${topic.deep.length}줄)</span></span>
      <span>${NAV.detailShowDeep?'▲':'▼'}</span>
    </div>
    ${NAV.detailShowDeep ? `<div class="hard-box" style="padding:14px;">${renderOutline(topic, topic.deep, 'deep', null)}</div>` : ''}
    ` : ''}

    ${topic.table ? `
    <div class="hard-box" style="padding:14px;">
      ${renderTable(topic.table, NAV.tableHideCol)}
    </div>` : ''}

    ${topic.figures && topic.figures.length ? `
    <div class="hard-box" style="padding:14px;">
      <div class="fig-head">곁들여 나오는 사상가 <span class="note">(${topic.figures.length}명 · 제시문 단서까지)</span></div>
      ${topic.figures.map(renderFigure).join('')}
    </div>` : ''}

    ${topic.story ? `
    <div class="hard-box story-toggle" onclick="toggleStory()">
      <span>흐름으로 읽기 ${NAV.detailShowStory?'접기':'펼치기'}
        <span class="note">(개념·심화를 이야기로 이어 붙인 글)</span></span>
      <span class="note">${NAV.detailShowStory?'▲':'▼'}</span>
    </div>` : ''}
    ${topic.story && NAV.detailShowStory ? `
    <div class="hard-box story-box">
      ${topic.story.map(para=>`<p class="story-p">${renderStoryLine(para)}</p>`).join('')}
    </div>` : ''}
  </div>`;
}
// 한 주제 안에서 잠깐씩 나오는 사상가. 길게 정리하지 않고 한 눈에 잡을 만큼만 둔다
function renderFigure(f){
  return `<div class="fig-card">
    <div class="fig-name">${f.name}${f.tag?` <span class="fig-tag">${f.tag}</span>`:''}</div>
    <div class="fig-gist">${renderStoryLine(f.gist)}</div>
    ${f.quote?`<div class="fig-quote">${renderStoryLine(f.quote)}${f.qsrc?`<span class="fig-qsrc">— ${f.qsrc}</span>`:''}</div>`:''}
    ${(f.clue&&f.clue.length)?`<div class="fig-clue">제시문에서는 · ${f.clue.map(c=>`「${c}」`).join(' / ')}</div>`:''}
  </div>`;
}
function toggleDeep(){ NAV.detailShowDeep = !NAV.detailShowDeep; render(); }
function toggleStory(){ NAV.detailShowStory = !NAV.detailShowStory; render(); }
// 스토리 본문의 <r>/<b> 는 필기와 같은 색이되, 굵게만 표시한다
function renderStoryLine(t){
  // <o>/<s>/<box> 는 필기와 같은 주석 표시. renderAnnot을 함께 태워
  // 흐름으로 읽기에서도 동그라미·취소선·네모가 그대로 나오게 한다
  return renderAnnot(t
    .replace(/<r>(.*?)<\/r>/g, '<b class="story-r">$1</b>')
    .replace(/<b>(.*?)<\/b>/g, '<b class="story-b">$1</b>')
    .replace(/<k>(.*?)<\/k>/g, '<b class="story-k">$1</b>'));
}

/* ---------- 빈칸학습 설정 ---------- */
function renderBlankSetup(){
  const topics = DATA.slice().sort((a,b)=>a.order-b.order);
  const sel = NAV.blankTopic;
  return `<div class="screen">
    <div class="hard-box" style="padding:16px;">
      <div class="section-title" style="margin-top:0;">1. 어떤 주제를 학습할까요?</div>
      <select id="blankTopicSel" onchange="NAV.blankTopic=this.value; render();" style="width:100%; padding:11px; border:1px solid var(--rule-strong); border-radius:9px; font-size:14px; font-weight:600; background:var(--panel); font-family:var(--font-sans);">
        <option value="">주제를 선택하세요</option>
        ${topics.map(t=>`<option value="${t.id}" ${sel===t.id?'selected':''}>${UNIT_ICON[t.unit]} ${t.title} · ${t.subtitle}</option>`).join('')}
      </select>

      <div class="section-title">2. 무엇을 가릴까요?</div>
      <div class="mode-pick">
        <button class="btn ${NAV.blankMode==='red'?'btn-red':''}" onclick="NAV.blankMode='red'; render();"><span class="sw sw-red"></span>빨간색만</button>
        <button class="btn ${NAV.blankMode==='blue'?'btn-blue':''}" onclick="NAV.blankMode='blue'; render();"><span class="sw sw-blue"></span>파란색만</button>
        <button class="btn ${NAV.blankMode==='both'?'btn-both':''}" onclick="NAV.blankMode='both'; render();"><span class="sw sw-both"></span>둘 다</button>
        <button class="btn ${NAV.blankMode==='black'?'btn-primary':''}" onclick="NAV.blankMode='black'; render();"><span class="sw sw-black"></span>검은색만</button>
      </div>
      <div class="note" style="margin:-8px 0 4px;">검은색만: 빨강·파랑 키워드는 그대로 두고, 설명하는 문장(검은 글씨)을 가려서 흐름을 스스로 채워보는 모드예요.</div>

      <div class="section-title">3. 범위</div>
      <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; margin-bottom:6px;">
        <input type="checkbox" ${NAV.blankIncludeDeep?'checked':''} onchange="NAV.blankIncludeDeep=this.checked; render();"/> 심화 정리 포함
      </label>
      <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700;">
        <input type="checkbox" ${NAV.blankIncludeTable?'checked':''} onchange="NAV.blankIncludeTable=this.checked; render();"/> 비교표 포함
      </label>

      <button class="btn btn-primary btn-block" style="margin-top:18px; padding:14px;" ${(!NAV.blankTopic||!NAV.blankMode)?'disabled':''} onclick="startBlankPractice()">가리고 학습 시작 →</button>
    </div>
  </div>`;
}
function startBlankPractice(){
  if(!NAV.blankTopic || !NAV.blankMode) return;
  NAV.blankRevealAll = false;
  go('blankPractice');
}

/* ---------- 빈칸학습 연습 ---------- */
function renderBlankPractice(){
  const topic = DATA.find(t=>t.id===NAV.blankTopic);
  if(!topic) return `<div class="screen"><div class="empty">먼저 주제를 선택해주세요<br><button class="btn btn-primary" style="margin-top:12px;" onclick="go('blankSetup')">설정으로</button></div></div>`;
  const blankSet = NAV.blankMode==='both' ? new Set(['red','blue']) : new Set([NAV.blankMode]);
  const modeLabel = {red:'빨강만 가림', blue:'파랑만 가림', both:'빨강·파랑 모두 가림', black:'검은색(설명 문장)만 가림'}[NAV.blankMode];

  let body = `<div class="hard-box" style="padding:14px; margin-bottom:14px;">
      <div class="badge tag-${topic.unit}"><span class="seal-ch">${UNIT_ICON[topic.unit]}</span>${UNIT_LABEL[topic.unit]}</div>
      <h2 style="margin:6px 0 0; font-size:17px;">${topic.title}</h2>
      <div class="ss">${topic.subtitle} · ${modeLabel}</div>
    </div>
    <div class="hard-box" style="padding:14px;">
      ${renderOutline(topic, topic.outline, 'outline', blankSet)}
    </div>`;

  if(NAV.blankIncludeDeep && topic.deep && topic.deep.length){
    body += `<div class="table-title" style="margin-top:18px;">심화 정리</div>
      <div class="hard-box" style="padding:14px;">${renderOutline(topic, topic.deep, 'deep', blankSet)}</div>`;
  }
  if(NAV.blankIncludeTable && topic.table){
    const tblankCols = blankSet.size ? topic.table.cols.map((c,ci)=>ci) : [];
    body += `<div class="hard-box" style="padding:14px; margin-top:14px;">${renderTableBlanked(topic.table, blankSet)}</div>`;
  }

  return `<div class="screen">
    <button class="btn btn-ghost btn-sm" onclick="go('blankSetup')">← 설정 다시하기</button>
    <div class="practice-toolbar">
      <button class="btn btn-sm btn-block" onclick="revealAllBlanks()">전체 정답 보기</button>
      <button class="btn btn-sm btn-block" onclick="hideAllBlanks()">다시 가리기</button>
    </div>
    ${body}
  </div>`;
}
function renderTableBlanked(table, blankSet){
  // 표에서도 <r>/<b> 표시된 셀 내용을 같은 방식으로 가림
  const rows = table.rows.map(r=>'<tr>'+r.map(cell=>`<td>${renderLineHTML(cell, blankSet, 'tbl'+Math.random().toString(36).slice(2))}</td>`).join('')+'</tr>').join('');
  const head = '<tr>'+table.cols.map(c=>`<th>${c}</th>`).join('')+'</tr>';
  return `<div class="table-title">${table.title}</div><div class="table-wrap"><table class="cmp-table">${head}${rows}</table></div>`;
}
function revealAllBlanks(){
  document.querySelectorAll('.blank.hidden').forEach(el=>{ el.classList.remove('hidden'); el.classList.add('shown'); });
}
function hideAllBlanks(){
  document.querySelectorAll('.blank.shown').forEach(el=>{ el.classList.remove('shown'); el.classList.add('hidden'); });
}

/* ---------- 백지 복습 (직접 타이핑 — 소제목 틀 유지 + 내용만 채우기) ---------- */
function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// 레벨0(대제목) 줄마다 새 섹션을 시작하고, 그 아래(레벨1~) 줄들의 빨간 키워드를 힌트 풀로 모음
function getGuidedSections(topic){
  const groups = [];
  const feed = (list, sec)=>{
    (list||[]).forEach((l, idx)=>{
      if(l.i === 0 || !groups.length){
        groups.push({ headerHtml: l.t, key: topic.id+':'+sec+':'+idx, subLines: [] });
      } else {
        groups[groups.length-1].subLines.push(l);
      }
    });
  };
  feed(topic.outline, 'outline');
  if(topic.deep && topic.deep.length) feed(topic.deep, 'deep');
  return groups.map(g=>{
    const terms = [];
    g.subLines.forEach(l=>{
      const re = /<r>(.*?)<\/r>/g;
      let m;
      while((m = re.exec(l.t))){
        let term = stripMarkup(m[1]);
        if(term.length > 10) term = term.slice(0, 9) + '…'; // 완전한 답이 아닌 짧은 단서만
        if(term.length >= 2) terms.push(term);
      }
    });
    return { ...g, hint: terms.slice(0, 5).join(' · ') };
  });
}
function guidedDraftFor(topicId){
  const v = STATE.blankPaper[topicId];
  return (v && typeof v === 'object') ? v : {};
}
function renderPaperSetup(){
  const topics = DATA.slice().sort((a,b)=>a.order-b.order);
  const sel = NAV.paperTopic;
  return `<div class="screen">
    <div class="hard-box" style="padding:16px;">
      <div class="section-title" style="margin-top:0;">주제를 고르고, 내용을 채워보세요</div>
      <div class="note" style="margin-bottom:10px;">큰 소제목은 그대로 보여주고, 그 아래 내용만 안 보고 채우는 방식이에요. 막히면 힌트로 핵심 키워드만 살짝 볼 수 있어요.</div>
      <select id="paperTopicSel" onchange="NAV.paperTopic=this.value; NAV.paperRevealed=false; render();" style="width:100%; padding:11px; border:1px solid var(--rule-strong); border-radius:9px; font-size:14px; font-weight:600; background:var(--panel); font-family:var(--font-sans);">
        <option value="">주제를 선택하세요</option>
        ${topics.map(t=>{
          const draft = guidedDraftFor(t.id);
          const has = Object.values(draft).some(v=>v && v.trim().length>0);
          return `<option value="${t.id}" ${sel===t.id?'selected':''}>${UNIT_ICON[t.unit]} ${t.title} · ${t.subtitle}${has?' (이어쓰기 가능)':''}</option>`;
        }).join('')}
      </select>
      <button class="btn btn-primary btn-block" style="margin-top:18px; padding:14px;" ${!NAV.paperTopic?'disabled':''} onclick="NAV.paperRevealed=false; NAV.paperMode='type'; NAV.shownHints={}; go('paperWrite')">채우기 시작 →</button>
    </div>
  </div>`;
}
function renderPaperWrite(){
  const topic = DATA.find(t=>t.id===NAV.paperTopic);
  if(!topic) return `<div class="screen"><div class="empty">먼저 주제를 선택해주세요<br><button class="btn btn-primary" style="margin-top:12px;" onclick="go('paperSetup')">설정으로</button></div></div>`;
  const mode = NAV.paperMode || 'type';
  const draft = guidedDraftFor(topic.id);
  const sections = mode === 'type' ? getGuidedSections(topic) : [];
  return `<div class="screen">
    <button class="btn btn-ghost btn-sm" onclick="go('paperSetup')">← 주제 다시 고르기</button>
    <div class="hard-box detail-head" style="margin-top:10px; padding:16px;">
      <span class="badge tag-${topic.unit}"><span class="seal-ch">${UNIT_ICON[topic.unit]}</span>${UNIT_LABEL[topic.unit]}</span>
      <h2 style="font-size:18px; margin-top:8px;">${topic.title}</h2>
      <div class="ss">${topic.subtitle} · 소제목 아래 내용을 채워보세요</div>
    </div>

    <div class="mode-toggle-row">
      <button class="btn ${mode==='type'?'btn-primary':''}" onclick="setPaperMode('type')">타이핑</button>
      <button class="btn ${mode==='draw'?'btn-primary':''}" onclick="setPaperMode('draw')">손글씨 (Apple Pencil)</button>
    </div>

    ${mode === 'type' ? `
      <div class="paper-meta" style="margin-bottom:6px;">
        <span class="note">자동저장됨</span>
        <span style="cursor:pointer; text-decoration:underline;" onclick="clearPaper()">전체 지우고 다시쓰기</span>
      </div>
      ${sections.map(s=>`
        <div class="guided-section">
          <div class="guided-header">${renderLineHTML(s.headerHtml, null, s.key)}</div>
          <textarea class="guided-input" data-key="${escAttr(s.key)}" oninput="onGuidedInput(this)" placeholder="이 항목 내용을 기억나는 대로 써보세요">${escHtml(draft[s.key]||'')}</textarea>
          <div class="guided-hint-row">
            ${s.hint ? `<span class="guided-hint-btn" onclick="toggleHint('${s.key}')">${(NAV.shownHints&&NAV.shownHints[s.key])?'힌트 숨기기':'힌트 보기'}</span>` : ''}
            ${(NAV.shownHints&&NAV.shownHints[s.key]) ? `<span class="guided-hint-text">힌트: ${s.hint}</span>` : ''}
          </div>
        </div>
      `).join('')}
    ` : `
      <div class="canvas-toolbar">
        <div class="pen-swatch ink ${HW.color==='ink'?'active':''}" onclick="setPenColor('ink')"></div>
        <div class="pen-swatch red ${HW.color==='red'?'active':''}" onclick="setPenColor('red')"></div>
        <div class="pen-swatch blue ${HW.color==='blue'?'active':''}" onclick="setPenColor('blue')"></div>
        <div class="pen-swatch eraser ${HW.color==='eraser'?'active':''}" onclick="setPenColor('eraser')">消</div>
        <span class="spacer"></span>
        <button class="btn btn-sm" onclick="undoStroke()">되돌리기</button>
        <button class="btn btn-sm" onclick="clearCanvas()">전체 지우기</button>
      </div>
      <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-soft); margin-bottom:8px; cursor:pointer;">
        <input type="checkbox" ${HW.showGuide?'checked':''} onchange="toggleGuide(this.checked)"/> 필기노트 비쳐 보이기 (49%) — 켜고 끌 수 있어요
      </label>
      <div class="canvas-wrap">
        ${HW.showGuide ? `<div class="canvas-guide">${renderGuideOutline(topic.outline)}${(topic.deep&&topic.deep.length)?renderGuideOutline(topic.deep):''}</div>` : ''}
        <canvas id="hwCanvas" class="hw-canvas"></canvas>
      </div>
      <div class="pencil-note">
        <label><input type="checkbox" ${HW.allowTouch?'checked':''} onchange="toggleAllowTouch(this.checked)"/> 손가락 입력도 허용</label>
        <span style="cursor:pointer; text-decoration:underline;" onclick="exportCanvasImage()">이미지로 저장</span>
      </div>
    `}

    <button class="btn btn-primary btn-block" style="margin-top:14px; padding:14px;" onclick="togglePaperReveal()">${NAV.paperRevealed?'원문 다시 가리기':'다 썼어요 — 원문과 비교하기'}</button>

    ${NAV.paperRevealed ? `
    <div class="compare-wrap">
      <div class="compare-head"><span class="t">원문 정리</span></div>
      <div class="hard-box" style="padding:14px;">
        ${renderOutline(topic, topic.outline, 'outline', null)}
      </div>
      ${topic.deep && topic.deep.length ? `
      <div class="table-title" style="margin-top:16px;">심화 정리</div>
      <div class="hard-box" style="padding:14px;">${renderOutline(topic, topic.deep, 'deep', null)}</div>` : ''}
      ${topic.table ? `<div class="hard-box" style="padding:14px; margin-top:14px;">${renderTable(topic.table, null)}</div>` : ''}
    </div>` : ''}
  </div>`;
}
let paperDebounce = null;
function onGuidedInput(el){
  const key = el.getAttribute('data-key');
  const val = el.value;
  clearTimeout(paperDebounce);
  paperDebounce = setTimeout(()=>{
    if(!STATE.blankPaper[NAV.paperTopic] || typeof STATE.blankPaper[NAV.paperTopic] !== 'object'){
      STATE.blankPaper[NAV.paperTopic] = {};
    }
    STATE.blankPaper[NAV.paperTopic][key] = val;
    saveStore();
  }, 400);
}
function toggleHint(key){
  if(!NAV.shownHints) NAV.shownHints = {};
  NAV.shownHints[key] = !NAV.shownHints[key];
  render();
}
function togglePaperReveal(){
  NAV.paperRevealed = !NAV.paperRevealed;
  render();
  if(NAV.paperRevealed){
    const el = document.querySelector('.compare-wrap');
    if(el && typeof el.scrollIntoView === 'function') el.scrollIntoView({behavior:'smooth', block:'start'});
  }
}
function clearPaper(){
  if(!confirm('지금까지 쓴 내용을 지울까요?')) return;
  STATE.blankPaper[NAV.paperTopic] = {};
  NAV.shownHints = {};
  saveStore();
  render();
}

/* ---------- 제시문 (단답형) — 기출 지문과 원전이 섞여 있다 ---------- */
function renderPsSetup(){
  const c = psCounts();
  const f = NAV.psFilter;
  const topics = psTopicsAvailable();
  if(c.total === 0){
    return `<div class="screen"><div class="empty"><div class="ic">無</div>아직 등록된 제시문이 없어요</div></div>`;
  }
  const poolNow = psPool(f).length;
  return `<div class="screen">
    <div class="hard-box" style="padding:16px;">
      <div class="section-title" style="margin-top:0;">제시문 보고 사상가 맞히기</div>
      <div class="note" style="margin-bottom:12px;">제시문을 읽고 누구의 주장인지 직접 써보세요. 정답을 맞히면 결정적 단서에 형광펜이 그어져요.</div>
      <div class="ox-stat-row">
        <div class="ox-stat"><b>${c.total}</b><span>전체</span></div>
        <div class="ox-stat"><b>${c.due}</b><span>복습 예정</span></div>
        <div class="ox-stat"><b>${c.star}</b><span>별표</span></div>
        <div class="ox-stat"><b>${c.wrong}</b><span>틀린 적</span></div>
      </div>

      <div class="section-title">사상가 <span class="note" style="font-weight:400;">${(f.topics&&f.topics.length)?f.topics.length+'명 선택':'전체'} · 여러 명 고를 수 있어요</span></div>
      <div class="chip-row">
        <button class="btn btn-sm ${!(f.topics&&f.topics.length)?'btn-primary':''}" onclick="clearPsTopics()">전체</button>
        ${topics.map(t=>`<button class="btn btn-sm ${(f.topics||[]).indexOf(t.id)>=0?'btn-primary':''}" onclick="togglePsTopic('${t.id}')">${t.title}</button>`).join('')}
      </div>

      <div class="section-title">조건</div>
      <label class="ox-check"><input type="checkbox" ${f.dueOnly?'checked':''} onchange="setPsFilter('dueOnly',this.checked)"/> 복습할 때가 된 것만 (간격 반복)</label>
      <label class="ox-check"><input type="checkbox" ${f.starred?'checked':''} onchange="setPsFilter('starred',this.checked)"/> ★ 별표한 것만</label>
      <label class="ox-check"><input type="checkbox" ${f.wrongOnly?'checked':''} onchange="setPsFilter('wrongOnly',this.checked)"/> 틀린 적 있는 것만</label>
      <label class="ox-check"><input type="checkbox" ${f.unseenOnly?'checked':''} onchange="setPsFilter('unseenOnly',this.checked)"/> 안 본 것만 <span class="note">(${psPool(Object.assign({}, f, {unseenOnly:true, wrongOnly:false, dueOnly:false})).length}편)</span></label>

      <div class="note" style="margin-top:12px;">지금 조건에 맞는 제시문: <b style="color:var(--ink);">${poolNow}개</b></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px; padding:14px;" ${poolNow===0?'disabled':''} onclick="startPsSession()">제시문 풀기 시작 →</button>
    </div>
  </div>`;
}
function setPsFilter(k,v){
  NAV.psFilter[k]=v;
  // 「안 본 것」과 「틀린 적 있는 것」은 겹칠 수 없어 하나를 켜면 다른 하나를 끈다
  if(v && k === 'unseenOnly') NAV.psFilter.wrongOnly = false;
  if(v && k === 'wrongOnly') NAV.psFilter.unseenOnly = false;
  render();
}
function togglePsTopic(id){
  const f = NAV.psFilter;
  if(!f.topics) f.topics = [];
  const i = f.topics.indexOf(id);
  if(i >= 0) f.topics.splice(i,1); else f.topics.push(id);
  f.topic = null;
  render();
}
function clearPsTopics(){ NAV.psFilter.topics = []; NAV.psFilter.topic = null; render(); }
function startPsSession(){
  const list = psSortForStudy(psPool(NAV.psFilter));
  const N = Math.min(10, list.length);
  NAV.psSession = { items:list.slice(0,N), idx:0, answered:false, lastCorrect:null, results:[], typed:'' };
  NAV.psInput = '';
  go('psQuiz');
}
function renderPsQuiz(){
  const s = NAV.psSession;
  if(!s) return `<div class="screen"><div class="empty">먼저 범위를 정해주세요<br><button class="btn btn-primary" style="margin-top:12px;" onclick="go('psSetup')">범위 설정</button></div></div>`;
  if(s.idx >= s.items.length){
    const correct = s.results.filter(Boolean).length;
    const wrongItems = s.items.filter((it,i)=>s.results[i]===false);
    return `<div class="screen">
      <div class="hard-box quiz-done">
        <div class="ss">이번 세트 완료</div>
        <div class="big">${correct} / ${s.items.length}</div>
        <div class="ss" style="margin-top:6px;">틀린 제시문은 내일 다시 나와요</div>
        <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="startPsSession()">이어서 더 풀기</button>
        <button class="btn btn-block" style="margin-top:10px;" onclick="go('psSetup')">범위 다시 정하기</button>
      </div>
      ${wrongItems.length ? `
      <div class="section-title">이번에 틀린 제시문 (${wrongItems.length})</div>
      ${wrongItems.map(it=>`
        <div class="hard-box" style="padding:13px; margin-bottom:9px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <b style="font-family:var(--font-serif); color:var(--red);">${it.name}</b>${it.by?`<span class="note">(${it.by})</span>`:''}
            <span class="note" style="flex:1;">${it.source||''}</span>
            <span class="ox-star ${isPsStarred(it.id)?'on':''}" onclick="togglePsStar('${it.id}')">★</span>
          </div>
          <div class="ps-body" style="margin-top:7px; font-size:12.5px;">${highlightClues(it.text, it.clues)}</div>
        </div>`).join('')}
      ` : ''}
    </div>`;
  }
  const item = s.items[s.idx];
  const r = psRec(item.id);
  return `<div class="screen">
    <div class="quiz-progress">
      ${s.items.map((it,i)=>`<div class="dot ${i<s.idx ? (s.results[i]?'ok':'no') : (i===s.idx?'now':'')}"></div>`).join('')}
    </div>

    <div class="hard-box ps-card ${s.answered ? (s.lastCorrect?'is-correct':'is-wrong') : ''}">
      <div class="ox-meta">
        <span>${s.idx+1} / ${s.items.length}</span>
        <span class="note">${s.answered ? (item.source||'') : ''}</span>
        <span class="ox-star ${isPsStarred(item.id)?'on':''}" onclick="togglePsStar('${item.id}')">★</span>
      </div>
      <div class="ps-body">${s.answered ? highlightClues(item.text, item.clues) : escHtml(item.text)}</div>
      ${r.wrong>0 && !s.answered ? `<div class="note" style="margin-top:10px;">이전에 ${r.wrong}번 틀린 제시문이에요</div>` : ''}
      ${s.answered ? `
        <div class="ox-verdict ${s.lastCorrect?'ok':'no'}">
          <div class="ox-verdict-mark">${s.lastCorrect?'✓':'✕'}</div>
          <div class="ox-verdict-txt">
            <b>${s.lastCorrect?'정답':'오답'}</b>
            <span>답: <b style="font-family:var(--font-serif); font-size:16px; color:var(--ink);">${item.name}</b>${item.by?`<span class="note"> (${item.by})</span>`:''}</span>
          </div>
        </div>
        ${!s.lastCorrect && s.typed ? `<div class="note" style="margin-top:8px;">내가 쓴 답: "${escHtml(s.typed)}" — 맞게 썼는데 오답 처리됐다면 <span style="color:var(--blue); text-decoration:underline; cursor:pointer;" onclick="overridePsCorrect()">정답으로 인정</span></div>` : ''}
      ` : ''}
    </div>

    ${!s.answered ? `
      <input id="psInput" class="ps-input" type="text" autocomplete="off" autocapitalize="off"
        placeholder="이 제시문은 누구의 주장일까요?" value="${escAttr(NAV.psInput||'')}"
        oninput="NAV.psInput=this.value" onkeydown="if(event.key==='Enter'){submitPs();}"/>
      <button class="btn btn-primary btn-block" style="margin-top:10px; padding:14px;" onclick="submitPs()">확인</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="submitPs(true)">모르겠어요 (답 보기)</button>
    ` : `
      <button class="btn btn-primary btn-block" style="padding:14px;" onclick="nextPs()">다음 →</button>
    `}
  </div>`;
}
function submitPs(giveUp){
  const s = NAV.psSession;
  if(!s || s.answered) return;
  const item = s.items[s.idx];
  const typed = NAV.psInput || '';
  if(!giveUp && !typed.trim()) return;
  const correct = giveUp ? false : checkPsAnswer(typed, item);
  s.answered = true;
  s.lastCorrect = correct;
  s.typed = typed;
  s.results[s.idx] = correct;
  gradePs(item, correct);
  if(correct) playCorrectSound(); else playWrongSound();
  render();
}
// 사용자가 스스로 정답 처리 (표기 차이 등)
function overridePsCorrect(){
  const s = NAV.psSession;
  if(!s || !s.answered || s.lastCorrect) return;
  const item = s.items[s.idx];
  const r = psRec(item.id);
  r.wrong = Math.max(0, r.wrong - 1);
  r.streak = 1;
  r.due = daysNow() + SRS_STEPS[1];
  const today = todayStr();
  const h = ensurePsState().hist[today];
  if(h) h.correct++;
  s.lastCorrect = true;
  s.results[s.idx] = true;
  saveStore();
  render();
}
function nextPs(){
  const s = NAV.psSession;
  s.idx++; s.answered=false; s.lastCorrect=null; s.typed='';
  NAV.psInput = '';
  render();
}

/* ===================================================================
   모의고사 화면
   =================================================================== */

const MOCK_MARK = ['①','②','③','④','⑤'];
const MOCK_BOXY = { box:1, venn:1, algo:1 };
const MOCK_TRIO_LB = ['갑','을','병'];

function mockEraWord(era){
  if(era === '사회') return '사회사상가';
  return (era ? era + ' ' : '') + '사상가';
}

function mockStemText(q){
  if(q.type === 'trio'){
    const era = mockEraPair(q.who[0], q.who[1], q.pairTopic, q.unit);
    return mockEraWord(era) + ' 갑, 을, 병의 입장으로 옳은 것은?';
  }
  if(q.type === 'algo'){
    const era = mockEraPair(q.a, q.b, q.pairTopic, q.unit);
    return '(가)의 ' + (era && era !== '사회' ? era + ' ' : '') + '사상가 갑, 을의 입장을 (나) 그림으로 탐구하고자 할 때, ' +
           'A~C에 들어갈 적절한 질문만을 <보기>에서 있는 대로 고른 것은?';
  }
  if(q.type === 'venn'){
    const era = mockEraPair(q.a, q.b, q.pairTopic, q.unit);
    return '(가)의 ' + (era && era !== '사회' ? era + ' ' : '') + '사상가 갑, 을의 입장을 (나) 그림으로 표현할 때, ' +
           'A~C에 해당하는 적절한 진술만을 <보기>에서 있는 대로 고른 것은?';
  }
  if(q.type === 'box'){
    const era = mockEraPair(q.a, q.b, q.pairTopic, q.unit);
    if(q.ism) return '사회사상 (가), (나)의 입장으로 옳은 것만을 <보기>에서 고른 것은?';
    return mockEraWord(era) + ' 갑, 을의 입장으로 옳은 것만을 <보기>에서 고른 것은?';
  }
  if(q.type === 'pair'){
    const era = mockEraPair(q.a, q.b, q.pairTopic, q.unit);
    if(q.ism) return '사회사상 (가), (나)의 입장으로 가장 적절한 것은?';
    return mockEraWord(era) + ' 갑, 을의 입장으로 옳은 것은?';
  }
  const era = mockEra(q.name);
  const tail = (q.type === 'right') ? '옳은 것은?' : '옳지 않은 것은?';
  if(mockIsIsm(q.name)) return '다음 사회사상의 입장으로 ' + (q.type==='right' ? '가장 적절한 것은?' : '적절하지 않은 것은?');
  if(era === '사회') return '다음을 주장한 사회사상가의 입장으로 ' + tail;
  return '다음을 주장한 ' + era + ' 사상가의 입장으로 ' + tail;
}
// 제시문 박스 — 갑·을이면 두 편을 라벨과 함께 보여 준다
function mockPsBox(q){
  if(q.type === 'trio'){
    return `<div class="mock-ps mock-ps-pair">
      ${q.psList.map((p,i)=>`<div class="mock-ps-row"><span class="lb">${MOCK_TRIO_LB[i]}</span><span>${escHtml(p.text)}</span></div>`).join('')}
    </div>`;
  }
  if(q.type === 'venn' || q.type === 'box' || q.type === 'pair' || q.type === 'algo'){
    return `<div class="mock-ps mock-ps-pair">
      <div class="mock-ps-row"><span class="lb">${q.L1||'갑'}</span><span>${escHtml(q.psA.text)}</span></div>
      <div class="mock-ps-row"><span class="lb">${q.L2||'을'}</span><span>${escHtml(q.psB.text)}</span></div>
    </div>`;
  }
  return `<div class="mock-ps">${escHtml(q.ps.text)}</div>`;
}
function mockFigFor(q){
  if(q.type === 'venn') return mockVennFig();
  if(q.type === 'algo') return mockAlgoFig();
  return '';
}
let MOCK_FIG_SEQ = 0;

// (나) 벤다이어그램 — 두 원이 겹친 B만 색칠한다
function mockVennFig(){
  const id = 'vf' + (++MOCK_FIG_SEQ);
  return `<div class="mock-fig"><svg viewBox="0 0 480 175" width="100%" style="max-width:430px" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="갑과 을의 원이 겹친 그림. A는 갑만, B는 겹친 부분, C는 을만의 입장">
    <defs>
      <clipPath id="c${id}"><ellipse cx="132" cy="98" rx="72" ry="52"/></clipPath>
    </defs>
    <text x="126" y="22" text-anchor="middle" font-size="11.5" fill="currentColor">갑</text>
    <line x1="130" y1="26" x2="142" y2="42" stroke="currentColor" stroke-width=".8"/>
    <text x="244" y="22" text-anchor="middle" font-size="11.5" fill="currentColor">을</text>
    <line x1="240" y1="26" x2="228" y2="42" stroke="currentColor" stroke-width=".8"/>
    <ellipse class="vn-lens" cx="240" cy="98" rx="72" ry="52" clip-path="url(#c${id})"/>
    <ellipse cx="132" cy="98" rx="72" ry="52" fill="none" stroke="currentColor"/>
    <ellipse cx="240" cy="98" rx="72" ry="52" fill="none" stroke="currentColor"/>
    <text class="vn-lb" x="100" y="105" text-anchor="middle" font-size="15">A</text>
    <text class="vn-lb" x="186" y="105" text-anchor="middle" font-size="15">B</text>
    <text class="vn-lb" x="272" y="105" text-anchor="middle" font-size="15">C</text>
    <rect x="330" y="50" width="142" height="82" fill="none" stroke="currentColor"/>
    <text x="401" y="47" text-anchor="middle" font-size="10.5" fill="currentColor">〈범례〉</text>
    <text x="344" y="74" font-size="10.5" fill="currentColor">A : 갑만의 입장</text>
    <text x="344" y="96" font-size="10.5" fill="currentColor">B : 갑과 을의 공통 입장</text>
    <text x="344" y="118" font-size="10.5" fill="currentColor">C : 을만의 입장</text>
  </svg></div>`;
}

// (나) 순서도 — 시험지와 같은 SVG
function mockAlgoFig(){
  return `<div class="mock-fig"><svg viewBox="0 0 520 200" width="100%" style="max-width:460px" xmlns="http://www.w3.org/2000/svg">
    <rect x="150" y="4" width="220" height="26" rx="3" fill="none" stroke="currentColor"/>
    <text x="260" y="21" text-anchor="middle" font-size="11.5" fill="currentColor">사상가 갑, 을의 입장을 탐구한다.</text>
    <line x1="260" y1="30" x2="260" y2="44" stroke="currentColor"/>
    <polygon points="260,44 318,66 260,88 202,66" fill="none" stroke="currentColor"/>
    <text x="260" y="71" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">A</text>
    <text x="330" y="61" font-size="9.5" fill="currentColor">아니요</text>
    <line x1="318" y1="66" x2="420" y2="66" stroke="currentColor" stroke-dasharray="4 3"/>
    <line x1="420" y1="66" x2="420" y2="92" stroke="currentColor" stroke-dasharray="4 3"/>
    <text x="252" y="101" text-anchor="end" font-size="9.5" fill="currentColor">예</text>
    <line x1="260" y1="88" x2="260" y2="102" stroke="currentColor"/>
    <polygon points="260,102 318,124 260,146 202,124" fill="none" stroke="currentColor"/>
    <text x="260" y="129" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">B</text>
    <polygon points="420,92 472,114 420,136 368,114" fill="none" stroke="currentColor"/>
    <text x="420" y="119" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">C</text>
    <text x="252" y="159" text-anchor="end" font-size="9.5" fill="currentColor">예</text>
    <line x1="260" y1="146" x2="260" y2="162" stroke="currentColor"/>
    <rect x="206" y="162" width="108" height="24" rx="12" fill="none" stroke="currentColor"/>
    <text x="260" y="178" text-anchor="middle" font-size="11.5" fill="currentColor">갑의 입장</text>
    <text x="412" y="152" text-anchor="end" font-size="9.5" fill="currentColor">예</text>
    <line x1="420" y1="136" x2="420" y2="162" stroke="currentColor"/>
    <rect x="366" y="162" width="108" height="24" rx="12" fill="none" stroke="currentColor"/>
    <text x="420" y="178" text-anchor="middle" font-size="11.5" fill="currentColor">을의 입장</text>
  </svg></div>`;
}
// <보기> 상자 (보기형 · 벤다이어그램 · 순서도 공용)
function mockBoxList(q){
  return `<div class="mock-boxes">
    <div class="mock-boxes-t">&lt; 보 기 &gt;</div>
    ${q.items.map(it=>`<div class="mock-box-row">
      <span class="mk">${it.mark}.</span>
      <span class="tx"><b class="mock-lb">${it.zone ? it.zone : it.label} :</b> ${escHtml(it.body)}</span>
    </div>`).join('')}
  </div>`;
}
function mockOptLabel(q, oi){
  return q.opts[oi].map(i=>q.items[i].mark).join(', ');
}
function mockChoiceHtml(c){
  return (c.label ? `<b class="mock-lb">${c.label} :</b> ` : '') + escHtml(c.body);
}
function mockQName(q){
  if(q.type === 'trio') return q.who.join(' · ');
  if(q.type === 'pair' || q.type === 'box' || q.type === 'venn' || q.type === 'algo') return q.a + ' · ' + q.b;
  return q.name;
}
const MOCK_TYPE_LABEL = { right:'옳은 것', wrong:'옳지 않은 것', pair:'갑·을 대조',
                          box:'보기 고르기', venn:'벤다이어그램', algo:'순서도', trio:'갑·을·병 대조' };
// 자체 제작 선지가 근거로 삼은 원전 한 줄. 기출이 아니라 어디서 왔는지 보이게 한다
function mockSrcNote(it){
  if(!it || !it.quote) return '';
  const ps = (typeof PASSAGES !== 'undefined' && PASSAGES)
    ? PASSAGES.filter(p=>p.id === it.psid)[0] : null;
  const who = ps ? ps.name : '';
  return `<div class="mock-rv-src">원전 — ${escHtml(who)} 「${escHtml(it.quote)}」</div>`;
}

// 채점 화면에서 선지 문장 자체가 맞는 말인지
function mockChoiceTruth(q, ci){
  if(q.type === 'wrong') return ci !== q.ans;
  return ci === q.ans;
}
function mockStarBtn(id){
  if(!id) return '';
  const on = isOxStarred(id);
  return `<button class="mock-star ${on?'on':''}" onclick="event.stopPropagation(); toggleOxStar('${id}')"
    aria-label="${on?'별표 해제':'별표'}" aria-pressed="${on}">${on?'★':'☆'}</button>`;
}
function mockJump(i){
  const el = document.getElementById('mockrv-' + i);
  if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
}

/* ---------- 시작 화면 ---------- */
function renderMockSetup(){
  const pool = mockPool();
  if(pool.usable.length < MOCK_N){
    return `<div class="screen"><div class="empty"><div class="ic">無</div>
      아직 문제를 만들 만큼 선지가 모이지 않았어요<br>
      <span class="note">출제 가능한 사상가 ${pool.usable.length}명 · ${MOCK_N}명 필요</span></div></div>`;
  }
  const run = ensureMockRun();
  const done = mockAnsweredCount();
  const hist = mockHistoryList();
  const avg = hist.length
    ? Math.round(hist.reduce((s,h)=>s + h.score/h.total, 0) / hist.length * 100)
    : 0;
  const timed = hist.filter(h=>h.sec);
  const avgSec = timed.length ? timed.reduce((s,h)=>s + h.sec, 0) / timed.length * 1000 : 0;

  let card;
  if(run.submitted){
    card = `
      <div class="mock-hero-label">오늘 ${run.setNo ? (run.setNo+1) + '번째 세트 ' : ''}채점 완료</div>
      <div class="mock-hero-score"><b>${run.score}</b><span> / ${MOCK_N}</span></div>
      ${run.ms ? `<div class="note" style="margin-top:6px;">${mockFmtDur(run.ms)} 걸림</div>` : ''}
      <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="go('mockResult')">채점 결과 · 해설 보기</button>
      <button class="btn btn-block" style="margin-top:9px;" onclick="newMockSet()">새 세트로 한 판 더</button>`;
  } else if(done > 0 || run.ms > 0 || mockOmrCount(run) > 0){
    card = `
      <div class="mock-hero-label">풀던 시험지가 있어요</div>
      <div class="mock-hero-score"><b>${mockOmrCount(run)}</b><span> / ${MOCK_N} OMR 마킹</span></div>
      <div class="note" style="margin-top:6px;">시험지 표시 ${done}문항 · 남은 시간 ${mockFmtClock(mockLeftMs(run.ms))} · 시험지를 열면 시간이 다시 가요</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="go('mockExam')">이어서 풀기</button>`;
  } else {
    card = `
      <div class="mock-hero-label">${todayStr().replace(/-/g,'.')} 실력 점검</div>
      <div class="mock-hero-score"><b>${MOCK_N}</b><span> 문항 · 30분</span></div>
      <div class="note" style="margin-top:8px;">전 범위 · 사상가는 겹치지 않게 뽑아요</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="startMock()">시험 시작</button>`;
  }

  return `<div class="screen">
    <div class="hard-box mock-hero">${card}</div>

    <div class="hard-box mock-rule">
      <div class="mock-rule-t">출제 방식</div>
      <div class="note">
        제시문 한 편을 주고 그 사상가의 입장을 묻습니다.
        오답 선지는 <b>같은 사상가가 실제로 틀렸다고 나온 기출 선지</b>에서만 뽑기 때문에
        답이 둘이 되는 일이 없어요. 출제 가능한 사상가는 지금 ${pool.usable.length}명입니다.
      </div>
      <div class="note" style="margin-top:7px;">
        같은 날에는 몇 번을 들어와도 같은 20문항이 나옵니다. 채점은 다 풀고 한 번에 합니다.
      </div>
      <div class="note" style="margin-top:7px;">
        <b>제한 시간 30분.</b> 시험지를 누르면 연필 표시가 되고, <b>채점은 OMR 답안지로</b> 합니다.
        오른쪽 <b>OMR</b> 탭을 눌러 답안지를 꺼내 옮겨 적고, 다시 누르면 들어가요.
        시간이 끝나면 그때까지 마킹한 OMR로 바로 채점돼요.
      </div>
      <div class="note" style="margin-top:7px;">
        시험지를 펴 둔 동안만 시간이 가고, 시험지에 표시할 때마다 문항별 시간이 기록돼요.
        자신 없이 고른 문항은 <b>찍음</b>을 눌러 두세요. 채점할 때 틀린 선지와 찍은 문항의 선지가
        기출OX 별표에 자동으로 들어갑니다.
      </div>
    </div>

    ${hist.length ? `
      <div class="section-title">지난 기록 <span class="note" style="font-weight:400;">정답률 평균 ${avg}%${avgSec ? ' · 시간 평균 ' + mockFmtDur(avgSec) : ''}</span></div>
      ${hist.slice(0,12).map(h=>{
        const pct = Math.round(h.score/h.total*100);
        return `<div class="hard-box mock-hist">
          <span class="mock-hist-d">${h.date.slice(5).replace('-','.')}${h.setNo ? `<i>${h.setNo+1}회</i>` : ''}</span>
          <div class="progress-bar" style="flex:1; margin:0;"><div style="width:${pct}%"></div></div>
          <span class="mock-hist-t">${h.sec ? mockFmtClock(h.sec*1000) : ''}</span>
          <span class="mock-hist-s"><b>${h.score}</b>/${h.total}</span>
        </div>`;
      }).join('')}
    ` : ''}
  </div>`;
}

/* ---------- 시험지 ---------- */
// OMR 답안지 — 오른쪽에서 꺼냈다 넣었다 한다
function renderOmrPanel(set, run){
  const open = !!NAV.omrOpen;
  const n = mockOmrCount(run);
  return `
  <button id="omrTab" class="omr-tab" onclick="toggleOmr()" aria-controls="omrPanel" aria-expanded="${open}">
    <span>OMR</span><b data-omr-count>${n}</b>
  </button>
  <aside id="omrPanel" class="omr-panel ${open?'open':''}" aria-label="OMR 답안지" aria-hidden="${!open}">
    <div class="omr-head">
      <div>
        <div class="omr-title">답안지</div>
        <div class="omr-sub">윤리와 사상 · <b data-omr-count>${n}</b>/${set.length}</div>
      </div>
      <span id="omrClock" class="omr-clock">${mockFmtClock(mockLeftMs(mockLiveMs(run)))}</span>
      <button class="omr-close" onclick="toggleOmr(false)" aria-label="답안지 넣기">넣기</button>
    </div>
    <div class="omr-grid" role="group" aria-label="문항별 마킹">
      <div class="omr-row omr-colhead" aria-hidden="true">
        <span class="omr-no">번호</span>
        ${MOCK_MARK.map((m,k)=>`<span class="omr-cell">${k+1}</span>`).join('')}
      </div>
      ${set.map((q,i)=>{
        const p = run.picks[i];
        return `<div class="omr-row ${i%5===4?'sep':''}" id="omr-${i}">
          <button class="omr-no" onclick="jumpMockQ(${i})" aria-label="${i+1}번 문항으로">${i+1}</button>
          ${MOCK_MARK.map((m,k)=>`<span class="omr-cell"><button class="omr-b ${run.omr[i]===k?'on':''}"
              onclick="markOmr(${i},${k})" aria-pressed="${run.omr[i]===k}" aria-label="${i+1}번 ${k+1}">${k+1}</button></span>`).join('')}
          <span class="omr-pen" title="시험지에 표시한 답">${(p !== undefined && p !== null) ? MOCK_MARK[p] : ''}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="omr-foot">회색 번호는 시험지에 표시한 답이에요. 채점은 까맣게 칠한 칸으로 합니다.</div>
  </aside>`;
}

function renderMockExam(){
  const set = buildMockSet();
  const run = ensureMockRun();
  if(run.submitted) return renderMockResult();
  const done = mockAnsweredCount();
  const live = mockLiveMs(run);
  const left = mockLeftMs(live);

  return `<div class="screen">
    <div class="mock-bar">
      <span class="mock-clock-wrap">남은 시간 <span id="mockClock" class="mock-clock ${left <= MOCK_WARN_MS[0] ? 'low' : ''}">${mockFmtClock(left)}</span></span>
      <span class="mock-bar-n">시험지 ${done}</span>
      <button class="mock-omr-btn" onclick="toggleOmr()">OMR 답안지 <b data-omr-count>${mockOmrCount(run)}</b>/${set.length}</button>
    </div>

    ${set.map((q,i)=>{
      const picked = run.picks[i];
      const boxType = !!MOCK_BOXY[q.type];
      const guessed = !!run.guess[i];
      return `<div class="hard-box mock-q ${guessed?'guessed':''}" id="mockq-${i}">
        <div class="mock-stem"><span class="mock-no">${i+1}</span>${escHtml(mockStemText(q))}</div>
        ${mockPsBox(q)}
        ${mockFigFor(q)}
        ${boxType ? mockBoxList(q) : ''}
        <div class="mock-choices ${boxType?'compact':''}">
          ${boxType
            ? q.opts.map((p,ci)=>`
              <div class="mock-choice ${picked===ci?'on':''}" onclick="pickMock(${i},${ci})">
                <span class="mk">${MOCK_MARK[ci]}</span><span class="tx">${mockOptLabel(q,ci)}</span>
              </div>`).join('')
            : q.choices.map((c,ci)=>`
              <div class="mock-choice ${picked===ci?'on':''}" onclick="pickMock(${i},${ci})">
                <span class="mk">${MOCK_MARK[ci]}</span><span class="tx">${mockChoiceHtml(c)}</span>
              </div>`).join('')}
        </div>
        <div class="mock-q-foot">
          <button class="mock-guess ${guessed?'on':''}" onclick="toggleMockGuess(${i})" aria-pressed="${guessed}">
            ${guessed ? '찍음 표시됨' : '찍음'}
          </button>
        </div>
      </div>`;
    }).join('')}

    <button class="btn ${NAV.mockSubmitArm ? 'btn-warn' : 'btn-primary'} btn-block" style="padding:15px; margin-top:6px;" onclick="submitMock()">
      ${NAV.mockSubmitArm ? '비어 있는 채로 제출하기' : 'OMR 제출하고 채점하기'}
    </button>
    <div class="note ${NAV.mockSubmitArm ? 'mock-arm' : ''}" id="mockSubmitNote" style="text-align:center; margin-top:8px;">${mockSubmitNote(run)}</div>
  </div>`;
}

/* ---------- 채점 결과 ---------- */
function renderMockTimeGrid(set, run){
  const per = set.map((q,i)=> run.per[i] || 0);
  const max = Math.max.apply(null, per.concat([1]));
  return `<div class="mock-tgrid">
    ${set.map((q,i)=>{
      const picked = mockAns(run, i);
      const st = (picked === null) ? 'none' : (picked === q.ans ? 'ok' : 'no');
      const hasCard = st !== 'ok' || run.guess[i];
      return `<button class="mock-tc ${st}" ${hasCard ? `onclick="mockJump(${i})"` : 'disabled'}
          aria-label="${i+1}번 ${mockFmtDur(per[i])} ${st==='ok'?'맞음':(st==='no'?'틀림':'안 고름')}${run.guess[i]?' 찍음':''}">
        <span class="n">${i+1}${run.guess[i] ? '<i>찍</i>' : ''}</span>
        <span class="t">${per[i] ? mockFmtClock(per[i]).replace(/^0(?=\d:)/,'') : '—'}</span>
        <span class="bar"><i style="width:${Math.round(per[i]/max*100)}%"></i></span>
      </button>`;
    }).join('')}
  </div>`;
}

function renderMockResult(){
  const set = buildMockSet();
  const run = ensureMockRun();
  if(!run.submitted){
    return `<div class="screen"><div class="empty">아직 채점하지 않은 시험지예요<br>
      <button class="btn btn-primary" style="margin-top:12px;" onclick="go('mockExam')">시험지로 가기</button></div></div>`;
  }
  const pct = Math.round(run.score/set.length*100);
  const slips = mockMismatch(run);
  // 시험지 표시대로 옮겼다면 맞았을 문항
  const lost = slips.filter(i=> run.picks[i] === set[i].ans);
  const showIdx = [];
  set.forEach((q,i)=>{ if(mockAns(run, i) !== q.ans || run.guess[i]) showIdx.push(i); });
  const nWrong = set.filter((q,i)=> mockAns(run, i) !== q.ans).length;
  const nGuess = set.filter((q,i)=> run.guess[i]).length;
  const answered = set.filter((q,i)=> run.picks[i] !== undefined && run.picks[i] !== null).length;
  let longest = -1, longMs = 0;
  set.forEach((q,i)=>{ if((run.per[i] || 0) > longMs){ longMs = run.per[i]; longest = i; } });
  const avgMs = answered ? (run.ms - (run.review||0)) / answered : 0;

  return `<div class="screen">
    <div class="hard-box quiz-done">
      <div class="ss">${run.date.replace(/-/g,'.')} 채점 결과</div>
      <div class="big">${run.score} / ${set.length}</div>
      <div class="ss" style="margin-top:6px;">정답률 ${pct}%${run.timeUp ? ' · 시간 종료로 제출' : ''}</div>
      ${run.ms ? `<div class="mock-time-sum">
        <div><b>${mockFmtDur(run.ms)}</b><span>총 시간</span></div>
        <div><b>${mockFmtDur(avgMs)}</b><span>문항당 평균</span></div>
        <div><b>${mockFmtDur(run.review||0)}</b><span>마지막 검토</span></div>
      </div>` : ''}
      <button class="btn btn-block" style="margin-top:16px;" onclick="newMockSet()">새 세트로 한 판 더</button>
      <button class="btn btn-ghost btn-block" style="margin-top:9px;" onclick="go('mock')">기록 보기</button>
    </div>

    ${slips.length ? `
      <div class="hard-box mock-slipbox">
        <b>마킹 실수 ${slips.length}문항</b>
        <div class="note">시험지에 표시한 답과 OMR이 달라요 — ${slips.map(i=>`<a href="javascript:void 0" onclick="mockJump(${i})">${i+1}번</a>`).join(', ')}
        ${lost.length ? `<br>제대로 옮겼다면 <b>${lost.length}점</b>을 더 받았어요.` : ''}</div>
      </div>` : ''}

    ${run.ms ? `
      <div class="section-title">문항별 시간
        ${longest >= 0 ? `<span class="note" style="font-weight:400;">가장 오래 본 문항 ${longest+1}번 · ${mockFmtDur(run.per[longest])}</span>` : ''}</div>
      ${renderMockTimeGrid(set, run)}
      <div class="note" style="margin:6px 2px 0;">시험지에 표시한 순간 기준으로 나눈 시간이에요. 건너뛴 문항의 시간은 다음에 표시한 문항에 들어가요. 칸 색은 OMR 채점 결과입니다.</div>
    ` : ''}

    ${(run.starred && run.starred.length) ? `
      <div class="hard-box mock-starbox">
        <div><b>★ ${run.starred.length}개</b>를 기출OX 별표에 넣었어요</div>
        <div class="note">틀린 문항 ${nWrong}개의 헷갈린 선지와 찍은 문항 ${nGuess}개의 선지예요. 아래에서 ☆를 누르면 뺄 수 있어요.</div>
        <button class="btn btn-sm btn-primary" style="margin-top:9px;" onclick="studyStarred()">별표 선지 풀기</button>
      </div>` : ''}

    ${showIdx.length ? `<div class="section-title">다시 볼 문항 ${showIdx.length}개 <span class="note" style="font-weight:400;">틀림 ${nWrong} · 찍음 ${nGuess}</span></div>` : `
      <div class="hard-box" style="text-align:center; padding:18px;"><b style="font-size:16px;">전부 맞혔어요</b></div>`}

    ${showIdx.map(i=> renderMockReview(set[i], i, run)).join('')}
  </div>`;
}

function renderMockReview(q, i, run){
  const picked = mockAns(run, i);
  const blank = (picked === null);
  const pen = run.picks[i];
  const slip = run.omr && pen !== undefined && pen !== null && pen !== picked;
  const ok = picked === q.ans;
  const guessed = !!run.guess[i];
  const boxType = !!MOCK_BOXY[q.type];
  const tags = `
    ${ok ? `<span class="mock-tag ok">찍어서 맞힘</span>` : (blank ? `<span class="mock-tag">안 고름</span>` : `<span class="mock-tag no">틀림</span>`)}
    ${guessed && !ok ? `<span class="mock-tag">찍음</span>` : ''}
    ${slip ? `<span class="mock-tag no">마킹 실수</span>` : ''}
    ${run.per[i] ? `<span class="mock-rv-time">${mockFmtDur(run.per[i])}</span>` : ''}`;

  let body;
  if(boxType){
    body = `
      <div class="mock-boxes">
        <div class="mock-boxes-t">&lt; 보 기 &gt;</div>
        ${q.items.map(it=>`<div class="mock-box-row ${it.ok?'t':'f'}">
          <span class="mk">${it.mark}.</span>
          <span class="tx"><b class="mock-lb">${it.zone?it.zone:it.label} :</b> ${escHtml(it.body)}
            <span class="ox">${it.ok?'O':'X'}</span>${mockStarBtn(it.id)}
            ${it.note?`<div class="mock-rv-note">${escHtml(it.note)}</div>`:''}
            ${mockSrcNote(it)}
            ${!it.ok && it.fix?`<div class="mock-rv-note">이렇게 고치면 맞는 선지 — ${escHtml(it.fix)}</div>`:''}
          </span>
        </div>`).join('')}
      </div>
      <div class="mock-rv-line ok"><span class="mk">${MOCK_MARK[q.ans]}</span>
        <div><div class="lb">정답</div><div>${mockOptLabel(q,q.ans)}</div></div></div>
      ${(!blank && !ok) ? `<div class="mock-rv-line no"><span class="mk">${MOCK_MARK[picked]}</span>
        <div><div class="lb">OMR에 마킹한 것</div><div>${mockOptLabel(q,picked)}</div></div></div>` : ''}
      ${slip ? `<div class="mock-rv-line"><span class="mk">${MOCK_MARK[pen]}</span>
        <div><div class="lb">시험지에 표시한 것</div><div>${mockOptLabel(q,pen)}</div></div></div>` : ''}`;
  } else {
    body = `<div class="mock-rv-list">
      ${q.choices.map((c,ci)=>{
        const isAns = ci === q.ans, isMine = ci === picked;
        const truth = mockChoiceTruth(q, ci);
        const open = isAns || isMine;
        let notes = '';
        if(open){
          const statementTrue = (q.type === 'wrong') ? !isAns : isAns;
          if(c.note) notes += `<div class="mock-rv-note">${statementTrue?'함께 알아둘 것':'왜 틀렸나'} — ${escHtml(c.note)}</div>`;
          if(!statementTrue && c.fix) notes += `<div class="mock-rv-note">이렇게 고치면 맞는 선지 — ${escHtml(c.fix)}</div>`;
          notes += mockSrcNote(c);
        }
        return `<div class="mock-rv-row ${isAns?'ans':''} ${isMine && !isAns?'mine':''}">
          <span class="mk">${MOCK_MARK[ci]}</span>
          <div class="tx">
            ${(isAns || isMine || (slip && ci === pen)) ? `<div class="lb">${[isAns?'정답':'', isMine?'OMR 마킹':'', (slip && ci === pen)?'시험지 표시':''].filter(Boolean).join(' · ')}</div>` : ''}
            <div>${mockChoiceHtml(c)} <span class="ox ${truth?'t':'f'}">${truth?'O':'X'}</span>${mockStarBtn(c.id)}</div>
            ${notes}
            ${open && c.src ? `<div class="note" style="margin-top:3px;">${escHtml(c.src)}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
    ${blank ? `<div class="note" style="margin-top:9px;">OMR에 마킹하지 않은 문항이에요</div>` : ''}`;
  }

  return `<div class="hard-box mock-rv" id="mockrv-${i}">
    <div class="mock-rv-head">
      <span class="mock-no ${ok?'':'no'}">${i+1}</span>
      <b class="mock-rv-name">${mockQName(q)}</b>
      <span class="note">${MOCK_TYPE_LABEL[q.type]||''}</span>
      <span class="mock-rv-tags">${tags}</span>
    </div>
    ${mockPsBox(q)}
    ${mockFigFor(q)}
    ${body}
  </div>`;
}

/* ---------- 기출 OX (STEP3) ---------- */
function renderOxSetup(){
  const c = oxCounts();
  const f = NAV.oxFilter;
  const topics = oxTopicsAvailable();
  if(c.total === 0){
    return `<div class="screen"><div class="empty"><div class="ic">無</div>아직 등록된 기출 선지가 없어요</div></div>`;
  }
  const poolNow = oxPool(f).length;
  return `<div class="screen">
    <div class="hard-box" style="padding:16px;">
      <div class="section-title" style="margin-top:0;">오늘 풀 범위</div>
      <div class="ox-stat-row">
        <div class="ox-stat"><b>${c.total}</b><span>전체</span></div>
        <div class="ox-stat"><b>${c.due}</b><span>복습 예정</span></div>
        <div class="ox-stat"><b>${c.star}</b><span>별표</span></div>
        <div class="ox-stat"><b>${c.wrong}</b><span>틀린 적</span></div>
      </div>

      <div class="section-title">사상가 <span class="note" style="font-weight:400;">${(f.topics&&f.topics.length)?f.topics.length+'명 선택':'전체'} · 여러 명 고를 수 있어요</span></div>
      <div class="chip-row">
        <button class="btn btn-sm ${!(f.topics&&f.topics.length)?'btn-primary':''}" onclick="clearOxTopics()">전체</button>
        ${topics.map(t=>`<button class="btn btn-sm ${(f.topics||[]).indexOf(t.id)>=0?'btn-primary':''}" onclick="toggleOxTopic('${t.id}')">${t.title}</button>`).join('')}
      </div>

      <div class="section-title">회차로 풀기</div>
      <div class="chip-row">
        <button class="btn btn-sm ${!f.exam?'btn-primary':''}" onclick="setOxFilter('exam',null)">안 씀</button>
        ${oxExamRounds().map(r=>{
          const p = oxExamProgress(r.src);
          return `<button class="btn btn-sm ${f.exam===r.src?'btn-primary':''}" onclick="setOxFilter('exam','${r.src}')">${r.year} ${r.kind} <span class="note">${p.done}/${p.total}</span></button>`;
        }).join('')}
      </div>
      ${f.exam ? `<div class="note" style="margin-top:6px;">시험지 순서대로 나와요. 이어서 풀면 다음 번호부터 계속됩니다.</div>` : ''}

      <div class="section-title">출처</div>
      <div class="chip-row">
        <button class="btn btn-sm ${!f.source?'btn-primary':''}" onclick="setOxFilter('source',null)">전체</button>
        <button class="btn btn-sm ${f.source==='수능평가원'?'btn-primary':''}" onclick="setOxFilter('source','수능평가원')">수능·평가원</button>
        <button class="btn btn-sm ${f.source==='EBS'?'btn-primary':''}" onclick="setOxFilter('source','EBS')">EBS(수완·수특)</button>
      </div>

      <div class="section-title">조건</div>
      <label class="ox-check"><input type="checkbox" ${f.dueOnly?'checked':''} onchange="setOxFilter('dueOnly',this.checked)"/> 복습할 때가 된 것만 (간격 반복)</label>
      <label class="ox-check"><input type="checkbox" ${f.starred?'checked':''} onchange="setOxFilter('starred',this.checked)"/> ★ 별표한 것만</label>
      <label class="ox-check"><input type="checkbox" ${f.wrongOnly?'checked':''} onchange="setOxFilter('wrongOnly',this.checked)"/> 틀린 적 있는 것만</label>
      <label class="ox-check"><input type="checkbox" ${f.unseenOnly?'checked':''} onchange="setOxFilter('unseenOnly',this.checked)"/> 안 본 것만 <span class="note">(${oxPool(Object.assign({}, f, {unseenOnly:true, wrongOnly:false, dueOnly:false})).length}개)</span></label>
      <label class="ox-check"><input type="checkbox" ${!STATE.soundOff?'checked':''} onchange="toggleSound()"/> 효과음 켜기</label>

      <div class="note" style="margin-top:12px;">지금 조건에 맞는 문항: <b style="color:var(--ink);">${poolNow}개</b></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px; padding:14px;" ${poolNow===0?'disabled':''} onclick="startOxSession()">OX 풀기 시작 →</button>
      ${poolNow===0 ? `<div class="note" style="margin-top:8px;">조건에 맞는 문항이 없어요. 조건을 완화해보세요.</div>` : ''}
    </div>
  </div>`;
}
function toggleOxTopic(id){
  const f = NAV.oxFilter;
  if(!f.topics) f.topics = [];
  const i = f.topics.indexOf(id);
  if(i >= 0) f.topics.splice(i,1); else f.topics.push(id);
  f.topic = null;
  render();
}
function clearOxTopics(){ NAV.oxFilter.topics = []; NAV.oxFilter.topic = null; render(); }
function setOxFilter(key, val){
  NAV.oxFilter[key] = val;
  // 회차를 고르면 간격 반복 조건은 자동으로 풀어 준다. 시험지 한 벌을 통으로 보기 위해서다.
  if(key === 'exam' && val) NAV.oxFilter.dueOnly = false;
  // 「안 본 것」과 「틀린 적 있는 것」은 겹칠 수 없어 하나를 켜면 다른 하나를 끈다
  if(val && key === 'unseenOnly') NAV.oxFilter.wrongOnly = false;
  if(val && key === 'wrongOnly') NAV.oxFilter.unseenOnly = false;
  render();
}
function startOxSession(){
  const pool = oxPool(NAV.oxFilter);
  const list = NAV.oxFilter.exam ? oxSortForExam(pool) : oxSortForStudy(pool);
  const N = Math.min(20, list.length);
  NAV.oxSession = { items: list.slice(0, N), idx:0, answered:false, lastCorrect:null, results:[] };
  go('oxQuiz');
}
function renderOxQuiz(){
  const s = NAV.oxSession;
  if(!s) return `<div class="screen"><div class="empty">먼저 범위를 정해주세요<br><button class="btn btn-primary" style="margin-top:12px;" onclick="go('oxSetup')">범위 설정</button></div></div>`;
  if(s.idx >= s.items.length){
    const correct = s.results.filter(Boolean).length;
    const wrongItems = s.items.filter((it,i)=>s.results[i]===false);
    return `<div class="screen">
      <div class="hard-box quiz-done">
        <div class="ss">이번 세트 완료</div>
        <div class="big">${correct} / ${s.items.length}</div>
        <div class="ss" style="margin-top:6px;">틀린 문항은 내일 다시 나와요</div>
        <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="startOxSession()">이어서 더 풀기</button>
        <button class="btn btn-block" style="margin-top:10px;" onclick="go('oxSetup')">범위 다시 정하기</button>
      </div>
      ${wrongItems.length ? `
      <div class="section-title">이번에 틀린 선지 (${wrongItems.length})</div>
      ${wrongItems.map(it=>`
        <div class="hard-box ox-review-item">
          <div class="ox-review-ans ${it.answer==='O'?'is-o':'is-x'}">${it.answer}</div>
          <div class="ox-review-text">${it.text}<div class="note" style="margin-top:3px;">${it.source||''}</div></div>
          <span class="ox-star ${isOxStarred(it.id)?'on':''}" onclick="toggleOxStar('${it.id}')">★</span>
        </div>`).join('')}
      ` : ''}
    </div>`;
  }
  const item = s.items[s.idx];
  const r = oxRec(item.id);
  return `<div class="screen">
    <div class="quiz-progress">
      ${s.items.map((it,i)=>`<div class="dot ${i<s.idx ? (s.results[i]?'ok':'no') : (i===s.idx?'now':'')}"></div>`).join('')}
    </div>

    <div class="hard-box ox-card ${s.answered ? (s.lastCorrect?'is-correct':'is-wrong') : ''}">
      <div class="ox-meta">
        <span>${s.idx+1} / ${s.items.length}</span>
        <span class="note">${item.source||''}</span>
        <span class="ox-star ${isOxStarred(item.id)?'on':''}" onclick="toggleOxStar('${item.id}')">★</span>
      </div>
      <div class="ox-text">${item.text}</div>
      ${r.wrong>0 && !s.answered ? `<div class="note" style="margin-top:10px;">이전에 ${r.wrong}번 틀린 선지예요</div>` : ''}
      ${s.answered ? `
        <div class="ox-verdict ${s.lastCorrect?'ok':'no'}">
          <div class="ox-verdict-mark">${s.lastCorrect?'✓':'✕'}</div>
          <div class="ox-verdict-txt">
            <b>${s.lastCorrect?'정답':'오답'}</b>
            <span>답: <b class="ox-ans-${item.answer==='O'?'o':'x'}">${item.answer}</b></span>
          </div>
        </div>
        ${item.fix ? `
          <div class="ox-fix">
            <div class="ox-fix-label">이렇게 고치면 맞는 선지</div>
            <div class="ox-fix-text">${item.fix}</div>
          </div>
        ` : ''}
        ${item.plain ? `
          <div class="ox-plain">
            <div class="ox-plain-label">쉬운 말로</div>
            <div class="ox-plain-text">${item.plain}</div>
          </div>
        ` : ''}
        ${(item.same && item.same.length) ? `
          <div class="ox-same">
            <div class="ox-same-label">같은 말을 바꿔 쓴 선지</div>
            <ul class="ox-same-list">
              ${item.same.map(s=>`<li>${s}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${item.note ? `
          <div class="ox-note-box">
            <div class="ox-note-label">${item.fix ? '왜 틀렸나' : '함께 알아둘 것'}</div>
            <div class="ox-note-text">${item.note}</div>
          </div>
        ` : ''}
      ` : ''}
    </div>

    ${!s.answered ? `
      <div class="grade-row">
        <button class="btn ox-btn-o" style="padding:18px;" onclick="answerOx('O')">O</button>
        <button class="btn ox-btn-x" style="padding:18px;" onclick="answerOx('X')">X</button>
      </div>
    ` : `
      <button class="btn btn-primary btn-block" style="padding:14px;" onclick="nextOx()">다음 →</button>
    `}
  </div>`;
}
function answerOx(choice){
  const s = NAV.oxSession;
  if(!s || s.answered) return;
  const item = s.items[s.idx];
  const correct = (choice === item.answer);
  s.answered = true;
  s.lastCorrect = correct;
  s.results[s.idx] = correct;
  gradeOx(item, correct);
  if(correct) playCorrectSound(); else playWrongSound();
  render();
}
function nextOx(){
  const s = NAV.oxSession;
  s.idx++;
  s.answered = false;
  s.lastCorrect = null;
  render();
}

const GENEALOGY = {
  title: "경험론 · 합리론 · 반이성 · 유물론 계보",
  desc: "세상과 진리를 무엇으로 보느냐에 따른 네 흐름이에요. 감각과 경험을 신뢰하는 경험론, 이성과 사유를 신뢰하는 합리론, 이성 중심 사고 자체를 비판한 반이성 계열(실존주의), 그리고 정신보다 물질을 근본으로 보는 유물론 계열이에요. 한 사람이 여러 계열에 걸치기도 해요 — 에피쿠로스는 경험론이면서 유물론이고, 홉스는 유물론이면서 사회계약론자예요. 인물을 탭하면 그 사상가 정리로 이동해요.",
  cols: [
    { key:'empiricism', label:'감각·경험 계열 (경험론)', color:'blue', chain:[
      {name:'소피스트', id:'sophists', note:'감각적 유용성, 상대적 진리'},
      {name:'에피쿠로스학파', id:'epicureanism', note:'쾌락(감각)이 곧 선'},
      {name:'베이컨', id:'bacon', note:'참된 귀납법, 우상론'},
      {name:'흄', id:'hume', note:'도덕은 감정 (주정주의)'},
      {name:'공리주의 (벤담·밀)', id:'utilitarianism', note:'쾌락 계산, 최대다수 최대행복'},
      {name:'실용주의 (제임스·듀이)', id:'modern-western-philosophy', note:'지식은 실생활 문제해결의 도구'},
    ]},
    { key:'rationalism', label:'이성·사유 계열 (합리론)', color:'red', chain:[
      {name:'소크라테스', id:'socrates', note:'보편타당한 진리 추구'},
      {name:'플라톤', id:'plato', note:'이데아는 이성으로 파악'},
      {name:'아리스토텔레스', id:'aristotle', note:'이성적 지성적 덕, 실천적 지혜'},
      {name:'스토아 학파', id:'stoicism', note:'로고스(이성)에 따르는 삶'},
      {name:'데카르트', id:'descartes', note:'연역법, 방법적 회의'},
      {name:'스피노자', id:'spinoza', note:'이성으로 신(자연)을 인식'},
      {name:'칸트', id:'kant', note:'이성의 도덕법칙 (정언명령)'},
    ]},
    { key:'materialism', label:'물질 계열 (유물론)', color:'sage', chain:[
      {name:'데모크리토스', id:'sophists', note:'만물은 원자로 이루어짐 — 유물론의 시초'},
      {name:'에피쿠로스', id:'epicureanism', note:'원자론 계승, 영혼도 원자라 죽으면 흩어짐'},
      {name:'홉스', id:'social-contract', note:'인간도 물체, 국가는 인공적 기계'},
      {name:'마르크스', id:'capitalism-alternatives', note:'물질적 생산 관계가 의식을 규정 — 유물사관'},
    ]},
    { key:'irrationalism', label:'반이성 계열 (실존주의)', color:'gold', chain:[
      {name:'키르케고르', id:'modern-western-philosophy', note:'유신론 · 신 앞의 단독자, 주체적 진리'},
      {name:'야스퍼스', id:'modern-western-philosophy', note:'유신론 · 한계 상황에서 초월자와 만남'},
      {name:'하이데거', id:'modern-western-philosophy', note:'무신론 · 죽음을 향한 존재, 본래적 실존'},
      {name:'사르트르', id:'modern-western-philosophy', note:'무신론 · 실존이 본질에 앞선다'},
    ]},
  ]
};

/* ---------- 부록: 개념 층위 / 포함관계 다이어그램 ---------- */
const HIERARCHIES = [
  { id:'confucius-in', unit:'유교', title:'공자 — 인(仁)의 실천 구조', topicId:'confucius', type:'tree',
    note:"'인'은 공자 사상의 최상위 개념이에요. 그 실천 방법인 '효제충서' 중에서도 '서'는 다시 두 원리(추기급인, 기소불욕 물시어인)로 한 단계 더 들어가는데, 이 하위 원리들을 '인' 자체와 같은 층위로 잘못 이해하지 않는 게 중요해요.",
    roots:[{label:'인(仁)', desc:'인간 내면의 타고난 도덕성', children:[
      {label:'효제충서', desc:'인의 실천 방법', children:[
        {label:'효제', desc:'부모에게 효도, 형제 간의 우애'},
        {label:'충', desc:'온 정성을 다함'},
        {label:'서', desc:'상대방을 배려, 역지사지', children:[
          {label:'추기급인', desc:'나를 미루어 남에게 미침'},
          {label:'기소불욕 물시어인', desc:'내가 원치 않는 걸 남에게 시키지 말 것'},
        ]},
      ]},
    ]}]},

  { id:'zhuxi-simtongseongjeong', unit:'유교', title:'주자 — 심통성정 구조', topicId:'zhuxi', type:'tree',
    note:"마음(심)이 본성(성)과 감정(정)을 모두 통괄한다는 게 심통성정이에요. 본연지성+사단은 순선무악해서 '도심', 기질지성+칠정은 가선가악해서 '인심'으로 다시 교차 결합되는데(인심 中 악한 것이 인욕), 이 대응 관계를 헷갈리지 않는 게 핵심이에요.",
    roots:[{label:'심(心)', desc:'본성과 감정을 통괄(관통)', children:[
      {label:'성(性) · 본성', desc:'태어날 때 마음, 발동 이전', children:[
        {label:'본연지성', desc:'이(理), 천리로서의 본성(인의예지 내재)'},
        {label:'기질지성', desc:'이+기, 기질로서의 본성(사람마다 차이)'},
      ]},
      {label:'정(情) · 감정', desc:'발동 이후의 마음, 동요된 마음', children:[
        {label:'사단', desc:'순선무악한 감정(측은,수오,사양,시비)'},
        {label:'칠정', desc:'가선가악한 감정(희노애구애오욕)'},
      ]},
    ]}]},

  { id:'xunzi-hwaseonggiwi', unit:'유교', title:'순자 — 화성기위 네 단계', topicId:'xunzi', type:'flow',
    note:"성→정→려→위 순서가 곧 화성기위(化性起僞), 악한 본성이 선하게 바뀌는 전 과정이에요. 마지막 '위(僞)'는 '거짓'이 아니라 '사람이 하는 일'이라는 뜻이에요. 글자만 보고 부정적으로 읽으면 뜻이 반대가 돼요.",
    flow:{ steps:[
      {badge:'性', label:'성(性)', desc:'이기적이고 악한 본성 — 이익을 좋아하고 남을 미워함'},
      {badge:'情', label:'정(情)', desc:'어떤 사건에 감응하여 일어난 감정'},
      {badge:'慮', label:'려(慮)', desc:'감정이 생긴 뒤 마음이 헤아리고 선택함'},
      {badge:'僞', label:'위(僞)', desc:'예를 배워 행함 — 후천적 노력으로 화성기위 완성'},
    ]}},

  { id:'buddha-samdok-samhak', unit:'불교', title:'불교 — 삼독(제거) vs 삼학(추구)', topicId:'buddha', type:'matrix',
    note:"삼독은 없애야 할 것, 삼학은 길러야 할 것이라 방향이 반대예요. 「삼학을 통해 삼독에 이른다」처럼 목표를 뒤집어 놓는 함정이 자주 나와요. 삼학을 여덟 갈래로 구체화한 것이 팔정도예요.",
    matrix:{ corner:'', cols:['삼독(三毒) — 없앨 것', '삼학(三學) — 기를 것'], rows:[
      { label:'첫째', cells:['탐(貪) — 탐욕, 과도한 욕심', '계(戒) — 계율, 지켜야 할 규칙'] },
      { label:'둘째', cells:['진(瞋) — 성냄, 화를 내고 자만함', '정(定) — 선정, 마음을 고요히 함'] },
      { label:'셋째', cells:['치(癡) — 어리석음, 진리를 모름', '혜(慧) — 지혜, 있는 그대로 통찰함'] },
      { label:'방향', cells:['불성을 가리는 번뇌 → 제거 대상', '불성을 드러내는 수행 → 추구 대상'] },
      { label:'팔정도와의 관계', cells:['삼독이 괴로움의 원인(집제)', '팔정도가 삼학을 여덟 갈래로 편 것(도제)'] },
    ]}},

  { id:'buddha-8path', unit:'불교', title:'불교 — 팔정도(八正道)', topicId:'buddha', type:'tree',
    note:"팔정도는 삼학을 여덟 갈래로 편 것이라, 세 묶음으로 나눠 외우면 순서가 헷갈리지 않아요. 여기서 정명(正命)은 바른 생계를 뜻하며 공자의 정명(正名, 이름값)과 한자가 달라요. 쾌락과 고행 어느 쪽에도 치우치지 않는 중도(中道)의 구체적 내용이기도 해요.",
    roots:[
      {label:'혜(慧) — 지혜', desc:'있는 그대로 보는 눈', children:[
        {label:'정견(正見)', desc:'바른 견해 — 사성제를 바로 앎 ★'},
        {label:'정사유(正思惟)', desc:'바른 생각 — 탐욕과 성냄을 떠난 사유'},
      ]},
      {label:'계(戒) — 계율', desc:'말과 행동을 바르게', children:[
        {label:'정어(正語)', desc:'바른 말 — 거짓말·이간질을 하지 않음'},
        {label:'정업(正業)', desc:'바른 행위 — 살생·도둑질을 하지 않음'},
        {label:'정명(正命)', desc:'바른 생계 — 남을 해치지 않는 직업'},
      ]},
      {label:'정(定) — 선정', desc:'마음을 고요히 하고 집중함', children:[
        {label:'정정진(正精進)', desc:'바른 노력 — 선을 늘리고 악을 줄임'},
        {label:'정념(正念)', desc:'바른 마음챙김 — 몸과 마음을 깨어 살핌'},
        {label:'정정(正定)', desc:'바른 삼매 — 흔들림 없는 집중'},
      ]},
    ]},

  { id:'buddha-oon', unit:'불교', title:'불교 — 오온(五蘊)', topicId:'buddha', type:'nested',
    note:"오온은 무상(無常)해서 계속 변해요. 그래서 '고정된 실체로서의 나'는 없다는 게 무아인데, '변해가는 나' 자체는 존재한다는 걸 놓치면 안 돼요 — 무아를 '어떠한 나도 없음'으로 잘못 이해하는 게 대표적인 함정이에요.",
    nested:{ boxes:[{label:'‘나’라고 불리는 것', desc:'고정된 실체가 아니라 다섯 무더기가 잠시 모인 것', children:[
      {label:'색(色) — 육체', desc:'물질적인 몸'},
      {label:'수(受) — 느낌', desc:'괴로움·즐거움의 감각'},
      {label:'상(想) — 표상', desc:'대상을 떠올리고 이름 붙임'},
      {label:'행(行) — 의지', desc:'마음의 작용과 의도'},
      {label:'식(識) — 인식', desc:'대상을 알아차림'},
    ]}]}},

  { id:'mahayana-6paramita', unit:'불교', title:'대승불교 — 6바라밀', topicId:'buddhism-development', type:'tree',
    note:"6바라밀 중 '보시'만 무주상보시(대가를 바라지 않는 보시)로 한 단계 더 들어가요. 나머지 다섯(지계,인욕,정진,선정,지혜)은 그 자체로 하나의 항목이에요.",
    roots:[{label:'6바라밀', desc:'해탈의 언덕으로 가는 대승불교의 수행 방법', children:[
      {label:'보시', desc:'남에게 베풂', children:[
        {label:'무주상보시', desc:'대가없이 베풂'},
      ]},
      {label:'지계'}, {label:'인욕'}, {label:'정진'}, {label:'선정'}, {label:'지혜'},
    ]}]},

  { id:'aristotle-virtue', unit:'서양', title:'아리스토텔레스 — 덕의 분류', topicId:'aristotle', type:'matrix',
    note:"두 덕은 영혼의 어느 부분에 관계되는지, 어떻게 길러지는지가 달라요. 다만 서로를 필요로 해서 어느 한쪽만 갖추는 일은 없어요. '중용을 판단하는 것'은 실천적 지혜(지성적 덕)의 몫이고, '그 판단대로 행하는 품성'이 품성적 덕이라는 구분이 핵심이에요.",
    matrix:{ corner:'', cols:['지성적 덕', '품성적 덕(도덕적 덕)'], rows:[
      { label:'영혼의 어느 부분', cells:['이성적인 부분', '비이성적인 부분 — 감정과 욕구'] },
      { label:'어떻게 길러지나', cells:['교육과 시간을 통해', '반복과 습관을 통해'] },
      { label:'무엇이 속하나', cells:['철학적 지혜(최고의 덕) · 실천적 지혜', '용기 · 절제 · 관대함 등'] },
      { label:'중용과의 관계', cells:['실천적 지혜가 중용이 무엇인지 판단한다', '그 판단대로 행하는 품성이 곧 중용의 덕'] },
      { label:'최고의 활동', cells:['관조(theoria) — 가장 높은 행복', '실천을 통해 폴리스의 좋은 삶에 기여'] },
    ]}},

  { id:'stoic-passion', unit:'서양', title:'스토아 — 정념의 분류', topicId:'stoicism', type:'tree',
    note:"스토아 학파는 모든 정념을 없애자는 게 아니에요. 자연적 정념은 허용하고, 비자연적 정념만 제거 대상이에요 (함정: 모든 정념 제거는 X, 해방·초연이 O).",
    roots:[{label:'정념', desc:'욕구, 열망, 감각, 열정 등', children:[
      {label:'자연적 정념 — 허용', desc:'자기애, 부모에 대한 사랑'},
      {label:'비자연적 정념 — 제거', desc:'권력욕, 명예욕, 지나친 쾌락'},
    ]}]},

  { id:'epicurus-desire', unit:'서양', title:'에피쿠로스 — 욕망의 분류', topicId:'epicureanism', type:'matrix',
    note:"두 기준(자연적인가 · 필수적인가)으로 나눠 보면 충족해야 할 것은 왼쪽 위 하나뿐이에요. 자연적이라고 다 채워야 하는 게 아니라는 점이 함정으로 자주 나와요. 오른쪽 아래 칸이 비어 있는 이유는 필수적인데 자연적이지 않은 욕망은 없기 때문이에요.",
    matrix:{ corner:'', cols:['필수적 ○', '필수적 ✕'], rows:[
      { label:'자연적 ○', cells:['식욕 · 수면욕 — 최소한만 충족', '성욕 · 식도락 — 없어도 무방, 극복 대상'] },
      { label:'자연적 ✕', cells:['해당 없음', '권력욕 · 명예욕 · 부에 대한 욕심 — 극복 대상'] },
    ]}},

  { id:'medieval-law', unit:'서양', title:'중세 — 법의 위계', topicId:'medieval-christianity', type:'pyramid',
    note:"아래가 근거, 위로 갈수록 구체화돼요. 영원법이 모든 법의 뿌리이고, 인간 이성이 그것을 나눠받은 게 자연법, 각 나라가 상황에 맞게 만든 게 실정법이에요. 영원법·자연법은 '불변', 실정법만 '가변'이라는 차이도 같이 기억하세요.",
    pyramid:{ levels:[
      {label:'실정법', desc:'개별 국가의 법 · 가변 · 인간이 만든 법'},
      {label:'자연법', desc:'인간 이성의 명령 · 불변 · 이성적 피조물이 영원법에 참여하는 방식'},
      {label:'영원법', desc:'신의 명령과 계시 · 불변 · 모든 법의 근거'},
    ]}},

  { id:'kant-categorical', unit:'서양', title:'칸트 — 정언명령의 두 정식', topicId:'kant', type:'matrix',
    note:"정언명령은 보편화 정식과 인간성 정식으로 이루어져요. 함정으로 자주 나오는 건 두 가지예요. '단지 수단으로만' 대하지 말라는 것이지 수단으로 대하는 것 자체를 금지하지는 않는다는 점, 그리고 모든 준칙이 보편화 가능한 것은 아니라는 점이에요.",
    matrix:{ corner:'두 정식', cols:['무엇을 묻는가', '통과 기준', '자주 나오는 함정'], rows:[
      { label:'보편화 정식', cells:[
        '내 준칙이 모두의 법칙이 되어도 괜찮은가',
        '네 의지의 준칙이 언제나 동시에 보편적 입법의 원리가 될 것',
        '모든 준칙이 보편화 가능하다고 서술하면 X — 일부만 통과한다'] },
      { label:'인간성 정식', cells:[
        '사람을 도구로만 쓰고 있지 않은가',
        '자신과 타인의 인격을 언제나 동시에 목적으로 대우할 것',
        "'수단으로 대하면 안 된다'로 쓰면 X — '단지 수단으로만'이 조건이다"] },
    ]}},

  { id:'rawls-priority', unit:'이데올로기', title:'롤스 — 정의의 원칙 우선순위', topicId:'ideal-society', type:'flow',
    note:"위에 있는 원칙이 아래보다 언제나 우선해요. 앞의 원칙이 충족되지 않으면 뒤의 원칙으로 넘어갈 수 없다는 뜻이라, 사회 전체의 이익을 위해 기본적 자유를 제한하는 것은 허용되지 않아요. 순서를 바꿔서 출제하는 함정이 많아요.",
    flow:{ steps:[
      {badge:'1', label:'평등한 자유의 원칙', desc:'모든 사람에게 기본적 자유를 평등하게 — 다른 어떤 이유로도 제한 불가'},
      {badge:'2', label:'기회균등의 원칙', desc:'직책과 지위는 공정한 기회균등 아래 모두에게 개방'},
      {badge:'3', label:'차등의 원칙', desc:'불평등은 최소 수혜자에게 최대 이익이 될 때만 정당화'},
    ]}},

  { id:'freedom-liberal-republican', unit:'이데올로기', title:'자유의 두 개념 — 불간섭 vs 비지배', topicId:'state-role', type:'matrix',
    note:"둘 다 '자유'라는 같은 단어를 쓰지만 뜻이 달라요. 자유주의는 간섭이 없는 것 자체를 자유로 보고, 공화주의는 자의적으로 지배할 수 있는 힘이 없는 것을 자유로 봐요. 그래서 법에 대한 태도가 정반대로 갈려요.",
    matrix:{ corner:'', cols:['자유주의 — 불간섭', '공화주의 — 비지배'], rows:[
      { label:'자유란', cells:['간섭이 없는 상태', '자의적 지배가 없는 상태'] },
      { label:'대표 학자', cells:['벌린 · 밀', '페팃 · 비롤리'] },
      { label:'법을 보는 눈', cells:['법도 간섭이므로 자유를 제한한다', '합당한 법은 지배를 막아 주므로 자유와 양립한다'] },
      { label:'간섭 없는 노예', cells:['간섭이 없으니 자유롭다', '주인이 있으므로 자유롭지 않다'] },
      { label:'국가의 역할', cells:['최소한에 그쳐야 한다 (해악 금지 원칙)', '시민의 참여로 자의적 권력을 견제해야 한다'] },
    ]}},

  { id:'modern-korea-matrix', unit:'근대', title:'근대 한국 윤리 — 봉건 × 외세 매트릭스', topicId:'modern-korean-ethics', type:'matrix',
    note:"찬봉건/반봉건과 반외세/찬외세, 두 기준을 따로따로 보면 헷갈려요. 위정척사=찬봉건+반외세, 동학=반봉건+반외세, 온건개화=찬봉건+찬외세, 급진개화=반봉건+찬외세로 2×2 매트릭스로 정리하면 절대 안 헷갈려요.",
    matrix:{
      corner:'', cols:['반외세','찬외세'],
      rows:[
        {label:'찬봉건', cells:['위정척사 (성리학 수호, 외세배척)','온건개화 (동도서기)']},
        {label:'반봉건', cells:['동학 (신분제 폐지, 서학 배척)','급진개화 (입헌군주제, 변법자강)']},
      ],
    },
  },

  { id:'yiyi-chilposa', unit:'유교', title:'이이 — 칠정과 사단의 포함관계 (칠포사)', topicId:'yiiyi', type:'nested',
    note:"이이는 사단과 칠정이 같은 뿌리(기발이승)에서 나온다고 봤어요. 그래서 사단은 칠정 중 선한 부분만 가리키는 것으로, 칠정이 사단을 포함하는 관계(칠포사, 七包四)가 성립해요. 반면 이황은 사단(이발기수)과 칠정(기발이승)의 연원 자체가 다르다고 봐서 이런 포함관계가 성립하지 않아요 — 두 사람의 차이를 '포함관계 성립 여부'로 기억하면 헷갈리지 않아요.",
    nested:{ boxes:[{label:'칠정 (모든 감정)', desc:'희·노·애·구·애·오·욕 — 기가 발하고 이가 탐[氣發理乘]', children:[
      {label:'사단 (선한 감정)', desc:'측은·수오·사양·시비 — 칠정 가운데 절도에 맞게 드러난 부분'},
    ]}]}},

  { id:'kierkegaard-stages', unit:'서양', title:'키르케고르 — 실존 회복의 3단계', topicId:'modern-western-philosophy', type:'flow',
    note:"앞의 두 단계는 각각 '절망'으로 끝나면서 다음 단계로 넘어가는 계기가 돼요. 단계 이행은 이성적 추론이 아니라 주체적 결단, 곧 질적 비약으로만 가능하다는 점이 핵심이에요. 순서를 바꿔 묻는 문제가 자주 나와요.",
    flow:{ steps:[
      {badge:'1', label:'심미적 실존', desc:'감각적 향락을 좇음 → 권태와 절망'},
      {badge:'2', label:'윤리적 실존', desc:'보편적 규범을 따름 → 자신의 유한함과 죄를 자각, 다시 절망'},
      {badge:'3', label:'종교적 실존', desc:'신 앞에 선 단독자로 결단 ⇒ 절망 극복'},
    ]}},

  { id:'buddha-12nidana', unit:'불교', title:'불교 — 십이연기(十二緣起)', topicId:'buddha', type:'cycle',
    note:"시작도 끝도 없이 도는 구조라는 점이 핵심이에요. 앞의 것이 뒤의 것을 낳고, 마지막 늙음과 죽음이 다시 무명으로 이어져요. 그래서 어느 한 고리를 끊으면 사슬 전체가 무너지는데, 그 고리가 바로 무명(無明)이에요. 무명을 없애는 것이 곧 해탈이라는 게 이 그림의 결론이에요.",
    cycle:{ loopNote:'무명을 끊지 않는 한 윤회는 멈추지 않는다', steps:[
      {badge:'1', label:'무명(無明)', desc:'진리를 알지 못하는 근본 무지'},
      {badge:'2', label:'행(行)', desc:'무명에서 나온 의지 작용'},
      {badge:'3', label:'식(識)', desc:'대상을 알아차리는 의식'},
      {badge:'4', label:'명색(名色)', desc:'정신과 육체'},
      {badge:'5', label:'육처(六處)', desc:'눈·귀·코·혀·몸·뜻의 여섯 감각 기관'},
      {badge:'6', label:'촉(觸)', desc:'감각 기관이 대상과 만남'},
      {badge:'7', label:'수(受)', desc:'괴로움·즐거움의 느낌'},
      {badge:'8', label:'애(愛)', desc:'느낌에서 생기는 갈애'},
      {badge:'9', label:'취(取)', desc:'갈애가 굳어진 집착'},
      {badge:'10', label:'유(有)', desc:'집착이 만들어 낸 존재'},
      {badge:'11', label:'생(生)', desc:'태어남'},
      {badge:'12', label:'노사(老死)', desc:'늙고 병들고 죽음 — 다시 무명으로'},
    ]}},

  { id:'sadan-chiljeong-debate', unit:'유교', title:'사단칠정 논쟁 — 이황 vs 이이', topicId:'yiiyi', type:'matrix',
    note:"두 사람의 차이는 '이(理)가 발할 수 있는가' 하나로 갈려요. 이황은 이발을 인정해 사단과 칠정의 연원을 나누고, 이이는 이무위를 지켜 발하는 것은 언제나 기라고 봐요. 따를 수(隨)는 사단, 올라탈 승(乘)은 칠정에 붙는데 이 한 글자를 바꿔 놓는 변형이 가장 자주 나와요.",
    matrix:{ corner:'', cols:['이황 (퇴계)', '이이 (율곡)'], rows:[
      { label:'학설 이름', cells:['이기호발설(理氣互發說)', '기발이승일도설(氣發理乘一途說)'] },
      { label:'사단은', cells:['이발이기수지 — 이가 발하고 기가 따름', '기발이승 — 기가 발하고 이가 탐'] },
      { label:'칠정은', cells:['기발이이승지 — 기가 발하고 이가 탐', '기발이승 — 사단과 같은 길'] },
      { label:'이(理)는', cells:['스스로 발할 수 있다 [理發]', '발하지 못한다 [理無爲]'] },
      { label:'사단과 칠정', cells:['연원이 달라 나뉜다 [不相雜 강조]', '칠정이 사단을 포함한다 [七包四]'] },
      { label:'강조점', cells:['주리론 · 이귀기천 · 도덕 명분', '주기론 · 이기지묘 · 현실 개혁'] },
      { label:'수양의 중심', cells:['경(敬)', '성(誠) — 경을 통해 성에 이름'] },
    ]}},

  { id:'social-contract-three', unit:'이데올로기', title:'사회계약설 세 사람 비교', topicId:'social-contract', type:'matrix',
    note:"자연 상태를 어떻게 그리느냐가 나머지를 모두 결정해요. 홉스는 전쟁 상태라 전부 넘기고, 로크는 대체로 평화롭지만 불안하니 일부만 맡기고, 루소는 자유롭고 평화로웠으니 공동체 전체에 넘기되 곧 자기 자신에게 복종하는 셈이 돼요. 양도 범위와 저항권이 짝을 이룬다는 점이 핵심이에요.",
    matrix:{ corner:'', cols:['홉스', '로크', '루소'], rows:[
      { label:'자연 상태', cells:['만인의 만인에 대한 투쟁', '대체로 평화롭지만 불안정', '자유롭고 평화로움'] },
      { label:'인간 본성', cells:['이기적', '이성적이되 불완전', '선하지만 문명이 타락시킴'] },
      { label:'양도 범위', cells:['자연권 전부', '자연법 집행권만', '전면 양도(모두가 똑같이)'] },
      { label:'주권자', cells:['계약 밖의 절대 주권자', '신탁받은 입법부', '인민 전체 = 일반 의지'] },
      { label:'저항권', cells:['없음 (생명 위협 시만 예외)', '있음 — 신탁 위반 시 회수', '주권자가 곧 인민이라 성립 안 함'] },
      { label:'주권의 성질', cells:['양도됨 · 분할 불가', '신탁됨 · 권력 분립', '양도·분할·대표 모두 불가'] },
      { label:'이상 정부', cells:['절대군주정', '입헌군주정 · 대의제', '직접 민주정 · 공화정'] },
    ]}},

  { id:'galtung-violence-peace', unit:'이데올로기', title:'갈퉁 — 폭력과 평화의 층위', topicId:'peace-theory', type:'nested',
    note:"바깥 상자가 넓은 개념이에요. 직접적 폭력만 없앤 상태가 소극적 평화이고, 구조적·문화적 폭력까지 없애야 적극적 평화가 돼요. 전쟁이 멈춘 것만으로는 평화가 아니라는 게 갈퉁의 요지예요. 구조적 폭력은 가해자가 특정되지 않아도 성립한다는 점이 함정으로 자주 나와요.",
    nested:{ boxes:[
      {label:'적극적 평화', desc:'세 층위의 폭력이 모두 사라진 상태 — 갈퉁이 말하는 진정한 평화', children:[
        {label:'문화적 폭력', desc:'직접적·구조적 폭력을 정당화하는 종교·이념·언어·예술 — 가장 깊은 층', children:[
          {label:'구조적 폭력', desc:'빈곤·억압·차별처럼 사회 구조 자체가 사람을 해치는 것 — 가해자가 특정되지 않음', children:[
            {label:'소극적 평화 = 직접적 폭력의 부재', desc:'전쟁·폭행처럼 눈에 보이는 폭력만 멈춘 상태'},
          ]},
        ]},
      ]},
    ]}},

  { id:'dasan-gihoseol', unit:'유교', title:'정약용 — 성기호설과 자주지권', topicId:'jeongyakyong', type:'nested',
    note:"성(性)은 실체가 아니라 방향을 가진 쏠림이에요. 기호가 둘이라는 점을 놓치면 '동물과 마찬가지'라는 선지에서 헷갈려요. 형구의 기호는 동물과 공유하지만 영지의 기호는 인간만 지녀요. 그리고 두 기호가 부딪힐 때 어느 쪽을 따를지 고르는 힘이 자주지권이에요.",
    nested:{ boxes:[
      {label:'인간', desc:'하늘이 기호와 자주지권을 함께 부여했다', children:[
        {label:'성(性) = 기호(嗜好)', desc:'실체가 아니라 좋아하고 싫어하는 마음의 경향성', children:[
          {label:'영지(靈知)의 기호', desc:'선을 좋아하고 악을 미워함 — 인간만 지님 (도의지성)'},
          {label:'형구(形軀)의 기호', desc:'육체에서 오는 감각적 욕구 — 동물과 공유'},
        ]},
        {label:'자주지권(自主之權)', desc:'두 기호가 부딪힐 때 스스로 고를 수 있는 권한 — 그래서 공과(功過)가 나에게 돌아온다'},
        {label:'사덕(四德)', desc:'사단을 실천해서 나중에 이루어지는 것 — 타고나는 성이 아니다'},
      ]},
    ]}},

  { id:'aristotle-happiness-cond', unit:'서양', title:'아리스토텔레스 — 행복의 조건', topicId:'aristotle', type:'pyramid',
    note:"아래가 없으면 위가 성립하지 않는 구조예요. 덕만 갖추면 행복하다고 보지 않았다는 점이 스토아와 갈리는 지점이에요. 어느 정도의 외적 선과 충분한 삶의 기간이 필요하고, 덕은 지니는 것만으로는 부족해 발휘되어야 해요. 맨 위 관조가 최고의 행복이라는 것도 자주 물어져요.",
    pyramid:{ levels:[
      {label:'관조(theoria)', desc:'신적인 활동 — 가장 완전하고 자족적인 행복'},
      {label:'덕에 따른 활동', desc:'덕을 지니는 데 그치지 않고 실제로 발휘함'},
      {label:'품성적 덕 · 지성적 덕', desc:'습관과 교육으로 길러지는 탁월성'},
      {label:'외적 선과 충분한 삶', desc:'건강 · 재산 · 친구 · 온전한 생애 — 없으면 행복이 온전하지 않다'},
    ]}},

  { id:'marx-history-stages', unit:'이데올로기', title:'마르크스 — 유물사관 5단계', topicId:'capitalism-alternatives', type:'flow',
    note:"생산력이 발달하면 기존 생산 관계와 부딪히고, 그 모순이 다음 단계를 낳는다는 것이 유물사관이에요. 계급이 있는 단계는 노예제부터 자본주의까지이고, 처음과 끝에는 계급이 없어요. 공산 사회에서는 계급과 함께 국가도 소멸한다는 점이 핵심이에요. 순환이 아니라 한 방향으로 나아가는 발전관이라는 점도 함께 물어져요.",
    flow:{ steps:[
      {badge:'1', label:'원시 공산 사회', desc:'생산 수단 공유 · 계급 없음'},
      {badge:'2', label:'고대 노예제 사회', desc:'주인 ↔ 노예 — 계급 발생'},
      {badge:'3', label:'중세 봉건제 사회', desc:'영주 ↔ 농노'},
      {badge:'4', label:'근대 자본주의 사회', desc:'자본가 ↔ 노동자 — 착취와 소외가 극에 달함'},
      {badge:'★', label:'프롤레타리아 독재', desc:'과도기 — 노동에 따른 분배'},
      {badge:'5', label:'공산 사회', desc:'계급도 국가도 소멸 · 능력에 따라 일하고 필요에 따라 분배'},
    ]}},

  { id:'aid-three-views', unit:'이데올로기', title:'해외 원조 — 롤스 · 싱어 · 노직', topicId:'cosmopolitanism-aid', type:'matrix',
    note:"세 사람은 원조를 의무로 보는지, 그리고 무엇을 기준으로 삼는지가 모두 달라요. 롤스는 정치 문화를, 싱어는 고통을, 노직은 개인의 자유를 봐요. 특히 롤스는 자원이 부족해도 질서 정연한 사회일 수 있다고 보아 부의 균등화를 목표로 삼지 않는다는 점이 함정으로 자주 나와요.",
    matrix:{ corner:'', cols:['롤스', '싱어', '노직'], rows:[
      { label:'원조는', cells:['의무 (윤리적)', '의무 (윤리적)', '의무 아님 — 자선의 영역'] },
      { label:'판단 기준', cells:['질서 정연한 사회인가', '고통을 겪고 있는가', '개인의 소유 권리'] },
      { label:'대상', cells:['고통받는 사회 (국가 단위)', '절대 빈곤에 처한 개인', '없음 — 강제할 수 없다'] },
      { label:'목표', cells:['스스로 문제를 관리하는 사회가 되도록', '고통의 총량을 줄임', '해당 없음'] },
      { label:'빈곤의 원인', cells:['자원이 아니라 정치 문화', '분배의 실패', '분배 자체를 문제 삼지 않음'] },
      { label:'국경의 의미', cells:['사회 단위로 판단하므로 의미 있음', '도덕적으로 무의미 — 거리는 상관없다', '소유권이 정당하면 국경과 무관'] },
      { label:'멈추는 지점', cells:['질서 정연해지면 종료 — 부의 균등화는 목표 아님', '한계 효용까지 — 이익 평등 고려', '해당 없음'] },
    ]}},

  { id:'plato-soul-virtue-class', unit:'서양', title:'플라톤 — 영혼 · 덕 · 계급의 대응', topicId:'plato', type:'table',
    note:"영혼 삼분설의 세 부분이 각각 하나의 덕, 하나의 계급과 1:1로 대응해요. '정의'는 이 세 계급이 각자 역할을 잘 수행할 때 실현되는 조화의 덕이라, 표 안의 한 줄이 아니라 전체를 아우르는 덕으로 이해해야 해요.",
    table:{ cols:['영혼의 부분','대응하는 덕','계급'], rows:[
      ['머리 - 이성','지혜','통치자(금) — 수호자'],
      ['가슴 - 기개','용기','방위자(은) — 수호자'],
      ['배·사지 - 욕망','절제','생산자(동)'],
    ]},
  },
];
function renderGenealogy(){
  return `<div class="hard-box" style="padding:16px;">
    <div class="table-title" style="margin-top:0;">${GENEALOGY.title}</div>
    <div class="geneal-desc">${GENEALOGY.desc}</div>
    <div class="geneal-row">
      ${GENEALOGY.cols.map(col=>`
        <div class="geneal-col">
          <div class="geneal-col-head ${col.color}">${col.label}</div>
          <div class="geneal-chain">
            ${col.chain.map((node,i)=>`
              <div class="geneal-node ${col.color}" onclick="go('topicDetail',{topicId:'${node.id}'})">
                <div class="n">${node.name}</div>
                <div class="d">${node.note}</div>
              </div>
              ${i<col.chain.length-1?'<div class="geneal-arrow">↓</div>':''}
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

function renderTables(){
  const withTable = DATA.filter(t=>t.table).sort((a,b)=>a.order-b.order);
  if(NAV.tableIdx >= withTable.length) NAV.tableIdx = 0;
  const topic = withTable[NAV.tableIdx];
  const mode = NAV.tablesMode || 'genealogy';

  const modeRow = `<div class="grid3" style="margin-bottom:14px;">
      <button class="btn btn-sm ${mode==='genealogy'?'btn-primary':''}" onclick="NAV.tablesMode='genealogy'; render();">譜 계보</button>
      <button class="btn btn-sm ${mode==='table'?'btn-primary':''}" onclick="NAV.tablesMode='table'; render();">表 비교표</button>
      <button class="btn btn-sm ${mode==='appendix'?'btn-primary':''}" onclick="NAV.tablesMode='appendix'; render();">錄 부록</button>
    </div>`;

  if(mode === 'genealogy'){
    return `<div class="screen">${modeRow}${renderGenealogy()}</div>`;
  }

  if(mode === 'appendix'){
    if(NAV.appendixId){
      return `<div class="screen">${modeRow}${renderAppendixDetail(NAV.appendixId)}</div>`;
    }
    return `<div class="screen">${modeRow}${renderAppendixList()}</div>`;
  }

  const chips = `<div style="display:flex; gap:8px; margin-bottom:12px; overflow-x:auto; padding-bottom:4px;">
      ${withTable.map((t,i)=>`<button class="btn btn-sm ${i===NAV.tableIdx?'btn-primary':''}" style="flex:none;" onclick="NAV.tableIdx=${i}; NAV.tableHideCol=null; render();">${t.title}</button>`).join('')}
    </div>`;

  return `<div class="screen">
    ${modeRow}
    ${chips}
    <div class="hard-box" style="padding:14px;">
      ${renderTable(topic.table, NAV.tableHideCol)}
    </div>

    <button class="btn btn-ghost btn-block" style="margin-top:12px;" onclick="go('topicDetail',{topicId:'${topic.id}'})">${topic.title} 전체 정리 보러가기 →</button>
  </div>`;
}

/* ---------- 부록: 개념 층위 렌더링 ---------- */
function renderHierMatrix(m){
  return `<div class="table-wrap"><table class="hier-matrix">
    <tr><th>${m.corner||''}</th>${m.cols.map(c=>`<th>${c}</th>`).join('')}</tr>
    ${m.rows.map(r=>`<tr><td class="row-h">${r.label}</td>${r.cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}
  </table></div>`;
}
/* ===================================================================
   부록 구조도 — SVG로 그린다

   HTML+CSS 로 들여쓰기·테두리만 쌓으면 층위가 눈에 안 들어온다.
   선과 도형으로 그려야 「무엇이 무엇 아래인지」가 한눈에 보인다.

   글자 폭을 재는 대신 글자 수로 줄바꿈을 계산한다.
   한글은 글자 폭이 거의 일정해서 이 방법으로 충분하다.
   =================================================================== */

const SVGD = {
  W: 340,            // 기준 폭 (viewBox)
  pad: 10,
  labelSize: 12.5,
  descSize: 10.5,
  lineH: 13.5
};

function svgEsc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// 한글 기준으로 대략적인 글자 폭을 재서 줄을 나눈다
function svgWidthOf(ch){
  const c = ch.charCodeAt(0);
  if(c >= 0xAC00 && c <= 0xD7A3) return 1;        // 한글
  if(c >= 0x4E00 && c <= 0x9FFF) return 1;        // 한자
  if(ch === ' ') return 0.34;
  return 0.56;                                     // 영문·숫자·기호
}
function svgWrap(text, maxUnits){
  const words = String(text).split(' ');
  const lines = [];
  let cur = '', curW = 0;
  words.forEach(w=>{
    let ww = 0;
    for(let i=0;i<w.length;i++) ww += svgWidthOf(w[i]);
    if(cur && curW + 0.34 + ww > maxUnits){ lines.push(cur); cur = w; curW = ww; }
    else { cur = cur ? (cur + ' ' + w) : w; curW = curW + (cur === w ? 0 : 0.34) + ww; }
  });
  if(cur) lines.push(cur);
  return lines.length ? lines : [''];
}
function svgLines(lines, x, y, size, cls){
  return lines.map((ln,i)=>
    `<text x="${x}" y="${y + i*SVGD.lineH}" font-size="${size}" class="${cls||''}" fill="currentColor">${svgEsc(ln)}</text>`
  ).join('');
}
function svgOpen(h){
  return `<div class="hier-svg"><svg viewBox="0 0 ${SVGD.W} ${Math.ceil(h)}" width="100%" xmlns="http://www.w3.org/2000/svg">`;
}
const svgClose = '</svg></div>';

// 한 칸(라벨 + 설명)의 높이를 미리 계산
function svgBoxPlan(node, w){
  const inner = (w - 20) / (SVGD.descSize * 1.03);
  const dl = node.desc ? svgWrap(node.desc, inner) : [];
  return { lines: dl, h: 18 + (dl.length ? dl.length * SVGD.lineH + 4 : 0) + 8 };
}
function svgBox(x, y, w, plan, node, opt){
  opt = opt || {};
  const fill = opt.fill || 'rgba(0,0,0,.028)';
  const sw = opt.strong ? 1.4 : 1;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${plan.h}" rx="4"
          fill="${fill}" stroke="currentColor" stroke-opacity=".55" stroke-width="${sw}"/>
    <text x="${x+9}" y="${y+15}" font-size="${SVGD.labelSize}" font-weight="700" fill="currentColor">${svgEsc(node.label)}</text>
    ${plan.lines.length ? svgLines(plan.lines, x+9, y+15+SVGD.lineH+1, SVGD.descSize, 'sd') : ''}`;
}

/* ---------- 계통도(tree) ---------- */
function svgTree(roots){
  const IND = 16;
  let out = '', y = 4;
  function walk(node, depth){
    const x = SVGD.pad + depth * IND;
    const w = SVGD.W - SVGD.pad*2 - depth*IND;
    const plan = svgBoxPlan(node, w);
    const myTop = y;
    out += svgBox(x, y, w, plan, node, { strong: depth === 0, fill: depth === 0 ? 'rgba(0,0,0,.055)' : 'rgba(0,0,0,.02)' });
    y += plan.h + 8;
    (node.children || []).forEach(ch=>{
      const childTop = y;
      // 부모 왼쪽 아래에서 자식 왼쪽으로 꺾어 내려가는 선
      out += `<path d="M ${x+7} ${myTop + plan.h} L ${x+7} ${childTop + 13} L ${x+IND} ${childTop + 13}"
                 fill="none" stroke="currentColor" stroke-opacity=".38"/>`;
      walk(ch, depth + 1);
    });
  }
  roots.forEach(r=>{ walk(r, 0); y += 4; });
  return svgOpen(y) + out + svgClose;
}

/* ---------- 흐름도(flow) ---------- */
function svgFlow(flow){
  const steps = flow.steps || [];
  const x = SVGD.pad + 30, w = SVGD.W - SVGD.pad*2 - 30;
  let out = '', y = 4;
  steps.forEach((s,i)=>{
    const plan = svgBoxPlan(s, w);
    out += svgBox(x, y, w, plan, s);
    // 왼쪽 원형 배지
    out += `<circle cx="${SVGD.pad + 13}" cy="${y + plan.h/2}" r="12"
              fill="rgba(0,0,0,.06)" stroke="currentColor" stroke-opacity=".5"/>
            <text x="${SVGD.pad + 13}" y="${y + plan.h/2 + 4}" text-anchor="middle"
              font-size="11" font-weight="700" fill="currentColor">${svgEsc(s.badge || (i+1))}</text>`;
    y += plan.h;
    if(i < steps.length - 1){
      out += `<line x1="${SVGD.pad+13}" y1="${y}" x2="${SVGD.pad+13}" y2="${y+18}" stroke="currentColor" stroke-opacity=".45"/>
              <path d="M ${SVGD.pad+9} ${y+13} L ${SVGD.pad+13} ${y+19} L ${SVGD.pad+17} ${y+13}"
                    fill="none" stroke="currentColor" stroke-opacity=".45"/>`;
      y += 18;
    }
  });
  return svgOpen(y + 4) + out + svgClose;
}

/* ---------- 순환도(cycle) ---------- */
function svgCycle(cycle){
  const steps = cycle.steps || [];
  const x = SVGD.pad + 30, w = SVGD.W - SVGD.pad*2 - 42;
  let out = '', y = 6;
  const tops = [];
  steps.forEach((s,i)=>{
    const plan = svgBoxPlan(s, w);
    tops.push({ y:y, h:plan.h });
    out += svgBox(x, y, w, plan, s);
    out += `<circle cx="${SVGD.pad + 13}" cy="${y + plan.h/2}" r="11"
              fill="rgba(0,0,0,.06)" stroke="currentColor" stroke-opacity=".5"/>
            <text x="${SVGD.pad + 13}" y="${y + plan.h/2 + 4}" text-anchor="middle"
              font-size="10.5" font-weight="700" fill="currentColor">${svgEsc(s.badge || (i+1))}</text>`;
    y += plan.h;
    if(i < steps.length - 1){
      out += `<line x1="${SVGD.pad+13}" y1="${y}" x2="${SVGD.pad+13}" y2="${y+14}" stroke="currentColor" stroke-opacity=".45"/>
              <path d="M ${SVGD.pad+9.5} ${y+9} L ${SVGD.pad+13} ${y+15} L ${SVGD.pad+16.5} ${y+9}"
                    fill="none" stroke="currentColor" stroke-opacity=".45"/>`;
      y += 14;
    }
  });
  // 마지막에서 처음으로 돌아가는 큰 고리
  const rx = SVGD.W - SVGD.pad - 6;
  const y0 = tops[0].y + tops[0].h/2;
  const y1 = tops[tops.length-1].y + tops[tops.length-1].h/2;
  out += `<path d="M ${x + w} ${y1} L ${rx} ${y1} L ${rx} ${y0} L ${x + w + 4} ${y0}"
             fill="none" stroke="currentColor" stroke-opacity=".5" stroke-dasharray="4 3"/>
          <path d="M ${x + w + 10} ${y0 - 4} L ${x + w + 3} ${y0} L ${x + w + 10} ${y0 + 4}"
             fill="none" stroke="currentColor" stroke-opacity=".5"/>`;
  if(cycle.loopNote){
    out += `<text x="${rx - 4}" y="${y0 - 8}" text-anchor="end" font-size="9.5"
              fill="currentColor" fill-opacity=".7">${svgEsc(cycle.loopNote)}</text>`;
  }
  return svgOpen(y + 8) + out + svgClose;
}

/* ---------- 피라미드(pyramid) ---------- */
// 데이터는 위에서 아래로(좁은 것 → 넓은 것) 들어온다
function svgPyramid(pyr){
  const levels = pyr.levels || [];
  const n = levels.length;
  const maxW = SVGD.W - SVGD.pad*2;
  let out = '', y = 6;
  levels.forEach((lv,i)=>{
    const wTop = maxW * (0.42 + 0.58 * (i / n));
    const wBot = maxW * (0.42 + 0.58 * ((i+1) / n));
    const inner = (wTop - 18) / (SVGD.descSize * 1.03);
    const dl = lv.desc ? svgWrap(lv.desc, inner) : [];
    const h = 20 + (dl.length ? dl.length * SVGD.lineH + 2 : 0) + 8;
    const cx = SVGD.W / 2;
    out += `<path d="M ${cx - wTop/2} ${y} L ${cx + wTop/2} ${y} L ${cx + wBot/2} ${y+h} L ${cx - wBot/2} ${y+h} Z"
               fill="rgba(0,0,0,${0.03 + i*0.02})" stroke="currentColor" stroke-opacity=".5"/>
            <text x="${cx}" y="${y+16}" text-anchor="middle" font-size="${SVGD.labelSize}"
               font-weight="700" fill="currentColor">${svgEsc(lv.label)}</text>
            ${dl.map((ln,k)=>`<text x="${cx}" y="${y+16+SVGD.lineH+k*SVGD.lineH}" text-anchor="middle"
               font-size="${SVGD.descSize}" fill="currentColor" fill-opacity=".78">${svgEsc(ln)}</text>`).join('')}`;
    y += h + 3;
  });
  out += `<text x="${SVGD.W/2}" y="${y+12}" text-anchor="middle" font-size="9.5"
            fill="currentColor" fill-opacity=".6">아래로 갈수록 근거가 되는 법</text>`;
  return svgOpen(y + 18) + out + svgClose;
}

/* ---------- 포함도(nested) ---------- */
function svgNested(nested){
  const boxes = nested.boxes || [];
  let out = '', y = 6;
  boxes.forEach(b=>{
    const kids = b.children || [];
    const innerW = SVGD.W - SVGD.pad*2 - 22;
    const plans = kids.map(k=>svgBoxPlan(k, innerW - 16));
    const outerPlan = svgBoxPlan(b, SVGD.W - SVGD.pad*2 - 18);
    const kidsH = plans.reduce((s,p)=>s + p.h + 6, 0);
    const H = outerPlan.h + kidsH + 14;
    out += `<rect x="${SVGD.pad}" y="${y}" width="${SVGD.W - SVGD.pad*2}" height="${H}" rx="7"
               fill="rgba(0,0,0,.03)" stroke="currentColor" stroke-opacity=".6" stroke-width="1.4"/>
            <text x="${SVGD.pad+11}" y="${y+17}" font-size="${SVGD.labelSize}" font-weight="700"
               fill="currentColor">${svgEsc(b.label)}</text>
            ${outerPlan.lines.map((ln,k)=>`<text x="${SVGD.pad+11}" y="${y+17+SVGD.lineH+k*SVGD.lineH}"
               font-size="${SVGD.descSize}" fill="currentColor" fill-opacity=".78">${svgEsc(ln)}</text>`).join('')}`;
    let yy = y + outerPlan.h + 6;
    kids.forEach((k,i)=>{
      out += svgBox(SVGD.pad + 11, yy, innerW, plans[i], k, { fill:'rgba(0,0,0,.05)' });
      yy += plans[i].h + 6;
    });
    y += H + 10;
  });
  return svgOpen(y) + out + svgClose;
}

function renderHierEntry(entry){
  let body = '';
  if(entry.type === 'tree'){
    body = svgTree(entry.roots);
  } else if(entry.type === 'cycle'){
    body = svgCycle(entry.cycle);
  } else if(entry.type === 'flow'){
    body = svgFlow(entry.flow);
  } else if(entry.type === 'pyramid'){
    body = svgPyramid(entry.pyramid);
  } else if(entry.type === 'nested'){
    body = svgNested(entry.nested);
  } else if(entry.type === 'matrix'){
    body = renderHierMatrix(entry.matrix);
  } else if(entry.type === 'table'){
    body = `<div class="table-wrap"><table class="cmp-table">
      <tr>${entry.table.cols.map(c=>`<th>${c}</th>`).join('')}</tr>
      ${entry.table.rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}
    </table></div>`;
  }
  return `<div class="hier-note-box">${entry.note}</div>${body}`;
}
// 부록을 정리 탭과 같은 순서로 — 필기 주제 order를 따르고, 같은 주제면 등록 순서 유지
function appendixSorted(){
  return HIERARCHIES.map((h,i)=>{
    const t = DATA.find(x=>x.id===h.topicId);
    return { h, order: t ? t.order : 99, seq: i };
  }).sort((a,b)=> (a.order - b.order) || (a.seq - b.seq)).map(x=>x.h);
}
function renderAppendixList(){
  const list = appendixSorted();
  let lastUnit = null;
  return list.map(h=>{
    const head = (h.unit !== lastUnit)
      ? `<div class="section-title" style="margin-top:${lastUnit?18:2}px;">${h.unit}</div>` : '';
    lastUnit = h.unit;
    return head + `
    <div class="hard-box appendix-item" onclick="NAV.appendixId='${h.id}'; render();">
      <span class="badge tag-${h.unit}"><span class="seal-ch">${UNIT_ICON[h.unit]}</span></span>
      <span class="t">${h.title}</span>
    </div>`;
  }).join('');
}
function renderAppendixDetail(id){
  const entry = HIERARCHIES.find(h=>h.id===id);
  if(!entry) return `<div class="empty">無</div>`;
  const topic = DATA.find(t=>t.id===entry.topicId);
  return `
    <button class="btn btn-ghost btn-sm" style="margin-bottom:10px;" onclick="NAV.appendixId=null; render();">← 부록 목록으로</button>
    <div class="hard-box" style="padding:16px;">
      <span class="badge tag-${entry.unit}"><span class="seal-ch">${UNIT_ICON[entry.unit]}</span>${UNIT_LABEL[entry.unit]}</span>
      <div class="table-title" style="margin-top:8px;">${entry.title}</div>
      ${renderHierEntry(entry)}
    </div>
    ${topic ? `<button class="btn btn-ghost btn-block" style="margin-top:12px;" onclick="go('topicDetail',{topicId:'${topic.id}'})">${topic.title} 전체 정리 보러가기 →</button>` : ''}
  `;
}


/* ---------- 통계 ---------- */
function renderStats(){
  const prog = overallProgress();
  const today = todayStr();
  const c = oxCounts();
  const oxHist = (STATE.ox && STATE.ox.hist) || {};
  const oxToday = oxHist[today] || {done:0, correct:0};
  const oxAcc = oxToday.done ? Math.round(oxToday.correct/oxToday.done*100) : 0;
  const starred = OX_ITEMS.filter(it=>isOxStarred(it.id));
  const wrongOx = OX_ITEMS
    .map(it=>({it, r:(STATE.ox&&STATE.ox.rec&&STATE.ox.rec[it.id])||null}))
    .filter(x=>x.r && x.r.wrong>0)
    .sort((a,b)=>b.r.wrong-a.r.wrong);
  return `<div class="screen">
    <div class="hard-box stat-box">
      <div><div class="l">연속 학습</div><div class="v">${STATE.streak.count||0}일</div></div>
      <div><div class="l">전체 진도</div><div class="v">${prog.pct}%</div></div>
    </div>
    <div class="progress-bar" style="margin:0 0 18px;"><div style="width:${prog.pct}%"></div></div>

    <div class="section-title" style="margin-top:0;">오늘의 기출 OX</div>
    <div class="hard-box" style="padding:15px;">
      <div class="ox-stat-row" style="border-top:none; padding-top:0;">
        <div class="ox-stat"><b>${oxToday.done}</b><span>푼 문항</span></div>
        <div class="ox-stat"><b>${oxAcc}%</b><span>정답률</span></div>
        <div class="ox-stat"><b>${c.due}</b><span>복습 예정</span></div>
        <div class="ox-stat"><b>${c.seen}/${c.total}</b><span>학습한 선지</span></div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="go('oxSetup')">기출 OX 풀러 가기 →</button>
    </div>

    ${(function(){
      const pc = psCounts();
      const ph = (STATE.ps && STATE.ps.hist) || {};
      const pt = ph[today] || {done:0, correct:0};
      const pAcc = pt.done ? Math.round(pt.correct/pt.done*100) : 0;
      if(!pc.total) return '';
      return `<div class="section-title">오늘의 제시문</div>
      <div class="hard-box" style="padding:15px;">
        <div class="ox-stat-row" style="border-top:none; padding-top:0;">
          <div class="ox-stat"><b>${pt.done}</b><span>푼 제시문</span></div>
          <div class="ox-stat"><b>${pAcc}%</b><span>정답률</span></div>
          <div class="ox-stat"><b>${pc.due}</b><span>복습 예정</span></div>
          <div class="ox-stat"><b>${pc.seen}/${pc.total}</b><span>학습한 제시문</span></div>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="go('psSetup')">제시문 풀러 가기 →</button>
      </div>`;
    })()}

    <div class="section-title">단원별 진도</div>
    ${UNIT_ORDER.map(u=>{
      const topics = DATA.filter(t=>t.unit===u);
      let total=0, done=0;
      topics.forEach(t=>{ total+=topicLineCount(t); done+=topicCheckedCount(t); });
      const pct = total? Math.round(done/total*100):0;
      return `<div class="hard-box unit-card" onclick="go('topics')">
        <div class="unit-card-top">
          <span class="badge tag-${u}"><span class="seal-ch">${UNIT_ICON[u]}</span>${UNIT_LABEL[u]}</span>
          <span class="unit-card-pct">${pct}%</span>
        </div>
        <div class="progress-bar" style="margin-top:0;"><div style="width:${pct}%"></div></div>
      </div>`;
    }).join('')}

    <div class="section-title">★ 별표한 선지 (${starred.length})</div>
    ${starred.length===0 ? `<div class="note" style="padding:4px 2px 8px;">헷갈리는 선지에 ★를 눌러두면 여기 모여요.</div>` :
      `<button class="btn btn-gold btn-block" style="margin-bottom:10px;" onclick="studyStarred()">별표만 모아서 풀기 (${starred.length})</button>` +
      starred.slice(0,15).map(it=>`
      <div class="hard-box ox-review-item">
        <div class="ox-review-ans ${it.answer==='O'?'is-o':'is-x'}">${it.answer}</div>
        <div class="ox-review-text">${it.text}</div>
        <span class="ox-star on" onclick="toggleOxStar('${it.id}')">★</span>
      </div>`).join('')}

    <div class="section-title">자주 틀리는 선지 (${wrongOx.length})</div>
    ${wrongOx.length===0 ? `<div class="note" style="padding:4px 2px 8px;">아직 틀린 선지가 없어요.</div>` :
      `<button class="btn btn-block" style="margin-bottom:10px; border-color:var(--red); color:var(--red);" onclick="studyWrongOx()">틀린 것만 모아서 풀기 (${wrongOx.length})</button>` +
      wrongOx.slice(0,15).map(x=>`
      <div class="hard-box ox-review-item">
        <div class="ox-review-ans ${x.it.answer==='O'?'is-o':'is-x'}">${x.it.answer}</div>
        <div class="ox-review-text">${x.it.text}<div class="note" style="margin-top:3px;">${x.r.wrong}번 틀림</div></div>
        <span class="ox-star ${isOxStarred(x.it.id)?'on':''}" onclick="toggleOxStar('${x.it.id}')">★</span>
      </div>`).join('')}

    <div class="section-title">설정</div>
    <div class="hard-box" style="padding:14px;">
      <label class="ox-check" style="margin-bottom:0;"><input type="checkbox" ${!STATE.soundOff?'checked':''} onchange="toggleSound()"/> 효과음 켜기</label>
    </div>

    <div class="section-title">홈 화면에 추가</div>
    <div class="hard-box" style="padding:16px;">
      ${isStandalonePWA() ? `
        <div class="note">이미 홈 화면 앱으로 실행 중이에요.</div>
      ` : `
        <div class="note" style="margin-bottom:10px; line-height:1.7;">
          아이폰·아이패드: Safari 하단(또는 상단) <b style="color:var(--ink);">공유 버튼</b> → <b style="color:var(--ink);">"홈 화면에 추가"</b>를 누르면 아이콘이 생기고, 브라우저 주소창 없이 앱처럼 열려요.
        </div>
        <button id="pwaInstallBtn" class="btn btn-primary btn-block" style="display:none; padding:12px;" onclick="installPWA()">앱 설치하기</button>
      `}
    </div>

    <div class="section-title">학습 기록 백업</div>
    <div class="hard-box" style="padding:14px;">
      <div class="note" style="line-height:1.65; margin-bottom:12px;">
        학습 기록은 이 브라우저 안에만 저장돼요. 기기를 바꾸거나 방문 기록을 지우면 사라지니
        가끔 파일로 내보내 두면 안전해요.
        <div style="margin-top:8px; color:var(--ink);">현재 기록 — ${storeSummary(STATE)}</div>
      </div>
      <button class="btn btn-primary btn-block" style="padding:12px;" onclick="exportStore()">파일로 내보내기</button>
      <div style="height:8px;"></div>
      <button class="btn btn-block" style="padding:12px;" onclick="pickBackupFile('merge')">불러와서 합치기</button>
      <div style="height:8px;"></div>
      <button class="btn btn-block" style="padding:12px;" onclick="pickBackupFile('replace')">불러와서 덮어쓰기</button>
      <div class="note" style="margin-top:10px; line-height:1.6;">
        <b style="color:var(--ink);">합치기</b>는 지금 기록을 남긴 채 백업을 얹어요. 같은 항목은 백업 쪽이 이겨요.<br/>
        <b style="color:var(--ink);">덮어쓰기</b>는 지금 기록을 지우고 백업으로 바꿔요.
      </div>
    </div>

    <div class="section-title">데이터 관리</div>
    <button class="btn btn-block" style="border-color:var(--red); color:var(--red);" onclick="resetAllData()">학습 기록 전체 초기화</button>
  </div>`;
}
function studyStarred(){
  NAV.oxFilter = { topic:null, starred:true, wrongOnly:false, dueOnly:false, source:null, exam:null };
  startOxSession();
}
function studyTopicOx(topicId){
  NAV.oxFilter = { topic:topicId, starred:false, wrongOnly:false, dueOnly:false, source:null, exam:null };
  startOxSession();
}
function studyWrongOx(){
  NAV.oxFilter = { topic:null, starred:false, wrongOnly:true, dueOnly:false, source:null, exam:null };
  startOxSession();
}
function resetAllData(){
  if(!confirm('아래가 모두 사라져요. 되돌릴 수 없으니 필요하면 먼저 내보내 두세요.\n\n' +
              storeSummary(STATE) + '\n\n초기화할까요?')) return;
  if(!confirm('한 번 더 확인할게요. 정말 전부 지울까요?')) return;
  STATE = emptyStore();
  saveStore(); go('home');
}

/* ---------- 초기 렌더 ---------- */
document.addEventListener('DOMContentLoaded', ()=>{ if(NAV.view === 'home') advanceHeroKao(); render(); });
