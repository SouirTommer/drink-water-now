import * as vscode from 'vscode';
import { defaultMessages } from './messages';

function messages(): string[] {
  const cfg = vscode.workspace.getConfiguration('drinkWater');
  const custom = cfg.get<string[]>('messages', []);
  if (custom.length > 0) return custom;
  const lang = cfg.get<string>('language', 'auto');
  return defaultMessages(lang === 'auto' ? vscode.env.language : lang);
}

export function activate(context: vscode.ExtensionContext): void {
  console.log('[drink-water] activated');
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = 'drinkWater.dismiss';
  item.tooltip = '💧 Drink water reminder — click to count a cup';

  let timer: ReturnType<typeof setInterval> | undefined;
  let i = 0;

  const get = (key: string): unknown =>
    vscode.workspace.getConfiguration('drinkWater').get(key);

  const today = (): string => new Date().toISOString().slice(0, 10);

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

  function start(): void {
    if (timer) clearInterval(timer);
    const minutes = get('intervalMinutes') as number;
    if (!get('enabled') || !(minutes > 0)) return;
    timer = setInterval(remind, minutes * 60000);
  }

  function remind(): void {
    const cfg = vscode.workspace.getConfiguration('drinkWater');
    const msgs = messages();
    item.text = msgs[i++ % msgs.length];
    item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    item.show();
    if (cfg.get<boolean>('modal', true)) {
      void vscode.window.showInformationMessage(item.text, { modal: true }).then(dismiss);
    }
    if (cfg.get<boolean>('bounceLogo', false)) {
      showBouncePanel();
    }
  }

  function dismiss(): void {
    const s = context.globalState.get<{ date: string; count: number }>('cups', { date: '', count: 0 });
    const count = (s.date === today() ? s.count : 0) + 1;
    void context.globalState.update('cups', { date: today(), count });
    updateIdle();
  }

  function showBouncePanel(): void {
    const panel = vscode.window.createWebviewPanel(
      'drinkWater.bounce',
      '💧 DRINK!',
      vscode.ViewColumn.Active,
      {}
    );
    panel.webview.html = `<!DOCTYPE html>
<html>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  #logo { position: absolute; width: 100px; height: 120px;
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
</body>
</html>`;
    const t = setTimeout(() => panel.dispose(), 20000);
    panel.onDidDispose(() => clearTimeout(t));
  }

  updateIdle();
  start();
  context.subscriptions.push(
    item,
    vscode.commands.registerCommand('drinkWater.dismiss', dismiss),
    vscode.commands.registerCommand('drinkWater.remindNow', remind),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('drinkWater')) {
        start();
        updateIdle();
      }
    })
  );
}

export function deactivate(): void {}
