import test from 'node:test';
import assert from 'node:assert/strict';

// A missing public API is asserted explicitly, so the first run reports the
// absent behavior instead of aborting with an import exception.
const engine = await import('../engine.mjs').catch(() => ({}));
const api = () => {
  for (const key of ['createGame', 'execute', 'getView', 'validateSave']) {
    assert.equal(typeof engine[key], 'function', `missing engine behavior: ${key}`);
  }
  return engine;
};
function followHints(state = api().createGame(), expected = 'good') {
  const e = api();
  assert.equal(typeof e.getHint, 'function', 'missing engine behavior: getHint');
  const seen = new Set();
  const commands = [];
  while (!state.ending && commands.length < 65) {
    const key = JSON.stringify([state.location, state.flags, state.backups]);
    assert.ok(!seen.has(key), `hint route loops at ${state.location}: ${commands.join(' → ')}`);
    seen.add(key);
    const before = JSON.stringify(state);
    const hint = e.getHint(state);
    const view = e.getView(state);
    assert.equal(JSON.stringify(state), before, 'getting a hint must leave the save untouched');
    assert.deepEqual(Object.keys(hint).sort(), ['command', 'label', 'reason']);
    assert.ok(hint.label && hint.reason);
    const choice = [...view.actions, ...view.exits.filter(exit => !exit.locked)].find(option => option.command === hint.command);
    assert.ok(choice, `hint must be a clickable choice: ${hint.command}`);
    assert.notEqual(hint.command, '等待');
    const read = e.execute(state, '提示');
    assert.equal(read.changed, false);
    assert.equal(JSON.stringify(read.state), before);
    assert.ok(read.messages.some(item => item.text.includes(hint.label) && item.text.includes(hint.reason)));
    assert.deepEqual(view.nextAction, hint);
    commands.push(hint.command);
    const result = e.execute(state, hint.command);
    assert.equal(result.changed, true, `hint should progress: ${hint.command}`);
    assert.equal(e.validateSave(result.state), true);
    state = result.state;
  }
  assert.equal(state.ending?.id, expected, `hint route did not reach ${expected}: ${commands.join(' → ')}`);
  return { state, commands };
}
const investigation = [
  '观察街道', '去 广场', '调查广播', '查看终端', '核验授权', '比对录像',
];
const oldCase = ['去 东侧通道', '检查挡板', '救助伊恩', '检查防水袋', '去 广场'];
const rescue = [
  '查看名单', '核对转运记录', '准备担架', '去 礼拜堂', '安排掩护',
  '铺设安全通路', '疏散居民', '转移伤员', '寻找备用路线', '去 屋顶',
  '搜救技师', '去 控制室', '检查控制台',
];
const deployment = [
  '安排 能天使 护送居民', '安排 菲亚梅塔 接管控制室',
  '安排 莫斯提马 接应技师', '安排 送葬人 核验封锁令',
  '去 屋顶', '去 钟楼', '质问司钟人', '授权协同',
  '确认居民撤离', '隔离主控',
];
function run(commands, state = api().createGame()) {
  for (const command of commands) {
    const result = engine.execute(state, command);
    assert.equal(result.changed, true, `command should progress: ${command}\n${JSON.stringify(result.messages)}`);
    assert.equal(engine.validateSave(result.state), true, `save invalid after ${command}`);
    state = result.state;
  }
  return state;
}

test('new game exposes a serializable single-player scene at 09:00', () => {
  const e = api();
  const state = e.createGame();
  const view = e.getView(state);
  assert.equal(state.schema, 1);
  assert.equal(view.location.id, 'bakery');
  assert.equal(view.stats.minutesLeft, 180);
  assert.equal(view.companions.length, 4);
  assert.equal(view.map.length, 7);
  assert.equal(e.validateSave(JSON.parse(JSON.stringify(state))), true);
});

test('read, invalid and repeated commands do not consume time or mutate input', () => {
  const e = api();
  const start = e.createGame();
  const snapshot = JSON.stringify(start);
  for (const command of ['查看', '地图', '背包', '帮助', '图鉴', '随便胡说', '去 钟楼']) {
    const result = e.execute(start, command);
    assert.equal(result.changed, false, command);
    assert.deepEqual(result.state, start);
    assert.ok(result.messages.length > 0);
  }
  assert.equal(JSON.stringify(start), snapshot);
  const next = run(['观察街道'], start);
  const again = e.execute(next, '观察街道');
  assert.equal(again.changed, false);
  assert.equal(again.state.minutesLeft, next.minutesLeft);
});

