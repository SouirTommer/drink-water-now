# 💧 drink-water

<img width="1875" height="991" alt="動畫" src="https://github.com/user-attachments/assets/bc613cda-ddac-4a28-b9be-574987657f90" />

Stops you from coding for 5 hours straight without drinking anything.

It's a small VS Code extension: a timer runs in the background, and when it's up the status bar turns yellow and tells you to drink water. You click it, it records a cup, timer restarts. That's the whole thing.

No telemetry. No network. No runtime dependencies. Just a `setInterval` and a status bar item.

## Features

- **Status bar reminder** — shows a message like "Time to drink some water!" and highlights itself when the timer's up
- **Modal option** — if you want to be *really* annoyed, it pops a dialog that blocks until you click OK. Clicking OK also counts a cup
- **Bouncing DVD logo option** — the reminder bounces around a black panel like an old DVD screensaver for 20 seconds. This exists because I asked for it
- **Daily cup counter** — status bar shows `💧 4/8`. Click the reminder and it goes up. Resets at midnight
- **50 messages × 3 languages** — en, zh-tw, zh-cn. Or set your own and it uses those instead
- No emoji in the built-in messages, I removed them on request. The status bar icon is separate UI

## Install

Dev setup: open the folder, press F5. It'll compile and pop an Extension Development Host.

Packaging:

```bash
npm install
npm run package
```

That gives you `drink-water-now-0.0.1.vsix`. Install it via Extensions → … → Install from VSIX.

## Settings

Search `drink water` in Settings. Everything has a default, so you don't need to touch anything.

| Setting | Default | Notes |
| --- | --- | --- |
| `drinkWater.enabled` | `true` | Master switch |
| `drinkWater.intervalMinutes` | `30` | How often it nags you |
| `drinkWater.modal` | `true` | Blocking dialog. Set to false if you hate it |
| `drinkWater.bounceLogo` | `true` | DVD screensaver panel. Also set to false if you hate it |
| `drinkWater.language` | `auto` | `auto`, `en`, `zh-tw`, `zh-cn` |
| `drinkWater.cupTarget` | `8` | Daily goal. `0` hides the counter |
| `drinkWater.messages` | `[]` | Custom messages, cycled in order. Empty = built-in |

One thing to know: `drinkWater.messages` overrides the language setting. If you set custom messages, they're used as-is, whatever language they're in.

## Commands

- **Reset Drink Water Timer** — resets and records a cup (same as clicking the status bar)
- **Show Drink Water Reminder Now** — fires a reminder on demand. Handy for testing without waiting 30 minutes

## Development

```bash
npm install
npm run compile    # or just press F5
npm run package    # build the .vsix
```

The `out/` folder is build output, don't edit it. Change things in `src/` and recompile.

## License

MIT
