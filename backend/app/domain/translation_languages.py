"""Backend-owned target languages, identified by standard BCP 47 language tags."""

TRANSLATION_LANGUAGES = (
    {"code": "zh-CN", "name": "Simplified Chinese"},
    {"code": "en", "name": "English"},
    {"code": "ja", "name": "Japanese"},
    {"code": "de", "name": "German"},
)

TRANSLATION_LANGUAGE_BY_CODE = {language["code"]: language for language in TRANSLATION_LANGUAGES}


def translation_language(code: str) -> dict:
    return TRANSLATION_LANGUAGE_BY_CODE.get(code, {})
