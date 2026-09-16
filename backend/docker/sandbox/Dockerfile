FROM python:3.14-alpine

RUN addgroup -S nodeflow && adduser -S nodeflow -G nodeflow

WORKDIR /runner
COPY src/execution/common/nf_trace.py /runner/nf_trace.py
COPY src/execution/python/tracer.py /runner/tracer.py

USER nodeflow
ENTRYPOINT ["python", "/runner/tracer.py"]
