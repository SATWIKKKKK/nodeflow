FROM eclipse-temurin:21-jdk-jammy

# Python drives compilation + JSON I/O; javac/java do the real work, and the
# JDI-based NfTracer records traces.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r nodeflow && useradd -r -g nodeflow nodeflow

WORKDIR /runner

# The harness and tracer are compiled once, at image build time.
COPY src/execution/java/NfHarness.java src/execution/java/NfTracer.java /runner/java/src/
RUN mkdir -p /runner/java/classes \
    && javac -nowarn -encoding UTF-8 -d /runner/java/classes /runner/java/src/NfHarness.java /runner/java/src/NfTracer.java \
    && java -Xshare:dump >/dev/null 2>&1 || true

COPY src/execution/common/nf_trace.py /runner/nf_trace.py
COPY src/execution/java/runner.py /runner/runner.py

USER nodeflow
ENV HOME=/tmp
ENTRYPOINT ["python3", "/runner/runner.py"]
