import * as vscode from 'vscode';
import { defaultMessages } from './messages';

function messages(): string[] {
  const cfg = vscode.workspace.getConfiguration('drinkWater');
  const custom = cfg.get<string[]>('messages', []);
  if (custom.length > 0) return custom;
  const lang = cfg.get<string>('language', 'auto');
  return defaultMessages(lang === 'auto' ? vscode.env.language : lang);
}

interface TimerState {
  nextDue: number;
  pausedSince: number | null;
}

export function activate(context: vscode.ExtensionContext): void {
  console.log('[drink-water] activated');
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = 'drinkWater.dismiss';
  item.tooltip = '💧 Drink water — click to count a cup (ml)';

  const countdown = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  countdown.command = 'drinkWater.togglePause';
  countdown.tooltip = '⏱ Click to pause/resume';

  let ticker: ReturnType<typeof setInterval> | undefined;
  let i = 0;
  let dayCheck = 0;
  let lastActivity = Date.now();
  let blockerDismissed = false;
  let redStored: string | null = context.globalState.get<string | null>('redOriginal', null);
  if (
    redStored !== null &&
    vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '') === 'Red'
  ) {
    void vscode.workspace
      .getConfiguration('workbench')
      .update('colorTheme', redStored, vscode.ConfigurationTarget.Global);
    redStored = null;
    void context.globalState.update('redOriginal', undefined);
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  class DrinkHistoryProvider implements vscode.WebviewViewProvider {
    private view: vscode.WebviewView | undefined;
    private pendingFlash = false;
    resolveWebviewView(view: vscode.WebviewView): void {
      this.view = view;
      this.render();
    }
    refresh(flash = false): void {
      this.pendingFlash = flash;
      this.render();
    }
    private render(): void {
      if (!this.view) return;
      const drinks = context.globalState.get<number[]>('drinks', []);
      const byDay = new Map<string, number>();
      for (const ts of drinks) {
        const key = dayKey(new Date(ts));
        byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - 104);
      start.setDate(start.getDate() - start.getDay());
      const todayKey = dayKey(now);
      const cells: { date: string; count: number; month: number }[] = [];
      const cur = new Date(start);
      while (cur <= now) {
        const key = dayKey(cur);
        cells.push({ date: key, count: byDay.get(key) ?? 0, month: cur.getMonth() });
        cur.setDate(cur.getDate() + 1);
      }
      const flash = this.pendingFlash;
      this.pendingFlash = false;
      const cols = Math.ceil(cells.length / 7);
      const level = (n: number): number => (n >= 7 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0);
      const cellsHtml = cells
        .map((c, i) => {
          const today = c.date === todayKey;
          const cls = today ? (flash ? 'today flash' : 'today') : '';
          return `<div class="c l${level(c.count)} ${cls}" style="grid-row:${(i % 7) + 1};grid-column:${Math.floor(i / 7) + 1}" title="${c.date}: ${c.count} cup${c.count === 1 ? '' : 's'}"></div>`;
        })
        .join('');
      let prev = -1;
      const months: string[] = [];
      for (let c = 0; c < cols; c++) {
        const m = c * 7 < cells.length ? cells[c * 7].month : prev;
        months.push(m === prev ? '' : MONTHS[m]);
        prev = m;
      }
      const monthsHtml = months.map((m) => `<div>${m}</div>`).join('');
      const total = cells.reduce((a, c) => a + c.count, 0);
      const week = cells.slice(-7).reduce((a, c) => a + c.count, 0);
      this.view.webview.html = `<!DOCTYPE html>
<html>
<style>
  body { margin: 0; padding: 6px; font-family: system-ui; font-size: 11px; }
  .stats { color: var(--vscode-foreground); margin-bottom: 4px; }
  .months { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 3px;
            font-size: 9px; color: var(--vscode-foreground); opacity: .6; margin-bottom: 2px; }
  .grid { display: grid; grid-template-columns: repeat(${cols}, 1fr);
          grid-template-rows: repeat(7, auto); gap: 3px; }
  .c { width: 100%; aspect-ratio: 1; border-radius: 2px; }
  .l0 { background: #21262d; } .l1 { background: #7fd8f7; }
  .l2 { background: #33a3dc; } .l3 { background: #0e6ba8; } .l4 { background: #0d3b66; }
  .today { outline: 2px solid rgba(255, 255, 255, 0.8); outline-offset: 1px; }
  @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(80, 200, 255, 0); }
                     50% { box-shadow: 0 0 0 4px rgba(80, 200, 255, 0.9); } }
  .flash { animation: pulse 0.5s ease 3; }
</style>
<body>
  <div class="stats">Last 15 weeks: <b>${total}</b> cups · last 7 days: <b>${week}</b></div>
  <div class="months">${monthsHtml}</div>
  <div class="grid">${cellsHtml}</div>
</body>
</html>`;
    }
  }
  const drinkProvider = new DrinkHistoryProvider();

  function dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function resetDrinks(all: boolean): void {
    const todayKey = dayKey(new Date());
    if (all) {
      void context.globalState.update('drinks', []);
    } else {
      const list = context.globalState.get<number[]>('drinks', []).filter((t) => dayKey(new Date(t)) !== todayKey);
      void context.globalState.update('drinks', list);
    }
    void context.globalState.update('cups', { date: today(), ml: 0 });
    drinkProvider.refresh();
    updateIdle();
  }

  const get = (key: string): unknown =>
    vscode.workspace.getConfiguration('drinkWater').get(key);

  const today = (): string => new Date().toISOString().slice(0, 10);

  const readTimer = (): TimerState =>
    context.globalState.get<TimerState>('timer', { nextDue: Date.now(), pausedSince: null });

  const writeTimer = (s: TimerState): void => {
    void context.globalState.update('timer', s);
  };

  const intervalMs = (): number => (get('intervalMinutes') as number) * 60000;

  const mlPerCup = (): number => (get('mlPerCup') as number) || 350;
  const targetMl = (): number => (get('cupTarget') as number) * mlPerCup();

  function getMl(): number {
    const s = context.globalState.get<{ date: string; ml: number }>('cups', { date: '', ml: 0 });
    if (s.date !== today()) {
      void context.globalState.update('cups', { date: today(), ml: 0 });
      return 0;
    }
    return typeof s.ml === 'number' ? s.ml : 0;
  }

  function progressTooltip(ml: number): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    const t = targetMl();
    md.appendMarkdown('**Drink Water**  \n');
    if (t > 0) {
      const pct = Math.min(100, Math.round((ml / t) * 100));
      const filled = Math.round((pct / 100) * 20);
      md.appendMarkdown('`' + '▰'.repeat(filled) + '▱'.repeat(20 - filled) + '`  \n');
      md.appendMarkdown(`**${ml}ml / ${t}ml** (${pct}%)`);
      if (ml >= t) md.appendMarkdown('  ✅ Goal reached!');
    } else {
      md.appendMarkdown(`**${ml}ml**`);
    }
    return md;
  }

  function updateIdle(): void {
    const ml = getMl();
    const t = targetMl();
    item.text = t > 0 ? `💧 ${ml}ml/${t}ml` : `💧 ${ml}ml`;
    item.tooltip = progressTooltip(ml);
    item.backgroundColor = undefined;
    item.show();
  }

  function showCountdown(s: TimerState): void {
    const base = s.pausedSince !== null ? s.pausedSince : Date.now();
    const total = Math.max(0, Math.ceil((s.nextDue - base) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const clock = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    countdown.text = `${s.pausedSince !== null ? '$(debug-pause)' : '$(watch)'} ${clock}`;
    countdown.show();
  }

  function tick(): void {
    if (!get('enabled')) {
      countdown.hide();
      return;
    }
    if (
      dayCheck++ % 60 === 0 &&
      context.globalState.get<{ date: string }>('cups', { date: '' }).date !== today()
    ) {
      updateIdle();
    }
    const now = Date.now();
    const idleMin = get('idlePauseMinutes') as number;
    if (idleMin > 0 && now - lastActivity > idleMin * 60000) {
      writeTimer({ ...readTimer(), pausedSince: now });
      lastActivity = now;
    }
    const s = readTimer();
    if (s.pausedSince !== null) {
      showCountdown(s);
      return;
    }
    if (s.nextDue <= now) {
      remind();
      writeTimer({ nextDue: now + intervalMs(), pausedSince: null });
      showCountdown(readTimer());
      return;
    }
    showCountdown(s);
  }

  function togglePause(): void {
    const s = readTimer();
    const now = Date.now();
    if (s.pausedSince === null) {
      writeTimer({ ...s, pausedSince: now });
    } else {
      writeTimer({ nextDue: s.nextDue + (now - s.pausedSince), pausedSince: null });
    }
    lastActivity = now;
    showCountdown(readTimer());
  }

  function remind(): void {
    const cfg = vscode.workspace.getConfiguration('drinkWater');
    const msgs = messages();
    item.text = msgs[i++ % msgs.length];
    item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    item.show();
    if (cfg.get<boolean>('redAlert', false)) redAlert(true);
    if (cfg.get<boolean>('blocker', false)) {
      showBlockingPanel(item.text);
    } else if (cfg.get<boolean>('bounceLogo', false)) {
      showBouncePanel();
    }
  }

  function showBlockingPanel(msg: string): void {
    blockerDismissed = false;
    const cfg = vscode.workspace.getConfiguration('drinkWater');
    const delay = cfg.get<number>('confirmDelaySeconds', 3);
    const bounce = cfg.get<boolean>('bounceLogo', false);
    const safe = msg.replace(/</g, '&lt;').replace(/&/g, '&amp;').replace(/>/g, '&gt;');
    const logoCss = bounce
      ? `#logo { position: absolute; width: 100px; height: 120px; z-index: 0; cursor: pointer;
          animation: bx 7s linear infinite, by 5s linear infinite; }
         @keyframes bx { 0% { left: 0; } 50% { left: calc(100% - 100px); } 100% { left: 0; } }
         @keyframes by { 0% { top: 0; } 25% { top: calc(100% - 120px); } 50% { top: 0; }
                         75% { top: calc(100% - 120px); } 100% { top: 0; } }`
      : '';
    const logo = bounce
      ? `<div id="logo">
           <svg width="100" height="120" viewBox="0 0 100 120">
             <path d="M50 5 C50 5 10 55 10 85 a40 40 0 0 0 80 0 C90 55 50 5 50 5 z" fill="#4fc3f7"/>
             <ellipse cx="38" cy="78" rx="10" ry="5" fill="#e1f5fe" opacity="0.7"/>
           </svg>
         </div>`
      : '';

    const makePanel = (): void => {
      if (blockerDismissed) return;
      try {
        const panel = vscode.window.createWebviewPanel(
          'drinkWater.block',
          '💧 DRINK WATER NOW',
          vscode.ViewColumn.Active,
          { enableScripts: true }
        );
        panel.webview.html = `<!DOCTYPE html>
<html>
<style>
  html, body { margin: 0; height: 100%; background: #111; color: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: system-ui; }
  #content { position: relative; z-index: 1; display: flex; flex-direction: column;
             align-items: center; }
  h1 { font-size: 44px; margin: 8px 0; }
  p  { font-size: 20px; opacity: .85; max-width: 720px; text-align: center; }
  button { margin-top: 32px; font-size: 22px; padding: 16px 48px; border: none;
    border-radius: 8px; cursor: pointer; background: #4fc3f7; color: #000; }
  button:disabled { background: #555; color: #aaa; cursor: not-allowed; }
  #cd { font-size: 16px; margin-top: 14px; opacity: .6; }
  ${logoCss}
</style>
<body>
  ${logo}
  <div id="content">
    <h1>💧</h1>
    <h1>DRINK WATER NOW</h1>
    <p>${safe}</p>
    <button id="ok" disabled>I drank some water</button>
    <div id="cd"></div>
  </div>
  <script>
    const ok = document.getElementById('ok');
    const cd = document.getElementById('cd');
    let left = ${delay};
    const t = setInterval(() => {
      if (left > 0) {
        cd.textContent = 'Button unlocks in ' + left + 's';
        left--;
      } else {
        clearInterval(t);
        cd.textContent = '';
        ok.disabled = false;
        ok.focus();
      }
    }, 1000);
    ok.addEventListener('click', () => {
      acquireVsCodeApi().postMessage({ command: 'confirm' });
    });
    const logo = document.getElementById('logo');
    if (logo) {
      logo.addEventListener('click', () => {
        acquireVsCodeApi().postMessage({ command: 'confirm' });
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') e.preventDefault();
    });
  </script>
</body>
</html>`;
        panel.webview.onDidReceiveMessage((m) => {
          if (m.command === 'confirm') {
            blockerDismissed = true;
            panel.dispose();
            dismiss();
          }
        });
        panel.onDidDispose(() => {
          if (!blockerDismissed) setTimeout(makePanel, 300);
        });
      } catch {
        // window shutting down; ignore
      }
    };
    makePanel();
  }

  function dismiss(): void {
    const s = context.globalState.get<{ date: string; ml: number }>('cups', { date: '', ml: 0 });
    const oldMl = s.date === today() ? (typeof s.ml === 'number' ? s.ml : 0) : 0;
    const ml = oldMl + mlPerCup();
    const drinks = context.globalState.get<number[]>('drinks', []);
    drinks.push(Date.now());
    const t = targetMl();
    item.text = `${t > 0 ? `💧 ${ml}ml/${t}ml` : `💧 ${ml}ml`} ✓`;
    const crossed = [1500, 2000, 4000].find((th) => ml >= th && oldMl < th);
    if (crossed !== undefined) {
      void vscode.window.showInformationMessage(`🎉 ${crossed}ml today! Keep it up.`);
    }
    void Promise.all([
      context.globalState.update('cups', { date: today(), ml }),
      context.globalState.update('drinks', drinks),
    ]).then(() => drinkProvider.refresh(true));
    redAlert(false);
    writeTimer({ nextDue: Date.now() + intervalMs(), pausedSince: null });
    showCountdown(readTimer());
    setTimeout(() => {
      updateIdle();
    }, 1200);
  }

  function redAlert(on: boolean): void {
    const wb = vscode.workspace.getConfiguration('workbench');
    if (on) {
      const cur = wb.get<string>('colorTheme', '');
      if (cur !== 'Red' && redStored === null) {
        redStored = cur;
        void context.globalState.update('redOriginal', cur);
        void wb.update('colorTheme', 'Red', vscode.ConfigurationTarget.Global);
      }
    } else if (redStored !== null) {
      void wb.update('colorTheme', redStored, vscode.ConfigurationTarget.Global);
      redStored = null;
      void context.globalState.update('redOriginal', undefined);
    }
  }

  function showBouncePanel(): void {
    const panel = vscode.window.createWebviewPanel(
      'drinkWater.bounce',
      '💧 DRINK!',
      vscode.ViewColumn.Active,
      { enableScripts: true }
    );
    panel.webview.html = `<!DOCTYPE html>
<html>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  #logo { position: absolute; width: 100px; height: 120px; cursor: pointer;
          animation: bx 7s linear infinite, by 5s linear infinite; }
  @keyframes bx { 0% { left: 0; } 50% { left: calc(100% - 100px); } 100% { left: 0; } }
  @keyframes by { 0% { top: 0; } 25% { top: calc(100% - 120px); } 50% { top: 0; }
                  75% { top: calc(100% - 120px); } 100% { top: 0; } }
</style>
<body>
  <div id="logo">
    <svg width="100" height="120" viewBox="0 0 100 120">
      <path d="M50 5 C50 5 10 55 10 85 a40 40 0 0 0 80 0 C90 55 50 5 50 5 z" fill="#4fc3f7"/>
      <ellipse cx="38" cy="78" rx="10" ry="5" fill="#e1f5fe" opacity="0.7"/>
    </svg>
  </div>
  <script>
    document.getElementById('logo').addEventListener('click', () => {
      acquireVsCodeApi().postMessage({ command: 'close' });
    });
  </script>
</body>
</html>`;
    panel.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'close') {
        panel.dispose();
        dismiss();
      }
    });
    const t = setTimeout(() => panel.dispose(), 20000);
    panel.onDidDispose(() => clearTimeout(t));
  }

  const st = context.globalState.get<TimerState>('timer', {
    nextDue: Date.now() + intervalMs(),
    pausedSince: null,
  });
  if (st.nextDue <= Date.now()) st.nextDue = Date.now();
  writeTimer(st);
  updateIdle();
  tick();
  ticker = setInterval(tick, 1000);

  context.subscriptions.push(
    item,
    countdown,
    vscode.window.registerWebviewViewProvider('drinkWater.history', drinkProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('drinkWater.dismiss', dismiss),
    vscode.commands.registerCommand('drinkWater.resetAll', () => resetDrinks(true)),
    vscode.commands.registerCommand('drinkWater.resetToday', () => resetDrinks(false)),
    vscode.commands.registerCommand('drinkWater.remindNow', remind),
    vscode.commands.registerCommand('drinkWater.togglePause', togglePause),
    vscode.workspace.onDidChangeTextDocument(() => {
      lastActivity = Date.now();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('drinkWater')) {
        lastActivity = Date.now();
        writeTimer({ nextDue: Date.now() + intervalMs(), pausedSince: null });
        updateIdle();
      }
    })
  );
}

export function deactivate(): void {}
