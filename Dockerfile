# 1. Use the official Cloudflare Sandbox image with Python pre-installed
# We use the specific version found in your 'code-interpreter' example for stability.
FROM docker.io/cloudflare/sandbox:0.6.7-python

# 2. Set the working directory where the agent's files will be stored
WORKDIR /workspace

# 3. Install System Dependencies
# 'build-essential' is needed for compiling some Python packages.
# 'git' is required for the agent's 'cloneRepo' tool.
# 'curl' and 'wget' are useful for the agent to download files.
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 4. Pre-install Python Libraries
# Installing these now saves time during the agent's execution.
# These cover data analysis, plotting, and HTTP requests.
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    seaborn \
    requests \
    scikit-learn \
    scipy

# 5. Expose Ports
# Expose port 8080 (or 8000) for the 'startPreview' tool.
# This allows the agent to run web servers that you can view in the browser.
EXPOSE 8080
EXPOSE 8000

# 6. Metadata (Optional but recommended)
LABEL maintainer="polymath-agent"
LABEL description="AI Sandbox environment with Python and Data Science tools"

# Note: The base image handles the ENTRYPOINT/CMD automatically.
# It starts the Sandbox supervisor which listens for your Worker's commands.
