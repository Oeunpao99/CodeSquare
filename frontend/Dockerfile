# syntax=docker/dockerfile:1

# ---------- build: compile the Vite bundle ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* vars at build time. Pass the Google OAuth client id here
# (compose forwards it from .env.prod). Empty is fine if Google login is unused.
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

# ---------- runtime: static files served by nginx, /api proxied to backend ----------
FROM nginx:1.27-alpine AS runtime

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
