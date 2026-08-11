# QuantPilot MT5 Bridge – Docker
# NOTE: MetaTrader 5 terminal must run on a Windows host with the GUI terminal open.
# This image runs the FastAPI bridge only; it cannot host MT5 itself.
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV ENVIRONMENT=development
ENV MT5_LIVE_EXECUTION=false
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]