from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class SchemaMetadataRecord(Base):
    __tablename__ = "schema_metadata"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)

class DocumentRecord(Base):
    """Local metadata only; all MinerU output bytes live in object storage."""
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    decode_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    decode_error: Mapped[str | None] = mapped_column(Text)
    object_prefix: Mapped[str | None] = mapped_column(String, unique=True)
    parser_backend: Mapped[str | None] = mapped_column(String)
    mineru_version: Mapped[str | None] = mapped_column(String)
    imported_at: Mapped[str] = mapped_column(String, nullable=False)
    artifacts: Mapped[list["DocumentArtifactRecord"]] = relationship(back_populates="document", cascade="all, delete-orphan")
    translation_job: Mapped["TranslationJobRecord | None"] = relationship(back_populates="document", cascade="all, delete-orphan", uselist=False)
    messages: Mapped[list["ChatMessageRecord"]] = relationship(back_populates="document", cascade="all, delete-orphan")
    remarks: Mapped[list["RemarkRecord"]] = relationship(back_populates="document", cascade="all, delete-orphan")

class DocumentArtifactRecord(Base):
    __tablename__ = "document_artifacts"
    __table_args__ = (UniqueConstraint("document_id", "archive_path", name="uq_document_artifact_path"),)
    id: Mapped[str] = mapped_column(String, primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    archive_path: Mapped[str] = mapped_column(Text, nullable=False)
    object_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String, nullable=False)
    translation_language: Mapped[str | None] = mapped_column(String)
    document: Mapped[DocumentRecord] = relationship(back_populates="artifacts")

class TranslationJobRecord(Base):
    """One durable translation state machine per document."""
    __tablename__ = "translation_jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    target_language: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
    document: Mapped[DocumentRecord] = relationship(back_populates="translation_job")

class ChatMessageRecord(Base):
    __tablename__ = "chat_messages"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    document: Mapped[DocumentRecord] = relationship(back_populates="messages")

class RemarkRecord(Base):
    __tablename__ = "remarks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    block_index: Mapped[int | None] = mapped_column(Integer, index=True)
    block_id: Mapped[str] = mapped_column(String, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    document: Mapped[DocumentRecord] = relationship(back_populates="remarks")

class UserRecord(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    google_sub: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    picture: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    last_login_at: Mapped[str] = mapped_column(String, nullable=False)
    sessions: Mapped[list["UserSessionRecord"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    settings: Mapped["UserSettingsRecord | None"] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False)

class UserSessionRecord(Base):
    __tablename__ = "user_sessions"
    session_id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at: Mapped[str] = mapped_column(String, nullable=False)
    user: Mapped[UserRecord] = relationship(back_populates="sessions")

class UserSettingsRecord(Base):
    """All service credentials stored as a single JSON blob (configs_json).
    No legacy single-field columns — the new multi-profile design is the only source of truth.
    """
    __tablename__ = "user_settings"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    configs_json: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
    user: Mapped[UserRecord] = relationship(back_populates="settings")
