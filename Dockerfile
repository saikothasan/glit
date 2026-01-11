# Use the official Cloudflare Sandbox base image
FROM cloudflare/sandbox:latest

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment for the agent to use
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Pre-install popular data science & utility libraries to speed up execution
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    requests \
    beautifulsoup4 \
    yt-dlp \
    scikit-learn

# Set the working directory
WORKDIR /workspace
