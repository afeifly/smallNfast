from pydantic import BaseModel
from typing import Optional, List, Dict

class ProjectOut(BaseModel):
    id: int
    name: str
    content_type: str
    source_lang: str
    target_lang: Optional[str]
    status: str
    segment_count: int
    share_code: Optional[str] = None
    is_published: bool = False
    created_at: str

    @classmethod
    def from_row(cls, row) -> "ProjectOut":
        d = dict(row)
        d["segment_count"] = d.pop("segment_count", 0)
        d["is_published"] = bool(d.get("is_published", 0))
        return cls(**d)


class ProjectDetail(ProjectOut):
    original_file: Optional[str]
    markdown_content: Optional[str]
    updated_at: str
    available_languages: List[str] = []


class SegmentOut(BaseModel):
    id: int
    project_id: int
    sequence: int
    paragraph_index: int
    container_paragraph_index: Optional[int]
    run_index: int
    source_text: str
    formatting_json: dict
    paragraph_formatting_json: dict
    container_type: str
    container_index: Optional[int]
    table_row: Optional[int]
    table_col: Optional[int]
    section_index: Optional[int]
    key_id: Optional[int]
    translated_text: Optional[str]
    is_translated: bool
    ignored: bool
    translated_langs: Dict[str, str] = {}

    @classmethod
    def from_row(cls, row) -> "SegmentOut":
        d = dict(row)
        d["formatting_json"] = d.get("formatting_json") or {}
        if isinstance(d["formatting_json"], str):
            import json
            d["formatting_json"] = json.loads(d["formatting_json"])
        d["paragraph_formatting_json"] = d.get("paragraph_formatting_json") or {}
        if isinstance(d["paragraph_formatting_json"], str):
            import json
            d["paragraph_formatting_json"] = json.loads(d["paragraph_formatting_json"])
        d["is_translated"] = bool(d.get("is_translated", False))
        d["ignored"] = bool(d.get("ignored", False))
        d["translated_langs"] = d.get("translated_langs") or {}
        if isinstance(d["translated_langs"], str):
            d["translated_langs"] = json.loads(d["translated_langs"])
        return cls(**d)


class PaginatedSegments(BaseModel):
    items: List[SegmentOut]
    total: int
    page: int
    page_size: int


class TranslationPair(BaseModel):
    key_id: int
    source_text: str
    translated_text: Optional[str]
    is_edited: bool
    occurrence_count: int


class TranslateRequest(BaseModel):
    target_lang: str
    provider: str = "openl"


class TranslateStatus(BaseModel):
    status: str
    translated_count: int
    total_count: int


class ExportRequest(BaseModel):
    target_lang: str


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    target_lang: Optional[str] = None
    source_lang: Optional[str] = None


class CreateMarkdownRequest(BaseModel):
    name: str
    content_type: str = "markdown"
    markdown_content: str = ""
    source_lang: str = "EN"


class UpdateContentRequest(BaseModel):
    markdown_content: str


class EditTranslationRequest(BaseModel):
    translated_text: str


class BatchEditRequest(BaseModel):
    edits: List[dict]


class PublishedProjectOut(BaseModel):
    name: str
    content_type: str
    source_lang: str
    target_lang: str
    content: str
