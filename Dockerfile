FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json index.ts ./
COPY utils/ utils/
COPY commands/ commands/

ENV DATA_DIR=/app/data
VOLUME /app/data

CMD ["bun", "run", "index.ts"]
