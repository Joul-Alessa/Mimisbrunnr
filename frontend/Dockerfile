# Build stage. Needs Node >=22.12 (Vite's rolldown toolchain requires it —
# see Docs, "Frontend vite build error" note for why 20/22.11 don't work).
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Vite bakes VITE_* env vars into the build at build time, not at container
# start time, so this has to be a build arg rather than a runtime env var.
ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Serve stage: static files behind nginx.
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
