# 💧 drink-water

<img width="1875" height="991" alt="動畫" src="https://github.com/user-attachments/assets/bc613cda-ddac-4a28-b9be-574987657f90" />

Stop coding, is time to drink water. That's the whole thing.

## Features

1. Status bar reminder
2. pop up modal to annoying you
3. DVD logo lmao
4. Drink counter

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
