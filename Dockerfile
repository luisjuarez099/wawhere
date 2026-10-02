# --- Build ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inyecta las variables VITE_* en tiempo de build
ARG VITE_MAP_URL
ENV VITE_MAP_URL=$VITE_MAP_URL

RUN npm run build

# --- Runtime ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
