from abc import ABC, abstractmethod


class TranslationProvider(ABC):
    @abstractmethod
    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        ...

    @abstractmethod
    def translate_batch(
        self, texts: list[str], source_lang: str, target_lang: str
    ) -> list[str]:
        ...
