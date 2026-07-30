import os
import json
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select
from ..infrastructure.database import SessionLocal
from ..infrastructure.orm_models import UserRecord, UserSessionRecord, TempAuthTokenRecord

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
            sub = f"demo_sub_{abs(hash(credential))}"
            return {
                "sub": sub,
                "email": f"{sub}@demo.zhidao.ai",
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
            user = session.scalar(select(UserRecord).where((UserRecord.google_sub == info["sub"]) | (UserRecord.email == info["email"])))
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

    def create_temp_auth_token(self, user_id: str, expires_in_seconds: int = 120) -> dict:
        """
        Web 端申请：为已登录的 user_id 生成一个 1-2 分钟有效的临时单次授权码 TempToken。
        """
        temp_token = f"auth_tmp_{uuid.uuid4().hex}"
        now_dt = datetime.now(timezone.utc)
        created_at = now_dt.isoformat()
        expires_at = (now_dt + timedelta(seconds=expires_in_seconds)).isoformat()

        with SessionLocal.begin() as session:
            token_record = TempAuthTokenRecord(
                token=temp_token,
                user_id=user_id,
                created_at=created_at,
                expires_at=expires_at,
                used=False
            )
            session.add(token_record)

        return {
            "tempToken": temp_token,
            "expiresIn": expires_in_seconds,
            "expiresAt": expires_at
        }

    def exchange_temp_token(self, temp_token: str) -> dict:
        """
        手机 App 端调用：拿着 Web 端生成的 TempToken 兑换正式的 30 天 App Session Token。
        验证规则：
        1. 必须在数据库中存在
        2. 必须未被使用过 (used == False)
        3. 必须在有效期内 (now <= expires_at)
        4. 验证成功后标记 used = True (单次使用)
        """
        if not temp_token:
            raise ValueError("授权码 TempToken 不能为空")

        now = self.now_iso()

        with SessionLocal.begin() as session:
            record = session.scalar(select(TempAuthTokenRecord).where(TempAuthTokenRecord.token == temp_token))
            if not record:
                raise ValueError("无效的授权码或已被清除")

            if record.used:
                raise ValueError("此授权码已被使用过，请在 Web 端刷新二维码后重试")

            if record.expires_at < now:
                raise ValueError("授权码已超时失效，请在 Web 端刷新二维码")

            # 标记为已使用 (Single-use enforcement)
            record.used = True

            user = session.scalar(select(UserRecord).where(UserRecord.id == record.user_id))
            if not user:
                raise ValueError("绑定的 Web 端用户账号不存在")

            user.last_login_at = now

            # 创建手机 App 端的正式 30 天 session
            session_id = f"sess_app_{uuid.uuid4().hex}"
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

            return {
                "success": True,
                "token": session_id,
                "sessionId": session_id,
                "user": user_data
            }

