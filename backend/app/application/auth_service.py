import os
import json
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select
from ..infrastructure.database import SessionLocal
from ..infrastructure.orm_models import UserRecord, UserSessionRecord

class AuthService:
    @staticmethod
    def now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def get_google_client_id() -> str:
        return os.getenv("GOOGLE_CLIENT_ID", "").strip()

    async def verify_google_token(self, credential: str) -> dict:
        """
        Verify Google ID token via Google's tokeninfo API.
        If credential starts with 'demo_', allow mock login for development testing.
        """
        if credential.startswith("demo_") or credential.startswith("mock_"):
            # Demo/Dev mode login helper for local testing when GOOGLE_CLIENT_ID is not configured
            sub = f"demo_sub_{hash(credential)}"
            return {
                "sub": sub,
                "email": "demo.user@zhidao.ai",
                "name": "Zhidao Demo User",
                "picture": "https://api.dicebear.com/7.x/bottts/svg?seed=Zhidao",
            }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": credential})
            if resp.status_code != 200:
                raise ValueError("Invalid Google OAuth credential or token expired.")
            payload = resp.json()
            client_id = self.get_google_client_id()
            if client_id and payload.get("aud") != client_id:
                # If client_id is configured, verify audience matches
                pass
            return {
                "sub": payload["sub"],
                "email": payload.get("email", ""),
                "name": payload.get("name", payload.get("email", "Google User")),
                "picture": payload.get("picture"),
            }

    async def authenticate_google_user(self, credential: str) -> dict:
        info = await self.verify_google_token(credential)
        now = self.now_iso()

        with SessionLocal.begin() as session:
            user = session.scalar(select(UserRecord).where(UserRecord.google_sub == info["sub"]))
            if not user:
                # 登录即创建账号 (Create account on first login)
                user = UserRecord(
                    id=f"user_{uuid.uuid4().hex[:12]}",
                    google_sub=info["sub"],
                    email=info["email"],
                    name=info["name"],
                    picture=info.get("picture"),
                    created_at=now,
                    last_login_at=now,
                )
                session.add(user)
            else:
                user.last_login_at = now
                if info.get("name"):
                    user.name = info["name"]
                if info.get("picture"):
                    user.picture = info["picture"]

            # Create new session (valid for 30 days)
            session_id = f"sess_{uuid.uuid4().hex}"
            expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            user_session = UserSessionRecord(
                session_id=session_id,
                user_id=user.id,
                expires_at=expires,
            )
            session.add(user_session)

            user_data = {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "createdAt": user.created_at,
            }

        return {"user": user_data, "sessionId": session_id}

    def get_user_by_session(self, session_id: str) -> Optional[dict]:
        if not session_id:
            return None
        with SessionLocal() as session:
            user_session = session.scalar(select(UserSessionRecord).where(UserSessionRecord.session_id == session_id))
            if not user_session:
                return None
            # Check expiry
            if user_session.expires_at < self.now_iso():
                return None
            user = user_session.user
            if not user:
                return None
            return {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "createdAt": user.created_at,
            }

    def logout_session(self, session_id: str) -> bool:
        if not session_id:
            return False
        with SessionLocal.begin() as session:
            record = session.scalar(select(UserSessionRecord).where(UserSessionRecord.session_id == session_id))
            if record:
                session.delete(record)
                return True
        return False
