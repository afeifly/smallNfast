from backend.translation.base import TranslationProvider
from backend.translation.openl import OpenLProvider
from backend.translation.minimax import MiniMaxProvider

PROVIDERS: dict[str, type[TranslationProvider]] = {
    "openl": OpenLProvider,
    "minimax": MiniMaxProvider,
}


def get_provider(name: str, api_key: str, **kwargs) -> TranslationProvider:
    cls = PROVIDERS.get(name)
    if not cls:
        raise ValueError(
            f"Unknown translation provider: {name}. "
            f"Available: {list(PROVIDERS.keys())}"
        )
    return cls(api_key=api_key, **kwargs)
