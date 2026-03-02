import logging
import sys

logging.basicConfig(level=logging.INFO,
                    handlers=[logging.StreamHandler(sys.stdout)],
                    format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ikimina app")