import * as Game from './engine.mjs?v=99a2c39e34';

const ASSETS = globalThis.BELL_ASSETS;
const SAVE_KEY = 'violet-thirteenth-bell-save-v1';
const SETTINGS_KEY = 'violet-thirteenth-bell-settings-v1';
const root = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toastBox = document.querySelector('#toast');
const fileInput = document.querySelector('#save-file');
const CG = {
  bakery: { title: '清晨的苹果派', number: '01', subtitle: '一次尚未结束的早餐' },
  chapel: { title: '礼拜堂救援', number: '02', subtitle: '二十七个名字，一个也不能少' },
  tower: { title: '钟楼对峙', number: '03', subtitle: '第十二声之后，仍然有人在等待' },
};
const icons = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  northeast: '<path d="M6 18 18 6M6 6h12v12"/>',
  send: '<path d="m5 12 14-7-5 14-3-6-6-1Z"/><path d="m11 13 8-8"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 8V5a3 3 0 0 1 6 0v3M8 12h8"/>',
  team: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/>',
  book: '<path d="M4 3h14a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V3Z"/><path d="M4 17h16M8 7h8M8 11h5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L6 21"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 8.5a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  diamond: '<path d="m12 3 9 9-9 9-9-9 9-9Z"/><path d="M12 8v5M12 16h.01"/>',
  radio: '<path d="M9 8a5 5 0 0 0 0 8M15 8a5 5 0 0 1 0 8M6 5a9 9 0 0 0 0 14M18 5a9 9 0 0 1 0 14"/><circle cx="12" cy="12" r="1"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  restart: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  home: '<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',
  sound: '<path d="m4 9 4 0 5-4v14l-5-4H4V9Z"/><path d="M17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/>',
};
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.arrow}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const logo = () => '<div class="halo-logo" aria-hidden="true"><span>XIII</span></div>';
const brand = () => `<div class="brand">${logo()}<div><strong>第十三声钟响</strong><small>THE THIRTEENTH BELL</small></div></div>`;

let state = null;
let history = [];
let saved = null;
let badSave = false;
let activePanel = 'map';
let screen = 'title';
let commands = [];
let commandIndex = 0;
let toastTimer;
let storageAvailable = true;
let lastCG = 'bakery';
let settings = { text: 'normal', sound: true };
let audioContext;
let typingFrame = null;
let typingNodes = [];
let introStep = 0;
let introStartsNewGame = true;
let shownHint = null;

function validHistory(value) {
  return Array.isArray(value) && value.length <= 160 && value.every(entry => entry &&
    typeof entry.text === 'string' && entry.text.length <= 5000 &&
    ['story', 'npc', 'system', 'success', 'warning', 'command'].includes(entry.kind) &&
    (entry.speaker === undefined || typeof entry.speaker === 'string' && entry.speaker.length <= 100));
}
function validEnvelope(value) {
  return value?.version === 1 && Game.validateSave(value.state) && validHistory(value.history);
}
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const data = JSON.parse(raw);
    if (validEnvelope(data)) saved = data;
    else badSave = true;
  }
} catch { badSave = true; }
try {
  const storedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  if (storedSettings) {
    if (['small', 'normal', 'large'].includes(storedSettings.text)) settings.text = storedSettings.text;
    settings.sound = storedSettings.sound === true;
  }
} catch {}

