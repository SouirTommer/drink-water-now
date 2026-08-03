# Drink the water right nowww

![demo](animation_720.gif)
![drink_dist](drink_hist.png)

Stop coding, is time to drink water. That's the whole thing.

## Features

1. Status bar reminder
2. Full-screen blocker with a DVD-style bouncing 💧 (click it to count a cup)
3. Red theme flash when it's time to drink
4. Drink counter
5. Countdown in the status bar (bottom right). Click it to pause/resume
6. Auto-freeze when you step away, resumes when you start typing
7. Drink history in the Explorer view — a GitHub-style contribution heatmap (15 weeks) of every cup

## Install

Dev setup: open the folder, press F5. It'll compile and pop an Extension Development Host.

Packaging:

```bash
npm install
npm run package
```

That gives you `drink-water-nag-0.0.1.vsix`. Install it via Extensions → … → Install from VSIX.

## Settings

Search `drink water` in Settings. Everything has a default, so you don't need to touch anything.

| Setting | Default | Notes |
| --- | --- | --- |
| `drinkWater.enabled` | `true` | Master switch |
| `drinkWater.intervalMinutes` | `30` | How often it nags you |
| `drinkWater.idlePauseMinutes` | `5` | Auto-pause after no typing for this long. `0` = off |
| `drinkWater.blocker` | `true` | Full-screen page that fills the editor and re-opens when closed. Confirm button unlocks after a delay |
| `drinkWater.redAlert` | `false` | Switch VS Code to the red theme when it's time to drink, restore after you confirm |
| `drinkWater.confirmDelaySeconds` | `3` | Blocker confirm button delay (0–30s). `0` = clickable immediately |
| `drinkWater.bounceLogo` | `true` | DVD screensaver panel. Also set to false if you hate it |
| `drinkWater.language` | `auto` | `auto`, `en`, `zh-tw`, `zh-cn` |
| `drinkWater.cupTarget` | `8` | Daily goal. `0` hides the counter |
| `drinkWater.messages` | `[]` | Custom messages, cycled in order. Empty = built-in |

One thing to know: `drinkWater.messages` overrides the language setting. If you set custom messages, they're used as-is, whatever language they're in.

## Commands

- **Reset Drink Water Timer** — resets and records a cup (same as clicking the status bar)
- **Show Drink Water Reminder Now** — fires a reminder on demand. Handy for testing without waiting 30 minutes
- **Pause/Resume Drink Water Countdown** — same as clicking the countdown in the status bar
- **Reset Today's Drink Records** — clears today's history and counter
- **Reset All Drink Records** — clears the whole history and counter

## Development

```bash
npm install
npm run compile    # or just press F5
npm run package    # build the .vsix
```

The `out/` folder is build output, don't edit it. Change things in `src/` and recompile.

## License

MIT
