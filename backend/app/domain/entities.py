from dataclasses import dataclass, field
from typing import Optional

@dataclass
class MarkdownBlock:
    id: str
    index: int
    content: str
    page_index: Optional[int] = None
    bbox: Optional[str] = None

@dataclass
class Paper:
    id: str
    title: str
    url: str
    is_decoded: bool = False
    decode_status: str = "pending"
    decode_error: Optional[str] = None
    imported_at: str = ""
    blocks: list[MarkdownBlock] = field(default_factory=list)

@dataclass
class ChatMessage:
    id: str
    paper_id: str
    role: str
    content: str
    created_at: str

@dataclass
class Remark:
    id: str
    paper_id: str
    block_id: str
    comment: str
    color: str
    created_at: str

@dataclass
class ModelConfig:
    id: str
    name: str
    api_key: str = ""
    base_url: str = ""
    is_primary: bool = False