function applySettings() {
  document.documentElement.style.setProperty('--story-size', { small: '14px', normal: '18px', large: '21px' }[settings.text]);
}
function toast(message) {
  clearTimeout(toastTimer);
  toastBox.textContent = message;
  toastBox.classList.add('visible');
  toastTimer = setTimeout(() => toastBox.classList.remove('visible'), 3400);
}
function addMessages(messages) {
  for (const entry of messages || []) {
    const item = typeof entry === 'string' ? { kind: 'story', text: entry } : entry;
    if (item && typeof item.text === 'string') history.push({ kind: item.kind || 'story', ...(item.speaker ? { speaker: item.speaker } : {}), text: item.text });
  }
  history = history.slice(-140);
}
function persist() {
  if (!state) return false;
  const data = { version: 1, savedAt: new Date().toISOString(), state, history };
  saved = data;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    storageAvailable = true;
    return true;
  } catch {
    if (storageAvailable) toast('浏览器无法自动保存。可在设置中导出存档。');
    storageAvailable = false;
    return false;
  }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  applySettings();
}
function bell() {
  if (!settings.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audioContext ||= new Audio();
    audioContext.resume();
    const time = audioContext.currentTime;
    [392, 784, 1179].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(.055 / (index + 1), time + .015);
      gain.gain.exponentialRampToValueAtTime(.001, time + 1.3);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(time); oscillator.stop(time + 1.4);
    });
  } catch {}
}
function feedbackSound(kind) {
  if (!settings.sound) return;
  if (kind === 'chapter') return bell();
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audioContext ||= new Audio();
    audioContext.resume();
    const time=audioContext.currentTime;
    const tones=kind==='clue' ? [587.33,880] : [440];
    tones.forEach((frequency,index)=>{
      const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
      const start=time+index*.09, duration=kind==='clue' ? .38 : .1;
      oscillator.type='sine'; oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(kind==='clue' ? .045 : .025,start+.008);
      gain.gain.exponentialRampToValueAtTime(.001,start+duration);
      oscillator.connect(gain);gain.connect(audioContext.destination);
      oscillator.start(start);oscillator.stop(start+duration+.02);
    });
  } catch {}
}
function stopTyping(reveal=true) {
  if (typingFrame!==null) cancelAnimationFrame(typingFrame);
  typingFrame=null;
  if (reveal) for(const item of typingNodes) item.node.textContent=item.text;
  typingNodes=[];
  document.querySelector('#show-all')?.classList.add('hidden');
  document.querySelector('#story-log')?.classList.remove('is-typing');
}
function typeMessages(from) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return stopTyping(true);
  const log=document.querySelector('#story-log');
  typingNodes=history.map((entry,index)=>({node:document.querySelector(`[data-log-copy="${index}"]`),text:entry.text,index,kind:entry.kind}))
    .filter(item=>item.index>=from && item.node && item.kind!=='command');
  if (!typingNodes.length) return;
  document.querySelector('#show-all')?.classList.remove('hidden');
  log?.classList.add('is-typing');
  let current=0, started=performance.now(),previousLength=-1;
  const step=now=>{
    const item=typingNodes[current];
    if (!item || !item.node.isConnected) return stopTyping(true);
    const chars=Array.from(item.text);
    const speed=Math.max(38,chars.length/5);
    const length=Math.min(chars.length,Math.max(0,Math.floor((now-started)*speed/1000)+1));
    if(length!==previousLength){
      const shouldFollow=log && log.scrollHeight-log.scrollTop-log.clientHeight<75;
      item.node.textContent=chars.slice(0,length).join('');
      if(shouldFollow) log.scrollTop=log.scrollHeight;
      previousLength=length;
    }
    if(length===chars.length){current++;started=now+100;previousLength=-1;}
    if(current===typingNodes.length) return stopTyping(true);
    typingFrame=requestAnimationFrame(step);
  };
  typingFrame=requestAnimationFrame(step);
}
function closeDialog() { if (dialog.open) dialog.close(); }
function showDialog(title, body, className = '') {
  dialog.className = className;
  dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-button" data-ui="close" aria-label="关闭">${icon('close')}</button></div>${body}`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop=0;
}

function renderTitle() {
  stopTyping();
  screen = 'title';
  let saveText = '';
  if (saved) {
    const v = Game.getView(saved.state);
    saveText = `上次停留 · ${v.location.name}${v.ending ? ' · 已抵达结局' : ''}`;
  }
  root.innerHTML = `<section class="landing fade-in">
    <img class="cover-image" src="${ASSETS.bakery}" alt="清晨的拉特兰街头，博士和能天使在面包店前分享苹果派">
    <header class="landing-header">${brand()}<div class="edition"><span class="dot"></span><span>单人文字探索</span><button class="text-button" data-ui="help" aria-label="游玩指南">${icon('help')}</button></div></header>
    <main class="landing-content">
      <div class="location-label">拉特兰 · 白钟区</div>
      <h1 class="serif"><span class="title-line">第十三声</span><span class="title-line">钟响</span></h1>
      <p class="en-title">BEFORE THE LAST BELL</p>
      <p class="intro">一段被剪去的命令，二十七个消失的名字。<br>正午将至，你必须在钟声落下之前，<br>找到真相，把他们带回来。</p>
      <div class="button-row">${saved ? `<button class="primary" data-ui="continue">继续旅程${icon('arrow')}</button><button class="secondary" data-ui="new">重新启程</button>` : `<button class="primary" data-ui="new">开始行动${icon('arrow')}</button><button class="text-button" data-ui="help">游玩指南${icon('northeast')}</button>`}</div>
      <p class="save-preview">${saved ? esc(saveText) : '以博士的身份，走进这座城市。'}</p>
      ${badSave && !saved ? '<p class="save-preview">旧存档无法读取。你可以重新开始，或在设置中导入备份。</p>' : ''}
    </main>
    <div class="cover-caption">09:00 / 苹果派还没有凉</div>
    <footer class="landing-footer"><div class="chapter-line"><span><b>Ⅰ</b> 追查伪令</span><span><b>Ⅱ</b> 礼拜堂救援</span><span><b>Ⅲ</b> 钟楼对峙</span></div><span class="premise">你的选择，决定钟声之后的结局。</span><button class="text-button" data-ui="settings">violet ${icon('settings')}</button></footer>
  </section>`;
}

