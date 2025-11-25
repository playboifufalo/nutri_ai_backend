# Dockerfile для React фронтенда Nutriai Frontend
FROM node:18-alpine as build

WORKDIR /app

# Копируем package.json для кэширования зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . ./

# Переменные окружения для build
ARG REACT_APP_API_URL=http://localhost:3001
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Билдим React приложение
RUN npm run build

# Production stage с Nginx
FROM nginx:alpine

# Удаляем дефолтную nginx страницу
RUN rm -rf /usr/share/nginx/html/*

# Копируем собранное приложение
COPY --from=build /app/build /usr/share/nginx/html

# Копируем кастомную nginx конфигурацию
COPY nginx.conf /etc/nginx/nginx.conf

# Создаем пользователя nginx
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Права доступа
RUN chown -R nextjs:nodejs /usr/share/nginx/html
RUN chown -R nextjs:nodejs /var/cache/nginx
RUN chown -R nextjs:nodejs /var/log/nginx
RUN chown -R nextjs:nodejs /etc/nginx/conf.d
RUN touch /var/run/nginx.pid
RUN chown -R nextjs:nodejs /var/run/nginx.pid

USER nextjs

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]