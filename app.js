/* ===================================================================
   윤리와 사상 학습노트 — 앱 로직
   ※ 자료 추가 방법: 이 파일 위에 삽입되는 const DATA 배열에
     동일한 스키마({id,unit,order,title,subtitle,outline,deep?,table?})로
     새 항목을 추가하면 정리/빈칸학습/오늘의문제/비교표에 자동 반영됨.
     outline/deep 각 줄: {i: 들여쓰기(0~3), t: "텍스트 <r>빨강</r> <b>파랑</b>"}
     필기 표기: <o>동그라미</o> <s>그어 지움</s> <box>네모</box> — 색 안팎 어디에 써도 된다
   =================================================================== */

const STORE_KEY = 'ethnote_v1';
const UNIT_ORDER = ['유교','불교','도가','근대','서양','이데올로기'];
const UNIT_LABEL = {유교:'유교', 불교:'불교', 도가:'도가', 근대:'근대 한국 윤리', 서양:'서양 윤리', 이데올로기:'이데올로기'};
const UNIT_ICON = {유교:'儒', 불교:'佛', 도가:'道', 근대:'近', 서양:'西', 이데올로기:'政'};

let STATE = loadStore();
let NAV = { view:'home', topicId:null, detailShowDeep:false, detailShowTable:true,
            blankTopic:null, blankMode:null, blankIncludeDeep:true, blankIncludeTable:true, blankRevealAll:false,
            quiz:null, tableIdx:0, tableHideCol:null, tableQuizMode:false, tmq:null, tmScore:{c:0,t:0}, searchQ:'',
            paperTopic:null, paperRevealed:false, paperMode:'type', tablesMode:'genealogy', appendixId:null, shownHints:{},
            oxFilter:{ topic:null, topics:[], starred:false, wrongOnly:false, unseenOnly:false, dueOnly:true, source:null, exam:null },
            oxSession:null,
            psFilter:{ topic:null, topics:[], starred:false, wrongOnly:false, unseenOnly:false, dueOnly:true },
            psSession:null, psInput:'' };

/* ===================================================================
   기출 OX 선지 엔진 (STEP3)
   - 별표(북마크), 오답 자동 재출제(간격 반복), 필터
   - 진행 상태는 STATE.ox 에 저장
   =================================================================== */
function ensureOxState(){
  if(!STATE.ox) STATE.ox = { stars:{}, rec:{}, hist:{} };
  if(!STATE.ox.stars) STATE.ox.stars = {};
  if(!STATE.ox.rec) STATE.ox.rec = {};   // id -> {due, streak, wrong, seen}
  if(!STATE.ox.hist) STATE.ox.hist = {}; // 날짜 -> {done, correct}
  return STATE.ox;
}
function oxRec(id){
  const ox = ensureOxState();
  if(!ox.rec[id]) ox.rec[id] = { due:0, streak:0, wrong:0, seen:0 };
  return ox.rec[id];
}
function daysNow(){ return Math.floor(Date.now() / 86400000); }

// 연속 학습일 갱신 (오늘 처음 학습했을 때만)
function markDailyActivity(){
  const today = todayStr();
  if(STATE.streak.lastDate === today) return;
  const y = new Date(); y.setDate(y.getDate()-1);
  const yStr = y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');
  STATE.streak.count = (STATE.streak.lastDate === yStr) ? (STATE.streak.count+1) : 1;
  STATE.streak.lastDate = today;
  saveStore();
}

// 간격 반복: 틀리면 다음날, 맞히면 1→3→7→16일로 늘어남
const SRS_STEPS = [1, 3, 7, 16, 35];
function gradeOx(item, correct){
  const ox = ensureOxState();
  const r = oxRec(item.id);
  r.seen++;
  if(correct){
    r.streak = Math.min(r.streak + 1, SRS_STEPS.length - 1);
    r.due = daysNow() + SRS_STEPS[r.streak];
  } else {
    r.streak = 0;
    r.wrong++;
    r.due = daysNow() + 1;
  }
  const today = todayStr();
  if(!ox.hist[today]) ox.hist[today] = { done:0, correct:0 };
  ox.hist[today].done++;
  if(correct) ox.hist[today].correct++;
  markDailyActivity();
  saveStore();
}
function toggleOxStar(id){
  const ox = ensureOxState();
  ox.stars[id] = !ox.stars[id];
  saveStore();
  render();
}
function isOxStarred(id){ return !!(ensureOxState().stars[id]); }

// 원주제(필기)로 필터를 걸면 하위 세부 주제까지 함께 나오게 한다.
// 예: 정리 탭 '서양 현대 철학'의 기출 OX 버튼 -> 실용주의·실존주의 선지도 포함
const OX_TOPIC_CHILDREN = {
  'modern-western-philosophy': ['pragmatism','existentialism-theistic','existentialism-atheistic'],
};
function oxTopicMatches(it, topicId){
  const tags = it.topics || [];
  if(tags.includes(topicId)) return true;
  const kids = OX_TOPIC_CHILDREN[topicId];
  return !!(kids && kids.some(k=>tags.includes(k)));
}
// 필터 조건에 맞는 문항 목록
function oxPool(filter){
  const f = filter || {};
  const today = daysNow();
  return OX_ITEMS.filter(it=>{
    if(f.topics && f.topics.length){
      let hit = false;
      for(let i=0;i<f.topics.length;i++){ if(oxTopicMatches(it, f.topics[i])){ hit = true; break; } }
      if(!hit) return false;
    } else if(f.topic && !oxTopicMatches(it, f.topic)) return false;
    if(f.starred && !isOxStarred(it.id)) return false;
    if(f.unseenOnly){                       // 기출OX에서 한 번도 안 푼 것
      const r = STATE.ox && STATE.ox.rec && STATE.ox.rec[it.id];
      if(r && r.seen > 0) return false;
    }
    if(f.wrongOnly){
      const r = STATE.ox && STATE.ox.rec && STATE.ox.rec[it.id];
      if(!r || !r.wrong) return false;
    }
    if(f.dueOnly){
      const r = STATE.ox && STATE.ox.rec && STATE.ox.rec[it.id];
      if(r && r.seen > 0 && r.due > today) return false;
    }
    if(f.exam && (it.source || '') !== f.exam) return false;
    if(f.source){
      const s = it.source || '';
      if(f.source === '수능평가원'){
        if(!/수능|평|교/.test(s)) return false;
      } else if(f.source === 'EBS'){
        if(!/수완|수특/.test(s)) return false;
      }
    }
    return true;
  });
}
// 복습 우선순위: 오답많음 > 미학습 > 예정일 지난 것
// 배열 무작위 섞기 (Fisher-Yates)
function shuffleArr(arr){
  const a = arr.slice();
  for(let i=a.length-1; i>0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// 우선순위 그룹으로만 나누고, 그룹 안에서는 매번 무작위로 섞음
function oxSortForStudy(list){
  const today = daysNow();
  const dueGroup = [];   // 복습 예정일이 도래한 것 (가장 우선)
  const freshGroup = []; // 아직 안 풀어본 것
  const restGroup = [];  // 아직 복습할 때가 아닌 것
  list.forEach(it=>{
    const r = oxRec(it.id);
    if(r.seen === 0) freshGroup.push(it);
    else if(r.due <= today) dueGroup.push(it);
    else restGroup.push(it);
  });
  // 복습 예정은 많이 틀린 것부터, 동점끼리는 무작위
  const dueShuffled = shuffleArr(dueGroup).sort((a,b)=> oxRec(b.id).wrong - oxRec(a.id).wrong);
  return [...dueShuffled, ...shuffleArr(freshGroup), ...shuffleArr(restGroup)];
}
// ── 회차별 풀기 ───────────────────────────────────────────────
// 출처가 '2027 9평' 같은 평가원 회차인 선지를 모아 최근 3개 학년도만 보여 준다.
// 교육청(○교)과 EBS(수특·수완)는 회차로 치지 않는다.
const EXAM_KIND_ORDER = { '6평':0, '9평':1, '수능':2 };
function oxExamRounds(){
  const cnt = {};
  OX_ITEMS.forEach(it=>{
    const m = /^(\d{4}) (6평|9평|수능)$/.exec(it.source || '');
    if(m) cnt[it.source] = (cnt[it.source] || 0) + 1;
  });
  const rounds = Object.keys(cnt).map(src=>{
    const m = /^(\d{4}) (6평|9평|수능)$/.exec(src);
    return { src, year: +m[1], kind: m[2], count: cnt[src] };
  });
  const years = Array.from(new Set(rounds.map(r=>r.year))).sort((a,b)=>b-a).slice(0, 3);
  return rounds.filter(r=> years.includes(r.year))
               .sort((a,b)=> (b.year - a.year) || (EXAM_KIND_ORDER[a.kind] - EXAM_KIND_ORDER[b.kind]));
}
// 회차를 고른 경우: 시험지처럼 번호 순으로, 아직 안 푼 것부터 이어서 나온다.
function oxSortForExam(list){
  const seq = list.slice().sort((a,b)=>
    String(a.set||'').localeCompare(String(b.set||'')) || ((a.no||0) - (b.no||0)));
  return [...seq.filter(it=> oxRec(it.id).seen === 0),
          ...seq.filter(it=> oxRec(it.id).seen > 0)];
}
// 그 회차를 얼마나 풀었는지
function oxExamProgress(src){
  const list = OX_ITEMS.filter(it=> (it.source||'') === src);
  return { total: list.length, done: list.filter(it=> oxRec(it.id).seen > 0).length };
}
function oxCounts(){
  const today = daysNow();
  let seen=0, due=0, star=0, wrong=0;
  OX_ITEMS.forEach(it=>{
    const r = (STATE.ox && STATE.ox.rec && STATE.ox.rec[it.id]) || null;
    if(r && r.seen) seen++;
    if(!r || !r.seen || r.due <= today) due++;
    if(isOxStarred(it.id)) star++;
    if(r && r.wrong) wrong++;
  });
  return { total: OX_ITEMS.length, seen, due, star, wrong };
}
// OX 전용 세부 주제: 필기(DATA)는 '서양 현대 철학' 하나로 두고, 선지 필터만 잘게 나눈다.
// DATA에 없는 id이므로 여기서 표시 이름과 정렬 순서를 준다. (order는 원주제 29 뒤에 붙임)
const OX_TOPIC_EXTRA = {
  'pragmatism':               { title:'실용주의',        unit:'서양', order:29.1 },
  'existentialism-theistic':  { title:'실존주의(유신론)', unit:'서양', order:29.2 },
  'existentialism-atheistic': { title:'실존주의(무신론)', unit:'서양', order:29.3 },
};
function oxTopicsAvailable(){
  const set = new Set();
  OX_ITEMS.forEach(it=> (it.topics||[]).forEach(t=>set.add(t)));
  return Array.from(set).map(id=>{
    const topic = DATA.find(t=>t.id===id);
    const ex = OX_TOPIC_EXTRA[id];
    if(topic) return { id, title: topic.title, unit: topic.unit };
    if(ex)    return { id, title: ex.title, unit: ex.unit };
    return { id, title: id, unit: '' };
  }).sort((a,b)=>{
    const oa = DATA.find(t=>t.id===a.id), ob = DATA.find(t=>t.id===b.id);
    const va = oa ? oa.order : (OX_TOPIC_EXTRA[a.id] ? OX_TOPIC_EXTRA[a.id].order : 99);
    const vb = ob ? ob.order : (OX_TOPIC_EXTRA[b.id] ? OX_TOPIC_EXTRA[b.id].order : 99);
    return va - vb;
  });
}

/* ---------- 효과음 (Web Audio · 외부 파일 없이 생성) ---------- */
let AUDIO_CTX = null;
function audioCtx(){
  if(AUDIO_CTX) return AUDIO_CTX;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    AUDIO_CTX = new AC();
  }catch(e){ return null; }
  return AUDIO_CTX;
}
function playTone(freq, startAt, dur, vol, type){
  const ctx = audioCtx();
  if(!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + dur);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startAt);
  osc.stop(ctx.currentTime + startAt + dur + 0.02);
}
function playCorrectSound(){
  if(STATE.soundOff) return;
  const ctx = audioCtx();
  if(ctx && ctx.state === 'suspended') ctx.resume();
  // 도-미-솔 짧은 상행 (맑고 기분좋게)
  playTone(784.0, 0.00, 0.10, 0.14, 'sine');
  playTone(1046.5, 0.08, 0.16, 0.12, 'sine');
}
function playWrongSound(){
  if(STATE.soundOff) return;
  const ctx = audioCtx();
  if(ctx && ctx.state === 'suspended') ctx.resume();
  // 낮게 두 번 (툭툭, 거슬리지 않게)
  playTone(196.0, 0.00, 0.13, 0.11, 'triangle');
  playTone(155.6, 0.10, 0.18, 0.10, 'triangle');
}
function toggleSound(){
  STATE.soundOff = !STATE.soundOff;
  saveStore();
  render();
}

