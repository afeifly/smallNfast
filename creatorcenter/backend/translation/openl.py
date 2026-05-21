import httpx
from backend.translation.base import TranslationProvider
from backend.config import LANG_TO_API

RAPIDAPI_HOST = "openl-translate.p.rapidapi.com"
RAPIDAPI_URL = "https://openl-translate.p.rapidapi.com/translate/bulk"


class OpenLProvider(TranslationProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.Client(
            timeout=httpx.Timeout(60.0, connect=15.0),
            headers={
                "Content-Type": "application/json",
                "x-rapidapi-host": RAPIDAPI_HOST,
                "x-rapidapi-key": self.api_key,
            },
        )

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        results = self.translate_batch([text], source_lang, target_lang)
        return results[0] if results else text

    def translate_batch(
        self, texts: list[str], source_lang: str, target_lang: str
    ) -> list[str]:
        response = self.client.post(
            RAPIDAPI_URL,
            json={
                "target_lang": LANG_TO_API.get(target_lang, target_lang.lower()),
                "text": texts,
            },
        )
        response.raise_for_status()
        data = response.json()
        translations = data.get("translatedTexts", [])
        if not translations:
            return texts
        return translations

    def close(self):
        self.client.close()
