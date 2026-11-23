"""Build the self-contained landing page using the files in this repository."""

from base64 import b64encode
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "src"
ASSETS = SOURCE / "assets"


def encode_asset(name):
    return b64encode((ASSETS / name).read_bytes()).decode("ascii")


def build(destination):
    html = (SOURCE / "imenno-hero.template.html").read_text(encoding="utf-8")
    replacements = {
        "__PRATA__": encode_asset("Prata-Regular.ttf"),
        "__GOLOS__": encode_asset("GolosText.ttf"),
        "__LOGO__": encode_asset("imenno-full-reverse-ivory.svg"),
        "__GIFTED_IMAGE__": encode_asset("imenno-situation-gifted-editorial.jpg"),
        "__UNKNOWN_IMAGE__": encode_asset("imenno-situation-colleague-editorial.jpg"),
        "__MODELS__": (SOURCE / "imenno-gifts.js").read_text(encoding="utf-8"),
        "__SCENE__": (SOURCE / "imenno-scene.js").read_text(encoding="utf-8"),
        "__QUIZ_DATA__": (SOURCE / "imenno-quiz-data.js").read_text(encoding="utf-8"),
        "__QUIZ_CONTROLLER__": (SOURCE / "imenno-quiz.js").read_text(encoding="utf-8"),
        "__TYPOGRAPHY__": (SOURCE / "imenno-typography.js").read_text(encoding="utf-8"),
    }
    for product in ("sleeve", "light", "stand", "drip", "voucher", "chocolate"):
        replacements[f"__DEMO_{product.upper()}__"] = encode_asset(f"imenno-demo-{product}.jpg")
    for placeholder, value in replacements.items():
        html = html.replace(placeholder, value)
    destination.write_bytes(html.encode("utf-8"))


if __name__ == "__main__":
    build(ROOT / "index.html")