/* ===================================================================
   기출 제시문 학습 (단답형: 이 제시문은 누구?)
   =================================================================== */
function ensurePsState(){
  if(!STATE.ps) STATE.ps = { stars:{}, rec:{}, hist:{} };
  if(!STATE.ps.stars) STATE.ps.stars = {};
  if(!STATE.ps.rec) STATE.ps.rec = {};
  if(!STATE.ps.hist) STATE.ps.hist = {};
  return STATE.ps;
}
function psRec(id){
  const s = ensurePsState();
  if(!s.rec[id]) s.rec[id] = { due:0, streak:0, wrong:0, seen:0 };
  return s.rec[id];
}
function isPsStarred(id){ return !!(ensurePsState().stars[id]); }
function togglePsStar(id){
  const s = ensurePsState();
  s.stars[id] = !s.stars[id];
  saveStore();
  render();
}
// 채점: 공백/괄호/한자 무시하고 허용답안과 비교
function normalizeAnswer(s){
  return String(s || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[\s·,\.\-'"’‘“”]/g, '')
    .toLowerCase();
}
function checkPsAnswer(input, item){
  const v = normalizeAnswer(input);
  if(!v) return false;
  const pool = [item.name, ...(item.aliases||[])].map(normalizeAnswer).filter(Boolean);
  // 정확히 일치하거나, 허용답안이 입력에 포함(예: "순자 荀子")
  return pool.some(a => a === v || (a.length >= 2 && v.includes(a)));
}
function gradePs(item, correct){
  const s = ensurePsState();
  const r = psRec(item.id);
  r.seen++;
  if(correct){
    r.streak = Math.min(r.streak + 1, SRS_STEPS.length - 1);
    r.due = daysNow() + SRS_STEPS[r.streak];
  } else {
    r.streak = 0; r.wrong++; r.due = daysNow() + 1;
  }
  const today = todayStr();
  if(!s.hist[today]) s.hist[today] = { done:0, correct:0 };
  s.hist[today].done++;
  if(correct) s.hist[today].correct++;
  markDailyActivity();
  saveStore();
}
function psPool(filter){
  const f = filter || {};
  const today = daysNow();
  return PASSAGES.filter(p=>{
    if(f.topics && f.topics.length){
      if(f.topics.indexOf(p.topic) < 0) return false;
    } else if(f.topic && p.topic !== f.topic) return false;
    if(f.starred && !isPsStarred(p.id)) return false;
    if(f.unseenOnly){                       // 제시문 탭에서 한 번도 안 푼 것
      const r = STATE.ps && STATE.ps.rec && STATE.ps.rec[p.id];
      if(r && r.seen > 0) return false;
    }
    if(f.wrongOnly){
      const r = STATE.ps && STATE.ps.rec && STATE.ps.rec[p.id];
      if(!r || !r.wrong) return false;
    }
    if(f.dueOnly){
      const r = STATE.ps && STATE.ps.rec && STATE.ps.rec[p.id];
      if(r && r.seen > 0 && r.due > today) return false;
    }
    return true;
  });
}
function psSortForStudy(list){
  const today = daysNow();
  const due=[], fresh=[], rest=[];
  list.forEach(p=>{
    const r = psRec(p.id);
    if(r.seen === 0) fresh.push(p);
    else if(r.due <= today) due.push(p);
    else rest.push(p);
  });
  const dueSorted = shuffleArr(due).sort((a,b)=> psRec(b.id).wrong - psRec(a.id).wrong);
  return [...dueSorted, ...shuffleArr(fresh), ...shuffleArr(rest)];
}
function psCounts(){
  const today = daysNow();
  let seen=0, due=0, star=0, wrong=0;
  PASSAGES.forEach(p=>{
    const r = (STATE.ps && STATE.ps.rec && STATE.ps.rec[p.id]) || null;
    if(r && r.seen) seen++;
    if(!r || !r.seen || r.due <= today) due++;
    if(isPsStarred(p.id)) star++;
    if(r && r.wrong) wrong++;
  });
  return { total: PASSAGES.length, seen, due, star, wrong };
}
function psTopicsAvailable(){
  const set = new Set();
  PASSAGES.forEach(p=> set.add(p.topic));
  // 필기(DATA)에 없는 OX 전용 주제도 이름이 제대로 나오도록 OX_TOPIC_EXTRA를 함께 본다
  return Array.from(set).map(id=>{
    const t = DATA.find(x=>x.id===id);
    const ex = (typeof OX_TOPIC_EXTRA !== 'undefined') ? OX_TOPIC_EXTRA[id] : null;
    return { id, title: t ? t.title : (ex ? ex.title : id) };
  }).sort((a,b)=>{
    const oa = DATA.find(t=>t.id===a.id), ob = DATA.find(t=>t.id===b.id);
    const ea = (typeof OX_TOPIC_EXTRA !== 'undefined') ? OX_TOPIC_EXTRA[a.id] : null;
    const eb = (typeof OX_TOPIC_EXTRA !== 'undefined') ? OX_TOPIC_EXTRA[b.id] : null;
    const va = oa ? oa.order : (ea ? ea.order : 99);
    const vb = ob ? ob.order : (eb ? eb.order : 99);
    return va - vb;
  });
}
// 본문에서 단서 문구를 하이라이트
function highlightClues(text, clues){
  let out = escHtml(text);
  (clues||[]).forEach(c=>{
    const e = escHtml(c);
    if(out.includes(e)) out = out.split(e).join(`<mark class="ps-clue">${e}</mark>`);
  });
  return out;
}

/* ---------- 손글씨 (Apple Pencil) 상태 ---------- */
const PEN_COLORS = { ink:'#221F1A', red:'#9C2B26', blue:'#233A66' };
let HW = { canvas:null, ctx:null, dpr:1, drawing:false, color:'ink', allowTouch:false, strokes:[], currentStroke:null, showGuide:true };

/* ---------- PWA: 설치 프롬프트 (Android/데스크톱 Chrome 등) ---------- */
let PWA_DEFERRED_PROMPT = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  PWA_DEFERRED_PROMPT = e;
  const btn = document.getElementById('pwaInstallBtn');
  if(btn) btn.style.display = 'flex';
});
window.addEventListener('appinstalled', () => {
  PWA_DEFERRED_PROMPT = null;
  const btn = document.getElementById('pwaInstallBtn');
  if(btn) btn.style.display = 'none';
});
function installPWA(){
  if(!PWA_DEFERRED_PROMPT) return;
  PWA_DEFERRED_PROMPT.prompt();
  PWA_DEFERRED_PROMPT.userChoice.finally(()=>{ PWA_DEFERRED_PROMPT = null; });
}
function isStandalonePWA(){
  try{
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }catch(e){ return false; }
}

