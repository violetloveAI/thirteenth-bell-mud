/** Deterministic, single-player story engine. No clock, network or DOM access. */
const LOCATIONS = {
  bakery: { name: '苹果派店', kicker: '旧城的清晨', cg: 'bakery', x: 12, y: 73 },
  plaza: { name: '白钟广场', kicker: '临时医疗点', cg: 'bakery', x: 35, y: 63 },
  tunnel: { name: '东侧通道', kicker: '尚未验收的出口', cg: 'bakery', x: 12, y: 35 },
  chapel: { name: '旧礼拜堂', kicker: '名单之外的二十七人', cg: 'chapel', x: 57, y: 79 },
  roof: { name: '屋顶维护路', kicker: '失去近路之后', cg: 'chapel', x: 61, y: 43 },
  control: { name: '广播控制室', kicker: '命令从这里传出', cg: 'tower', x: 88, y: 47 },
  tower: { name: '钟楼上层', kicker: '第十二声之后', cg: 'tower', x: 77, y: 14 },
};
const CONNECTIONS = [['bakery', 'plaza'], ['plaza', 'tunnel'], ['plaza', 'chapel'], ['chapel', 'roof'], ['roof', 'control'], ['roof', 'tower']];
const LOCATION_NAMES = {
  面包店: 'bakery', 苹果派店: 'bakery', 广场: 'plaza', 白钟广场: 'plaza', 医疗点: 'plaza',
  东侧通道: 'tunnel', 东侧: 'tunnel', 通道: 'tunnel', 礼拜堂: 'chapel', 旧礼拜堂: 'chapel',
  屋顶: 'roof', 维护路: 'roof', 屋顶维护路: 'roof', 控制室: 'control', 广播控制室: 'control',
  钟楼: 'tower', 钟楼上层: 'tower',
};
const PEOPLE = [
  { id: 'exusiai', name: '能天使', role: '护送与现场观察', flag: 'northTeam', task: '护送居民' },
  { id: 'mostima', name: '莫斯提马', role: '寻找通路与接应', flag: 'techTeam', task: '接应技师' },
  { id: 'fiammetta', name: '菲亚梅塔', role: '掩护与控制室行动', flag: 'controlTeam', task: '接管控制室' },
  { id: 'executor', name: '送葬人', role: '核验授权与证据交接', flag: 'lawTeam', task: '核验封锁令' },
];
const ITEMS = {
  terminal: { name: '博士的终端', type: 'tool', description: '保存本地工作录像，可接通队内通讯。白金色光环不会读取思想或控制他人。' },
  recording: { name: '完整工作录像', type: 'clue', description: '原话包含“复检通过前”和“不得让北门暂停通行”。' },
  authorization: { name: '真实维护授权', type: 'clue', description: '印章是真的，但权限只到设施维护，不包括拘押与医疗转运。' },
  edited: { name: '剪辑与越权证据', type: 'evidence', description: '完整录像与授权范围相互印证：公开命令删去了条件和否定词。' },
  oldCase: { name: '旧事故移交单', type: 'evidence', description: '当年未通过的检查被记为通过，司钟人是签字者之一。' },
  missing: { name: '二十七人转运记录', type: 'evidence', description: '医疗站已转移到旧礼拜堂，系统却仍按旧地点宣称完成撤离。' },
  stretcher: { name: '担架与急救包', type: 'tool', description: '供两名无法独立行走的伤员使用；救援后仍保留记录。' },
  plan: { name: '控制室维护图', type: 'clue', description: '新增的“最后处置”不是正规保护流程，必须由现场技师确认隔离结果。' },
};
const FLAG_NAMES = ['incident', 'video', 'barrier', 'recording', 'authorization', 'edited', 'ian', 'oldCase', 'roster', 'missing', 'medical', 'cover', 'ramp', 'walking', 'evacuated', 'route', 'technicians', 'plan', 'northTeam', 'techTeam', 'controlTeam', 'lawTeam', 'confronted', 'coordinated', 'northSafe', 'isolated', 'restrained'];
const CHAPTERS = [null, '被剪掉的半句话', '礼拜堂的台阶', '钟楼中的人', '傍晚的苹果派'];
const evidenceIds = s => s.inventory.filter(id => ITEMS[id]?.type === 'evidence');
const clone = value => JSON.parse(JSON.stringify(value));
const message = (text, kind = 'story', speaker) => ({ kind, ...(speaker ? { speaker } : {}), text });
const unchanged = (s, text, kind = 'system', speaker) => ({ state: s, messages: [message(text, kind, speaker)], changed: false });
const adjacent = (a, b) => CONNECTIONS.some(([x, y]) => (x === a && y === b) || (y === a && x === b));
const evidenceName = id => ITEMS[id].name;

export function createGame() {
  return {
    schema: 1, location: 'bakery', minutesLeft: 180, rescued: 0, chapter: 1, trust: 0,
    flags: Object.fromEntries(FLAG_NAMES.map(key => [key, false])), inventory: ['terminal'],
    visited: ['bakery'], backups: [], cgUnlocked: ['bakery'], turns: 0, ending: null,
    journal: [{ title: '09:00 · 清晨', text: '你是罗德岛博士。早餐之后本应去核对药品交接。先观察街道，或与能天使说几句话。' }],
  };
}

