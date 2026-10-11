import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "Money & Profit Control Kit"
    ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    # Database
    DATABASE_URL: str = "sqlite:///./control_kit.db"
    
    # Security & Auth
    JWT_SECRET: str = "dev-secret-key-change-in-production-min32chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Razorpay Payments
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: str = "dev_razorpay_webhook_secret_key"
    ENABLE_PAYMENT_SIMULATION: bool = True
    
    # Pricing in INR Paise
    SOLO_TIER_PRICE_PAISE: int = 299900      # ₹2,999.00
    BUSINESS_TIER_PRICE_PAISE: int = 399900  # ₹3,999.00
    
    # Email
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "Money & Profit Control Kit <noreply@controlkit.in>"
    EMAIL_DEV_SINK_FILE: str = "./logs/sent_emails.jsonl"
    
    # Storage
    STORAGE_DIR: str = "./storage/receipts"
    
    # Feature Flags (OFF by default)
    ENABLE_AI_RECEIPTS: bool = False
    ENABLE_AI_ASSISTANT: bool = False

    from pydantic import ConfigDict
    model_config = ConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