function startGame() {
  closeDialog();
  state = Game.createGame();
  history = [];
  commands = [];
  activePanel = 'map';
  const view = Game.getView(state);
  addMessages([{ kind: 'system', text: '09:00 · 拉特兰，白钟区。' },
    { kind: 'story', text: view.location.description },
    { kind: 'npc', speaker: '能天使', text: '“博士，早餐也是任务的一部分。先尝尝苹果派？”' }]);
  lastCG = view.location.cg;
  persist();
  screen = 'game';
  renderGame({animateFrom:1});
  feedbackSound('chapter');
  window.scrollTo(0, 0);
}
function continueGame() {
  if (!saved) return startGame();
  state = structuredClone(saved.state);
  history = structuredClone(saved.history);
  screen = 'game';
  renderGame();
  window.scrollTo(0, 0);
}
function requestNewGame() {
  if (!saved && !state) return showIntro(true);
  showDialog('重新启程', `<div class="dialog-body">这会从面包店的清晨重新开始，并替换当前自动存档。你可以先在设置中导出这段旅程。</div><div class="button-row" style="margin-top:24px"><button class="primary" data-ui="confirm-new">重新开始${icon('restart')}</button><button class="secondary" data-ui="close">保留当前旅程</button></div>`);
}
function chapterNumber(number) { return String(number || 1).padStart(2, '0'); }
function clockTime(minutesLeft) {
  const passed = Math.max(0, 720 - Math.max(0, Number(minutesLeft) || 0));
  return `${String(Math.floor(passed / 60)).padStart(2, '0')}:${String(passed % 60).padStart(2, '0')}`;
}
function latestTurnStart() {
  for (let index=history.length-1; index>=0; index--) {
    if (history[index].kind==='command') return index;
  }
  return 0;
}
function logHTML(animateFrom=Infinity, all=false) {
  const from=all ? 0 : latestTurnStart();
  const animate=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  return history.map((entry,index) => index<from ? '' : `<div class="log-entry ${esc(entry.kind)}">${entry.speaker ? `<span class="speaker">${esc(entry.speaker)}</span>` : ''}<span class="log-copy" data-log-copy="${index}">${animate && index>=animateFrom && entry.kind!=='command' ? '' : esc(entry.text)}</span></div>`).join('');
}
function renderEnding(ending) {
  if (!ending) return '';
  return `<section class="ending fade-in"><div class="ending-kicker">旅程终章 · ${esc(ending.grade || '结局')}</div><h2>${esc(ending.title)}</h2><p class="ending-subtitle">${esc(ending.subtitle)}</p>${(ending.paragraphs || []).map(text => `<p>${esc(text)}</p>`).join('')}<div class="button-row"><button class="primary" data-ui="new">重走旅程${icon('restart')}</button><button class="secondary" data-ui="ending-gallery">回望这一日${icon('image')}</button></div></section>`;
}
function renderGame({ focus = false, preserveScroll = false, animateFrom=Infinity } = {}) {
  stopTyping();
  if (!state) return renderTitle();
  screen = 'game';
  const previousScroll = document.querySelector('#story-log')?.scrollTop || 0;
  const view = Game.getView(state);
  const cg = Object.hasOwn(CG, view.location.cg) ? view.location.cg : 'bakery';
  const actions = [
    ...(view.actions || []).filter(action => !['提示','等待'].includes(action.command)),
    ...(view.exits || []).filter(exit => !exit.locked).map(exit => ({label:`前往${exit.name}`,command:exit.command})),
    ...(!view.ending ? [{label:'卡住了？查看提示',command:'提示'}] : []),
    ...(view.actions || []).filter(action => action.command === '等待'),
  ];
  const markup = `<header class="main-header"><button class="text-button" data-ui="title" style="padding:0;text-align:left" aria-label="返回标题">${brand()}</button><div class="header-right"><span class="saved-status"><span class="dot"></span>${storageAvailable ? '旅程已自动保存' : '可导出存档'}</span><span class="header-divider"></span><button class="text-button" data-ui="help">${icon('help')}游玩指南</button><button class="icon-button" data-ui="settings" aria-label="设置与存档">${icon('settings')}</button></div></header>
    <main class="workspace fade-in"><section class="story-column" aria-label="故事与行动">
      <div class="chapter-heading"><div class="eyebrow"><b>CHAPTER ${chapterNumber(view.chapter.number)}</b>${esc(view.chapter.title)}</div><span class="location-path">拉特兰 / 白钟区 / ${esc(view.location.name)}</span></div>
      <div class="scene" role="button" tabindex="0" data-cg="${cg}" aria-label="放大${esc(CG[cg].title)}插画"><img src="${ASSETS[cg]}" alt="${esc(CG[cg].title)}"><div class="scene-num">${Object.keys(CG).map(id => `<i class="${cg === id ? 'active' : ''}"></i>`).join('')}</div><div class="scene-title"><div><div class="eyebrow">${esc(view.location.kicker || 'LATERANO · WHITE BELL DISTRICT')}</div><h1>${esc(view.location.name)}</h1></div><span class="scene-mark">${icon('image')}SCENE ${CG[cg].number}</span></div></div>
      <div class="story-head"><h2>${icon('book')}此刻的故事</h2><div class="story-head-tools"><button class="text-button" data-ui="history">回看记录${icon('book')}</button><button id="show-all" class="text-button hidden" data-ui="show-all">显示全部${icon('arrow')}</button><button class="text-button" data-command="查看">重新观察${icon('northeast')}</button></div></div>
      <div id="story-log" class="story-log" tabindex="0" aria-label="本次行动内容">${logHTML(animateFrom)}</div>
      <div class="action-area">${renderEnding(view.ending)}${!view.ending ? `<div class="action-caption"><span>你准备怎么做？</span><span>选择一项行动，继续你的故事</span></div><div class="actions">${actions.map((action, index) => `<button class="action-button ${index === 0 ? 'primary-action' : ''}" data-command="${esc(action.command)}"><span>${esc(action.label)}</span>${icon('arrow')}</button>`).join('')}</div>` : ''}
      <div class="input-hint"><span>只需点击选项 · 阅读与查看不消耗时间</span><button class="text-button" data-ui="contact">${icon('radio')}联系同伴</button></div></div>
    </section><aside class="sidebar" aria-label="行动档案">
      <div class="timer"><div><div class="timer-label">${view.ending ? '这一日的终点' : `距正午 · ${Math.max(0, view.stats.minutesLeft)} 分钟`}</div><div class="timer-value">${clockTime(view.stats.minutesLeft)}<span>12:00 钟响</span></div></div><div class="clock-face" aria-hidden="true"></div></div>
      <section class="mission"><div class="label">当前目标${icon('diamond')}</div><p>${esc(view.objective)}</p><button class="hint-button" data-ui="hint">${icon('help')}提示 · 下一步</button></section>
      <div class="progress-stats"><div><div class="stat-value">${esc(view.stats.rescued)}<small>/ 27</small></div><div class="stat-label">居民获救</div></div><div><div class="stat-value">${esc(view.stats.evidence)}</div><div class="stat-label">已获证据</div></div><div><div class="stat-value">${esc(view.stats.trust)}<small>/ 4</small></div><div class="stat-label">同伴协同</div></div></div>
      <nav class="panel-tabs" aria-label="行动档案栏目">${[['map','地图'],['bag','背包'],['team','同伴'],['book','日志'],['image','图鉴']].map(([id,label]) => `<button data-panel="${id}" class="${activePanel === id ? 'active' : ''}" aria-pressed="${activePanel === id}">${icon(id)}${label}</button>`).join('')}</nav>
      <div class="panel-content" id="panel-content">${renderPanel(view)}</div>
      <div class="sidebar-footer"><span>博士 · 罗德岛</span><br>白金色的光环照亮道路。选择仍由你作出。</div>
    </aside></main><footer class="footer"><span>第十三声钟响 · violet</span><span>文字探索 / 单人旅程 / 自动存档</span></footer>`;
  updateGameMarkup(markup);
  const log = document.querySelector('#story-log');
  log.scrollTop = preserveScroll ? previousScroll : 0;
  if (focus) document.querySelector('.action-button')?.focus({ preventScroll: true });
  if (Number.isFinite(animateFrom)) typeMessages(animateFrom);
}

