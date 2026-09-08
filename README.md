# SANI CHESS v4.2 — FINAL HARDENED

Современная веб-игра в шахматы SANI GROUP.

## Возможности
- Игра против компьютера.
- Два игрока на одном устройстве.
- Онлайн 1×1.
- Серверная проверка онлайн-ходов.
- Полные шахматные правила.
- Фишки и магазин.
- 5 досок и 5 наборов фигур.
- Постоянные аккаунты и сохранение в `db.json`.
- VIP и бан.
- Админ-панель.
- Адаптивный интерфейс для ПК и телефона.

## Запуск

Требуется Node.js 18+.

```bash
npm start
```

Откройте `http://localhost:3000`.

## Админ
Пароль берётся только из переменной окружения `ADMIN_PASSWORD`. Если переменная не задана, админ-панель отключена. Пароль больше не передаётся в URL и не хранится в браузере.

## Хранилище
`db.json` содержит аккаунты игроков, их фишки, инвентарь, выбранные предметы, VIP и бан.

## v3.9 VIP
- VIP-only Grandmaster Hint
- VIP jewelry board and pieces, not purchasable
- VIP status refreshes without re-login
- New accounts start with 100,000 chips

## Исправления безопасности и онлайн-логики
- Серверные HttpOnly-сессии вместо доверия к `accountId` из клиента.
- Никнейм изменяется отдельным серверным endpoint и проверяется на уникальность.
- Админка использует отдельную HttpOnly-сессию.
- Онлайн-комнаты хранят историю позиций и revision для корректного повторения позиций.
- Возврат ставок при ничьей использует `accountId`, а не временный room uid.
- Результат игры против AI вычисляется сервером; клиент не может отправить `win/loss/draw`.
- Ходы AI выполняются и валидируются на сервере.
- Добавлено восстановление игрока онлайн-комнаты после перезагрузки страницы.
- Добавлен rate limit для игрового чата.
- Коды онлайн-столов — 4 цифры с проверкой коллизий.

## Обновление v3.9.3
- Никнейм можно менять в профиле в любое время.
- Смена никнейма не создаёт новый аккаунт: ID, фишки, VIP, покупки и настройки сохраняются.
- Если игрок уже находится в онлайн-столе, новое имя сразу применяется к игроку за столом.
- Добавлена кнопка музыки в верхней панели.
- В комплект добавлен оригинальный спокойный фон `bg-music.mp3`.


## Онлайн-соединение
При кратком обрыве интернета игроку даётся до 60 секунд на возврат. При намеренном выходе из стола партия завершается сразу поражением вышедшего игрока, а банк получает соперник.


## v4.2 stability / security hardening
- Client cache-busting (`client.js?v=4.2.0`) and no-store for HTML/JS/CSS.
- Friendly timeout/502/503/504 handling with safe retries for safe reads/sync.
- Active online rooms and bot games are persisted in `db.json` and restored after a normal server restart.
- Explicit 60-second reconnect grace after a detected disconnect; an intentional Leave/Back immediately forfeits the game.
- Settlement is marked before persistence to prevent duplicate payouts after restart.
- Admin login, account creation, room creation/join, bot start and VIP hints have rate limits.
- Security headers and strict content policy are sent by the server.
- Leaderboard no longer exposes internal account IDs.
- Local game state now applies the same 75-move, dead-position and repetition termination checks as the server.
- Online move list is restored from the server room state.
- Hint calculation is bounded and cached for fast VIP responses.
- Render deployment config includes `/api/health` health check.
- Mobile responsive layout retained.

## Important deployment note
`db.json` is a file-based store. The archive is safe for a single persistent Node.js instance, but a cloud platform must provide persistent disk storage for `DATA_DIR` or an external database; otherwise accounts, sessions, rooms and balances can disappear when the instance is recreated.

Set `ADMIN_PASSWORD` in the deployment environment. Never put it into a URL or client code.
