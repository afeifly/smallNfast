import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / ".env")  # Load from project root
DATABASE_PATH = BASE_DIR / "transt.db"
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUTS_DIR = BASE_DIR / "outputs"

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(OUTPUTS_DIR, exist_ok=True)

MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

SUPPORTED_LANGUAGES = {
    "EN": "English",
    "DE": "German",
    "CN": "Chinese (Simplified)",
    "JP": "Japanese",
    "FR": "French",
    "ES": "Spanish",
    "KO": "Korean",
    "PT": "Portuguese",
    "IT": "Italian",
    "RU": "Russian",
    "AR": "Arabic",
}

# Map our language codes to OpenL API language codes
LANG_TO_API = {
    "EN": "en",
    "DE": "de",
    "CN": "zh-CN",
    "JP": "ja",
    "FR": "fr",
    "ES": "es",
    "KO": "ko",
    "PT": "pt",
    "IT": "it",
    "RU": "ru",
    "AR": "ar",
}

TRANSLATION_PROVIDER = os.getenv("TRANSLATION_PROVIDER", "openl")
TRANSLATION_API_KEY = os.getenv("TRANSLATION_API_KEY", "b5adf2ddfcmsh9d2b1e6e00424ebp1d9f3cjsne440960a50c8")
TRANSLATION_API_URL = os.getenv("TRANSLATION_API_URL", "https://openl-translate.p.rapidapi.com/translate/bulk")
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_MODEL = os.getenv("MINIMAX_MODEL", "MiniMax-M2.5")