test('movement follows edges and chapter gates, with actionable feedback', () => {
  const e = api();
  let state = run(['观察街道', '去 广场']);
  const result = e.execute(state, '去 礼拜堂');
  assert.equal(result.changed, false);
  assert.match(result.messages.map(m => m.text).join(''), /名单|转运/);
  assert.equal(result.state.location, 'plaza');
  assert.equal(e.execute(state, '去 控制室').changed, false);
});

test('evidence is earned by comparing sources and cannot be farmed', () => {
  const e = api();
  const state = run([...investigation, ...oldCase]);
  assert.equal(e.getView(state).stats.evidence, 2);
  assert.equal(e.execute(state, '比对录像').changed, false);
  const returned = run(['去 东侧通道'], state);
  const result = e.execute(returned, '检查防水袋');
  assert.equal(result.changed, false);
  assert.equal(e.getView(result.state).stats.evidence, 2);
});

test('rescue requires preparation and advances exactly 25 then 27 civilians', () => {
  const e = api();
  let state = run([...investigation, '查看名单', '核对转运记录', '去 礼拜堂']);
  const refused = e.execute(state, '疏散居民');
  assert.equal(refused.changed, false);
  assert.match(refused.messages.map(m => m.text).join(''), /担架|掩护|通路/);
  state = run(['去 广场', '准备担架', '去 礼拜堂', '安排掩护', '铺设安全通路', '疏散居民'], state);
  assert.equal(e.getView(state).stats.rescued, 25);
  state = run(['转移伤员'], state);
  assert.equal(e.getView(state).stats.rescued, 27);
  assert.ok(state.minutesLeft <= 30);
  assert.equal(e.execute(state, '转移伤员').changed, false);
});

test('good ending needs rescue, independent team assignments and backed-up evidence', () => {
  const e = api();
  const state = run([...investigation, ...oldCase, ...rescue, '备份证据', ...deployment, '制止司钟人']);
  const view = e.getView(state);
  assert.equal(view.ending.id, 'good');
  assert.equal(view.stats.minutesLeft, 0, 'the narrated noon-to-evening epilogue must not retain time until noon');
  assert.equal(view.stats.rescued, 27);
  assert.equal(view.stats.evidence, 3);
  assert.ok(view.stats.trust >= 4);
  for (const command of ['查看', '地图', '图鉴', '背包']) {
    assert.equal(e.execute(state, command).changed, false);
  }
  assert.equal(e.execute(state, '去 广场').changed, false);
});

test('saving lives and stopping the system without old-case proof yields ordinary ending', () => {
  const e = api();
  const state = run([...investigation, ...rescue, ...deployment, '制止司钟人']);
  assert.equal(e.getView(state).ending.id, 'ordinary');
  assert.equal(e.getView(state).stats.rescued, 27);
});

test('final action cannot skip team duties and can be completed after correcting them', () => {
  const e = api();
  let state = run([...investigation, ...rescue, '去 屋顶', '去 钟楼', '质问司钟人']);
  const refused = e.execute(state, '隔离主控');
  assert.equal(refused.changed, false);
  assert.match(refused.messages.map(m => m.text).join(''), /分工|协同|菲亚梅塔/);
  state = run([
    ...deployment.slice(0, 4), '授权协同', '确认居民撤离', '隔离主控', '制止司钟人',
  ], state);
  assert.equal(e.getView(state).ending.id, 'ordinary');
});

test('timeout is a terminal failure with an explicit restart path', () => {
  const e = api();
  let state = run([...investigation, ...rescue]);
  for (let i = 0; i < 20 && !state.ending; i++) state = e.execute(state, '等待').state;
  assert.equal(e.getView(state).ending.id, 'failure');
  assert.equal(state.minutesLeft, 0);
  const restarted = e.execute(state, '重新开始');
  assert.equal(restarted.changed, true);
  assert.equal(restarted.state.location, 'bakery');
  assert.equal(restarted.state.ending, null);
});

test('every offered action uses execute and read-only view generation stays pure', () => {
  const e = api();
  let state = e.createGame();
  const commands = [...investigation, ...oldCase, ...rescue, '备份证据', ...deployment, '制止司钟人'];
  for (const command of commands) {
    const before = JSON.stringify(state);
    const view = e.getView(state);
    assert.equal(JSON.stringify(state), before);
    for (const action of view.actions) {
      const result = e.execute(state, action.command);
      assert.ok(result.messages.length > 0, action.command);
      assert.equal(e.validateSave(result.state), true);
    }
    state = e.execute(state, command).state;
  }
});

