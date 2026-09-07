# SANI CHESS v3.9.8

Premium SANI CHESS with persistent player profiles, VIP/shop, admin panel, computer play and online tables.

## Deploy
- Node.js 18+
- `npm install`
- Set `ADMIN_PASSWORD` in the hosting provider environment.
- Start with `npm start`.

## Online rules
- Leaving the table intentionally is an immediate loss and the opponent receives the room bank.
- A network disconnect gives the player 60 seconds to reconnect.
- Returning within the grace period keeps the game alive.
- If the player does not return within 60 seconds, the opponent wins the bank.
- Draw offers are server-side and require opponent acceptance.

## Music
Place `bg-music.mp3` beside `index.html` (or in the public root used by the deployment). Use the music button in the top bar to toggle playback.
