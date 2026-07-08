# Деплой в продакшен

При публикации GitHub Release автоматически:

1. Собираются Docker-образы `api` и `web`, пушатся в GitHub Container Registry (ghcr.io)
2. GitHub Actions заходит на сервер по SSH и перезапускает контейнеры с новыми образами
3. Контейнер `api` при старте прогоняет `prisma migrate deploy`

---

## Первичная настройка

### 1. GitHub Secrets

Добавьте в репозитории (Settings → Secrets and variables → Actions):

| Секрет                | Описание                                                                        |
| --------------------- | ------------------------------------------------------------------------------- |
| `SSH_HOST`            | IP или домен сервера                                                            |
| `SSH_USER`            | Пользователь для SSH                                                            |
| `SSH_PRIVATE_KEY`     | Приватный SSH-ключ (публичный — в `~/.ssh/authorized_keys` на сервере)          |
| `CR_PAT`              | GitHub PAT с правом `read:packages` — для pull образов на сервере               |
| `NEXT_PUBLIC_API_URL` | Публичный URL API: `https://app.example.com/api` — вшивается в образ при сборке |

Создайте environment `production` (Settings → Environments) — позволяет ограничить деплой по ревью или ветке.

### 2. DNS

Создай A-запись у регистратора домена:

```
app.example.com → IP-адрес сервера
```

### 3. SSL-сертификат

```bash
sudo apt install certbot

# Если nginx уже запущен — остановить, иначе certbot --standalone не займёт порт 80
sudo systemctl stop nginx

# Порт 80 должен быть свободен (проверить: ss -tlnp | grep :80)
sudo certbot certonly --standalone -d app.example.com
```

Сертификаты сохранятся в `/etc/letsencrypt/live/app.example.com/` — nginx читает их напрямую по этому пути. Автопродление через `certbot.timer` настраивается при установке; чтобы nginx подхватывал обновлённые сертификаты, добавь deploy-hook:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh << 'EOF'
#!/bin/bash
systemctl reload nginx
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

### 4. Установить системный nginx и подключить virtual host

```bash
# На сервере — установить nginx если не установлен
sudo apt install nginx
```

```bash
# Локально — скопировать конфиг virtual host во временную директорию на сервере
scp docker/nginx.conf user@server:/tmp/nexst-nginx
```

```bash
# На сервере — установить конфиг и подключить virtual host
sudo mv /tmp/nexst-nginx /etc/nginx/sites-available/nexst

# Заменить плейсхолдер на реальный домен
sudo sed -i 's/app.example.com/your.domain.com/g' /etc/nginx/sites-available/nexst

# Подключить virtual host
sudo ln -s /etc/nginx/sites-available/nexst /etc/nginx/sites-enabled/nexst

# Включить автозапуск при перезагрузке сервера
sudo systemctl enable nginx

# Проверить конфиг и запустить nginx
sudo nginx -t && sudo systemctl start nginx
```

### 5. Подготовить сервер

```bash
sudo mkdir -p /opt/nexst && sudo chown $USER:$USER /opt/nexst

# Скопировать docker-compose на сервер
scp docker-compose.prod.yml user@server:/opt/nexst/
```

### 6. Переменные окружения

Скопируй `.env.example` на сервер как стартовую точку и заполни значения.

```bash
# Локально — скопировать шаблон на сервер
scp .env.example user@server:/opt/nexst/.env
```

Сгенерируй секреты заранее (каждую команду — отдельно для каждой переменной):

```bash
openssl rand -base64 32   # POSTGRES_PASSWORD, REDIS_PASSWORD (44 символа, одна строка)
openssl rand -base64 48   # JWT_SECRET, JWT_REFRESH_SECRET, NEXTAUTH_SECRET (64 символа, одна строка)
```

Затем на сервере отредактируй файл (`nano /opt/nexst/.env`) и вставь сгенерированные значения:

| Переменная            | Значение                           |
| --------------------- | ---------------------------------- |
| `POSTGRES_PASSWORD`   | сгенерированная строка (base64 32) |
| `REDIS_PASSWORD`      | сгенерированная строка (base64 32) |
| `JWT_SECRET`          | сгенерированная строка (base64 48) |
| `JWT_REFRESH_SECRET`  | другая сгенерированная строка      |
| `NEXTAUTH_SECRET`     | сгенерированная строка (base64 48) |
| `NEXTAUTH_URL`        | `https://your.domain.com`          |
| `WEB_URL`             | `https://your.domain.com`          |
| `MAIL_FROM`           | адрес отправителя писем            |
| `SMTP_HOST/USER/PASS` | реквизиты SMTP-сервера             |

> `NEXT_PUBLIC_API_URL` задаётся в GitHub Secrets и вшивается в JS-бандл при сборке образа. Изменить его без пересборки (нового Release) нельзя.

---

## Создание релиза

```bash
gh release create v1.0.0 --title "v1.0.0" --notes "Первый релиз"
```

---

## Откат на предыдущую версию

```bash
cd /opt/nexst
GHCR_IMAGE_PREFIX=ghcr.io/owner/repo IMAGE_TAG=v1.0.0 \
  docker compose -f docker-compose.prod.yml up -d
```

---

## Чеклист перед деплоем

### Безопасность

- [ ] Все секреты (JWT_SECRET, NEXTAUTH_SECRET, REDIS_PASSWORD) — случайные строки нужной длины
- [ ] Seed-пользователь (`admin@example.com`) удалён или пароль изменён
- [ ] `.env` не попал в git (`git status`)
- [ ] Swagger (`/api/docs`) отключён или защищён в продакшене

### Инфраструктура

- [ ] SSL-сертификат получен и настроен
- [ ] Настроен мониторинг (uptime checks на `/health`)
- [ ] Настроены бэкапы базы данных

### Приложение

- [ ] `pnpm build` успешно выполняется
- [ ] `pnpm typecheck` без ошибок

---

## Частые проблемы

| Проблема           | Причина                               | Решение                                    |
| ------------------ | ------------------------------------- | ------------------------------------------ |
| API не запускается | Ошибка валидации env                  | `docker compose logs api`                  |
| 502 Bad Gateway    | API или Web не поднялся               | `docker compose ps`, проверить healthcheck |
| CORS ошибки        | `NEXTAUTH_URL` не совпадает с доменом | Проверить значение в `.env`                |
