"""Structured logging with secret redaction. Never logs credentials."""
from __future__ import annotations
import logging
import structlog


_REDACT_KEYS = {"password", "secret", "api_key", "mt5_password", "token", "authorization"}


def _redact_processor(_logger, _method, event_dict: dict) -> dict:
    for k in list(event_dict):
        if k.lower() in _REDACT_KEYS:
            event_dict[k] = "***REDACTED***"
    return event_dict


def configure_logging() -> None:
    logging.basicConfig(format="%(message)s", level=logging.INFO)
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            _redact_processor,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(),
    )


log = structlog.get_logger("quantpilot.mt5")