function endingFor(s, id) {
  if (id === 'good') return {
    id, title: '没有第十三声', subtitle: '二十七人获救，真相得以留下', grade: 'S',
    paragraphs: [
      '第十二声余音散去，额外的提示声没有响起。能天使确认最后两副担架已经离开，菲亚梅塔与获救技师完成隔离，送葬人将司钟人带离控制台。',
      '完整录像、旧事故记录与遗漏名单已经备份。今天的救援与三年前的责任，都有能够相互印证的材料。你没有替同伴决定每一步，而是让他们凭各自的判断完成了任务。',
      '傍晚，你们坐在礼拜堂前分一盒压坏的苹果派。小女孩问，是否应该听有光环的人说话。你说：“先听听他说什么，再看看他做了什么。”',
    ],
  };
  if (id === 'ordinary') return {
    id, title: '迟到的早餐', subtitle: '人们平安归来，调查仍待继续', grade: 'A',
    paragraphs: [
      '主控被隔离，二十七名居民全部撤离。司钟人的伪命令停止了，外部救援终于穿过北侧通路。',
      '现有证据足以追查今天的越权行为，但旧事故材料或完整的备份还不齐全。送葬人提醒，救援结束不意味着调查结束；能确认的事实必须逐项补齐。',
      '苹果派已经凉了，大家仍给你留了一块。今天你们救下了真实的人。下一次，也许可以让更多真相留下。',
    ],
  };
  return {
    id: 'failure', title: '仍然响起的钟声', subtitle: '行动未能在最后处置前完成', grade: 'C',
    paragraphs: [
      `第十三声提示响起。外援接手了紧急处置，你的行动被迫中止。本次已撤出礼拜堂 ${s.rescued} / 27 人；尚未完成的救援由赶来的队伍继续承担。`,
      '结果不会由一枚光环或一句口号改变。复盘中最重要的，是核验信息、准备通路，把明确的目标交给合适的人。',
      '可以查看日志与已解锁画面，或点击“重新开始”按钮，回到那份还温热的早餐。',
    ],
  };
}

function finish(s, id) {
  s.ending = endingFor(s, id);
  // The ending advances through noon into the evening epilogue.
  s.minutesLeft = 0;
  s.chapter = 4;
  s.journal.push({ title: s.ending.title, text: s.ending.subtitle });
}

function commit(source, cost, apply, text, title, speaker) {
  const s = clone(source);
  s.minutesLeft = Math.max(0, s.minutesLeft - cost);
  s.turns++;
  const out = [];
  if (s.minutesLeft === 0) {
    finish(s, 'failure');
    out.push(message('正午已经到来，最后处置先于你的下一步行动启动。点击“重新开始”按钮可以重试。', 'warning'));
  } else {
    apply(s);
    out.push(message(text, speaker ? 'npc' : 'success', speaker));
    if (title) s.journal.push({ title, text });
    if (!s.ending && s.minutesLeft <= 10) out.push(message(`距最后处置还剩 ${s.minutesLeft} 分钟。查看、交谈与提示不耗时，请先确定下一步。`, 'warning'));
  }
  return { state: s, messages: out, changed: true };
}

function gate(s, target) {
  if (!s.flags.incident && target !== 'bakery') return '先观察店外街道，确认刚才的响声。';
  if (target === 'chapel' && !s.flags.missing) return '先在广场查看名单，并核对转运记录，确认礼拜堂内的人。';
  if (['roof', 'control', 'tower'].includes(target) && !s.flags.route) return '礼拜堂救援完成后，向莫斯提马寻找备用路线。';
  return '';
}

