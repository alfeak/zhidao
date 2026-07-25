from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class ModelRecord(Base):
    __tablename__ = "models"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    api_key: Mapped[str] = mapped_column(Text, nullable=False, default="")
    base_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

class PaperRecord(Base):
    __tablename__ = "papers"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    is_decoded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    decode_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    decode_error: Mapped[str | None] = mapped_column(Text)
    imported_at: Mapped[str] = mapped_column(String, nullable=False)
    blocks: Mapped[list["MarkdownBlockRecord"]] = relationship(back_populates="paper", cascade="all, delete-orphan", order_by="MarkdownBlockRecord.block_index")
    messages: Mapped[list["ChatMessageRecord"]] = relationship(back_populates="paper", cascade="all, delete-orphan")
    remarks: Mapped[list["RemarkRecord"]] = relationship(back_populates="paper", cascade="all, delete-orphan")

class MarkdownBlockRecord(Base):
    __tablename__ = "markdown_blocks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    paper_id: Mapped[str] = mapped_column(ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    block_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_index: Mapped[int | None] = mapped_column(Integer)
    bbox: Mapped[str | None] = mapped_column(Text)
    paper: Mapped[PaperRecord] = relationship(back_populates="blocks")

class ChatMessageRecord(Base):
    __tablename__ = "chat_messages"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    paper_id: Mapped[str] = mapped_column(ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    paper: Mapped[PaperRecord] = relationship(back_populates="messages")

class RemarkRecord(Base):
    __tablename__ = "remarks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    paper_id: Mapped[str] = mapped_column(ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    block_id: Mapped[str] = mapped_column(String, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    paper: Mapped[PaperRecord] = relationship(back_populates="remarks")
