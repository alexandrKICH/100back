# 100GRAM Backend API

Express сервер с Socket.IO для мессенджера 100GRAM.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Регистрация пользователя
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/logout` - Выход
- `PUT /api/auth/user/:userId` - Обновление пользователя

### Contacts
- `GET /api/contacts/search?query=&userId=` - Поиск пользователей
- `POST /api/contacts/add` - Добавить контакт
- `GET /api/contacts/:userId` - Получить контакты
- `DELETE /api/contacts/:userId/:contactUserId` - Удалить контакт

### Groups
- `POST /api/groups/create` - Создать группу
- `GET /api/groups/:userId` - Получить группы пользователя
- `PUT /api/groups/:groupId` - Обновить группу
- `DELETE /api/groups/:groupId/:userId` - Покинуть группу

### Messages
- `POST /api/messages/send` - Отправить сообщение
- `GET /api/messages/:chatId?userId=` - Получить сообщения
- `GET /api/messages/chat-id/private/:user1Id/:user2Id` - ID приватного чата
- `GET /api/messages/chat-id/group/:groupId` - ID группового чата
- `GET /api/messages/last/:chatId` - Последнее сообщение

### Calls
- `POST /api/calls/initiate` - Инициировать звонок
- `PUT /api/calls/accept/:callId` - Принять звонок
- `PUT /api/calls/decline/:callId` - Отклонить звонок
- `PUT /api/calls/end/:callId` - Завершить звонок
- `GET /api/calls/active/:userId` - Активные звонки

### Files
- `POST /api/files/upload` - Загрузить файл

### Folders
- `GET /api/folders/:userId` - Получить папки
- `POST /api/folders/create` - Создать папку
- `PUT /api/folders/:folderId` - Обновить папку
- `DELETE /api/folders/:folderId` - Удалить папку
- `POST /api/folders/:folderId/add-chat` - Добавить чат в папку
- `POST /api/folders/:folderId/remove-chat` - Удалить чат из папки

## WebSocket Events

- `join_chat` - Присоединиться к чату
- `leave_chat` - Покинуть чат
- `new_message` - Новое сообщение (broadcast)

## Environment Variables

```env
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
FRONTEND_URL=http://localhost:5000
```

## Development

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
npm start
```