test('damaged, unknown and inconsistent saves are rejected without throwing', () => {
  const e = api();
  for (const bad of [null, [], {}, 'bad', { schema: 99 }, { schema: 1, location: 'bakery' }]) {
    assert.equal(e.validateSave(bad), false);
  }
  for (const mutate of [
    s => { s.location = 'moon'; }, s => { s.minutesLeft = -1; },
    s => { s.minutesLeft = NaN; }, s => { s.rescued = 99; },
    s => { s.flags = null; }, s => { s.inventory.push('nonexistent'); },
    s => { s.ending = { id: 'good' }; }, s => { s.visited = []; },
    s => { s.inventory.push('edited'); s.inventory.push('edited'); },
  ]) {
    const bad = e.createGame(); mutate(bad);
    assert.equal(e.validateSave(bad), false);
  }
});

test('a timed-out action cannot claim that its unapplied objective succeeded', () => {
  const e = api();
  let state = run([...investigation, '查看名单', '核对转运记录', '准备担架', '去 礼拜堂', '安排掩护', '铺设安全通路', '疏散居民']);
  // A nearly exhausted, otherwise legal save is equivalent to prior travel.
  state.minutesLeft = 3;
  const result = e.execute(state, '转移伤员');
  assert.equal(result.state.rescued, 25);
  assert.equal(e.getView(result.state).ending.id, 'failure');
  assert.equal(result.messages.some(m => /二十七个人，一个不少/.test(m.text)), false);
  assert.equal(e.validateSave(result.state), true);
});

test('map availability never implies teleportation, and gallery unlocks on story arrival', () => {
  const e = api();
  let state = run([...investigation]);
  const view = e.getView(state);
  assert.deepEqual(view.map.filter(p => p.available).map(p => p.id).sort(), ['bakery', 'tunnel']);
  assert.deepEqual(view.cgUnlocked, ['bakery']);
  state = run(['查看名单', '核对转运记录', '去 礼拜堂'], state);
  assert.deepEqual(e.getView(state).cgUnlocked, ['bakery', 'chapel']);
  assert.equal(e.getView(state).map.find(p => p.id === 'roof').available, false);
});

test('save validation rejects impossible chapter locations and flags', () => {
  const e = api();
  const s = e.createGame();
  s.location = 'tower'; s.visited.push('tower');
  assert.equal(e.validateSave(s), false);
  const other = e.createGame();
  other.flags.video = true;
  assert.equal(e.validateSave(other), false);
});

test('the displayed scene artwork is unlocked on each reachable ending route', () => {
  const e = api();
  const routes = [
    [...investigation, ...oldCase, ...rescue, '备份证据', ...deployment, '制止司钟人'],
    [...investigation, ...rescue, ...deployment, '制止司钟人'],
    [...investigation, ...rescue, ...Array(8).fill('等待')],
  ];
  for (const route of routes) {
    let state = e.createGame();
    for (const command of route) {
      state = e.execute(state, command).state;
      const view = e.getView(state);
      assert.ok(view.cgUnlocked.includes(view.location.cg), `${view.location.name} displays locked ${view.location.cg} artwork after ${command}`);
    }
  }
});

test('gallery dialogue describes the world without authoring notes', () => {
  const e = api();
  const result = e.execute(e.createGame(), '图鉴');
  const text = result.messages.map(m => m.text).join('\n');
  assert.doesNotMatch(text, /平行设定|本故事|作者注|\bAU\b/);
  assert.match(text, /博士/);
  assert.match(text, /菲亚梅塔.*黎博利/);
  assert.equal(result.changed, false);
});

test('all three endings are reachable using only offered action and exit choices', () => {
  const e = api();
  const placeCommands = {
    '去 广场': '去 白钟广场', '去 礼拜堂': '去 旧礼拜堂',
    '去 屋顶': '去 屋顶维护路', '去 控制室': '去 广播控制室', '去 钟楼': '去 钟楼上层',
  };
  function choose(state, intended) {
    const view = e.getView(state);
    const options = [...view.actions, ...view.exits.filter(exit => !exit.locked)];
    const option = options.find(item => item.command === (placeCommands[intended] || intended));
    assert.ok(option, `a visible option must exist for ${intended} at ${view.location.name}`);
    const result = e.execute(state, option.command);
    assert.equal(result.changed, true, intended);
    return result.state;
  }
  for (const [expected, route] of [
    ['good', [...investigation, ...oldCase, ...rescue, '备份证据', ...deployment, '制止司钟人']],
    ['ordinary', [...investigation, ...rescue, ...deployment, '制止司钟人']],
    ['failure', [...investigation, ...rescue]],
  ]) {
    let state = e.createGame();
    for (const command of route) state = choose(state, command);
    if (expected === 'failure') {
      for (let step = 0; step < 20 && !state.ending; step++) {
        assert.notEqual(e.getView(state).actions[0]?.command, '等待', 'waiting must be optional, not the primary recommendation');
        state = choose(state, '等待');
      }
    }
    assert.equal(e.getView(state).ending?.id, expected);
    assert.equal(choose(state, '重新开始').location, 'bakery');
  }
});