function pointerAllowed(e){
  if(e.pointerType === 'touch') return HW.allowTouch;
  return true; // pen, mouse 항상 허용
}
function getPos(e){
  const rect = HW.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const p = (typeof e.pressure === 'number' && e.pressure > 0) ? e.pressure : 0.5;
  return { x, y, p };
}
function strokeSegmentStyle(ctx, color){
  const isEraser = color === 'eraser';
  ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
  ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : PEN_COLORS[color];
  return isEraser;
}
function widthFor(isEraser, pressure){
  return isEraser ? 22 : 2.2 + pressure * 3.0;
}
function midpoint(a, b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

function drawStraightSegment(ctx, color, a, b){
  const isEraser = strokeSegmentStyle(ctx, color);
  ctx.lineWidth = widthFor(isEraser, b.p);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
// 2차 베지어 한 구간: midpoint(p0,p1) -> [제어점 p1] -> midpoint(p1,p2)
// 매 새 점마다 이 한 구간만 그리면 되므로 빠르고(O(1)), 각짐 없이 부드럽게 이어짐.
function drawQuadSegment(ctx, color, p0, p1, p2){
  const isEraser = strokeSegmentStyle(ctx, color);
  const start = midpoint(p0, p1);
  const end = midpoint(p1, p2);
  ctx.lineWidth = widthFor(isEraser, p1.p);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.quadraticCurveTo(p1.x, p1.y, end.x, end.y);
  ctx.stroke();
}
function drawDot(stroke){
  const ctx = HW.ctx;
  if(!ctx) return;
  const p = stroke.points[0];
  if(!p) return;
  const isEraser = strokeSegmentStyle(ctx, stroke.color);
  const r = widthFor(isEraser, p.p) / 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI*2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}
// 라이브 드로잉: 방금 추가된 새 점 하나에 대응하는 구간만 그림 (증분)
function drawLatestSegment(stroke){
  const ctx = HW.ctx;
  if(!ctx) return;
  const pts = stroke.points;
  const n = pts.length;
  if(n < 2) return;
  if(n === 2){ drawStraightSegment(ctx, stroke.color, pts[0], pts[1]); return; }
  drawQuadSegment(ctx, stroke.color, pts[n-3], pts[n-2], pts[n-1]);
}
// 저장된 점 데이터로부터 스트로크 전체를 처음부터 동일한 방식으로 재구성 (되돌리기/색변경/재진입 시)
function redrawStrokeFull(stroke){
  const ctx = HW.ctx;
  if(!ctx) return;
  const pts = stroke.points;
  if(pts.length === 0) return;
  if(pts.length === 1){ drawDot(stroke); return; }
  drawStraightSegment(ctx, stroke.color, pts[0], pts[1]);
  for(let i=2;i<pts.length;i++){
    drawQuadSegment(ctx, stroke.color, pts[i-2], pts[i-1], pts[i]);
  }
}
function redrawAllStrokes(){
  const ctx = HW.ctx;
  if(!ctx || !HW.canvas) return;
  ctx.clearRect(0, 0, HW.canvas.width, HW.canvas.height);
  HW.strokes.forEach(s=> redrawStrokeFull(s));
}
function onPointerDown(e){
  if(!pointerAllowed(e)) return;
  e.preventDefault();
  HW.drawing = true;
  HW.currentStroke = { color: HW.color, points: [getPos(e)] };
  try{ HW.canvas.setPointerCapture(e.pointerId); }catch(err){}
}
function onPointerMove(e){
  if(!HW.drawing || !pointerAllowed(e)) return;
  e.preventDefault();
  // getCoalescedEvents: Apple Pencil이 화면 갱신 사이 더 촘촘히 샘플링한 점들을 모두 반영 (끊김/각짐 방지)
  const events = (typeof e.getCoalescedEvents === 'function') ? (e.getCoalescedEvents() || []) : [];
  const list = events.length ? events : [e];
  list.forEach(ev=>{
    HW.currentStroke.points.push(getPos(ev));
    drawLatestSegment(HW.currentStroke);
  });
}
function onPointerUp(e){
  if(!HW.drawing) return;
  HW.drawing = false;
  if(HW.currentStroke && HW.currentStroke.points.length >= 1){
    if(HW.currentStroke.points.length === 1) drawDot(HW.currentStroke);
    HW.strokes.push(HW.currentStroke);
    saveStrokes();
  }
  HW.currentStroke = null;
}
function initCanvas(){
  const canvas = document.getElementById('hwCanvas');
  if(!canvas) return;
  const wrap = canvas.parentElement;
  const guideEl = wrap.querySelector('.canvas-guide');
  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = rect.width || wrap.clientWidth || 500;
  let cssHeight = 420;
  if(guideEl){
    const guideHeight = guideEl.scrollHeight || guideEl.offsetHeight || 0;
    cssHeight = Math.max(420, guideHeight + 28);
  }
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  if(!ctx) return;   // 캔버스 미지원 환경(테스트 등)에서 안전하게 종료
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  HW.canvas = canvas; HW.ctx = ctx; HW.dpr = dpr;
  redrawAllStrokes();
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
}
function loadStrokesForTopic(topicId){
  const saved = STATE.handwriting && STATE.handwriting[topicId];
  HW.strokes = saved ? JSON.parse(JSON.stringify(saved)) : [];
}
function saveStrokes(){
  if(!STATE.handwriting) STATE.handwriting = {};
  STATE.handwriting[NAV.paperTopic] = HW.strokes;
  saveStore();
}
function setPenColor(c){
  HW.color = c;
  render();
}
function undoStroke(){
  HW.strokes.pop();
  saveStrokes();
  render();
}
function clearCanvas(){
  if(!confirm('손글씨를 전부 지울까요?')) return;
  HW.strokes = [];
  saveStrokes();
  render();
}
function toggleAllowTouch(v){
  HW.allowTouch = v;
  render();
}
function toggleGuide(v){
  HW.showGuide = v;
  render();
}
function renderGuideOutline(list){
  if(!list || !list.length) return '';
  return '<ul class="outline">' + list.map(line=>{
    const html = renderLineHTML(line.t, null, '');
    return `<li><span class="txt i${line.i}">${html}</span></li>`;
  }).join('') + '</ul>';
}
function exportCanvasImage(){
  if(!HW.canvas) return;
  const url = HW.canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = (NAV.paperTopic || 'handwriting') + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function setPaperMode(m){
  NAV.paperMode = m;
  if(m === 'draw') loadStrokesForTopic(NAV.paperTopic);
  render();
}

// 빈 학습 기록의 기본 모양. 새로 만들 때도 초기화할 때도 이걸 쓴다.
function emptyStore(){
  return { checked:{}, bookmarks:{}, streak:{lastDate:null,count:0},
           quiz:{ wrong:[], history:{}, lastDate:null, lastSet:[], setNo:0, run:null },
           blankPaper:{}, handwriting:{},
           ox:{ rec:{}, stars:{} }, ps:{ rec:{}, stars:{} }, soundOff:false };
}
function loadStore(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw){
      const s = JSON.parse(raw);
      const base = emptyStore();
      Object.keys(base).forEach(k=>{ if(s[k] === undefined) s[k] = base[k]; });
      return s;
    }
  }catch(e){}
  return emptyStore();
}
/* ===================================================================
   모의고사 — 선지를 자동으로 조합해 5지선다를 만든다

   문항 유형 세 가지
     right : 제시문 1편 + 「입장으로 옳은 것은?」   정답 O선지 1 + 오답 X선지 4
     wrong : 제시문 1편 + 「옳지 않은 것은?」       정답 X선지 1 + 오답 O선지 4
     pair  : 갑·을 제시문 2편 + 선지마다 「갑:」「을:」「갑과 을:」 라벨
             정답 1(그 사람의 O선지) + 오답 4(각자의 X선지)

   지켜야 할 규칙은 하나다.
   **선지는 그 라벨이 가리키는 사상가 자신의 O/X로만 판정된다.**
   「갑:」 선지에는 갑의 선지만, 「을:」에는 을의 선지만 넣는다.
   라벨 없이 다른 사상가 선지를 섞으면 답이 둘이 되므로 절대 그렇게 하지 않는다.
   =================================================================== */

const MOCK_N = 20;
// 유형 비율. 남는 몫이 pair(갑·을 5지선다)
const MOCK_MIX = { right:0.28, wrong:0.20, box:0.16, venn:0.06, algo:0.06, trio:0.06 };

let MOCK_CACHE = null;

function mockNameList(){
  const seen = {};
  PASSAGES.forEach(p=>{ seen[p.name] = true; });
  return Object.keys(seen).sort((a,b)=>b.length - a.length);
}

// "칸트는 ~라고 본다." → { name:'칸트', body:'~라고 본다.' }
function mockSplit(text, names){
  for(let i=0;i<names.length;i++){
    const n = names[i];
    if(text.indexOf(n) !== 0) continue;
    let rest = text.slice(n.length);
    const m = rest.match(/^(은|는)\s*/);
    if(m) rest = rest.slice(m[0].length);
    else if(rest.indexOf('에 따르면') === 0) rest = rest.slice(5).replace(/^\s+/,'');
    else if(rest.indexOf('의 입장에서') === 0) rest = rest.slice(6).replace(/^\s+/,'');
    else return null;
    if(rest.length < 8) return null;
    for(let j=0;j<names.length;j++){
      if(names[j] !== n && rest.indexOf(names[j]) >= 0) return null;
    }
    return { name:n, body:rest };
  }
  return null;
}

// 「갑과 을」 선지: "A와 B는 모두 ~" → { a, b, body:'모두 ~' }
function mockSplitPair(text, names){
  for(let i=0;i<names.length;i++){
    const a = names[i];
    if(text.indexOf(a) !== 0) continue;
    let rest = text.slice(a.length);
    if(rest[0] !== '와' && rest[0] !== '과') return null;
    rest = rest.slice(1).replace(/^\s+/,'');
    for(let j=0;j<names.length;j++){
      const b = names[j];
      if(b === a || rest.indexOf(b) !== 0) continue;
      let r2 = rest.slice(b.length);
      const m = r2.match(/^(은|는)\s*/);
      if(!m) return null;
      r2 = r2.slice(m[0].length);
      if(r2.length < 8) return null;
      for(let k=0;k<names.length;k++){
        if(names[k] !== a && names[k] !== b && r2.indexOf(names[k]) >= 0) return null;
      }
      return { a:a, b:b, body:r2 };
    }
    return null;
  }
  return null;
}

function mockPairKey(a, b){ return (a < b) ? (a + '|' + b) : (b + '|' + a); }
function mockDiffKey(a, b){ return a + '>' + b; }

// 「A는 B와 달리 ~」 형태. O선지라면 A에게는 참, B에게는 거짓이라는 뜻이라
// 벤다이어그램의 「갑만의 입장」을 안전하게 만들 수 있는 유일한 재료다.
function mockSplitDiff(text, names){
  for(let i=0;i<names.length;i++){
    const a = names[i];
    if(text.indexOf(a) !== 0) continue;
    let rest = text.slice(a.length);
    const m = rest.match(/^(은|는)\s*/);
    if(!m) return null;
    rest = rest.slice(m[0].length);
    for(let j=0;j<names.length;j++){
      const b = names[j];
      if(b === a || rest.indexOf(b) !== 0) continue;
      const m2 = rest.slice(b.length).match(/^(와|과)\s*달리\s*/);
      if(!m2) return null;
      const body = rest.slice(b.length + m2[0].length);
      if(body.length < 8) return null;
      for(let k=0;k<names.length;k++){
        if(names[k] !== a && names[k] !== b && body.indexOf(names[k]) >= 0) return null;
      }
      return { a:a, b:b, body:body };
    }
    return null;
  }
  return null;
}

// 모의고사가 읽는 선지 = 기출 + 자체 제작 비교 선지.
// 자체 제작분은 기출 OX 탭(oxPool)에는 들어가지 않는다.
function mockSourceItems(){
  const cmp = (typeof CMP_ITEMS !== 'undefined' && CMP_ITEMS) ? CMP_ITEMS : [];
  return OX_ITEMS.concat(cmp);
}

function mockPool(){
  if(MOCK_CACHE) return MOCK_CACHE;
  const names = mockNameList();
  const byName = {}, pairs = {}, diffs = {};

  mockSourceItems().forEach(it=>{
    // psid·quote 는 자체 제작 선지가 근거로 삼은 원전(제시문). 채점 해설에서 보여 준다
    const base = { id:it.id, src:it.source||'', fix:it.fix||'', note:it.note||'', plain:it.plain||'',
                   psid:it.psid||'', quote:it.quote||'' };
    const sp = mockSplit(it.text, names);
    if(sp){
      const b = byName[sp.name] || (byName[sp.name] = {O:[], X:[], ps:[], units:{}, topics:{}});
      b[it.answer === 'X' ? 'X' : 'O'].push(Object.assign({body:sp.body}, base));
      return;
    }
    const pr = mockSplitPair(it.text, names);
    if(pr){
      const k = mockPairKey(pr.a, pr.b);
      const p = pairs[k] || (pairs[k] = {O:[], X:[]});
      const noAll = pr.body.replace(/^모두\s*/, '');
      p[it.answer === 'X' ? 'X' : 'O'].push(Object.assign({body:pr.body, plainBody:noAll}, base));
      return;
    }
    const df = mockSplitDiff(it.text, names);
    if(df && it.answer === 'O'){
      const k = mockDiffKey(df.a, df.b);
      (diffs[k] || (diffs[k] = [])).push(Object.assign({body:df.body}, base));
    }
  });

  // 같은 문장이 다른 회차에 또 나온 경우가 있어 본문 기준으로 한 번 걸러 낸다
  Object.keys(byName).forEach(n=>{
    ['O','X'].forEach(k=>{
      const seen = {}, out = [];
      byName[n][k].forEach(c=>{ if(seen[c.body]) return; seen[c.body]=1; out.push(c); });
      byName[n][k] = out;
    });
  });

  // 단원 표시. 갑·을은 같은 단원끼리 짝지어야 시험지 같다.
  const unitOfTopic = {};
  DATA.forEach(t=>{ unitOfTopic[t.id] = t.unit; });
  PASSAGES.forEach(p=>{
    const b = byName[p.name];
    if(!b) return;
    b.ps.push(p);
    b.topics[p.topic] = (b.topics[p.topic] || 0) + 1;
    const u = unitOfTopic[p.topic];
    if(u) b.units[u] = (b.units[u] || 0) + 1;
  });

  const solo = Object.keys(byName).filter(n=>{
    const b = byName[n];
    if(!b.ps.length) return false;
    return (b.O.length >= 1 && b.X.length >= 4) || (b.X.length >= 1 && b.O.length >= 4);
  }).sort();

  // 갑·을 문항에 쓸 수 있는 사람: 제시문 1편 + O 1개 + X 2개
  const pairable = Object.keys(byName).filter(n=>{
    const b = byName[n];
    return b.ps.length >= 1 && b.O.length >= 1 && b.X.length >= 2 && Object.keys(b.units).length > 0;
  }).sort();

  const unitMembers = {}, topicMembers = {};
  pairable.forEach(n=>{
    const b = byName[n];
    Object.keys(b.units).forEach(u=>{ (unitMembers[u] || (unitMembers[u] = [])).push(n); });
    Object.keys(b.topics).forEach(t=>{ (topicMembers[t] || (topicMembers[t] = [])).push(n); });
  });

  // 벤다이어그램을 만들 수 있는 쌍: 양쪽 「~와 달리」 O선지 + 「모두」 O선지가 다 있어야 한다
  const venn = [];
  Object.keys(pairs).forEach(k=>{
    const ab = k.split('|'), a = ab[0], b = ab[1];
    if(!pairs[k].O.length) return;
    if(!(diffs[mockDiffKey(a,b)] || []).length) return;
    if(!(diffs[mockDiffKey(b,a)] || []).length) return;
    if(pairable.indexOf(a) < 0 || pairable.indexOf(b) < 0) return;
    venn.push([a, b]);
  });

  MOCK_CACHE = { byName:byName, pairs:pairs, diffs:diffs, usable:solo, pairable:pairable,
                 unitMembers:unitMembers, topicMembers:topicMembers, venn:venn };
  return MOCK_CACHE;
}

function mockSeedStr(){ return todayStr() + '#' + (STATE.quiz.setNo || 0); }

function mockMainUnit(name){
  const b = mockPool().byName[name];
  let best = null, n = -1;
  Object.keys(b.units).forEach(u=>{ if(b.units[u] > n){ n = b.units[u]; best = u; } });
  return best;
}
function mockMainTopic(name){
  const b = mockPool().byName[name];
  let best = null, n = -1;
  Object.keys(b.topics).forEach(t=>{ if(b.topics[t] > n){ n = b.topics[t]; best = t; } });
  return best;
}

// 같은 날 · 같은 세트 번호면 언제 만들어도 같은 20문항이 나온다.
function buildMockSet(){
  const pool = mockPool();
  const rng = mulberry32(seedFromDate(mockSeedStr()));
  const order = shuffleSeeded(pool.usable, rng);
  const used = {};
  const qs = [];

  for(let i=0;i<order.length && qs.length < MOCK_N;i++){
    const n = order[i];
    if(used[n]) continue;
    const b = pool.byName[n];
    const canRight = b.O.length >= 1 && b.X.length >= 4;
    const canWrong = b.X.length >= 1 && b.O.length >= 4;

    let roll = rng(), acc = 0, type = 'pair';
    const order2 = ['right','wrong','box','venn','algo','trio'];
    for(let t=0;t<order2.length;t++){
      acc += MOCK_MIX[order2[t]];
      if(roll < acc){ type = order2[t]; break; }
    }

    // 벤다이어그램은 재료가 되는 쌍이 정해져 있다
    if(type === 'venn'){
      const cands = pool.venn.filter(p=> !used[p[0]] && !used[p[1]] && (p[0] === n || p[1] === n));
      const any = cands.length ? cands : pool.venn.filter(p=> !used[p[0]] && !used[p[1]]);
      if(any.length){
        const p = shuffleSeeded(any, rng)[0];
        const q = buildVennQ(p[0], p[1], mockMainUnit(p[0]), rng, null);
        if(q){ qs.push(q); used[p[0]] = 1; used[p[1]] = 1; continue; }
      }
      type = 'pair';
    }

    // 알고리즘(순서도) — 벤다이어그램과 같은 쌍에서만 만들 수 있다
    if(type === 'algo'){
      const cands = pool.venn.filter(p=> !used[p[0]] && !used[p[1]]);
      if(cands.length){
        const p = shuffleSeeded(cands, rng)[0];
        const q = buildAlgoQ(p[0], p[1], mockMainUnit(p[0]), rng, null);
        if(q){ qs.push(q); used[p[0]] = 1; used[p[1]] = 1; continue; }
      }
      type = 'pair';
    }

    // 갑·을·병
    if(type === 'trio'){
      const unit3 = mockMainUnit(n);
      const mates3 = (pool.unitMembers[unit3] || [])
        .filter(m=> m !== n && !used[m] && !mockSameSchool(n,m) && pool.byName[m].X.length >= 2);
      if(mates3.length >= 2 && pool.byName[n].X.length >= 2 && pool.byName[n].O.length >= 1){
        const pick2 = shuffleSeeded(mates3, rng).slice(0,2);
        const q = buildTrioQ(n, pick2[0], pick2[1], unit3, rng, null);
        if(q){ qs.push(q); used[n] = 1; used[pick2[0]] = 1; used[pick2[1]] = 1; continue; }
      }
      type = 'pair';
    }

    if(type === 'box' || type === 'pair'){
      const unit = mockMainUnit(n);
      const topic = mockMainTopic(n);
      // 같은 주제(평화 사상·국가의 역할…) 안에서 묶기도 하고,
      // 같은 단원 안이라면 주제가 달라도 묶는다. 스피노자와 스토아처럼 실제로 자주 붙는 조합이 있다.
      const near = (pool.topicMembers[topic] || []).filter(m=> m !== n && !used[m] && !mockSameSchool(n,m));
      const wide = (pool.unitMembers[unit] || []).filter(m=> m !== n && !used[m] && !mockSameSchool(n,m));
      const useNear = near.length && (rng() < 0.5 || !wide.length);
      const mates = useNear ? near : wide;
      const sharedTopic = useNear ? topic : null;
      if(mates.length && b.X.length >= 2 && b.O.length >= 1){
        const mate = shuffleSeeded(mates, rng)[0];
        let q = null;
        if(type === 'box') q = buildBoxQ(n, mate, unit, rng, sharedTopic);
        if(!q) q = buildPairQ(n, mate, unit, rng, sharedTopic);
        if(q){
          qs.push(q);
          used[n] = 1; used[mate] = 1;
          continue;
        }
      }
      type = canRight ? 'right' : 'wrong';   // 짝이 없으면 단독 문항으로
    }
    if(type === 'right' && !canRight) type = 'wrong';
    if(type === 'wrong' && !canWrong) type = 'right';

    const O = shuffleSeeded(b.O, rng);
    const X = shuffleSeeded(b.X, rng);
    const ansItem = (type === 'right') ? O[0] : X[0];
    const dist    = (type === 'right') ? X.slice(0,4) : O.slice(0,4);
    const ps = shuffleSeeded(b.ps, rng)[0];
    const choices = shuffleSeeded(dist.concat([ansItem]), rng);
    qs.push({ type:type, name:n, ps:ps, choices:choices, ans:choices.indexOf(ansItem) });
    used[n] = 1;
  }
  return qs;
}


/* ---------- 발문 만들기 ----------
   실제 시험지 발문을 그대로 흉내 낸다.
     「근대 서양 사상가 갑, 을의 입장으로 옳은 것은?」
     「다음을 주장한 고대 서양 사상가의 입장으로 옳은 것은?」
     「사회사상 (가), (나)의 입장으로 가장 적절한 것은?」   ← 이념끼리 붙을 때
*/
const MOCK_ERA = {
  confucius:'고대 동양', mencius:'고대 동양', xunzi:'고대 동양',
  laozi:'고대 동양', zhuangzi:'고대 동양',
  zhuxi:'중국 유교', yangming:'중국 유교',
  yiiyi:'한국 유교', jeongyakyong:'한국 유교', 'joseon-yangming':'한국 유교',
  buddha:'동양 불교', 'buddhism-development':'동양 불교', 'korean-buddhism':'한국 불교',
  'modern-korean-ethics':'근대 한국',
  sophists:'고대 서양', socrates:'고대 서양', plato:'고대 서양', aristotle:'고대 서양',
  stoicism:'고대 서양', epicureanism:'고대 서양',
  'medieval-christianity':'중세 서양',
  'modern-philosophy-rise':'근대 서양', bacon:'근대 서양', hume:'근대 서양',
  descartes:'근대 서양', spinoza:'근대 서양', kant:'근대 서양', utilitarianism:'근대 서양',
  'modern-western-philosophy':'현대 서양', pragmatism:'현대 서양',
  'existentialism-atheistic':'현대 서양', 'existentialism-theistic':'현대 서양'
};
const MOCK_UNIT_ERA = { 이데올로기:'사회', 서양:'서양', 유교:'동양', 불교:'동양 불교', 도가:'동양', 근대:'근대 한국' };
// 학파 이름과 그 학파에 속한 사람은 갑·을로 묶지 않는다 (대조가 성립하지 않음)
const MOCK_SAME_SCHOOL = [['스토아학파','아우렐리우스','에픽테토스','키케로','세네카']];
function mockSameSchool(a, b){
  for(let i=0;i<MOCK_SAME_SCHOOL.length;i++){
    const g = MOCK_SAME_SCHOOL[i];
    if(g.indexOf(a) >= 0 && g.indexOf(b) >= 0) return true;
  }
  return false;
}
// 사람이 아니라 사상(이념) 이름인 것들 — 발문에서 갑/을 대신 (가)/(나)를 쓴다
const MOCK_ISM = { '자유주의':1, '공화주의':1, '민주 사회주의':1, '규칙 공리주의':1 };

function mockEra(name){
  const t = mockMainTopic(name);
  return MOCK_ERA[t] || '사회';
}
// 발문 수식어는 '무엇을 근거로 둘을 묶었는가'로 정한다.
function mockEraPair(a, b, pairTopic, unit){
  if(pairTopic) return MOCK_ERA[pairTopic] || '사회';
  if(unit && MOCK_UNIT_ERA[unit]) return MOCK_UNIT_ERA[unit];
  const x = mockEra(a), y = mockEra(b);
  if(x.indexOf('불교') >= 0 && y.indexOf('불교') >= 0) return '동양 불교';
  const west = s => s.indexOf('서양') >= 0;
  const east = s => (s.indexOf('동양') >= 0 || s.indexOf('유교') >= 0 || s.indexOf('불교') >= 0 || s.indexOf('한국') >= 0);
  if(west(x) && west(y)) return '서양';
  if(east(x) && east(y)) return '동양';
  return '';
}
function mockIsIsm(name){ return !!MOCK_ISM[name]; }

// 갑·을 대조 문항. 실제 시험지처럼 ①② 갑 · ③④ 을 · ⑤ 갑과 을 순서로 배치한다.
function buildPairQ(a, b, unit, rng, pairTopic){
  const pool = mockPool();
  const A = pool.byName[a], B = pool.byName[b];
  const ism = mockIsIsm(a) && mockIsIsm(b);
  const L1 = ism ? '(가)' : '갑', L2 = ism ? '(나)' : '을', LB = ism ? '(가)와 (나)' : '갑과 을';

  const AO = shuffleSeeded(A.O, rng), AX = shuffleSeeded(A.X, rng);
  const BO = shuffleSeeded(B.O, rng), BX = shuffleSeeded(B.X, rng);
  const pr = pool.pairs[mockPairKey(a,b)] || {O:[], X:[]};
  const prO = shuffleSeeded(pr.O, rng), prX = shuffleSeeded(pr.X, rng);

  // 자리 구성은 시험지에 나오는 대로 몇 가지를 섞어 쓴다.
  // 갑 2 · 을 2 · 공통 1  /  갑 3 · 을 2  /  갑 2 · 을 3
  const hasBoth = (prO.length + prX.length) > 0;
  const plans = [];
  if(hasBoth) plans.push(['A','A','B','B','P']);
  plans.push(['A','A','A','B','B']);
  plans.push(['A','A','B','B','B']);
  const plan = plans[Math.floor(rng() * plans.length)];

  // 정답이 나올 자리를 고른다 (그 자리에 O선지, 나머지는 전부 X선지)
  const seats = plan.map((z,i)=>i).filter(i=> plan[i] !== 'P' || prO.length);
  const ans = seats[Math.floor(rng() * seats.length)];

  const mk = (o, label, who) => (o ? Object.assign({}, o, { label:label, who:who }) : null);
  const use = { A:0, B:0, P:0 };
  const slot = [];
  for(let i=0;i<5;i++){
    const z = plan[i], isAns = (i === ans);
    let src;
    if(z === 'A') src = isAns ? AO : AX;
    else if(z === 'B') src = isAns ? BO : BX;
    else src = isAns ? prO : prX;
    const k = z + (isAns ? 'T' : 'F');
    const idx = use[k] || 0; use[k] = idx + 1;
    const pick = src[idx];
    if(!pick) return null;
    slot.push(mk(pick, z === 'A' ? L1 : (z === 'B' ? L2 : LB), z === 'P' ? (a + '·' + b) : (z === 'A' ? a : b)));
  }

  const psA = shuffleSeeded(A.ps, rng)[0];
  const psB = shuffleSeeded(B.ps, rng)[0];
  return { type:'pair', a:a, b:b, unit:unit, pairTopic:pairTopic||null, ism:ism, psA:psA, psB:psB,
           L1:L1, L2:L2, choices:slot, ans:ans };
}

/* ---------- <보기> ㄱㄴㄷㄹ 유형 ----------
   실제 시험지처럼 선택지는 다섯 쌍으로 고정한다: ㄱㄴ · ㄱㄷ · ㄴㄷ · ㄴㄹ · ㄷㄹ
   (ㄱㄹ 조합은 시험에 안 나온다) 정답이 될 쌍을 먼저 고르고
   그 자리에 참인 진술을, 나머지 자리에 거짓인 진술을 넣는다.
*/
const MOCK_BOX_MARK = ['ㄱ','ㄴ','ㄷ','ㄹ'];
// 두 개짜리 여섯 · 세 개짜리 넷. 실제 시험도 ㄱㄴㄷ 같은 세 개짜리가 꽤 자주 나온다.
const MOCK_BOX_ALL = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3],[0,1,2],[0,1,3],[0,2,3],[1,2,3]];
const MOCK_KEY = a => a.join(',');
// 정답 조합을 하나 고르고, 그것을 포함해 다섯 개를 시험지 순서대로 배열한다
function mockOptSet(rng){
  const three = rng() < 0.4;
  const pick = three ? MOCK_BOX_ALL.slice(6) : MOCK_BOX_ALL.slice(0,6);
  const ansC = pick[Math.floor(rng() * pick.length)];
  const others = shuffleSeeded(MOCK_BOX_ALL.filter(c=> MOCK_KEY(c) !== MOCK_KEY(ansC)), rng).slice(0,4);
  const opts = MOCK_BOX_ALL.filter(c=> MOCK_KEY(c) === MOCK_KEY(ansC) || others.some(o=> MOCK_KEY(o) === MOCK_KEY(c)));
  return { idx:ansC, opts:opts, ans:opts.findIndex(c=> MOCK_KEY(c) === MOCK_KEY(ansC)) };
}

