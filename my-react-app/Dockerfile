FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# build:docker chứ không phải build: mode "production" nạp .env.production và nung
# VITE_WS_URL trỏ tới backend Render vào bundle, khiến bản compose chạy local mở WebSocket
# sang production thay vì sang container backend. Xem .env.docker.
RUN npm run build:docker

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
