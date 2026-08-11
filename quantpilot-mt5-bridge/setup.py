# QuantPilot MT5 Bridge – FastAPI Backend
# Echte MetaTrader5-Python-Schnittstelle. Läuft auf dem MT5/Vantage-Rechner.
# Live-Execution ist hier NICHT enthalten – /orders/execute ist technisch blockiert.

from setuptools import setup, find_packages

setup(
    name="quantpilot-mt5-bridge",
    version="1.2.0",
    description="QuantPilot MT5 Bridge – FastAPI read-only adapter for Vantage / MetaTrader 5",
    packages=find_packages(),
    python_requires=">=3.11",
    install_requires=[
        "fastapi>=0.110",
        "uvicorn[standard]>=0.27",
        "pydantic>=2.6",
        "pydantic-settings>=2.2",
        "MetaTrader5>=5.0.45",
        "structlog>=24.1",
        "requests>=2.31",
    ],
    extras_require={"test": ["pytest>=8.0", "httpx>=0.27"]},
)