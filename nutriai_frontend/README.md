# NutriAI Frontend 🥗📱

React Native приложение для анализа питания с интеграцией FastAPI backend и AI-сканированием.

## 🚀 Особенности

- **🔐 Аутентификация**: Регистрация и вход с JWT токенами
- **📱 Сканирование штрихкодов**: Распознавание продуктов по баркоду
- **🤖 AI-сканирование**: ИИ-анализ продуктов по фотографии
- **🍎 Поиск продуктов**: Интеграция с базой данных продуктов питания
- **📊 История сканирований**: Отслеживание и анализ питания
- **📸 Камера интеграция**: expo-camera, expo-barcode-scanner, expo-image-picker
- **⚡ Real-time тестирование**: Встроенные инструменты для тестирования API
- **🎨 Современный UI**: Адаптивный дизайн с темной/светлой темой
- **📱 Cross-platform**: iOS, Android, Web поддержка

## 🛠 Технологический стек

- **Framework**: React Native с Expo SDK 54
- **Navigation**: Expo Router (file-based routing)
- **Language**: TypeScript
- **Camera**: expo-camera, expo-barcode-scanner, expo-image-picker, react-webcam
- **Backend**: FastAPI интеграция
- **Authentication**: JWT токены
- **API**: RESTful endpoints

## 📋 Требования

- Node.js 16+ 
- Expo CLI
- iOS Simulator или Android Emulator
- FastAPI backend на localhost:3001

## 🚀 Быстрый старт

1. **Клонируйте репозиторий**
   ```bash
   git clone https://github.com/YOUR_USERNAME/nutriai-frontend.git
   cd nutriai-frontend
   ```

2. **Установите зависимости**
   ```bash
   npm install
   ```

3. **Настройте окружение**
   ```bash
   cp .env.example .env
   # Отредактируйте .env файл при необходимости
   ```

4. **Запустите приложение**
   ```bash
   npx expo start
   ```

5. **Откройте на устройстве**
   - Отсканируйте QR код в Expo Go
   - Или нажмите `i` для iOS симулятора
   - Или нажмите `a` для Android эмулятора

## 🔧 Конфигурация

### Environment Variables

Создайте `.env` файл в корне проекта:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_ENVIRONMENT=development
EXPO_PUBLIC_AUTH_ENABLED=true
```

### Backend Setup

Убедитесь, что ваш FastAPI backend запущен на `localhost:3001` с endpoints:

- `GET /health` - Health check
- `POST /auth/register` - Регистрация пользователя
- `POST /auth/login` - Вход в систему
- `GET /food/foods` - Поиск продуктов
- `GET /food/scan-history` - История сканирований

## 📱 Функционал приложения

### Profile Screen (Главный экран тестирования)

- **🔗 API Connection Test**: Проверка соединения с backend
- **🔐 Authentication Test**: Тестирование регистрации и входа
- **🗄️ Database Integration**: Тестирование работы с базой данных
- **🍎 Food Search**: Поиск продуктов в реальном времени
- **📊 Scan History**: Просмотр истории сканирований

### Home Screen

- Основной интерфейс приложения
- Навигация по функциям

## 🔧 API Интеграция

Приложение интегрируется с FastAPI backend через:

- **Authentication API** (`/auth/`): Регистрация, вход, управление токенами
- **Food API** (`/food/`): Поиск продуктов, история сканирований
- **Health Check** (`/health`): Мониторинг состояния backend

## 📚 Документация

- [`API_INTEGRATION.md`](./API_INTEGRATION.md) - Подробная документация по API
- [`MOBILE_SETUP.md`](./MOBILE_SETUP.md) - Настройка мобильной разработки
- [`ENV_GUIDE.md`](./ENV_GUIDE.md) - Руководство по переменным окружения

## 🧪 Тестирование

Встроенные инструменты тестирования на Profile экране:

1. **Test API Connection** - Проверка соединения
2. **Test Authentication** - Полный цикл аутентификации  
3. **Search Foods** - Тестирование поиска
4. **Get Scan History** - Проверка данных пользователя

## 🚀 Deployment

### Expo Build

```bash
# Android
expo build:android

# iOS  
expo build:ios

# Web
expo build:web
```

### EAS Build (Рекомендуется)

```bash
npx eas build --platform all
```

## 🤝 Contributing

1. Fork репозиторий
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 License

MIT License - подробности в [LICENSE](LICENSE) файле.

## 👥 Авторы

- **Timofej Stukalin** - *Initial work* - [GitHub](https://github.com/YOUR_USERNAME)

## 🙏 Благодарности

- Expo team за отличный framework
- FastAPI за мощный backend framework
- React Native community за полезные библиотеки

---

**NutriAI** - Делаем здоровое питание проще! 🥗✨
