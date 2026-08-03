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
  item.tooltip = '💧 Drink water — click to count a cup';

  const countdown = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  countdown.command = 'drinkWater.togglePause';
  countdown.tooltip = '⏱ Click to pause/resume';

  let ticker: ReturnType<typeof setInterval> | undefined;
  let i = 0;
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

  class DrinkHistoryProvider implements vscode.WebviewViewProvider {
    private view: vscode.WebviewView | undefined;
    resolveWebviewView(view: vscode.WebviewView): void {
      this.view = view;
      this.render();
    }
    refresh(): void {
      this.render();
    }
    private render(): void {
      if (!this.view) return;
      const drinks = context.globalState.get<number[]>('drinks', []);
      const byDay = new Map<string, number>();
      for (const ts of drinks) {
        const d = new Date(ts);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
      const cells: { date: string; count: number }[] = [];
      for (let i = 104; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        cells.push({ date: key, count: byDay.get(key) ?? 0 });
      }
      const level = (n: number): number => (n >= 7 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0);
      const cellsHtml = cells
        .map((c) => `<div class="c l${level(c.count)}" title="${c.date}: ${c.count} cup${c.count === 1 ? '' : 's'}"></div>`)
        .join('');
      const total = cells.reduce((a, c) => a + c.count, 0);
      const week = cells.slice(-7).reduce((a, c) => a + c.count, 0);
      this.view.webview.html = `<!DOCTYPE html>
<html>
<style>
  body { margin: 0; padding: 6px; font-family: system-ui; font-size: 11px; }
  .stats { color: var(--vscode-foreground); margin-bottom: 6px; }
  .grid { display: grid; grid-template-columns: repeat(15, 1fr); grid-template-rows: repeat(7, auto);
          gap: 3px; }
  .c { width: 100%; aspect-ratio: 1; border-radius: 2px; }
  .l0 { background: #21262d; } .l1 { background: #0d3b66; }
  .l2 { background: #0e6ba8; } .l3 { background: #33a3dc; } .l4 { background: #7fd8f7; }
</style>
<body>
  <div class="stats">Last 105 days: <b>${total}</b> cups · last 7 days: <b>${week}</b></div>
  <div class="grid">${cellsHtml}</div>
</body>
</html>`;
    }
  }
  const drinkProvider = new DrinkHistoryProvider();

  function addDrink(ts: number): void {
    const list = context.globalState.get<number[]>('drinks', []);
    list.push(ts);
    void context.globalState.update('drinks', list.slice(-200));
  }

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
    void context.globalState.update('cups', { date: today(), count: 0 });
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

  function getCups(): number {
    const s = context.globalState.get<{ date: string; count: number }>('cups', { date: '', count: 0 });
    if (s.date !== today()) {
      void context.globalState.update('cups', { date: today(), count: 0 });
      return 0;
    }
    return s.count;
  }

  function updateIdle(): void {
    const target = get('cupTarget') as number;
    item.text = target > 0 ? `💧 ${getCups()}/${target}` : '💧';
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
    const s = context.globalState.get<{ date: string; count: number }>('cups', { date: '', count: 0 });
    const count = (s.date === today() ? s.count : 0) + 1;
    void context.globalState.update('cups', { date: today(), count });
    updateIdle();
    addDrink(Date.now());
    drinkProvider.refresh();
    redAlert(false);
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
