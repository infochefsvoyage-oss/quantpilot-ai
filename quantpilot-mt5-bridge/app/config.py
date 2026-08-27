"""QuantPilot MT5 Bridge – Configuration & Kill-Switches."""
from __future__ import annotations
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MT5_", extra="ignore")

    environment: Literal["development", "staging", "production"] = "development"
    bridge_api_key: str = "change-me"

    # MT5 terminal
    terminal_path: str = ""
    login: int = 0
    server: str = ""
    password: str = ""  # secret – never logged

    # Live kill-switch (section 11) – must stay false until Phase D
    live_execution: bool = False

    # Heartbeat thresholds
    heartbeat_healthy_seconds: int = 10
    heartbeat_stale_seconds: int = 30

    # Verification expectations
    expected_broker_company: str = "Vantage"
    expected_server: str = "VantageMarkets-Live 14"

    # Symbol discovery
    symbol_canonical: str = "XAUUSD"
    symbol_candidates: str = "XAUUSD,XAUUSD.a,XAUUSD.m,GOLD,XAU"

    @property
    def symbol_candidate_list(self) -> list[str]:
        return [c.strip() for c in self.symbol_candidates.split(",") if c.strip()]

    def is_live_allowed(self) -> bool:
        """Double kill-switch: env must be production AND live_execution true."""
        return self.environment == "production" and self.live_execution is True


settings = Settings()