test('player guidance never asks for typed input', () => {
  const e = api();
  let state = e.createGame();
  for (const command of [...investigation, ...oldCase, ...rescue, '备份证据', ...deployment, '制止司钟人']) {
    const view = e.getView(state);
    const guidance = [view.objective, view.hint, ...(view.ending?.paragraphs || [])];
    for (const read of ['帮助', '提示', '交谈 能天使', '', '不存在的指令']) {
      guidance.push(...e.execute(state, read).messages.map(m => m.text));
    }
    assert.doesNotMatch(guidance.join('\n'), /输入|文字指令|填写/);
    state = e.execute(state, command).state;
  }
  while (!state.ending) state = e.execute(state, '等待').state;
  assert.doesNotMatch(e.getView(state).hint, /输入|填写/);
});

test('next-step hints alone reach S without loops, invisible commands, mutation or time cost', () => {
  const { state, commands } = followHints();
  assert.equal(state.rescued, 27);
  assert.equal(state.backups.length, 3);
  assert.ok(commands.indexOf('备份证据') < commands.indexOf('转移伤员'), 'use time before the rescue phase transition to preserve evidence');
  const hint = engine.getHint(state);
  assert.ok(engine.getView(state).actions.some(a => a.command === hint.command));
  assert.equal(engine.execute(state, '提示').changed, false);
});

test('hints recover from missed preparation, early detours and incomplete tower setup', () => {
  const deviations = [
    ['观察街道', '去 广场', '去 东侧通道', '检查挡板'],
    [...investigation, '查看名单', '核对转运记录', '去 礼拜堂', '安排掩护'],
    [...investigation, ...oldCase, ...rescue.slice(0, 10), '去 钟楼', '质问司钟人'],
  ];
  for (const route of deviations) followHints(run(route));
});

test('time-aware hints skip unreachable old-case detours and still rescue everyone and finish', () => {
  const start = run([...investigation, ...rescue]);
  const { state, commands } = followHints(start, 'ordinary');
  assert.equal(state.rescued, 27);
  assert.ok(!commands.includes('去 白钟广场'), 'do not send the player back for evidence when that loses the deadline');
  assert.ok(!commands.includes('备份证据'), 'do not spend scarce time on a backup that cannot improve this ending');
});

test('when a full stop is no longer possible hints still prioritise reachable civilian rescue', () => {
  let state = run([...investigation, '查看名单', '核对转运记录', '准备担架', '去 礼拜堂', '安排掩护', '铺设安全通路']);
  // Reach this deadline through the offered wait option, without forging flags.
  while (state.minutesLeft > 14) state = engine.execute(state, '等待').state;
  assert.ok(state.minutesLeft > 8 && state.minutesLeft <= 14);
  assert.equal(engine.getHint(state).command, '疏散居民');
  state = run(['疏散居民'], state);
  assert.equal(engine.getHint(state).command, '转移伤员');
  state = run(['转移伤员'], state);
  assert.equal(state.rescued, 27);
  assert.match(engine.getHint(state).reason, /时间|来不及|剩余/);
});

test('each recommended story action explains its concrete purpose before the time strategy', () => {
  const reasons = new Map();
  let state = api().createGame();
  for (let step = 0; step < 65 && !state.ending; step++) {
    const hint = engine.getHint(state);
    assert.notEqual(hint.command, '等待');
    if (hint.command.startsWith('去 ')) assert.match(hint.reason, /前往.*接下来需要/);
    else reasons.set(hint.command, hint.reason.split('。')[0]);
    state = engine.execute(state, hint.command).state;
  }
  assert.equal(state.ending?.id, 'good');
  assert.equal(new Set(reasons.values()).size, reasons.size, 'distinct actions should not repeat one generic strategy explanation');
  for (const [command, purpose] of Object.entries({
    查看终端: /原始录像.*广播/,
    核验授权: /授权.*范围/,
    铺设安全通路: /门槛.*担架/,
    疏散居民: /能.*行走.*担架/,
    转移伤员: /两名.*无法.*行走/,
    搜救技师: /技师.*隔离/,
    备份证据: /副本.*原件/,
    隔离主控: /非法.*处置/,
    制止司钟人: /操作柄|再次操作/,
  })) assert.match(reasons.get(command) || '', purpose, command);
});
