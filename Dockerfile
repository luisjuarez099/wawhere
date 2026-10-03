# --- Build ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inyecta las variables VITE_* en tiempo de build
ARG VITE_MAP_URL
ARG VITE_API_URL
ARG VITE_MAP_STYLE_URL
ARG VITE_REPORT_EXPIRY_HOURS
ENV VITE_MAP_URL=$VITE_MAP_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_MAP_STYLE_URL=$VITE_MAP_STYLE_URL \
    VITE_REPORT_EXPIRY_HOURS=$VITE_REPORT_EXPIRY_HOURS

RUN npm run build

# --- Runtime ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
