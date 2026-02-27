# Plan: Authentik Auth Integration

## Context

Excalidraw (InsparkDraw) — SPA, собранная Vite и отдаваемая nginx из Docker-контейнера.
Authentik стоит перед сервисом (Forward Auth через Nginx Proxy Manager) и передаёт заголовки:

| Header | Content |
|---|---|
| `X-User` | username |
| `X-Email` | email |
| `X-Name` | Full name |
| `X-Groups` | Groups (comma-separated) |
| `Remote-User` | username (duplicate) |

**Проблема:** JavaScript в браузере не может прочитать HTTP-заголовки запроса.
Нужен мост между серверными заголовками и клиентским JS.

**БД не нужна** — данные пользователя приходят в каждом запросе от Authentik.

---

## Решение: Tiny Node.js server вместо голого nginx

Заменяем `nginx:1.27-alpine` на `node:18-alpine` в финальной стадии Dockerfile.
Сервер (~30 строк) делает 3 вещи:
1. `GET /api/auth/me` — читает заголовки, отдаёт JSON
2. Отдаёт статику из `build/`
3. SPA-fallback: все остальные маршруты → `index.html`

**Бонус:** это также исправляет отсутствующий SPA-fallback (сейчас nginx не настроен на это) и станет фундаментом для будущих API (AI proxy, хранилище сцен из TODO).

---

## Phases

### Phase 1: Server bridge

**Файлы:**
- `excalidraw-app/server.js` — Express-сервер
- `Dockerfile` — изменить финальную стадию

**server.js** (псевдокод):
```js
const express = require('express');
const path = require('path');
const app = express();

app.get('/api/auth/me', (req, res) => {
  const username = req.headers['x-user'];
  if (!username) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    username,
    email: req.headers['x-email'] || '',
    name: req.headers['x-name'] || '',
    groups: (req.headers['x-groups'] || '').split(',').filter(Boolean),
    avatarUrl: req.headers['x-authentik-meta-avatar'] || null,
  });
});

app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(80, () => console.log('Listening on :80'));
```

**Dockerfile** изменения:
```dockerfile
# Вместо:
# FROM nginx:1.27-alpine
# COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

# Теперь:
FROM node:18-alpine
WORKDIR /app
RUN npm install express@4
COPY --from=build /opt/node_app/excalidraw-app/build ./build
COPY --from=build /opt/node_app/excalidraw-app/server.js ./server.js
EXPOSE 80
CMD ["node", "server.js"]
```

**Dev-режим:** Vite middleware мок в `vite.config.mts`:
```ts
// В plugins или server.proxy:
server: {
  proxy: {
    // В dev-режиме /api/auth/me возвращает мок-пользователя
  }
}
```

Добавить `excalidraw-app/server/dev-middleware.ts` — Vite plugin, который перехватывает `GET /api/auth/me` и возвращает:
```json
{
  "authenticated": true,
  "username": "dev-user",
  "email": "dev@localhost",
  "name": "Dev User",
  "groups": ["dev"],
  "avatarUrl": null
}
```
Включается только в dev через `VITE_APP_DEV_AUTH_MOCK=true` env var.

---

### Phase 2: Frontend — Auth module

**Файлы:**
- `excalidraw-app/auth/types.ts`
- `excalidraw-app/auth/authAtom.ts`
- `excalidraw-app/auth/useAuth.ts`

**types.ts:**
```ts
export interface AuthUser {
  authenticated: true;
  username: string;
  email: string;
  name: string;
  groups: string[];
  avatarUrl: string | null;
}

export interface AuthUnauthenticated {
  authenticated: false;
}

export type AuthState = AuthUser | AuthUnauthenticated;
```

**authAtom.ts:**
```ts
import { atom } from "jotai";
import type { AuthState } from "./types";

// Jotai atom — единый паттерн состояния в проекте
export const authUserAtom = atom<AuthState | null>(null);
```

**useAuth.ts:**
```ts
import { useEffect } from "react";
import { useAtom } from "jotai";
import { authUserAtom } from "./authAtom";
import { appJotaiStore } from "../app-jotai";

export const fetchAuthUser = async (): Promise<AuthState> => {
  try {
    const res = await fetch("/api/auth/me");
    return await res.json();
  } catch {
    return { authenticated: false };
  }
};

export const useAuth = () => {
  const [authUser, setAuthUser] = useAtom(authUserAtom);

  useEffect(() => {
    fetchAuthUser().then(setAuthUser);
  }, []);

  return authUser;
};
```

---

### Phase 3: Integration в приложение

**3a. Автоматическое имя для коллаборации**

В `App.tsx` / `ExcalidrawWrapper`:
- При загрузке, если auth user доступен → `saveUsernameToLocalStorage(authUser.name || authUser.username)`
- Это заменит рандомную генерацию для авторизованных пользователей

**3b. UI — кнопка профиля в правом верхнем углу** (РЕШЕНО)

- Маленький аватар рядом с существующими кнопками (справа вверху)
- Клик → dropdown с именем, email, группами
- Стиль: как в Figma/GitHub
- Новый компонент: `excalidraw-app/components/UserProfileButton.tsx`

**Аватар** — три уровня fallback:
1. `avatarUrl` из Authentik (если настроен property mapping)
2. GitHub аватар: `https://github.com/${username}.png` (username совпадает с GitHub)
3. Инициалы из имени (уже работает в `Avatar` компоненте)

---

### Phase 4: Документация настройки Authentik

Для аватара из GitHub в Authentik нужен **custom property mapping**:
1. В Authentik Admin → Customization → Property Mappings
2. Создать SAML/OAuth mapping для `avatar`:
   ```python
   return request.user.attributes.get("avatar", "")
   ```
3. В NPM добавить передачу заголовка:
   ```nginx
   auth_request_set $authentik_avatar $upstream_http_x_authentik_meta_avatar;
   proxy_set_header X-Avatar $authentik_avatar;
   ```

---

## Структура файлов после реализации

```
excalidraw-app/
├── auth/
│   ├── types.ts              # AuthUser, AuthState типы
│   ├── authAtom.ts           # Jotai atom для состояния авторизации
│   └── useAuth.ts            # Hook + fetch функция
├── components/
│   └── UserProfileButton.tsx # Кнопка-аватар (правый верхний угол)
├── server/
│   └── dev-middleware.ts     # Dev-мок для /api/auth/me
├── server.js                 # Express-сервер (production)
├── App.tsx                   # Изменён — подключает auth + auto-username
├── ...existing files...
Dockerfile                    # Изменён — node:18-alpine вместо nginx
```

---

## Решения (закрыты)

1. **UI пользователя**: Кнопка-аватар в правом верхнем углу (как Figma)
2. **GitHub аватар**: Username совпадает с GitHub → используем `https://github.com/${username}.png`
3. **Dev-режим**: Да, мок auth для локальной разработки. Vite proxy + fallback `{ authenticated: false }`

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Подделка заголовков при обходе proxy | Docker-контейнер не экспонирован напрямую, только через NPM |
| Authentik не настроен / нет заголовков | `{ authenticated: false }` → fallback на текущее поведение (random username) |
| Размер Docker-образа увеличится | node:18-alpine ~180MB vs nginx:alpine ~40MB, приемлемо для internal tool |
| Express dependency | Единственная зависимость, <1MB, стабильная |