const ACTIONS = {
  incident: { label: '观察店外街道', command: '观察街道', at: ['bakery'], flag: 'incident', cost: 1,
    text: '一声闷响惊动了街道。广播让居民进入尚未验收的东侧通道。能天使收起笑容，先去拦住人群；你需要到广场核验命令。', title: '广播与眼前的事实', },
  video: { label: '调查事故广播', command: '调查广播', at: ['plaza'], flag: 'video', cost: 1,
    text: '显示屏上的人是你，话却被剪成了另一个意思。两名警戒人员要求你交出终端。送葬人来到一旁：“先出示原始授权。”', title: '被剪辑的影像' },
  recording: { label: '调出完整录像', command: '查看终端', flag: 'recording', cost: 1, needs: [['video', '先到广场调查正在播放的广播影像。']], item: 'recording',
    text: '终端里保存着完整录像：“复检通过前，封闭东侧通道；如发生故障，不得让北门暂停通行。”原始文件没有被改动。', title: '完整的半句话' },
  authorization: { label: '请送葬人核验授权', command: '核验授权', at: ['plaza'], flag: 'authorization', cost: 2, needs: [['video', '先调查广场广播，取得警戒人员出示的处置令。']], item: 'authorization',
    text: '“印章是真的，用途不是。”送葬人指出：维护授权不包括拘押、封锁救援与接管医疗转运。请把它与本地录像一起比对。', title: '真实印章，错误用途', speaker: '送葬人' },
  edited: { label: '比对两份录像与授权', command: '比对录像', flag: 'edited', cost: 2, item: 'edited', needs: [['recording', '先查看终端中的完整录像。'], ['authorization', '先请送葬人在广场核验授权。']],
    text: '你找到了被删去的条件与否定词。警戒人员撤回拘押要求，开始核实外部报告。广播声称“已经无人”的街区，明明还有求援的人。', title: '证据一 · 剪辑与越权' },
  barrier: { label: '检查维修挡板', command: '检查挡板', at: ['tunnel'], flag: 'barrier', cost: 1,
    text: '验收牌标着“暂停使用”。通道内部落下碎石，侧门有人拍打。这里不适合作为撤离路线。', title: '被伪报为安全的出口' },
  ian: { label: '救助维修工伊恩', command: '救助伊恩', at: ['tunnel'], flag: 'ian', cost: 2, needs: [['barrier', '先检查维修挡板，找到侧门内求救的人。']],
    text: '你和能天使把伊恩扶出侧门，送到广场医疗点。他紧握防水袋：“不是修理。有人在抹掉当年的记录。”袋中材料可以由你查看。', title: '活着的证人' },
  oldCase: { label: '检查伊恩的防水袋', command: '检查防水袋', at: ['tunnel', 'plaza'], flag: 'oldCase', cost: 2, item: 'oldCase', needs: [['ian', '先在东侧通道救助伊恩，获得查看材料的许可。']],
    text: '移交单证明三年前有一项检查未通过，完成报告却写着通过。司钟人的签名就在下面。他的妹妹也在那次事故中遇难。痛苦无法抹去他需要承担的责任。', title: '证据二 · 旧事故移交单' },
  roster: { label: '查看撤离名单', command: '查看名单', at: ['plaza'], flag: 'roster', cost: 1, needs: [['edited', '先比对录像和授权，解除错误处置令。']],
    text: '系统名单写着撤离接近完成。能天使拿来居民口述的另一份名单，两边对不上。应去核对医疗站的转运记录。', title: '少掉的名字', speaker: '能天使' },
  missing: { label: '核对医疗转运记录', command: '核对转运记录', at: ['plaza'], flag: 'missing', cost: 2, item: 'missing', needs: [['roster', '先查看广场撤离名单。']], effect: s => { s.chapter = 2; },
    text: '二十七个人被漏掉了。医疗站漏水后，他们移入旧礼拜堂，其中两人无法自行行走。面包店女孩的母亲是护理员，也带着孩子回去帮忙了。带上担架再出发。', title: '证据三 · 二十七人仍在里面' },
  medical: { label: '准备担架和急救包', command: '准备担架', at: ['plaza'], flag: 'medical', cost: 2, item: 'stretcher', needs: [['missing', '先核对转运记录，弄清需要哪些救援准备。']],
    text: '你取到两副担架和急救包。医疗人员提醒：先清出稳定通路，再转移不能走动的伤员。', title: '为真实的人做准备' },
  cover: { label: '安排同伴掩护', command: '安排掩护', at: ['chapel'], flag: 'cover', cost: 2,
    text: '能天使从侧巷压住看守的行动，菲亚梅塔守住入口，避开居民的疏散方向。“里面归你，外面归我。”', title: '礼拜堂的分工', speaker: '菲亚梅塔' },
  ramp: { label: '铺设安全通路', command: '铺设安全通路', at: ['chapel'], flag: 'ramp', cost: 2,
    text: '你检查门槛，用礼拜堂里的木板和卷布垫平断口。莫斯提马确认门廊还能短暂通行，提醒先送能走的人，再抬担架。', title: '地图上的箭头变成了路' },
  walking: { label: '引导居民撤离', command: '疏散居民', at: ['chapel'], flag: 'walking', cost: 4, needs: [['medical', '缺少担架和急救包：先返回广场准备担架。'], ['cover', '先安排能天使与菲亚梅塔掩护。'], ['ramp', '先铺设安全通路，避免人群卡在断裂门槛。']], effect: s => { s.rescued = 25; },
    text: '二十五人通过通路。你握住女孩滑落的手，告诉她不要回头捡纸盒。礼拜堂内还留着两名必须用担架转移的伤员。', title: '25 / 27 · 还差两副担架' },
  evacuated: { label: '转移最后两名伤员', command: '转移伤员', at: ['chapel'], flag: 'evacuated', cost: 4, needs: [['walking', '先疏散能够行走的居民，腾出担架通道。']], effect: s => { s.rescued = 27; s.chapter = 3; s.minutesLeft = Math.min(s.minutesLeft, 30); },
    text: '最后两副担架越过门槛。二十七个人，一个不少。救援让你错过钟楼侧门的窗口；此刻已接近十一点半，距非法“最后处置”至多三十分钟。莫斯提马知道另一条路。', title: '27 / 27 · 人们先离开，近路已经关闭' },
  route: { label: '请莫斯提马寻找备用路线', command: '寻找备用路线', at: ['chapel'], flag: 'route', cost: 1, needs: [['evacuated', '先完成礼拜堂的二十七人救援。']],
    text: '“地图修改时总会忘掉一些路。”莫斯提马指向屋顶维护路。伊恩传来消息：两名技师仍被困在维护层，他们能够确认控制系统的隔离结果。', title: '屋顶上的另一条路', speaker: '莫斯提马' },
  technicians: { label: '搜救维护层技师', command: '搜救技师', at: ['roof'], flag: 'technicians', cost: 2,
    text: '你找到两名被锁在维护层的技师。莫斯提马护住松动的构件，让他们安全出来。两人确认，新增的“最后处置”已被人为篡改，愿意协助核验主控。', title: '熟悉设施的人获救' },
  plan: { label: '检查控制台与维护图', command: '检查控制台', at: ['control'], flag: 'plan', cost: 2, item: 'plan',
    text: '维护图与屏幕上的处置清单不同。那不是正常保护程序。菲亚梅塔可以接管这里，但最后隔离必须交给熟悉系统的技师确认。你不需要猜线路。', title: '控制室里的证据与分工' },
  confronted: { label: '质问司钟人', command: '质问司钟人', at: ['tower'], flag: 'confronted', cost: 2,
    text: '司钟人说，混乱来自不服从的人。你回答：“计划里必须装得下真实的人。站不起来的伤员，不会因为箭头画得笔直就突然走得更快。”他退到控制台前。', title: '钟楼中的争执' },
  coordinated: { label: '明确目标，授权同伴协同', command: '授权协同', at: ['tower'], flag: 'coordinated', cost: 1, needs: [['confronted', '先质问司钟人，稳住钟楼上层的局面。'], ['northTeam', '分工还缺能天使：安排她护送居民。'], ['controlTeam', '分工还缺菲亚梅塔：安排她接管控制室。'], ['techTeam', '分工还缺莫斯提马：安排她接应技师。'], ['lawTeam', '分工还缺送葬人：安排他核验封锁令。']],
    text: '“目标不变：先救人，再阻止毁坏。各处情况由你们判断，不必等我逐项确认。”四个应答陆续传来。你把目标交给同伴，而不是把所有决定握在自己手里。', title: '共同判断' },
  northSafe: { label: '确认北侧居民已撤离', command: '确认居民撤离', at: ['tower'], flag: 'northSafe', cost: 1, needs: [['coordinated', '先完成四位同伴分工，并授权协同。']],
    text: '能天使确认最后两副担架通过北侧窄道，送葬人核验的外援可以进来了。你松开一直攥紧的左手。', title: '居民离开危险范围', speaker: '能天使' },
  isolated: { label: '通知控制室隔离主控', command: '隔离主控', at: ['tower', 'control'], flag: 'isolated', cost: 2, needs: [['coordinated', '先完成钟楼队员分工并授权协同，再通知菲亚梅塔执行。'], ['northSafe', '先确认居民撤离，避免设施变化影响担架通行。']],
    text: '广播里的命令突然卡顿。菲亚梅塔接管控制室，获救技师确认非法处置已与主控隔离。她提醒：“别让他再碰操作柄。”', title: '主控隔离', speaker: '菲亚梅塔' },
  restrained: { label: '配合送葬人制止操作', command: '制止司钟人', at: ['tower'], flag: 'restrained', cost: 1, needs: [['isolated', '先确认居民撤离，再通知控制室隔离主控。']], effect: s => { finish(s, s.backups.length === 3 && s.inventory.includes('oldCase') ? 'good' : 'ordinary'); },
    text: '司钟人伸向操作柄。送葬人截住他的手臂，你移开倒下的椅子，将他与控制台分开。第十二声消散，没有新的提示声接上来。', title: '没有第十三声' },
};

