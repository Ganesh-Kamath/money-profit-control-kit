import os
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import httpx
from .config import settings

class EmailService:
    _recent_emails: List[Dict[str, Any]] = []

    @classmethod
    def send_email(
        cls,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        email_record = {
            "to": to_email,
            "subject": subject,
            "html": html_content,
            "text": text_content or subject,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "provider": "resend" if settings.RESEND_API_KEY else "local_dev_sink",
        }
        
        cls._recent_emails.insert(0, email_record)
        if len(cls._recent_emails) > 100:
            cls._recent_emails.pop()

        # Always record to local log file for easy verification
        try:
            sink_path = settings.EMAIL_DEV_SINK_FILE
            os.makedirs(os.path.dirname(os.path.abspath(sink_path)), exist_ok=True)
            with open(sink_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(email_record) + "\n")
        except Exception:
            pass

        # If live Resend API key is configured, send HTTP request
        if settings.RESEND_API_KEY:
            try:
                headers = {
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "from": settings.EMAIL_FROM,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                    "text": text_content or subject
                }
                resp = httpx.post("https://api.resend.com/emails", json=payload, headers=headers, timeout=10.0)
                return resp.status_code in (200, 201)
            except Exception as e:
                print(f"[EmailService Error] Resend dispatch failed: {e}")
                return False

        return True

    @classmethod
    def get_recent_emails(cls) -> List[Dict[str, Any]]:
        return cls._recent_emails
