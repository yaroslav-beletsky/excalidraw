FROM --platform=${BUILDPLATFORM} node:20 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --network-timeout 600000

ARG NODE_ENV=production

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM --platform=${TARGETPLATFORM} node:20-alpine

WORKDIR /app
RUN npm install --no-save express@4 @octokit/rest@22
COPY --from=build /opt/node_app/excalidraw-app/build ./build
COPY --from=build /opt/node_app/excalidraw-app/server.js ./server.js
EXPOSE 80
HEALTHCHECK CMD wget -q -O /dev/null http://localhost/api/auth/me || exit 1
CMD ["node", "server.js"]