function normalize(input) {
  return typeof input === 'string' ? input.trim().replace(/[，。！？!?]+$/g, '').replace(/\s+/g, '') : '';
}
const ALIASES = {
  观察: '查看', 看: '查看', 环顾: '查看', 看看: '查看', look: '查看', l: '查看', map: '地图', inventory: '背包', i: '背包', help: '帮助', '?': '帮助', journal: '日志',
  调查街道: '观察街道', 观察店外街道: '观察街道', 调查公告: '调查广播', 观察广播: '调查广播', 查看录像: '查看终端',
  检查终端: '查看终端', 调取录像: '查看终端', 检查授权: '核验授权', 对照录像: '比对录像',
  调查挡板: '检查挡板', 救伊恩: '救助伊恩', 询问伊恩: '检查防水袋', 调查防水袋: '检查防水袋',
  调查名单: '查看名单', 核对名单: '核对转运记录', 准备医疗用品: '准备担架', 检查门槛: '铺设安全通路',
  救援居民: '疏散居民', 救援伤员: '转移伤员', 寻找通路: '寻找备用路线', 救援技师: '搜救技师',
  调查控制台: '检查控制台', 交接证据: '备份证据', 保存证据: '备份证据', 协同: '授权协同',
  重来: '重新开始', restart: '重新开始', wait: '等待',
};

// Flags only move forward. Complete necessary work where we already are, then
// search the actual roads; never search permutations of independent team calls.
// The rescue's clock jump is modelled explicitly, so early evidence work is not
// mistaken for an equally cheap detour after 11:30.
function planMission(source, goal, ignoreDeadline = false) {
  const optional = ['barrier', 'ian', 'oldCase'];
  const all = Object.values(ACTIONS);
  const rescueEnd = goal === 'rescue25' ? 'walking' : goal === 'rescue27' ? 'evacuated' : null;
  const jobs = (rescueEnd ? all.slice(0, all.findIndex(a => a.flag === rescueEnd) + 1) : all)
    .filter(a => goal === 'good' || !optional.includes(a.flag));
  const fullEvidence = s => ['edited', 'oldCase', 'missing'].every(id => s.flags[id]);
  const complete = s => rescueEnd ? s.flags[rescueEnd] : s.flags.restrained;
  const step = (s, choice, cost, apply) => {
    if (!ignoreDeadline && s.minutesLeft <= cost) return false;
    s.minutesLeft -= cost;
    s.spent += cost;
    s.path.push(choice);
    apply(s);
    return true;
  };
  const prepare = node => {
    const s = { ...node, flags: { ...node.flags }, path: [...node.path] };
    let changed;
    do {
      changed = false;
      for (const a of jobs) {
        if (s.flags[a.flag] || (a.at && !a.at.includes(s.location)) || a.needs?.some(([flag]) => !s.flags[flag])) continue;
        if (goal === 'good' && ['evacuated', 'restrained'].includes(a.flag) && (!fullEvidence(s) || !s.backedUp)) continue;
        if (!step(s, { command: a.command, label: a.label }, a.cost, n => {
          n.flags[a.flag] = true;
          if (a.flag === 'evacuated') n.minutesLeft = Math.min(n.minutesLeft, 30);
        })) return null;
        changed = true;
        if (complete(s)) return s;
      }
      if (goal === 'good' && fullEvidence(s) && !s.backedUp) {
        if (!step(s, { command: '备份证据', label: '交接证据副本' }, 1, n => { n.backedUp = true; })) return null;
        changed = true;
      }
      if (!rescueEnd && s.flags.evacuated) for (const p of PEOPLE) {
        if (s.flags[p.flag] || (p.flag === 'controlTeam' && !s.flags.plan) || (p.flag === 'techTeam' && !s.flags.technicians)) continue;
        if (!step(s, { command: `安排 ${p.name} ${p.task}`, label: `${p.name} · ${p.task}` }, 1, n => { n.flags[p.flag] = true; })) return null;
        changed = true;
      }
    } while (changed);
    return s;
  };
  const first = prepare({ location: source.location, flags: source.flags, minutesLeft: source.minutesLeft, backedUp: source.backups.length === 3, spent: 0, path: [] });
  if (!first) return null;
  const queue = [first];
  const seen = new Map();
  while (queue.length) {
    queue.sort((a, b) => a.spent - b.spent || b.minutesLeft - a.minutesLeft);
    const s = queue.shift();
    const key = `${s.location}/${FLAG_NAMES.map(flag => +s.flags[flag]).join('')}/${+s.backedUp}`;
    const prior = seen.get(key) || [];
    if (prior.some(p => p.spent <= s.spent && p.minutesLeft >= s.minutesLeft)) continue;
    seen.set(key, [...prior.filter(p => p.spent < s.spent || p.minutesLeft > s.minutesLeft), { spent: s.spent, minutesLeft: s.minutesLeft }]);
    if (complete(s)) return s.path;
    for (const pair of CONNECTIONS) {
      if (!pair.includes(s.location)) continue;
      const id = pair.find(location => location !== s.location);
      if (gate(s, id)) continue;
      const moved = { ...s, path: [...s.path] };
      if (!step(moved, { command: `去 ${LOCATIONS[id].name}`, label: `前往${LOCATIONS[id].name}` }, 1, n => { n.location = id; })) continue;
      const next = prepare(moved);
      if (next) queue.push(next);
    }
  }
  return null;
}

