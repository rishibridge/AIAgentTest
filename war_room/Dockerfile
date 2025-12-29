# Use official Playwright image to ensure all browser dependencies are met
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install browsers for Playwright
RUN playwright install chromium

# Copy application files
COPY . .

# Cloud Run defines a PORT environment variable, so we listen on it
ENV PORT 8080

# Use Gunicorn as the production server
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
