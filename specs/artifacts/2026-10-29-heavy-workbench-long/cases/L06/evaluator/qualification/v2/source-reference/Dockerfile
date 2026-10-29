FROM opencorvus-benchmark-cpsat:20261029
RUN python -m venv --system-site-packages /opt/cpsat
RUN /opt/cpsat/bin/python -c "import numpy,scipy,matplotlib,ortools; print(numpy.__version__,scipy.__version__,matplotlib.__version__,ortools.__version__); assert (numpy.__version__,scipy.__version__,matplotlib.__version__,ortools.__version__)==('2.4.6','1.15.3','3.10.3','9.15.6755')"
