import json
import re
import httpx
from typing import List
from backend.translation.base import TranslationProvider
from backend.config import LANG_TO_API, SUPPORTED_LANGUAGES

MINIMAX_URL = "https://api.minimaxi.com/v1/chat/completions"

LANG_NAMES = {v: k for k, v in SUPPORTED_LANGUAGES.items()}


class MiniMaxProvider(TranslationProvider):
    def __init__(self, api_key: str, model: str = "MiniMax-M2.5"):
        self.api_key = api_key
        self.model = model
        self.client = httpx.Client(
            timeout=httpx.Timeout(120.0, connect=15.0),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        results = self.translate_batch([text], source_lang, target_lang)
        return results[0] if results else text

    def translate_batch(
        self, texts: List[str], source_lang: str, target_lang: str
    ) -> List[str]:
        if not texts:
            return []

        src_name = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
        tgt_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)

        # Build a JSON array of texts for the model to translate
        texts_json = json.dumps(texts, ensure_ascii=False)

        system_prompt = (
            f"Translate the following texts from {src_name} to {tgt_name}. "
            f"You MUST output ONLY a single JSON array — no thinking, no explanations, no markdown. "
            f'Format: ["trans1", "trans2"]'
        )

        response = self.client.post(
            MINIMAX_URL,
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": texts_json},
                ],
                "temperature": 0.1,
                "max_tokens": 4096,
            },
        )
        if response.status_code != 200:
            try:
                err = response.json()
                msg = err.get("error", {}).get("message", response.text)
            except Exception:
                msg = response.text
            raise Exception(f"MiniMax API error ({response.status_code}): {msg}")

        data = response.json()

        # Extract the assistant's reply
        content = data["choices"][0]["message"]["content"]

        # Strip <think>...</think> reasoning blocks (MiniMax M2.5)
        clean = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

        # Try parsing strategies in order
        for candidate in (content, clean):
            if not candidate:
                continue
            # Raw JSON array
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, list):
                    while len(parsed) < len(texts):
                        parsed.append(texts[len(parsed)])
                    return parsed[: len(texts)]
            except json.JSONDecodeError:
                pass
            # JSON inside markdown code block
            m = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", candidate, re.DOTALL)
            if m:
                try:
                    parsed = json.loads(m.group(1))
                    if isinstance(parsed, list):
                        while len(parsed) < len(texts):
                            parsed.append(texts[len(parsed)])
                        return parsed[: len(texts)]
                except json.JSONDecodeError:
                    pass
            # Numbered list: 1. "orig" - trans  or  1. "orig" — "trans"
            lines = re.findall(
                r'\d+[\.\)]\s*"([^"]+)"\s*[-–—]\s*"?([^"\n]+?)"?\s*$',
                candidate, re.MULTILINE
            )
            if lines and len(lines) >= len(texts) * 0.5:
                result = [t[1].strip().rstrip('"') for t in lines]
                while len(result) < len(texts):
                    result.append(texts[len(result)])
                return result[: len(texts)]

        raise Exception(
            f"MiniMax returned unparseable content: {content[:300]}"
        )

    def close(self):
        self.client.close()