// Keep the game shell and CG image mounted; actions only update changed regions.
function updateGameMarkup(markup) {
  if (!root.querySelector('.workspace')) {
    root.innerHTML=markup;
    return;
  }
  const template=document.createElement('template');
  template.innerHTML=markup;
  const next=template.content;
  const update=selector=>{
    const current=root.querySelector(selector), incoming=next.querySelector(selector);
    if (current && incoming && current.innerHTML!==incoming.innerHTML) current.innerHTML=incoming.innerHTML;
  };
  for (const selector of ['.saved-status','.chapter-heading','.scene-num','.scene-title',
    '#story-log','.action-area','.timer','.mission','.progress-stats','.panel-tabs','#panel-content']) update(selector);
  const scene=root.querySelector('.scene'), incoming=next.querySelector('.scene');
  scene.dataset.cg=incoming.dataset.cg;
  scene.setAttribute('aria-label',incoming.getAttribute('aria-label'));
  const image=scene.querySelector('img'), nextImage=incoming.querySelector('img');
  if (image.getAttribute('src')!==nextImage.getAttribute('src')) image.src=nextImage.getAttribute('src');
  image.alt=nextImage.alt;
}

function showHistory() {
  stopTyping();
  showDialog('旅程回看', `<p class="help-intro">之前的对话和行动都留在这里。向上翻阅，关闭后回到当前故事。</p><div class="history-log" tabindex="0" aria-label="历史行动记录">${logHTML(Infinity,true)}</div><div class="button-row history-footer"><button class="secondary" data-ui="close">返回当前故事</button></div>`, 'history-dialog');
  const log=dialog.querySelector('.history-log');
  log.scrollTop=log.scrollHeight;
}
function showHint() {
  if (!state) return;
  stopTyping();
  const view=Game.getView(state);
  const hint=view.nextAction;
  if (view.ending || !hint) return showDialog('旅程已结束', '<p class="help-intro">你已抵达这一日的结局。可以回看记录，或重新启程。</p>');
  shownHint=hint;
  for (const button of root.querySelectorAll('.action-button[data-command]')) {
    const recommended=button.dataset.command===hint.command;
    button.classList.toggle('recommended',recommended);
    if (recommended) button.setAttribute('aria-label',`${hint.label}，推荐行动`);
  }
  showDialog('下一步建议', `<div class="hint-kicker">推荐选择</div><h3 class="hint-choice">${esc(hint.label)}</h3><p class="hint-reason">${esc(hint.reason)}</p><p class="note">查看提示不消耗行动时间。对应选项已标记为“推荐”。</p><div class="button-row hint-footer"><button class="primary" data-ui="follow-hint">按提示行动${icon('arrow')}</button><button class="secondary" data-ui="close">我自己选</button></div>`, 'hint-dialog');
}

