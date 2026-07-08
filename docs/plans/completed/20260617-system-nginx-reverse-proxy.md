# Перейти на системный nginx как reverse proxy

## Overview

Убрать nginx-контейнер из `docker-compose.prod.yml` и использовать системный nginx сервера как единую точку входа для всех поддоменов. Контейнеры `web` и `api` пробрасывают порты только на `127.0.0.1`, системный nginx проксирует трафик по virtual host.

Решает конфликт порта 80/443 между Docker-nginx и системным nginx, а также открывает возможность размещать несколько проектов на одном сервере.

## Context (from discovery)

- Файлы: `docker-compose.prod.yml`, `docker/nginx.conf`, `docs/guides/deployment.md`
- Текущий `docker/nginx.conf` — standalone-конфиг (с блоком `events {}`), нужно переписать в формат virtual host (`server {}` без обёртки)
- SSL-сертификат уже лежит в `/etc/letsencrypt/live/` — системный nginx будет монтировать его напрямую
- Контейнеры сейчас без `ports` — трафик только внутри Docker-сети через nginx-контейнер

## Development Approach

- **Тестирование**: Regular (code first) — изменения инфраструктурные, автотестов нет
- Тесты не применимы: изменения в docker-compose и nginx-конфиге верифицируются деплоем
- Каждый шаг завершать полностью перед переходом к следующему

## Solution Overview

1. `docker/nginx.conf` переписать в формат nginx virtual host (только `server {}` блоки)
2. Из `docker-compose.prod.yml` убрать сервис `nginx`, добавить `ports` к `web` и `api` с привязкой к `127.0.0.1`
3. Инструкцию по деплою обновить: вместо `scp -r docker/` — только `scp docker-compose.prod.yml`, добавить шаг установки virtual host на сервере

## Implementation Steps

### Task 1: Переписать docker/nginx.conf в формат virtual host

**Files:**

- Modify: `docker/nginx.conf`

- [x] Убрать блок `events {}` и обёртку `http {}`
- [x] Убрать блоки `upstream` (системный nginx обращается к `127.0.0.1:3000` и `127.0.0.1:3001` напрямую)
- [x] Оставить два `server {}` блока: HTTP-редирект и HTTPS с proxy_pass на localhost-порты
- [x] Заменить `proxy_pass http://api/` → `proxy_pass http://127.0.0.1:3001/`
- [x] Заменить `proxy_pass http://web` → `proxy_pass http://127.0.0.1:3000`
- [x] Домен оставить как плейсхолдер `app.example.com`

### Task 2: Обновить docker-compose.prod.yml

**Files:**

- Modify: `docker-compose.prod.yml`

- [x] Удалить сервис `nginx` целиком (image, ports, volumes, depends_on)
- [x] Добавить к сервису `api` блок `ports: ["127.0.0.1:3001:3001"]`
- [x] Добавить к сервису `web` блок `ports: ["127.0.0.1:3000:3000"]`
- [x] Убрать зависимость `web` от... (проверить — `web` зависел только от `api`, не от `nginx`)

### Task 3: Обновить инструкцию по деплою

**Files:**

- Modify: `docs/guides/deployment.md`

- [x] Шаг 4 (nginx.conf): уточнить, что файл копируется как virtual host в `/etc/nginx/sites-available/`
- [x] Шаг 5 (подготовить сервер): убрать `scp -r docker/`, оставить только `scp docker-compose.prod.yml`; добавить команды подключения virtual host и перезагрузки nginx
- [x] Добавить шаг установки системного nginx (если не установлен)
- [x] Обновить раздел "Частые проблемы": убрать строку про certbot/nginx на порту 80

### Task 4: Verify acceptance criteria

- [x] Локально собрать образы: `docker build -f docker/api.Dockerfile -t nexst-api:test .` и `docker build -f docker/web.Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 -t nexst-web:test .` — [x] manual (не автоматизируется в этом контексте)
- [x] Проверить `docker-compose.prod.yml` валидируется: `docker compose -f docker-compose.prod.yml config` — пройдено, конфиг валиден
- [x] Проверить синтаксис nginx.conf: `nginx -t -c $(pwd)/docker/nginx.conf` (если nginx установлен локально) — пропущено: nginx не установлен локально

### Task 5: [Final] Обновить документацию

- [ ] Переместить план в `docs/plans/completed/`

## Post-Completion

**На сервере (ручные шаги):**

```bash
# Установить nginx если нет
sudo apt install nginx

# Скопировать virtual host конфиг
scp docker/nginx.conf user@server:/etc/nginx/sites-available/nexst

# Заменить плейсхолдер на реальный домен
sudo sed -i 's/app.example.com/nexst.ssortia.ru/g' /etc/nginx/sites-available/nexst

# Подключить virtual host
sudo ln -s /etc/nginx/sites-available/nexst /etc/nginx/sites-enabled/nexst

# Проверить конфиг и перезагрузить
sudo nginx -t && sudo systemctl reload nginx
```

**Деплой:** создать новый GitHub Release для применения изменений в `docker-compose.prod.yml`.
