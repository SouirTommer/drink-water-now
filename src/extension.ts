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
  item.tooltip = '💧 Drink water reminder — click to reset';

  let timer: ReturnType<typeof setInterval> | undefined;
  let i = 0;

  const get = (key: string): unknown =>
    vscode.workspace.getConfiguration('drinkWater').get(key);

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
  #logo { position: absolute; font-size: 80px; line-height: 96px;
          animation: bx 7s linear infinite, by 5s linear infinite; }
  @keyframes bx { 0% { left: 0; } 50% { left: calc(100% - 96px); } 100% { left: 0; } }
  @keyframes by { 0% { top: 0; } 25% { top: calc(100% - 96px); } 50% { top: 0; }
                  75% { top: calc(100% - 96px); } 100% { top: 0; } }
</style>
<body><div id="logo">💧</div></body>
</html>`;
    const t = setTimeout(() => panel.dispose(), 20000);
    panel.onDidDispose(() => clearTimeout(t));
  }

  function dismiss(): void {
    item.hide();
    item.backgroundColor = undefined;
  }

  start();
  context.subscriptions.push(
    item,
    vscode.commands.registerCommand('drinkWater.dismiss', dismiss),
    vscode.commands.registerCommand('drinkWater.remindNow', remind),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('drinkWater')) start();
    })
  );
}

export function deactivate(): void {}