function buildBoxQ(a, b, unit, rng, pairTopic){
  const pool = mockPool();
  const A = pool.byName[a], B = pool.byName[b];
  const ism = mockIsIsm(a) && mockIsIsm(b);
  const L1 = ism ? '(가)' : '갑', L2 = ism ? '(나)' : '을', LB = ism ? '(가)와 (나)' : '갑과 을';

  const AO = shuffleSeeded(A.O, rng), AX = shuffleSeeded(A.X, rng);
  const BO = shuffleSeeded(B.O, rng), BX = shuffleSeeded(B.X, rng);
  const pr = pool.pairs[mockPairKey(a,b)] || {O:[], X:[]};

  // 자리별 라벨 — 갑 둘, 을 하나, 마지막은 「갑과 을」이 있으면 그것으로
  const useBoth = (pr.O.length && pr.X.length) && rng() < 0.6;
  const labels = [L1, L1, L2, useBoth ? LB : L2];

  const set = mockOptSet(rng);
  const ansOpt = set.idx, opts = set.opts;
  const takeT = { 0:0, 1:0, 2:0, 3:0 };
  const items = [];
  for(let i=0;i<4;i++){
    const isTrue = ansOpt.indexOf(i) >= 0;
    let src;
    if(labels[i] === LB) src = isTrue ? pr.O : pr.X;
    else if(labels[i] === L1) src = isTrue ? AO : AX;
    else src = isTrue ? BO : BX;
    const used = takeT[labels[i] + (isTrue?'T':'F')] || 0;
    takeT[labels[i] + (isTrue?'T':'F')] = used + 1;
    const pick = src[used];
    if(!pick) return null;                     // 재료가 모자라면 이 유형은 포기
    items.push(Object.assign({}, pick, { label:labels[i], mark:MOCK_BOX_MARK[i], ok:isTrue }));
  }
  const psA = shuffleSeeded(A.ps, rng)[0];
  const psB = shuffleSeeded(B.ps, rng)[0];
  return { type:'box', a:a, b:b, unit:unit, pairTopic:pairTopic||null, ism:ism,
           L1:L1, L2:L2, psA:psA, psB:psB, items:items,
           opts:opts, ans:set.ans };
}

