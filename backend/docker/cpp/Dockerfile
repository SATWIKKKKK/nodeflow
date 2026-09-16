FROM gcc:13

# Python drives compilation + JSON I/O; gdb (with its Python API) records traces.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 gdb \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r nodeflow && useradd -r -g nodeflow nodeflow

WORKDIR /runner

# Precompiled <bits/stdc++.h> built with exactly the harness compile flags, so a
# submission compiles in well under a second instead of ~3s.
RUN mkdir -p /runner/pch/bits \
    && g++ -std=c++17 -O0 -g -x c++-header \
        "$(echo /usr/local/include/c++/*/x86_64-linux-gnu/bits/stdc++.h)" \
        -o /runner/pch/bits/stdc++.h.gch

COPY src/execution/common/nf_trace.py /runner/nf_trace.py
COPY src/execution/cpp/runner.py /runner/runner.py
COPY src/execution/cpp/gdb_tracer.py /runner/gdb_tracer.py

USER nodeflow
ENV HOME=/tmp
ENTRYPOINT ["python3", "/runner/runner.py"]
