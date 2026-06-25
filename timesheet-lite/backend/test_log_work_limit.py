import os
import json
import unittest
from pathlib import Path
from app.core.config import get_log_work_limit_days

class TestLogWorkLimit(unittest.TestCase):
    def setUp(self):
        # Resolve config path relative to backend folder
        self.config_path = Path(__file__).resolve().parent / "log_work_limit_days.json"
        self.backup_content = None
        if self.config_path.exists():
            try:
                with open(self.config_path, "r") as f:
                    self.backup_content = f.read()
            except Exception:
                pass

    def tearDown(self):
        # Restore backup if it existed
        if self.backup_content is not None:
            try:
                with open(self.config_path, "w") as f:
                    f.write(self.backup_content)
            except Exception:
                pass
        elif self.config_path.exists():
            try:
                os.remove(self.config_path)
            except Exception:
                pass

    def test_default_limit_fallback(self):
        # Remove config file temporarily to test fallback
        if self.config_path.exists():
            try:
                os.remove(self.config_path)
            except Exception:
                pass
        
        # Should fall back to 30
        limit = get_log_work_limit_days()
        self.assertEqual(limit, 30)

    def test_custom_limit(self):
        # Create a custom config
        config_data = {"log_work_limit_days": 45}
        with open(self.config_path, "w") as f:
            json.dump(config_data, f)
            
        limit = get_log_work_limit_days()
        self.assertEqual(limit, 45)

    def test_invalid_json_fallback(self):
        # Write malformed JSON
        with open(self.config_path, "w") as f:
            f.write("{invalid-json}")
            
        # Should fall back to 30
        limit = get_log_work_limit_days()
        self.assertEqual(limit, 30)

if __name__ == "__main__":
    unittest.main()
