import logging
import time
from weasyprint import HTML

def setup_logging():
    class ProgressHandler(logging.Handler):
        def emit(self, record):
            print(f"WEASY_LOG: {record.getMessage()}")
            
    logger = logging.getLogger('weasyprint.progress')
    logger.setLevel(logging.DEBUG)
    logger.addHandler(ProgressHandler())

setup_logging()
html_content = "<html><body><h1>Hello World</h1><p>" + "中文测试 "*1000 + "</p></body></html>"
start = time.time()
HTML(string=html_content).write_pdf("test.pdf")
print(f"Time taken: {time.time() - start:.2f}s")
