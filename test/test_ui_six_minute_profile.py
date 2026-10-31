from pathlib import Path


ROOT = Path(__file__).parents[1]


def test_six_minute_profile_is_available_across_ui_and_script_api():
    app = (ROOT / "ui_preview" / "app.js").read_text(encoding="utf-8")
    html = (ROOT / "ui_preview" / "index.html").read_text(encoding="utf-8")
    api = (ROOT / "ui_preview" / "api" / "generate-script.js").read_text(
        encoding="utf-8"
    )

    assert "['5-7m','5–7 phút · khoảng 6 phút']" in app
    assert '<option value="5-7m">5–7 phút · khoảng 6 phút</option>' in html
    assert (
        "'5-7m': {label:'5–7 phút · khoảng 6 phút', words:'750–1.050 từ'}"
        in api
    )