function renderPanel(view) {
  if (activePanel === 'map') {
    const map = view.map || [];
    const points = new Map(map.map(p => [p.id, p]));
    const lines = (view.connections || []).map(([a,b]) => {
      const from = points.get(a), to = points.get(b);
      return from && to ? `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>` : '';
    }).join('');
    return `<div class="panel-heading"><h3>白钟区地图</h3><small>沿相邻地点移动</small></div><div class="map"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${map.map(point => `<button class="map-node ${point.current ? 'current' : ''} ${point.visited ? 'visited' : ''} ${point.available ? 'available' : ''}" style="left:${Math.max(10,Math.min(90,point.x))}%;top:${Math.max(8,Math.min(90,point.y))}%" data-command="${point.current ? '查看' : `去 ${esc(point.name)}`}" ${!point.current && !point.available ? 'disabled' : ''} aria-label="${esc(point.name)}${point.current ? '，当前地点' : !point.available ? '，需要从相邻地点前往' : ''}"><i class="node-dot"></i><span>${esc(point.name)}</span></button>`).join('')}</div><div class="map-legend"><span><i class="filled"></i>当前位置</span><span><i></i>已探索</span><span>暗色 · 暂不可达</span></div><div class="exits">${(view.exits || []).map(exit => `<button class="exit-row" data-command="${esc(exit.command || `去 ${exit.name}`)}" ${exit.locked ? 'disabled' : ''}><span>${esc(exit.name)}${exit.locked && exit.reason ? `<small>${esc(exit.reason)}</small>` : ''}</span>${icon(exit.locked ? 'lock' : 'arrow')}</button>`).join('')}</div>`;
  }
  if (activePanel === 'bag') return `<div class="panel-heading"><h3>随身物品</h3><small>${view.inventory.length} 件</small></div><div class="inventory-list">${view.inventory.length ? view.inventory.map(item => `<article class="inventory-item"><div class="item-title">${icon(item.type === 'evidence' ? 'book' : 'bag')}${esc(item.name)}</div><p>${esc(item.description)}</p></article>`).join('') : '<p class="empty-panel">背包暂时没有物品。观察现场，与同伴交谈，寻找有用的东西。</p>'}</div>`;
  if (activePanel === 'team') return `<div class="panel-heading"><h3>队内频道</h3><small>四位同行者</small></div><div class="team-list">${view.companions.map(member => `<article class="team-member"><span class="initial" aria-hidden="true">${esc(member.name.slice(0,1))}</span><div><h4>${esc(member.name)}</h4><small>${esc(member.role)}</small><p>${esc(member.status)}</p></div><button class="team-contact" data-command="交谈 ${esc(member.name)}" aria-label="联系${esc(member.name)}">${icon('radio')}</button></article>`).join('')}</div>`;
  if (activePanel === 'book') return `<div class="panel-heading"><h3>调查日志</h3><small>${view.journal.length} 条记录</small></div><div class="journal-list">${view.journal.length ? view.journal.map(entry => `<article class="journal-item"><h4>${esc(entry.title)}</h4><p>${esc(entry.text)}</p></article>`).join('') : '<p class="empty-panel">白钟区看起来仍然安静。值得记录的线索，会留在这里。</p>'}</div>`;
  return `<div class="panel-heading"><h3>记忆中的画面</h3><small>${view.cgUnlocked.length} / 3</small></div><div class="gallery-list">${Object.entries(CG).map(([id, cg]) => { const unlocked = view.cgUnlocked.includes(id); return `<button class="gallery-card" data-cg="${id}" ${unlocked ? '' : 'disabled'} aria-label="${esc(cg.title)}${unlocked ? '，点击放大' : '，尚未解锁'}"><img src="${ASSETS[id]}" alt="${unlocked ? esc(cg.title) : '尚未解锁的场景'}">${unlocked ? '' : `<span class="gallery-lock">${icon('lock')}</span>`}<figcaption>${cg.number} / ${unlocked ? esc(cg.title) : '尚未抵达'}</figcaption></button>`; }).join('')}</div>`;
}

