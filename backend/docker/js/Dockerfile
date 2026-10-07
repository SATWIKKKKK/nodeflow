FROM node:24-bookworm-slim

# The JavaScript/TypeScript harness: acorn reads the code for tracing, Sucrase
# removes TypeScript's types without moving any line.
WORKDIR /runner/js
COPY src/execution/js/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY src/execution/js/runner.mjs src/execution/js/instrument.mjs src/execution/js/prelude.js ./

RUN groupadd -r nodeflow && useradd -r -g nodeflow nodeflow
USER nodeflow
ENV HOME=/tmp
ENTRYPOINT ["node", "/runner/js/runner.mjs"]
