# One image for Vercel Sandbox with every Noesis harness: Python tracer, C++
# (g++ + gdb) and Java (JDK + JDI). Layout mirrors Vercel's managed images: an
# `ubuntu` user with passwordless sudo and /vercel as home.
#
# Build and push (from backend/):
#   npx vercel@latest vcr build docker . noesis-runner:<tag> -f docker/vercel/Dockerfile --push
FROM ubuntu:26.04

ENV LANG=C.UTF-8
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates sudo procps util-linux coreutils \
      python3 g++ gdb openjdk-21-jdk-headless && \
    rm -rf /var/lib/apt/lists/*

RUN printf '%s\n' \
      'Defaults always_set_home' \
      'Defaults !env_reset' \
      'Defaults !fqdn' \
      'ubuntu ALL=(ALL) NOPASSWD:ALL' \
      > /etc/sudoers.d/sandbox && \
    chmod 0440 /etc/sudoers.d/sandbox && \
    install -d -o ubuntu -g ubuntu /vercel && \
    usermod --home /vercel ubuntu

WORKDIR /runner

# Precompiled <bits/stdc++.h> with the harness compile flags (see docker/cpp).
RUN mkdir -p /runner/pch/bits && \
    g++ -std=c++17 -O0 -g -x c++-header \
      "$(ls /usr/include/x86_64-linux-gnu/c++/*/bits/stdc++.h | tail -1)" \
      -o /runner/pch/bits/stdc++.h.gch

COPY src/execution/java/NfHarness.java src/execution/java/NfTracer.java /runner/java/src/
RUN mkdir -p /runner/java/classes && \
    javac -nowarn -encoding UTF-8 -d /runner/java/classes /runner/java/src/NfHarness.java /runner/java/src/NfTracer.java && \
    (java -Xshare:dump >/dev/null 2>&1 || true)

COPY src/execution/common/nf_trace.py /runner/nf_trace.py
COPY src/execution/python/tracer.py /runner/tracer.py
COPY src/execution/cpp/runner.py /runner/cpp_runner.py
COPY src/execution/cpp/gdb_tracer.py /runner/gdb_tracer.py
COPY src/execution/java/runner.py /runner/java_runner.py
COPY docker/vercel/nf-run /usr/local/bin/nf-run
RUN chmod 0755 /usr/local/bin/nf-run && chmod -R a+rX /runner && \
    python3 --version && g++ --version | head -1 && gdb --version | head -1 && java -version

# Payloads are written here by the API before each run: owned by the sandbox
# user, unreadable by the throwaway users the harnesses run as.
RUN install -d -m 0700 -o ubuntu -g ubuntu /vercel/in

ENV HOME=/vercel
USER ubuntu
WORKDIR /vercel