const HINT_REASONS = {
  观察街道: '店外的异响打断了早餐，先确认现场发生了什么。',
  调查广播: '广播指向尚未验收的通道，需要先查清公开命令的内容。',
  查看终端: '用终端保存的原始录像核对广播，找回被删掉的上下文。',
  核验授权: '请送葬人核实授权的适用范围，确认维护人员是否有权封锁救援。',
  比对录像: '把完整录像与授权放在一起，才能证明公开命令经过剪辑并越权。',
  检查挡板: '通道里传来求救声，先检查挡板与侧门，找到被困者的位置。',
  救助伊恩: '先把受伤的伊恩扶出危险区域，才能听取证言并查看他保管的材料。',
  检查防水袋: '伊恩留下的移交单能核实旧事故的验收经过与签字责任。',
  查看名单: '将系统名单与居民提供的信息对照，找出被遗漏的人。',
  核对转运记录: '医疗站曾经搬迁，转运记录能确认失联居民现在的位置和救援需求。',
  准备担架: '两名伤员不能自己走动，出发前带齐担架与急救包。',
  安排掩护: '看守正在逼近入口，先让同伴守住居民撤离的方向。',
  铺设安全通路: '门槛已经断裂，先铺平断口，让居民与担架都能安全通过。',
  疏散居民: '先让能够行走的二十五人离开，为后面的担架腾出通道。',
  转移伤员: '最后两名伤员无法自行行走，需要用准备好的担架送出礼拜堂。',
  寻找备用路线: '钟楼侧门的窗口已经错过，请莫斯提马确认屋顶维护路。',
  搜救技师: '被困技师熟悉设施，救出他们后才能可靠地确认主控隔离结果。',
  检查控制台: '对照控制台与维护图，查清被篡改的处置流程并明确接管目标。',
  质问司钟人: '先稳住司钟人，让各处同伴获得完成配合的机会。',
  授权协同: '四处任务已经分配，把共同目标交给同伴，避免每一步都等待你确认。',
  确认居民撤离: '先确认最后两副担架已通过北侧通路，防止设施变化影响救援。',
  隔离主控: '居民已经安全撤离，让菲亚梅塔与技师切断非法处置对主控的影响。',
  制止司钟人: '主控已经隔离，配合送葬人阻止司钟人再次触碰操作柄。',
  备份证据: '三组材料已经齐全，先交接可信副本，避免原件受损后失去证据。',
  '安排 能天使 护送居民': '让能天使守住北侧护送线，并确认最后两副担架离开危险范围。',
  '安排 莫斯提马 接应技师': '让莫斯提马接应获救技师，使熟悉设施的人能够支援控制室。',
  '安排 菲亚梅塔 接管控制室': '让菲亚梅塔守住控制台，准备与技师共同隔离非法流程。',
  '安排 送葬人 核验封锁令': '让送葬人核验封锁令与外援身份，为救援队进入北侧通路创造条件。',
};

/** A free, deterministic next choice. Commands always match a visible button. */
export function getHint(state) {
  const s = validateSave(state) ? state : createGame();
  if (s.ending) return { command: '日志', label: '回看日志', reason: '本次行动已结束，可以回看经过；再次挑战请点击“重新开始”按钮。' };
  let plan = planMission(s, 'good');
  let reason = '时间尚够，可以兼顾救援与完整证据。';
  if (!plan?.length) {
    plan = planMission(s, 'ordinary');
    reason = '时间不足以补齐全部证据，先保住二十七人并制止处置。';
  }
  if (!plan?.length) {
    plan = (!s.flags.evacuated && planMission(s, 'rescue27')) || (!s.flags.walking && planMission(s, 'rescue25'));
    reason = '时间不足以完成全部处置，先救出仍能转移的居民。';
  }
  if (!plan?.length) {
    plan = planMission(s, 'ordinary', true);
    reason = '剩余时间已非常紧张，先推进眼前的救援与处置，避免折返。';
  }
  const next = plan?.[0];
  if (!next) return { command: '提示', label: '听取行动建议', reason: '可以查看现场与日志，确认当前行动。' };
  if (next.command.startsWith('去 ')) {
    const nextAction = plan.find(item => !item.command.startsWith('去 '));
    reason = `沿相邻道路前往，接下来需要${nextAction?.label || '完成现场处置'}。${reason}`;
  } else reason = `${HINT_REASONS[next.command] || ''}${reason}`;
  return { ...next, reason };
}

const hintText = s => {
  const next = getHint(s);
  return `建议选择“${next.label}”。${next.reason}`;
};

