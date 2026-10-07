FROM gcc:13

# Python drives compilation + JSON I/O; gdb (with its Python API) records
# traces, with the same tracer as C++. uthash is there because LeetCode's C
# has it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 gdb uthash-dev \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r nodeflow && useradd -r -g nodeflow nodeflow

WORKDIR /runner

COPY src/execution/common/nf_trace.py /runner/nf_trace.py
COPY src/execution/c/runner.py /runner/runner.py
COPY src/execution/cpp/gdb_tracer.py /runner/gdb_tracer.py

USER nodeflow
ENV HOME=/tmp
ENTRYPOINT ["python3", "/runner/runner.py"]
