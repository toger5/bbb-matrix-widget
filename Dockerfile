# Build static widget
FROM node:20-slim AS build
WORKDIR /app
COPY . .

# Install dependencies and build
RUN yarn install --frozen-lockfile
RUN yarn build

# Serve with nginx
FROM nginx:1.19.0-alpine AS release
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