function nextObjective(s) {
  const f = s.flags;
  if (s.ending) return [s.ending.subtitle, '可以查看日志、背包、地图与图鉴。点击“重新开始”按钮再次挑战。'];
  if (!f.incident) return ['与能天使吃完这份早餐，观察店外的异响。', '选择“观察店外街道”行动，看看刚才发生了什么。'];
  if (!f.video) return ['到白钟广场查明广播与现场为何矛盾。', '选择通往“白钟广场”的出口，再选择“调查事故广播”行动。'];
  if (!f.edited) return ['证明命令经过剪辑，核实授权范围。', !f.recording ? '选择“调出完整录像”行动，查看本地记录。' : !f.authorization ? '在广场选择“请送葬人核验授权”行动。' : '选择“比对两份录像与授权”行动，将材料一起核实。'];
  if (!f.missing) return ['核对真实人数，找到被遗漏的居民。', !f.roster ? '在广场查看名单；东侧通道还有一位证人可调查。' : '核对转运记录，不要只相信“已完成撤离”。'];
  if (!f.evacuated) return [`将礼拜堂里的二十七人转移到安全处（${s.rescued}/27）。`, !f.medical ? '先在广场准备担架。' : !f.cover ? '到礼拜堂安排掩护。' : !f.ramp ? '铺设安全通路，让担架也能通过。' : !f.walking ? '先疏散能够行动的居民。' : '转移最后两名伤员。'];
  if (!f.route) return ['近路已经关闭，寻找通往钟楼的备用路线。', '在礼拜堂选择“请莫斯提马寻找备用路线”行动。'];
  if (!f.technicians) return ['先救出维护层的技师。', '前往屋顶，搜救技师；他们能判断隔离是否成功。'];
  if (!f.plan) return ['弄清控制室里的非法处置流程。', '从屋顶前往控制室，检查控制台。'];
  const missing = PEOPLE.find(p => !f[p.flag]);
  if (missing) return ['给四位同伴分配相互配合的任务。', `选择“${missing.name} · ${missing.task}”行动。已有证据也可以选择“交接证据副本”保存。`];
  if (!f.confronted) return ['前往钟楼，阻止司钟人继续操作。', '控制室与钟楼不直接相连：先回屋顶，再去钟楼。'];
  if (!f.coordinated) return ['稳住局面，让同伴独立完成各自任务。', '在钟楼选择“明确目标，授权同伴协同”行动。'];
  if (!f.northSafe) return ['确认居民已经离开设施危险范围。', '选择“确认北侧居民已撤离”行动。'];
  if (!f.isolated) return ['让菲亚梅塔与技师隔离非法主控。', '选择“通知控制室隔离主控”行动。'];
  return ['配合送葬人，阻止司钟人最后一次操作。', '选择“配合送葬人制止操作”行动。证据备份不会因为对峙开始而失效。'];
}

function description(s) {
  const f = s.flags;
  const text = {
    bakery: f.incident ? '苹果派留在柜台上，街口升起灰烟。能天使已去广场拦住人群，店主正在帮助邻居关门。' : '九点的钟声还在石拱门间回荡。能天使捧着热苹果派，小女孩好奇地看着你兜帽上方的白金光环。今天本该只是一次普通交接。',
    plaza: '广场四角的广播还在宣读命令。警戒人员、居民与医疗队聚在这里。桌上有撤离名单、转运记录和救援物资；东侧通道传来求救声。',
    tunnel: f.ian ? '伊恩已送往广场。挡板后的通道不能通行，他留下的防水袋记录着三年前的一次验收。' : '维修挡板没有拆，验收牌上的字被灰尘盖住。侧门内有人拍打；这里与广播承诺的安全出口完全不同。',
    chapel: f.evacuated ? '二十七人已经撤出礼拜堂。近路关闭的提示仍停在终端上，莫斯提马指着屋顶之间一条窄窄的维护路。' : '彩色玻璃缺了一角，病床沿墙排列。看守逼近入口，两名伤员不能自己走动。断裂门槛、掩护与担架都需要安排。',
    roof: '屋顶之间的窄桥绕过了封死的侧门。维护层有两名技师被困；前方分别通向广播控制室与钟楼上层。',
    control: f.isolated ? '错误广播已经停止。技师正在复核隔离结果，菲亚梅塔守住控制台。钟楼上层仍需你与送葬人完成最后行动。' : '屏幕上的处置清单与纸质维护图不符。菲亚梅塔等待明确目标，获救技师能协助确认系统状态；没有人要求你凭空猜测线路。',
    tower: f.confronted ? '铜钟上方的齿轮缓缓转动。司钟人仍守着控制台。你的队内终端保持接通，四位同伴等待的是目标，不是每一步都由你代答。' : '巨大钟面透进白昼。司钟人穿着磨旧的工作外套，站在操作柄旁。正午的最后处置仍未被取消。',
  };
  return text[s.location];
}

function readCommand(s, cmd) {
  if (['查看', '状态'].includes(cmd)) return unchanged(s, `${description(s)}\n当前目标：${nextObjective(s)[0]}`);
  if (cmd === '提示') return unchanged(s, hintText(s));
  if (cmd === '帮助') return unchanged(s, '选择行动按钮调查现场、准备救援与分配任务；选择相邻出口移动，点击同伴可听取建议。地图、背包、日志与图鉴帮助你回看信息。查看、交谈与已完成行动不耗时，移动和新的行动会推进时间。“等待五分钟”是可选行动，会消耗5分钟。点击“重新开始”按钮可从早餐重来。');
  if (cmd === '地图') return unchanged(s, `你在${LOCATIONS[s.location].name}。相邻地点：${CONNECTIONS.filter(pair => pair.includes(s.location)).map(pair => pair.find(id => id !== s.location)).map(id => `${LOCATIONS[id].name}${gate(s, id) ? '（暂不可达）' : ''}`).join('、')}。`);
  if (cmd === '背包') return unchanged(s, s.inventory.map(id => `${ITEMS[id].name}：${ITEMS[id].description}`).join('\n'));
  if (cmd === '日志') return unchanged(s, s.journal.map(j => `${j.title}｜${j.text}`).join('\n'));
  if (cmd === '图鉴') return unchanged(s, `已解锁画面：${s.cgUnlocked.map(id => ({ bakery: '清晨苹果派店', chapel: '礼拜堂救援', tower: '钟楼对峙' })[id]).join('、')}。\n博士：罗德岛指挥者，兜帽上方悬着一枚白金色光环。能天使：负责护送的萨科塔。菲亚梅塔：担任掩护的黎博利。莫斯提马：寻找通路的信使。送葬人：核验授权与交接证据的执行者。`);
  return null;
}