/* ---------- 벤다이어그램 유형 ----------
   A = 갑만의 입장 · B = 갑과 을의 공통 입장 · C = 을만의 입장
   재료는 셋뿐이고 전부 안전하다.
     「갑은 을과 달리 P」(O)  → A영역은 P가 참, C영역에 넣으면 거짓
     「을은 갑과 달리 Q」(O)  → C영역은 Q가 참, A영역에 넣으면 거짓
     「갑과 을은 모두 R」(O)  → B영역은 R이 참, X선지면 거짓
*/
function buildVennQ(a, b, unit, rng, pairTopic){
  const pool = mockPool();
  const A = pool.byName[a], B = pool.byName[b];
  const dAB = shuffleSeeded(pool.diffs[mockDiffKey(a,b)] || [], rng);
  const dBA = shuffleSeeded(pool.diffs[mockDiffKey(b,a)] || [], rng);
  const pr = pool.pairs[mockPairKey(a,b)] || {O:[], X:[]};
  const prO = shuffleSeeded(pr.O, rng), prX = shuffleSeeded(pr.X, rng);
  if(!dAB.length || !dBA.length || !prO.length) return null;

  const set = mockOptSet(rng);
  const ansOpt = set.idx, opts = set.opts;
  const zones = ['A','B','B','C'];              // ㄱ:A  ㄴ,ㄷ:B  ㄹ:C
  const cnt = {};
  const items = [];
  const seenBody = {};
  // 「모두」선지는 B영역에 들어갈 때 머리의 「모두」를 뗀다. 중복 검사는 그렇게
  // 떼고 난 뒤, 실제로 시험지에 찍히는 문장으로 해야 한다. 떼기 전 문장으로 비교하면
  // 「갑은 을과 달리 P」와 「갑과 을은 모두 P」가 같은 보기에 나란히 들어간다
  const bodyOf = (x) => x.plainBody || x.body;
  const take = (list, key) => {                 // 같은 문장이 두 번 나오지 않게
    let i = cnt[key] || 0;
    while(list[i] && seenBody[bodyOf(list[i])]) i++;
    cnt[key] = i + 1;
    return list[i] || null;
  };
  for(let i=0;i<4;i++){
    const isTrue = ansOpt.indexOf(i) >= 0;
    const z = zones[i];
    let pick = null;
    if(z === 'A') pick = isTrue ? take(dAB,'AB') : take(dBA,'BA');   // 을만의 입장을 A에 넣으면 거짓
    else if(z === 'C') pick = isTrue ? take(dBA,'BA') : take(dAB,'AB');
    else {
      const src = isTrue ? prO : prX;
      pick = take(src, 'B' + (isTrue ? 'T' : 'F'));
      if(!pick && !isTrue){                                  // 「모두」 X선지가 없으면
        pick = take(shuffleSeeded(A.X, rng), 'AX');          // 갑이 부정하는 문장 → 공통일 수 없다
      }
      if(pick) pick = Object.assign({}, pick, { body: bodyOf(pick) });
    }
    if(!pick) return null;
    seenBody[pick.body] = 1;
    items.push(Object.assign({}, pick, { zone:z, mark:MOCK_BOX_MARK[i], ok:isTrue }));
  }
  const psA = shuffleSeeded(A.ps, rng)[0];
  const psB = shuffleSeeded(B.ps, rng)[0];
  return { type:'venn', a:a, b:b, unit:unit, pairTopic:pairTopic||null,
           psA:psA, psB:psB, items:items, opts:opts, ans:set.ans };
}


