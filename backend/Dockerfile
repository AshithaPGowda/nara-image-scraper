FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for img2pdf
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpng-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create jobs directory
RUN mkdir -p /app/jobs

EXPOSE 5001

CMD ["python", "app.py"]