function run(command, focus = false) {
  const text = String(command || '').trim();
  if (!state || !text) return;
  stopTyping();
  if (text.length > 100) return toast('指令太长了，请使用简短的行动指令。');
  const normalized = text.replace(/[，。！？!?]+$/g,'').replace(/\s+/g,'');
  if (/^(重新开始|重开|重来|重新启程|restart)$/i.test(normalized)) return requestNewGame();
  if (/^(帮助|help|\?)$/i.test(text)) return showHelp();
  if (text==='提示') return showHint();
  shownHint=null;
  const panels = { 地图:'map', 背包:'bag', 日志:'book', 图鉴:'image' };
  if (panels[text]) activePanel = panels[text];
  const oldView = Game.getView(state);
  try {
    const result = Game.execute(state, text);
    if (!result?.state || !Array.isArray(result.messages)) throw new Error('Invalid game result');
    state = result.state;
    commands.push(text); commands = commands.slice(-50); commandIndex = commands.length;
    const newMessages=[{kind:'command',text}, ...result.messages];
    addMessages(newMessages);
    const view = Game.getView(state);
    if (view.chapter.number !== oldView.chapter.number || view.ending && !oldView.ending) feedbackSound('chapter');
    else if(view.stats.evidence>oldView.stats.evidence) feedbackSound('clue');
    else if(result.changed) feedbackSound('action');
    lastCG = view.location.cg;
    persist();
    renderGame({ focus, animateFrom:Math.max(0,history.length-newMessages.length) });
    if (view.ending && !oldView.ending) {
      document.querySelector('.ending')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'nearest' });
    }
  } catch (error) {
    console.error('Action failed', error);
    toast('这次行动没有完成，当前进度仍然保留。请重新尝试。');
  }
}