/* ---------- 알고리즘(순서도) 유형 ----------
   그림 구조
     [갑, 을의 입장을 탐구한다] → A ─예→ B ─예→ [갑의 입장]
                                  └아니요→ C ─예→ [을의 입장]
   그러므로 각 자리에 들어갈 질문의 조건은 이렇다.
     A : 갑은 「예」, 을은 「아니요」  →  「갑은 을과 달리 P」(O) 만이 안전한 재료
     B : 갑이 「예」                   →  갑의 O선지
     C : 을이 「예」                   →  을의 O선지
   거짓 보기는 각 자리에 그 사람이 「아니요」할 문장(X선지)을 넣거나,
   A 자리에 「을만의 입장」을 넣으면 된다.
*/
const MOCK_Q_RULES = [
  ['고 본다.', '고 보는가?'], ['라고 본다.', '라고 보는가?'], ['로 본다.', '로 보는가?'],
  ['고 보았다.', '고 보았는가?'], ['라고 보았다.', '라고 보았는가?'],
  ['것이다.', '것인가?'], ['않는다.', '않는가?'],
  ['있다.', '있는가?'], ['없다.', '없는가?'], ['한다.', '하는가?'], ['하였다.', '하였는가?'],
  ['된다.', '되는가?'], ['이다.', '인가?']
];
// 평서문을 질문형으로. 규칙에 안 맞으면 그 문장은 쓰지 않는다.
// 「~아니다.」는 넣지 않는다. 「~아닌가?」가 되면 순서도에서 예/아니요를 고를 때
// 부정이 겹쳐 읽기 어렵다. 그런 문장은 순서도 재료에서 그냥 빠진다.
function mockToQuestion(body){
  const t = body.trim();
  for(let i=0;i<MOCK_Q_RULES.length;i++){
    const from = MOCK_Q_RULES[i][0], to = MOCK_Q_RULES[i][1];
    if(t.length > from.length && t.slice(-from.length) === from){
      return t.slice(0, t.length - from.length) + to;
    }
  }
  return null;
}
function mockPickQ(list, used){
  for(let i=0;i<list.length;i++){
    const it = list[i];
    if(used[it.body]) continue;
    // 「…라는 질문에 긍정의 대답을 할 것이다」류는 질문형으로 바꾸면 이중 질문이 된다
    if(it.body.indexOf('대답') >= 0 || it.body.indexOf('질문') >= 0) continue;
    const q = mockToQuestion(it.body);
    if(!q) continue;
    used[it.body] = 1;
    return Object.assign({}, it, { body:q });
  }
  return null;
}

function buildAlgoQ(a, b, unit, rng, pairTopic){
  const pool = mockPool();
  const A = pool.byName[a], B = pool.byName[b];
  const dAB = shuffleSeeded(pool.diffs[mockDiffKey(a,b)] || [], rng);
  const dBA = shuffleSeeded(pool.diffs[mockDiffKey(b,a)] || [], rng);
  if(!dAB.length) return null;
  const AO = shuffleSeeded(A.O, rng), AX = shuffleSeeded(A.X, rng);
  const BO = shuffleSeeded(B.O, rng), BX = shuffleSeeded(B.X, rng);

  const set = mockOptSet(rng);
  const idx = set.idx;
  const zones = ['A','B','B','C'];
  const used = {};
  const items = [];
  for(let i=0;i<4;i++){
    const isTrue = idx.indexOf(i) >= 0;
    const z = zones[i];
    let src;
    if(z === 'A') src = isTrue ? dAB : (dBA.length ? dBA : AX);
    else if(z === 'B') src = isTrue ? AO : AX;
    else src = isTrue ? BO : BX;
    const pick = mockPickQ(src, used);
    if(!pick) return null;
    items.push(Object.assign({}, pick, { zone:z, mark:MOCK_BOX_MARK[i], ok:isTrue }));
  }

  const psA = shuffleSeeded(A.ps, rng)[0];
  const psB = shuffleSeeded(B.ps, rng)[0];
  return { type:'algo', a:a, b:b, unit:unit, pairTopic:pairTopic||null,
           psA:psA, psB:psB, items:items, opts:set.opts, ans:set.ans };
}

/* ---------- 갑·을·병 세 명 비교 ---------- */
function buildTrioQ(a, b, c, unit, rng, pairTopic){
  const pool = mockPool();
  const L = ['갑','을','병'], who = [a,b,c];
  const boxes = who.map(n=>pool.byName[n]);
  const ansIdx = Math.floor(rng() * 3);
  const ansItem = Object.assign({}, shuffleSeeded(boxes[ansIdx].O, rng)[0],
                                { label:L[ansIdx], who:who[ansIdx] });
  const XS = boxes.map(b=>shuffleSeeded(b.X, rng));   // 한 번만 섞어 두고 재사용해야 같은 문장이 두 번 안 나온다
  const dist = [];
  for(let i=0;i<3;i++){
    dist.push(Object.assign({}, XS[i][0], { label:L[i], who:who[i] }));
  }
  const j = (ansIdx + 1) % 3;
  const extra = XS[j][1];
  if(!extra) return null;
  dist.push(Object.assign({}, extra, { label:L[j], who:who[j] }));
  const ps = who.map(n=>shuffleSeeded(pool.byName[n].ps, rng)[0]);
  // 선지는 갑 → 을 → 병 순서로 늘어놓는다 (시험지와 같게)
  const rank = { '갑':0, '을':1, '병':2 };
  const choices = shuffleSeeded(dist.concat([ansItem]), rng)
    .sort((x,y)=> rank[x.label] - rank[y.label]);
  return { type:'trio', who:who, unit:unit, pairTopic:pairTopic||null,
           psList:ps, choices:choices, ans:choices.indexOf(ansItem) };
}

/* ---------- 응시 상태 ---------- */
function ensureMockRun(){
  const q = STATE.quiz;
  const today = todayStr();
  const setNo = q.setNo || 0;
  if(!q.run || q.run.date !== today || q.run.setNo !== setNo){
    q.run = { date:today, setNo:setNo, picks:[], submitted:false, score:0 };
  }
  mockRunDefaults(q.run);
  return q.run;
}
// 예전 기록에는 시간·찍음·OMR 필드가 없다
function mockRunDefaults(run){
  // OMR 답안 — 채점은 이것으로 한다. 이미 채점된 옛 기록은 picks 로 채점됐으므로 만들지 않는다
  if(!run.omr && !run.submitted) run.omr = [];
  if(!run.guess) run.guess = [];      // 문항별 「찍음」 표시
  if(!run.per) run.per = [];          // 문항별 쓴 시간(ms)
  if(typeof run.ms !== 'number') run.ms = 0;      // 시험지를 펴 놓은 총 시간(ms)
  if(typeof run.mark !== 'number') run.mark = 0;  // 마지막으로 답을 고른 시점(ms)
  if(!run.starred) run.starred = [];  // 채점할 때 자동으로 별표한 선지 id
  return run;
}
// 시험지 표시(연필) 개수
function mockAnsweredCount(){
  const run = ensureMockRun();
  let n = 0;
  for(let i=0;i<MOCK_N;i++){ if(run.picks[i] !== undefined && run.picks[i] !== null) n++; }
  return n;
}
// 채점에 쓰는 답 — OMR. OMR이 없던 옛 기록은 시험지 표시로 채점됐다
function mockAns(run, i){
  const v = run.omr ? run.omr[i] : run.picks[i];
  return (v === undefined) ? null : v;
}
function mockOmrCount(run){
  let n = 0;
  for(let i=0;i<MOCK_N;i++){ if(mockAns(run, i) !== null) n++; }
  return n;
}
// 시험지에 표시한 답과 OMR이 다른 문항 (OMR을 비워 둔 것 포함)
function mockMismatch(run){
  if(!run.omr) return [];
  const out = [];
  for(let i=0;i<MOCK_N;i++){
    const p = run.picks[i], o = run.omr[i];
    const hasP = (p !== undefined && p !== null), hasO = (o !== undefined && o !== null);
    if(hasP && p !== (hasO ? o : null)) out.push(i);
  }
  return out;
}