export function execute(state, command) {
  if (!validateSave(state)) return unchanged(createGame(), '存档内容不完整，已准备新的旅程。请点击“重新开始”按钮。', 'warning');
  let cmd = normalize(command);
  cmd = ALIASES[cmd] || cmd;
  if (cmd === '重新开始') return { state: createGame(), messages: [message('清晨九点，苹果派还没有凉。你重新回到面包店门口。')], changed: true };
  const read = readCommand(state, cmd);
  if (read) return read;
  if (!cmd) return unchanged(state, '可以查看现场，或选择一个行动按钮。');
  const talkName = cmd.replace(/^(交谈|对话|联系|询问)/, '');
  const person = PEOPLE.find(p => p.name === talkName || p.id === talkName);
  if (person) return unchanged(state, `${state.flags[person.flag] ? `我正在${person.task}。` : '队内通讯畅通。'}${hintText(state)}`, 'npc', person.name);
  if (state.ending) return unchanged(state, '这次行动已经结束。仍可查看地图、图鉴、背包和日志，或点击“重新开始”按钮。');
  if (/^(去|前往|移动到|走向|go)/.test(cmd)) {
    const name = cmd.replace(/^(移动到|前往|走向|去|go)/, '');
    const target = LOCATION_NAMES[name] || (Object.hasOwn(LOCATIONS, name) ? name : null);
    if (!target) return unchanged(state, '没有找到这个地点。请在地图中选择相邻地点，或选择一个出口。', 'warning');
    if (target === state.location) return unchanged(state, `你已经在${LOCATIONS[target].name}，可以查看现场或选择行动。`);
    if (!adjacent(state.location, target)) return unchanged(state, `从${LOCATIONS[state.location].name}不能直接前往${LOCATIONS[target].name}。请沿地图上的相邻道路行走。`, 'warning');
    const reason = gate(state, target);
    if (reason) return unchanged(state, reason, 'warning');
    return commit(state, 1, s => {
      s.location = target;
      if (!s.visited.includes(target)) s.visited.push(target);
      const cg = LOCATIONS[target].cg;
      if (!s.cgUnlocked.includes(cg)) s.cgUnlocked.push(cg);
    }, `你来到${LOCATIONS[target].name}。${description({ ...state, location: target })}`);
  }
  if (cmd === '等待') return commit(state, 5, () => {}, '你观察了一段时间。广播没有自行停止，钟楼的指针仍在向正午移动。', '五分钟过去了');
  if (cmd === '备份证据') {
    const ids = evidenceIds(state);
    if (!ids.length) return unchanged(state, '先收集可核实的证据，例如比对完整录像与维护授权。', 'warning');
    if (ids.every(id => state.backups.includes(id))) return unchanged(state, '手中的证据已有副本交给外部同僚，不需要重复交接。');
    return commit(state, 1, s => { s.backups = [...ids]; }, `送葬人通过可信的联络渠道交接了${ids.map(evidenceName).join('、')}。即使原件损毁，事实也不会只剩司钟人的说法。`, '证据副本已交接', '送葬人');
  }
  if (cmd.startsWith('安排')) {
    const p = PEOPLE.find(p => cmd === `安排${p.name}${p.task}`);
    if (p) {
      if (state.flags[p.flag]) return unchanged(state, `${p.name}已经在执行这项任务。`);
      if (!state.flags.evacuated) return unchanged(state, '先完成礼拜堂救援，再安排钟楼阶段的分工。', 'warning');
      if (p.flag === 'controlTeam' && !state.flags.plan) return unchanged(state, '先到广播控制室检查控制台，明确接管目标。', 'warning');
      if (p.flag === 'techTeam' && !state.flags.technicians) return unchanged(state, '先在屋顶维护路搜救技师，再安排接应。', 'warning');
      return commit(state, 1, s => { s.flags[p.flag] = true; s.trust++; }, `${p.name}收到目标：${p.task}。现场细节交由同伴判断，保持队内联络。`, `${p.name}的任务`, p.name);
    }
  }
  const action = Object.values(ACTIONS).find(a => normalize(a.command) === cmd);
  if (action) {
    if (state.flags[action.flag]) return unchanged(state, '这一步已经完成，结果已经记在日志中。');
    if (action.at && !action.at.includes(state.location)) return unchanged(state, `这项行动需要在${action.at.map(id => LOCATIONS[id].name).join('或')}进行。`, 'warning');
    const missing = action.needs?.find(([key]) => !state.flags[key]);
    if (missing) return unchanged(state, missing[1], 'warning');
    return commit(state, action.cost, s => {
      s.flags[action.flag] = true;
      if (action.item && !s.inventory.includes(action.item)) s.inventory.push(action.item);
      action.effect?.(s);
    }, action.text, action.title, action.speaker);
  }
  return unchanged(state, '这项行动暂时不可用。请选择当前行动按钮，或查看帮助；没有消耗时间。', 'warning');
}

