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
    const msgs = messages();
    item.text = msgs[i++ % msgs.length];
    item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    item.show();
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