function showIntro(startNew=true) {
  stopTyping();
  introStep=0;introStartsNewGame=startNew;
  renderIntro();
}
function renderIntro() {
  const pages=[
    {title:'钟声之前',kicker:'序章 · 故事背景',body:`<div class="intro-art"><img src="${ASSETS.bakery}" alt="拉特兰清晨的街道"></div><p class="intro-copy">你是罗德岛的<strong>博士</strong>，拥有一圈白金色光环。今天，你和能天使来到拉特兰旧城区，准备完成一次普通的医疗物资交接。</p><p class="intro-copy">早餐尚未吃完，错误的疏散广播响起。一段遭到剪辑的录像把嫌疑指向了你，而二十七位居民的名字，从撤离名单上消失了。</p><p class="intro-callout">正午之前，找到真相，也找到那些仍在等待的人。</p>`},
    {title:'与你同行的人',kicker:'队伍 · 各自的判断',body:`<p class="intro-copy">光环不会替你作出决定。你的力量来自观察、判断，以及对同伴的信任。</p><div class="intro-team">${[
      ['能天使','护送与现场观察','乐观又可靠。她能从居民的只言片语中发现遗漏，也会守住最后一副担架。'],
      ['莫斯提马','通路与接应','她熟悉那些没有画在地图上的路。危急时刻，会为同伴争取一点时间。'],
      ['菲亚梅塔','掩护与现场处置','她不轻信来路不明的命令。明确目标之后，控制室可以交给她。'],
      ['送葬人','授权核验与证据','印章是真是假，权限到哪里，他都会一项项查清。证据也需要留下副本。'],
    ].map(([name,role,text])=>`<article><span class="initial">${name[0]}</span><div><h3>${name}</h3><small>${role}</small><p>${text}</p></div></article>`).join('')}</div>`},
    {title:'你的第一份行动简报',kicker:'教程 · 只需点击选项',body:`<div class="tutorial-steps"><article><span>01</span><div><h3>阅读，再选择</h3><p>文本窗只呈现本次行动。点击“显示全部”立即读完，之前的对话可在“回看记录”中翻阅。</p></div></article><article><span>02</span><div><h3>沿地图探索</h3><p>点击下方选项行动，沿地图前往相邻地点。卡住时点击“查看提示”，系统会标出推荐的下一步。</p></div></article><article><span>03</span><div><h3>把合适的任务交给同伴</h3><p>先为救援做好准备，最后安排四位同伴共同解决钟楼危机。调查和选择会改变结局。</p></div></article></div><p class="intro-callout">阅读不会消耗时间。移动和新行动才会让钟表前进。</p><button class="intro-sound" data-ui="intro-sound">${icon('sound')}必要音效：${settings.sound?'已开启':'已关闭'}<span>点击切换</span></button>`},
  ];
  const page=pages[introStep];
  showDialog(page.title,`<div class="eyebrow intro-kicker">${page.kicker}</div>${page.body}<div class="intro-footer"><div class="intro-dots" aria-label="第${introStep+1}步，共3步">${pages.map((_,i)=>`<i class="${i===introStep?'active':''}"></i>`).join('')}</div><div class="button-row">${introStep>0?'<button class="text-button" data-ui="intro-back">上一步</button>':'<button class="text-button" data-ui="close">暂时返回</button>'}<button class="primary" data-ui="${introStep===2?'intro-finish':'intro-next'}">${introStep===2?(introStartsNewGame?'走进清晨':'返回旅程'):'继续'}${icon('arrow')}</button></div></div>`,'intro-dialog');
}
function showHelp() {
  showDialog('游玩指南', `<p class="help-intro">你是拥有白金色光环的罗德岛博士。调查事故、找到失踪居民，与四位同伴阻止钟楼中的危机。整段旅程只需点击选项。</p><div class="help-list"><code>选择行动</code><p>阅读行动记录，在下方选项中选择调查、救援或队员分工。</p><code>探索地图</code><p>点击“前往……”选项，或地图中相邻的可达地点。暗色地点暂时不能抵达。</p><code>联系同伴</code><p>选择一位同伴交谈。能天使、莫斯提马、菲亚梅塔和送葬人都在队内频道。</p><code>背包与日志</code><p>查看收集到的物品与证据。已经完成的行动会记录在日志里。</p><code>查看提示</code><p>卡住时点击“卡住了？查看提示”或“提示 · 下一步”。系统会显示推荐选项和理由，并标记对应按钮；查看不消耗时间。</p><code>回看记录</code><p>文本窗只显示本次行动。点击“回看记录”可翻阅之前的对话和行动，关闭后继续当前故事。</p><code>回望画面</code><p>点击场景插画可放大；图鉴会保留已经解锁的三张 CG。</p></div><p class="note">时间只会随移动和有效行动推进，不会在你阅读时流逝。“原地等待”会推进五分钟。收集与备份证据、完成救援和合理分工，都会影响结局。</p><p class="help-footer">游戏会自动保存到当前浏览器。换设备前，可以在设置中导出存档，再从另一台设备导入。</p><button class="text-button" data-ui="introduction">查看故事与人物介绍 ${icon('arrow')}</button>`);
}
function showContacts() {
  if (!state) return;
  const view=Game.getView(state);
  showDialog('队内频道', `<p class="help-intro">选择一位同伴接通通讯。</p><div class="actions">${view.companions.map(member=>`<button class="action-button" data-contact="${esc(member.name)}"><span>${esc(member.name)}<small>${esc(member.role)}</small></span>${icon('radio')}</button>`).join('')}</div>`);
}
function showSettings() {
  showDialog('旅程设置', `<div class="settings-row"><div><h3>正文字号</h3><p>选择适合你的阅读大小</p></div><div class="segmented">${[['small','紧凑'],['normal','舒适'],['large','大字']].map(([value,label]) => `<button data-size="${value}" class="${settings.text === value ? 'active' : ''}" aria-pressed="${settings.text === value}">${label}</button>`).join('')}</div></div><div class="settings-row"><div><h3>游戏音效</h3><p>行动、获得证据和章节转换时的轻声提示</p></div><div class="segmented"><button data-ui="sound" aria-pressed="${settings.sound}" class="${settings.sound ? 'active' : ''}">${settings.sound ? '已开启' : '已关闭'}</button></div></div><div class="settings-row"><div><h3>保存旅程</h3><p>自动存档只保存在当前浏览器</p></div><button class="text-button" data-ui="export" ${!state && !saved ? 'disabled' : ''}>${icon('download')}导出存档</button></div><div class="settings-row"><div><h3>恢复旅程</h3><p>导入先前导出的 JSON 存档</p></div><button class="text-button" data-ui="import">${icon('upload')}导入存档</button></div><div class="settings-end">${state || saved ? `<button class="text-button danger-button" data-ui="new">${icon('restart')}重新开始</button>` : '<span></span>'}<button class="text-button" data-ui="title">${icon('home')}返回标题</button></div>`);
}
function showCG(id) {
  if (!Object.hasOwn(CG,id)) return;
  if (state && !Game.getView(state).cgUnlocked.includes(id)) return;
  showDialog(CG[id].title, `<img src="${ASSETS[id]}" alt="${esc(CG[id].title)}"><p class="help-footer">${esc(CG[id].subtitle)}</p>`, 'gallery-dialog');
}
function exportSave() {
  const data = state ? { version:1, savedAt:new Date().toISOString(), state, history } : saved;
  if (!data) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url; link.download = '第十三声钟响_旅程存档.json';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('存档已导出。');
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-ui],[data-command],[data-panel],[data-size],[data-cg],[data-contact]');
  if (!button || button.disabled) return;
  if (button.dataset.command) return run(button.dataset.command);
  if (button.dataset.contact) { closeDialog(); return run(`交谈 ${button.dataset.contact}`); }
  if (button.dataset.panel) {
    activePanel = button.dataset.panel;
    renderGame({ preserveScroll:true });
    document.querySelector(`[data-panel="${activePanel}"]`)?.focus({preventScroll:true});
    return;
  }
  if (button.dataset.cg) return showCG(button.dataset.cg);
  if (button.dataset.size) { settings.text=button.dataset.size; saveSettings(); return showSettings(); }
  const action = button.dataset.ui;
  if (action === 'new') return requestNewGame();
  if (action === 'confirm-new') return showIntro(true);
  if (action === 'continue') return continueGame();
  if (action === 'help') return showHelp();
  if (action === 'introduction') return showIntro(false);
  if (action === 'intro-next') {introStep=Math.min(2,introStep+1);return renderIntro();}
  if (action === 'intro-back') {introStep=Math.max(0,introStep-1);return renderIntro();}
  if (action === 'intro-sound') {settings.sound=!settings.sound;saveSettings();if(settings.sound) feedbackSound('action');return renderIntro();}
  if (action === 'intro-finish') return introStartsNewGame ? startGame() : closeDialog();
  if (action === 'show-all') {stopTyping();document.querySelector('#story-log')?.scrollTo({top:document.querySelector('#story-log').scrollHeight});return;}
  if (action === 'settings') return showSettings();
  if (action === 'close') return closeDialog();
  if (action === 'hint') return showHint();
  if (action === 'history') return showHistory();
  if (action === 'follow-hint') { const hint=shownHint; closeDialog(); if(hint) return run(hint.command,true); }
  if (action === 'contact') return showContacts();
  if (action === 'export') return exportSave();
  if (action === 'import') return fileInput.click();
  if (action === 'sound') { settings.sound=!settings.sound; saveSettings(); bell(); return showSettings(); }
  if (action === 'title') { closeDialog(); if (state) persist(); renderTitle(); return window.scrollTo(0,0); }
  if (action === 'ending-gallery') { activePanel='image'; renderGame({preserveScroll:true}); document.querySelector('.panel-tabs')?.scrollIntoView({behavior:'smooth',block:'nearest'}); }
});
document.addEventListener('keydown', event => {
  if (event.target.matches('input,textarea,select') || dialog.open) return;
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.scene')) { event.preventDefault(); showCG(event.target.dataset.cg); }
});
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box=dialog.getBoundingClientRect();
  if (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom) closeDialog();
});
fileInput.addEventListener('change', async () => {
  const file=fileInput.files?.[0]; fileInput.value='';
  if (!file) return;
  if (file.size>2_000_000) return toast('存档文件过大，请选择本游戏导出的 JSON 文件。');
  try {
    const data=JSON.parse(await file.text());
    if (!validEnvelope(data)) throw new Error('Invalid save');
    saved=data; state=structuredClone(data.state); history=structuredClone(data.history);
    badSave=false; persist(); closeDialog(); renderGame(); window.scrollTo(0,0); toast('旅程已恢复。');
  } catch { toast('这份存档无法读取，当前进度没有改变。'); }
});

applySettings();
renderTitle();
