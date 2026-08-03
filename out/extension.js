"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const BUILTIN = {
    en: ['💧 Time to drink water!', '🚶 Stand up and stretch!', '🍵 Have a cup of tea!'],
    'zh-tw': ['💧 夠鐘飲水啦！', '🚶 起身郁動吓啦！', '🍵 沖杯茶歇一歇！'],
    'zh-cn': ['💧 该喝水啦！', '🚶 起来活动一下吧！', '🍵 泡杯茶歇一会儿！'],
};
function messages() {
    const custom = vscode.workspace.getConfiguration('drinkWater').get('messages', []);
    return custom.length > 0 ? custom : BUILTIN[vscode.env.language] ?? BUILTIN.en;
}
function activate(context) {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    item.command = 'drinkWater.dismiss';
    item.tooltip = '💧 飲水提醒 — 按一下重設｜Click to reset';
    let timer;
    let i = 0;
    const get = (key) => vscode.workspace.getConfiguration('drinkWater').get(key);
    function start() {
        if (timer)
            clearInterval(timer);
        const minutes = get('intervalMinutes');
        if (!get('enabled') || !(minutes > 0))
            return;
        timer = setInterval(remind, minutes * 60000);
    }
    function remind() {
        item.text = messages()[i++ % messages().length] ?? '💧 飲水啦！';
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        item.show();
    }
    function dismiss() {
        item.hide();
        item.backgroundColor = undefined;
    }
    start();
    context.subscriptions.push(item, vscode.commands.registerCommand('drinkWater.dismiss', dismiss), vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('drinkWater'))
            start();
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map