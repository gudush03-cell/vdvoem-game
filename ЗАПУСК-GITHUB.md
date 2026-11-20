# VDVOЁМ НАЛЕГКЕ · GitHub и Railway

## Загрузка файлов

1. Откройте https://github.com/new. В поле Repository name введите `vdvoem-game`. Для Visibility выберите **Private**: в папке `private` лежит авторская колода. Оставьте создание README выключенным и нажмите **Create repository**.
2. На странице пустого репозитория нажмите **uploading an existing file**. Если уже виден список файлов, используйте **Add file → Upload files**.
3. В Проводнике откройте `C:\Users\Admin\Documents\ChatGPT\Игра\vdvoem-telegram`. Перетащите содержимое этой папки в окно загрузки GitHub, сохраняя структуру папок. При использовании ZIP сначала распакуйте его.
4. Проверьте, что `Dockerfile` и `server.mjs` видны в корне, а также что загружены `public/game.js` и `private/cards.json`. Нажмите **Commit changes**. Настоящий токен бота и другие секреты вводятся только в Railway.

## Подключение существующего сервиса

1. В проекте Railway **gregarious-flow** нажмите карточку **vivacious-magic**. В **Settings → Service Source** выберите **Connect Repo**, дайте Railway доступ к приватному репозиторию **vdvoem-game** и выберите его. Для сборки есть Dockerfile в корне.
2. В **Settings → Networking** нажмите **Generate Domain**. Если появится поле порта, введите `8080`. Сохраните выданный HTTPS-адрес.
3. Добавьте **Volume** к сервису **vivacious-magic** с путём монтирования `/app/data`. В этой папке сервер хранит базу покупок.
4. Во вкладке **Variables** укажите `APP_URL` (выданный HTTPS-адрес), `BOT_TOKEN` (секрет из BotFather), `WEBHOOK_SECRET` (новая случайная строка от 32 символов), `PORT=8080` и `DATABASE_PATH=/app/data/game.sqlite`. В README есть команда для создания секрета. Если лог показывает отказ в записи на том, Railway рекомендует переменную `RAILWAY_RUN_UID=0` для образов с непривилегированным пользователем.
5. Для первого запуска демо задайте `PRICE_STARS=0`. Чтобы открыть продажи, укажите контакт `SUPPORT_CONTACT`, публичную страницу условий `TERMS_URL` и цену `PRICE_STARS=236`. Пример полей лежит в `.env.example`.
6. Примените изменения кнопкой **Deploy**. После запуска выполните `node bot.mjs setup` в терминале сервиса с его переменными. Команда привяжет кнопку «Играть» и уведомления Telegram к вашему домену. Откройте @VdvoemNaLegkeBOT и нажмите «Играть».

[Загрузка файлов в GitHub](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) · [Подключение репозитория в Railway](https://docs.railway.com/services) · [Постоянный диск Railway](https://docs.railway.com/volumes/reference)