/* ---------- 시험 시간 ----------
   시험지 화면이 앞에 떠 있는 동안만 시간이 간다.
   다른 탭으로 가거나 앱을 내리면 멈춘다.

   문항별 시간은 「답을 고른 순간」 기준으로 나눈다.
     직전에 답을 고른 뒤부터 이번 문항에 답을 고를 때까지 = 이번 문항에 쓴 시간
   답을 바꾸러 돌아가면 그 사이 시간은 바꾼 문항에 더해진다.
   마지막으로 답을 고른 뒤부터 제출까지는 「검토」로 따로 센다.
*/
const MOCK_LIMIT_MS = 30 * 60 * 1000;          // 제한 시간 30분 (실제 시험과 같게)
const MOCK_WARN_MS = [5 * 60 * 1000, 60 * 1000];  // 남은 시간 5분 · 1분에 알림
let MOCK_CLOCK = { on:false, since:0, timer:null, beat:0 };
function mockNow(){ return Date.now(); }
function mockLiveMs(run){
  return (run.ms || 0) + (MOCK_CLOCK.on ? mockNow() - MOCK_CLOCK.since : 0);
}
function mockClockCommit(run){
  if(!MOCK_CLOCK.on || !run) return;
  const t = mockNow();
  run.ms = (run.ms || 0) + (t - MOCK_CLOCK.since);
  MOCK_CLOCK.since = t;
}
function mockClockStart(){
  if(MOCK_CLOCK.on) return;
  MOCK_CLOCK.on = true;
  MOCK_CLOCK.since = mockNow();
  MOCK_CLOCK.beat = 0;
  if(typeof setInterval === 'function'){
    MOCK_CLOCK.timer = setInterval(mockClockTick, 1000);
  }
}
function mockClockStop(){
  if(!MOCK_CLOCK.on) return;
  mockClockCommit(STATE.quiz.run);
  MOCK_CLOCK.on = false;
  if(MOCK_CLOCK.timer){ clearInterval(MOCK_CLOCK.timer); MOCK_CLOCK.timer = null; }
  saveStore();
}
// 1초마다 화면 시계를 고치고, 5초마다 기록에 옮겨 둔다(앱이 갑자기 꺼져도 5초 이상 잃지 않게)
function mockClockTick(){
  const run = STATE.quiz.run;
  if(!run){ mockClockStop(); return; }
  MOCK_CLOCK.beat++;
  if(MOCK_CLOCK.beat % 5 === 0){ mockClockCommit(run); saveStore(); }
  const live = mockLiveMs(run);
  if(live >= MOCK_LIMIT_MS){ mockTimeUp(); return; }
  mockWarnCheck(run, live);
  if(typeof document !== 'undefined') mockPaintClock(live);
}
function mockLeftMs(ms){ return Math.max(0, MOCK_LIMIT_MS - (ms || 0)); }
function mockPaintClock(live){
  const left = mockLeftMs(live);
  const txt = mockFmtClock(left);
  const low = left <= MOCK_WARN_MS[0];
  ['mockClock','omrClock'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = txt;
    el.classList.toggle('low', low);
  });
}
// 남은 시간 알림 — 한 번씩만
function mockWarnCheck(run, live){
  if(!run.warned) run.warned = [];
  const left = mockLeftMs(live);
  MOCK_WARN_MS.forEach((w, k)=>{
    if(left <= w && !run.warned[k]){
      run.warned[k] = 1;
      const miss = MOCK_N - mockOmrCount(run);
      mockToast((w >= 60000 ? Math.round(w/60000) + '분' : '1분') + ' 남았어요' +
                (miss ? ' · OMR ' + miss + '문항이 비어 있어요' : ''));
      if(typeof document !== 'undefined'){
        const tab = document.getElementById('omrTab');
        if(tab){ tab.classList.remove('nudge'); void tab.offsetWidth; tab.classList.add('nudge'); }
      }
    }
  });
}
function mockToast(msg){
  if(typeof document === 'undefined') return;
  let el = document.getElementById('mockToast');
  if(!el){
    el = document.createElement('div');
    el.id = 'mockToast';
    el.className = 'mock-toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.classList.remove('show'), 4000);
}
// 시간이 끝나면 그때까지의 OMR로 바로 채점한다
function mockTimeUp(){
  const run = STATE.quiz.run;
  if(!run || run.submitted) return;
  mockClockCommit(run);
  run.ms = Math.min(run.ms, MOCK_LIMIT_MS);
  run.timeUp = true;
  submitMock(true);
  mockToast('시험 시간이 끝나 OMR 답안으로 채점했어요');
}
// 화면이 바뀔 때마다 부른다
function mockClockSync(){
  const run = STATE.quiz.run;
  const hidden = (typeof document !== 'undefined' && document.visibilityState === 'hidden');
  const want = NAV.view === 'mockExam' && run && !run.submitted && run.date === todayStr() && !hidden;
  if(want && (run.ms || 0) >= MOCK_LIMIT_MS){
    // 이미 시간을 다 쓴 시험지를 다시 연 경우 — 그리는 도중이라 한 박자 늦춰 채점한다
    setTimeout(mockTimeUp, 0);
    return;
  }
  if(want) mockClockStart(); else mockClockStop();
}
if(typeof document !== 'undefined'){
  document.addEventListener('visibilitychange', ()=>{ try{ mockClockSync(); }catch(e){} });
  window.addEventListener('pagehide', ()=>{ try{ mockClockStop(); }catch(e){} });
}
function mockFmtClock(ms){
  const s = Math.floor((ms || 0) / 1000);
  const m = Math.floor(s / 60);
  return (m < 10 ? '0' : '') + m + ':' + String(s % 60).padStart(2, '0');
}
function mockFmtDur(ms){
  const s = Math.round((ms || 0) / 1000);
  if(s < 60) return s + '초';
  const m = Math.floor(s / 60), r = s % 60;
  return r ? (m + '분 ' + r + '초') : (m + '분');
}

function pickMock(i, ci){
  const run = ensureMockRun();
  if(run.submitted) return;
  mockClockCommit(run);
  const t = run.ms;
  run.per[i] = (run.per[i] || 0) + Math.max(0, t - (run.mark || 0));
  run.mark = t;
  run.picks[i] = (run.picks[i] === ci) ? null : ci;
  saveStore();
  render();
}
// OMR 마킹 — 채점은 이 답으로 한다.
// 패널이 스크롤된 채로 남아 있게, 화면 전체를 다시 그리지 않고 그 줄만 고친다.
function markOmr(i, ci){
  const run = ensureMockRun();
  if(run.submitted || !run.omr) return;
  run.omr[i] = (run.omr[i] === ci) ? null : ci;
  NAV.mockSubmitArm = false;
  saveStore();
  if(typeof document === 'undefined'){ return; }
  const row = document.getElementById('omr-' + i);
  if(!row){ render(); return; }
  row.querySelectorAll('.omr-b').forEach((b, k)=>{
    const on = run.omr[i] === k;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
  });
  const n = mockOmrCount(run);
  document.querySelectorAll('[data-omr-count]').forEach(el=>{ el.textContent = n; });
  const arm = document.getElementById('mockSubmitNote');
  if(arm) arm.textContent = mockSubmitNote(run);
}
function toggleOmr(open){
  NAV.omrOpen = (open === undefined) ? !NAV.omrOpen : !!open;
  if(typeof document === 'undefined') return;
  const panel = document.getElementById('omrPanel');
  const tab = document.getElementById('omrTab');
  if(panel){
    panel.classList.toggle('open', NAV.omrOpen);
    panel.setAttribute('aria-hidden', !NAV.omrOpen);
  }
  if(tab){
    tab.setAttribute('aria-expanded', NAV.omrOpen);
    tab.classList.remove('nudge');
  }
}
// OMR 번호를 누르면 그 문항으로 간다
function jumpMockQ(i){
  const el = document.getElementById('mockq-' + i);
  if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
}
function mockSubmitNote(run){
  const miss = MOCK_N - mockOmrCount(run);
  return miss ? ('OMR ' + miss + '문항이 비어 있어요. 채점은 OMR로 합니다') : 'OMR에 마킹한 답으로 채점합니다';
}

function toggleMockGuess(i){
  const run = ensureMockRun();
  if(run.submitted) return;
  run.guess[i] = !run.guess[i];
  saveStore();
  render();
}

/* ---------- 자동 별표 ----------
   채점할 때 아래 선지를 기출OX 별표에 넣는다.
     틀린 5지선다   → 내가 고른 선지 + 정답 선지
     틀린 보기형    → 내 조합과 정답 조합이 갈린 보기 (내가 잘못 판단한 것만)
     찍은 문항      → 그 문항의 선지(보기) 전부 — 맞혔어도
     고르지 않은 문항 → 찍은 것과 같이 본다
*/
const MOCK_BOX_TYPES = { box:1, venn:1, algo:1 };
function mockStarIds(set, run){
  const ids = [];
  const add = id => { if(id && ids.indexOf(id) < 0) ids.push(id); };
  set.forEach((q,i)=>{
    const picked = mockAns(run, i);
    const blank = (picked === null);
    const guessed = !!(run.guess && run.guess[i]) || blank;
    const boxType = !!MOCK_BOX_TYPES[q.type];
    if(guessed){
      (boxType ? q.items : q.choices).forEach(c=> add(c.id));
      return;
    }
    if(picked === q.ans) return;
    if(boxType){
      const mine = q.opts[picked], right = q.opts[q.ans];
      q.items.forEach((it, k)=>{
        if((mine.indexOf(k) >= 0) !== (right.indexOf(k) >= 0)) add(it.id);
      });
    } else {
      add(q.choices[picked].id);
      add(q.choices[q.ans].id);
    }
  });
  return ids;
}
function mockHistKey(run){ return run.setNo ? (run.date + '#' + run.setNo) : run.date; }

// force: 시간 종료처럼 묻지 않고 바로 채점
// 확인 창은 홈 화면 앱에서 막히므로 쓰지 않는다. OMR이 비어 있으면 버튼을 한 번 더 누르게 한다.
function submitMock(force){
  const run = ensureMockRun();
  if(run.submitted){ go('mockResult'); return; }
  const set = buildMockSet();
  const blank = set.length - mockOmrCount(run);
  if(!force && blank > 0 && !NAV.mockSubmitArm){
    NAV.mockSubmitArm = true;
    render();
    return;
  }
  NAV.mockSubmitArm = false;
  mockClockCommit(run);
  mockClockStop();
  let score = 0;
  set.forEach((q,i)=>{ if(mockAns(run, i) === q.ans) score++; });
  run.submitted = true;
  run.score = score;
  run.review = Math.max(0, run.ms - (run.mark || 0));

  // 자동 별표 — 이미 별표였던 것은 건드리지 않고, 새로 붙인 것만 기록해 둔다
  const ox = ensureOxState();
  run.starred = mockStarIds(set, run).filter(id=>{
    if(ox.stars[id]) return false;
    ox.stars[id] = true;
    return true;
  });

  STATE.quiz.history = STATE.quiz.history || {};
  STATE.quiz.history[mockHistKey(run)] = {
    score:score, total:set.length, setNo:run.setNo,
    sec:Math.round(run.ms / 1000),
    per:set.map((q,i)=> Math.round((run.per[i] || 0) / 1000)),
    guess:set.map((q,i)=> run.guess[i] ? 1 : 0).reduce((a,b)=>a+b, 0),
    slip:mockMismatch(run).length,
    timeUp:run.timeUp ? 1 : 0
  };
  STATE.quiz.lastDate = run.date;
  markDailyActivity();
  saveStore();
  go('mockResult');
}
function newMockSet(){
  // confirm 이 막히는 환경(홈 화면 앱 등)이 있어 확인 창 없이 바로 새 세트를 만든다.
  // 세트마다 history 키가 따로라(날짜#세트번호) 지금 세트의 기록은 그대로 남는다.
  STATE.quiz.setNo = (STATE.quiz.setNo || 0) + 1;
  NAV.omrOpen = false;
  NAV.mockSubmitArm = false;
  ensureMockRun();
  saveStore();
  go('mockExam');
}
function startMock(){
  NAV.omrOpen = false;
  NAV.mockSubmitArm = false;
  ensureMockRun();
  saveStore();
  go('mockExam');
}
function mockHistoryList(){
  const h = STATE.quiz.history || {};
  return Object.keys(h).sort((x,y)=>{
    const dx = x.split('#'), dy = y.split('#');
    if(dx[0] !== dy[0]) return dx[0] < dy[0] ? 1 : -1;
    return (+(dy[1]||0)) - (+(dx[1]||0));
  }).map(k=>({ date:k.split('#')[0], setNo:+(k.split('#')[1] || 0),
               score:h[k].score, total:h[k].total, sec:h[k].sec }));
}

/* ---------- 학습 기록 백업 · 복원 ---------- */
// 기기를 바꾸거나 앱 파일을 갈아 끼울 때를 대비해 기록을 파일로 빼 둔다.
function exportStore(){
  const payload = {
    _app: 'ethics-note',
    _version: 1,
    _savedAt: new Date().toISOString(),
    state: STATE
  };
  const blob = new Blob([JSON.stringify(payload, null, 1)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const stamp = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  a.href = url;
  a.download = '윤사노트_학습기록_' + stamp + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
// 백업 파일에 담긴 항목 수를 세어 미리 보여 준다
function storeSummary(st){
  const n = o => o ? Object.keys(o).length : 0;
  return [
    '체크 ' + n(st.checked),
    '기출OX ' + n(st.ox && st.ox.rec),
    '제시문 ' + n(st.ps && st.ps.rec),
    '즐겨찾기 ' + (n(st.ox && st.ox.stars) + n(st.ps && st.ps.stars)),
    '손글씨 ' + n(st.handwriting),
    '연속학습 ' + ((st.streak && st.streak.count) || 0) + '일'
  ].join(' · ');
}
function importStoreFromText(text, mode){
  let payload;
  try{ payload = JSON.parse(text); }
  catch(e){ alert('파일을 읽지 못했어요. 이 앱에서 내보낸 백업 파일이 맞는지 확인해 주세요.'); return false; }
  const incoming = (payload && payload.state) ? payload.state
                 : (payload && payload.checked) ? payload   // 예전 형식도 받아 준다
                 : null;
  if(!incoming){ alert('학습 기록이 들어 있지 않은 파일이에요.'); return false; }

  if(mode === 'replace'){
    if(!confirm('지금 기기의 기록을 지우고 백업 파일로 덮어써요.\n\n' +
                '가져올 기록: ' + storeSummary(incoming) + '\n\n계속할까요?')) return false;
    const base = emptyStore();
    Object.keys(base).forEach(k=>{ if(incoming[k] === undefined) incoming[k] = base[k]; });
    STATE = incoming;
  } else {
    if(!confirm('지금 기록에 백업 파일을 합쳐요. 같은 항목은 백업 쪽이 이깁니다.\n\n' +
                '가져올 기록: ' + storeSummary(incoming) + '\n\n계속할까요?')) return false;
    STATE = mergeStore(STATE, incoming);
  }
  saveStore();
  alert('가져왔어요.\n\n현재 기록: ' + storeSummary(STATE));
  go('home');
  return true;
}
// 합치기 — 한 겹 깊이까지 사전을 병합하고, 겹치면 들어온 쪽을 쓴다
function mergeStore(cur, inc){
  const out = emptyStore();
  Object.keys(out).forEach(k=>{
    const a = cur[k], b = inc[k];
    if(b === undefined){ out[k] = (a === undefined ? out[k] : a); return; }
    if(a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)){
      out[k] = Object.assign({}, a);
      Object.keys(b).forEach(k2=>{
        const av = a[k2], bv = b[k2];
        if(av && bv && typeof av === 'object' && typeof bv === 'object' && !Array.isArray(av)){
          out[k][k2] = Object.assign({}, av, bv);
        } else {
          out[k][k2] = bv;
        }
      });
    } else {
      out[k] = b;
    }
  });
  // 연속학습은 더 긴 쪽을 남긴다
  if(cur.streak && inc.streak){
    out.streak = ((cur.streak.count||0) >= (inc.streak.count||0)) ? cur.streak : inc.streak;
  }
  return out;
}
function pickBackupFile(mode){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.onchange = ()=>{
    const f = inp.files && inp.files[0];
    if(!f) return;
    const fr = new FileReader();
    fr.onload = ()=> importStoreFromText(String(fr.result), mode);
    fr.onerror = ()=> alert('파일을 여는 데 실패했어요.');
    fr.readAsText(f);
  };
  inp.click();
}
function saveStore(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(STATE)); }catch(e){}
}

function todayStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function seedFromDate(str){
  let h = 0;
  for(let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) >>> 0; }
  return h || 1;
}
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
function shuffleSeeded(arr, rng){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()* (i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function escAttr(s){ return String(s).replace(/"/g,'&quot;'); }
function stripMarkup(html){
  return String(html)
    .replace(/<r>(.*?)<\/r>/g,'$1')
    .replace(/<b>(.*?)<\/b>/g,'$1')
    .replace(/<span[^>]*>(.*?)<\/span>/g,'$1')
    .replace(/<[^>]+>/g,'');
}

/* ---------- 필기 표기 (동그라미 / 취소선 / 네모) ---------- */
// 손으로 친 동그라미 <o>..</o>, 그어 지운 것 <s>..</s>, 네모 <box>..</box>
// 색은 물려받는다. 빨간 글씨에 친 동그라미는 빨갛게 나온다.
function renderAnnot(html){
  return String(html)
    .replace(/<o>(.*?)<\/o>/g,   '<span class="circ">$1</span>')
    .replace(/<s>(.*?)<\/s>/g,   '<span class="strike">$1</span>')
    .replace(/<box>(.*?)<\/box>/g,'<span class="boxed">$1</span>');
}

/* ---------- 라인 렌더링 (정리 뷰 / 빈칸학습 뷰 공용) ---------- */
function renderLineHTML(text, blankSet, idPrefix){
  // 텍스트를 <r>..</r> / <b>..</b> / <span class='note'>..</span> / 순수텍스트 조각으로 토큰화
  const re = /<r>(.*?)<\/r>|<b>(.*?)<\/b>|<span class='note'>(.*?)<\/span>/g;
  const tokens = [];
  let lastIndex = 0, m;
  while((m = re.exec(text))){
    if(m.index > lastIndex) tokens.push({type:'plain', c:text.slice(lastIndex, m.index)});
    if(m[1]!==undefined) tokens.push({type:'r', c:m[1]});
    else if(m[2]!==undefined) tokens.push({type:'b', c:m[2]});
    else if(m[3]!==undefined) tokens.push({type:'note', c:m[3]});
    lastIndex = re.lastIndex;
  }
  if(lastIndex < text.length) tokens.push({type:'plain', c:text.slice(lastIndex)});

  let counter = 0;
  return tokens.map(tok=>{
    if(tok.type === 'note') return `<span class="note">${renderAnnot(tok.c)}</span>`;
    if(tok.type === 'plain'){
      if(!tok.c.trim()) return tok.c;
      if(blankSet && blankSet.has('black')){
        // 목차 기호·번호(1. ① a. ㉠ ★ ⇒ 등)는 가리지 않는다 — 위치를 잃으면 문맥이 끊긴다
        const lead = tok.c.match(/^[\s★☆]*(?:\d+\.|[①-⑳]|[ⓐ-ⓩ]|[㉠-㉿]|[a-z]\.|[가-힣]\.|[-·•⇒→])?[\s]*/);
        const head = lead ? lead[0] : '';
        const body = tok.c.slice(head.length);
        if(!body.trim()) return tok.c;
        counter++;
        const uid = idPrefix + '-k' + counter;
        return head + `<span class="blank hidden black" data-uid="${uid}" onclick="toggleBlank(this)">${renderAnnot(body)}</span>`;
      }
      return renderAnnot(tok.c);
    }
    const color = tok.type === 'r' ? 'red' : 'blue';
    counter++;
    const uid = idPrefix + '-c' + counter;
    if(blankSet && blankSet.has(color)){
      return `<span class="blank hidden ${color}" data-uid="${uid}" onclick="toggleBlank(this)">${renderAnnot(tok.c)}</span>`;
    }
    return `<span class="term ${color}">${renderAnnot(tok.c)}</span>`;
  }).join('');
}

function renderOutline(topic, list, sectionKey, blankSet){
  if(!list || !list.length) return '';
  return '<ul class="outline">' + list.map((line, idx)=>{
    const lineKey = topic.id+':'+sectionKey+':'+idx;
    const checked = !!STATE.checked[lineKey];
    const html = renderLineHTML(line.t, blankSet, lineKey);
    return `<li>
      <span class="chk ${checked?'done':''}" data-key="${escAttr(lineKey)}" onclick="toggleCheck(this)">${checked?'✓':''}</span>
      <span class="txt i${line.i}">${html}</span>
    </li>`;
  }).join('') + '</ul>';
}

function renderTable(table, blankColIdx){
  const rows = table.rows.map(r=>{
    return '<tr>' + r.map((cell,ci)=>{
      const html = renderLineHTML(cell, null, '');
      const hide = (blankColIdx!==null && ci===blankColIdx);
      return `<td class="${hide?'tblank':''}" ${hide?'onclick="revealTblCell(this)"':''}>${hide?`<span class="tblank-cover">가리기</span><span class="tblank-real" style="display:none">${html}</span>`:html}</td>`;
    }).join('') + '</tr>';
  }).join('');
  const head = '<tr>' + table.cols.map((c,ci)=>`<th onclick="setTableHideCol(${ci})" style="cursor:pointer;">${c} ${blankColIdx===ci?'👁️‍🗨️':''}</th>`).join('') + '</tr>';
  return `<div class="table-title">${table.title}</div>
    <div class="table-wrap"><table class="cmp-table">${head}${rows}</table></div>
    <div class="note" style="margin:4px 2px 0;">열 제목을 탭하면 그 칸을 가려서 스스로 테스트할 수 있어요.</div>`;
}

/* ---------- 체크 / 북마크 토글 ---------- */
function toggleCheck(el){
  const key = el.getAttribute('data-key');
  STATE.checked[key] = !STATE.checked[key];
  saveStore();
  render();
}
function toggleBlank(el){
  if(el.classList.contains('hidden')){
    el.classList.remove('hidden'); el.classList.add('shown');
  } else {
    el.classList.remove('shown'); el.classList.add('hidden');
  }
}
let TBL_HIDE = {};
function setTableHideCol(ci){
  NAV.tableHideCol = (NAV.tableHideCol===ci) ? null : ci;
  render();
}
function revealTblCell(td){
  const cover = td.querySelector('.tblank-cover');
  const real = td.querySelector('.tblank-real');
  if(cover){ cover.style.display='none'; real.style.display='inline'; }
}

/* ---------- 진행률 계산 ---------- */
function topicLineCount(topic){
  let n = (topic.outline||[]).length + (topic.deep||[]).length;
  return n;
}
function topicCheckedCount(topic){
  let n = 0;
  (topic.outline||[]).forEach((l,idx)=>{ if(STATE.checked[topic.id+':outline:'+idx]) n++; });
  (topic.deep||[]).forEach((l,idx)=>{ if(STATE.checked[topic.id+':deep:'+idx]) n++; });
  return n;
}
function overallProgress(){
  let total=0, done=0;
  DATA.forEach(t=>{ total += topicLineCount(t); done += topicCheckedCount(t); });
  return {total, done, pct: total? Math.round(done/total*100):0};
}

/* ---------- 퀴즈 풀 생성 ---------- */