export function getView(state) {
  const s = validateSave(state) ? state : createGame();
  const [objective] = nextObjective(s);
  const nextAction = getHint(s);
  const hint = `建议选择“${nextAction.label}”。${nextAction.reason}`;
  const exits = CONNECTIONS.filter(pair => pair.includes(s.location)).map(pair => pair.find(id => id !== s.location)).map(id => ({
    id, name: LOCATIONS[id].name, command: `去 ${LOCATIONS[id].name}`, locked: Boolean(s.ending || gate(s, id)), reason: s.ending ? '本次行动已经结束' : gate(s, id),
  }));
  const actions = s.ending ? [{ label: '重新开始', command: '重新开始' }, { label: '回看日志', command: '日志' }] : Object.values(ACTIONS)
    .filter(a => !s.flags[a.flag] && (!a.at || a.at.includes(s.location)) && (!a.needs || a.needs.every(([flag]) => s.flags[flag])))
    .map(a => ({ label: a.label, command: a.command }));
  if (!s.ending) {
    if (evidenceIds(s).some(id => !s.backups.includes(id))) actions.push({ label: '交接证据副本', command: '备份证据' });
    if (s.flags.evacuated) for (const p of PEOPLE) {
      if (!s.flags[p.flag] && (p.flag !== 'controlTeam' || s.flags.plan) && (p.flag !== 'techTeam' || s.flags.technicians)) {
        actions.push({ label: `${p.name} · ${p.task}`, command: `安排 ${p.name} ${p.task}` });
      }
    }
    actions.push({ label: '听取行动建议', command: '提示' });
    actions.push({ label: '等待五分钟（可选）', command: '等待' });
  }
  return {
    location: { id: s.location, ...LOCATIONS[s.location], description: description(s) },
    chapter: { number: s.chapter, title: CHAPTERS[s.chapter] }, objective, hint, nextAction, exits, actions,
    inventory: s.inventory.map(id => ({ id, ...ITEMS[id] })),
    companions: PEOPLE.map(({ id, name, role, flag, task }) => ({ id, name, role, status: s.ending ? '行动结束，正在交接与复盘' : s.flags[flag] ? `正在${task}` : '队内通讯在线' })),
    stats: { minutesLeft: s.minutesLeft, rescued: s.rescued, evidence: evidenceIds(s).length, trust: s.trust },
    ending: clone(s.ending),
    map: Object.entries(LOCATIONS).map(([id, loc]) => ({ id, name: loc.name, x: loc.x, y: loc.y, visited: s.visited.includes(id), current: id === s.location, available: !s.ending && adjacent(s.location, id) && !gate(s, id) })),
    connections: clone(CONNECTIONS), journal: clone(s.journal), cgUnlocked: [...s.cgUnlocked],
  };
}

/** Accept the engine state itself, never a UI/localStorage wrapper. */
export function validateSave(data) {
  try {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.schema !== 1) return false;
    if (JSON.stringify(data).length > 500000) return false;
    const s = data;
    if (!Object.hasOwn(LOCATIONS, s.location) || !Number.isInteger(s.minutesLeft) || s.minutesLeft < 0 || s.minutesLeft > 180) return false;
    if (![0, 25, 27].includes(s.rescued) || !Number.isInteger(s.chapter) || s.chapter < 1 || s.chapter > 4 || !Number.isInteger(s.turns) || s.turns < 0) return false;
    if (!s.flags || typeof s.flags !== 'object' || Array.isArray(s.flags) || Object.keys(s.flags).length !== FLAG_NAMES.length || !FLAG_NAMES.every(key => typeof s.flags[key] === 'boolean')) return false;
    const uniqueKnown = (list, known) => Array.isArray(list) && list.length <= known.length && new Set(list).size === list.length && list.every(id => known.includes(id));
    if (!uniqueKnown(s.inventory, Object.keys(ITEMS)) || !s.inventory.includes('terminal')) return false;
    if (!uniqueKnown(s.visited, Object.keys(LOCATIONS)) || !s.visited.includes('bakery') || !s.visited.includes(s.location)) return false;
    if (s.visited.some(id => gate(s, id))) return false;
    if (!s.flags.incident && FLAG_NAMES.some(key => key !== 'incident' && s.flags[key])) return false;
    if (!uniqueKnown(s.backups, ['edited', 'oldCase', 'missing']) || !s.backups.every(id => s.inventory.includes(id))) return false;
    if (!uniqueKnown(s.cgUnlocked, ['bakery', 'chapel', 'tower']) || !s.cgUnlocked.includes('bakery')) return false;
    if (!Array.isArray(s.journal) || s.journal.length > 10000 || !s.journal.every(j => j && typeof j.title === 'string' && typeof j.text === 'string' && j.title.length < 300 && j.text.length < 6000)) return false;
    if (s.trust !== PEOPLE.filter(p => s.flags[p.flag]).length) return false;
    if (s.flags.evacuated !== (s.rescued === 27) || s.flags.walking !== (s.rescued >= 25)) return false;
    for (const a of Object.values(ACTIONS)) {
      if (a.item && s.flags[a.flag] !== s.inventory.includes(a.item)) return false;
      if (s.flags[a.flag] && a.needs?.some(([flag]) => !s.flags[flag])) return false;
    }
    if (s.flags.route && !s.flags.evacuated) return false;
    if (s.flags.technicians && !s.flags.route) return false;
    if (s.flags.plan && !s.flags.route) return false;
    if (PEOPLE.some(p => s.flags[p.flag]) && !s.flags.evacuated) return false;
    if (s.flags.controlTeam && !s.flags.plan) return false;
    if (s.flags.techTeam && !s.flags.technicians) return false;
    if (s.ending !== null) {
      if (!s.ending || !['good', 'ordinary', 'failure'].includes(s.ending.id) || s.chapter !== 4) return false;
      if (JSON.stringify(s.ending) !== JSON.stringify(endingFor(s, s.ending.id))) return false;
      if (s.ending.id !== 'failure' && (!s.flags.restrained || s.rescued !== 27 || !s.flags.isolated)) return false;
      if (s.ending.id === 'good' && s.backups.length !== 3) return false;
      if (s.ending.id === 'failure' && s.minutesLeft !== 0) return false;
    } else if (s.minutesLeft === 0 || s.flags.restrained || s.chapter !== (s.flags.evacuated ? 3 : s.flags.missing ? 2 : 1)) return false;
    return true;
  } catch { return false; }
}
