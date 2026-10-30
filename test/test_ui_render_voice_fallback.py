import json
import shutil
import subprocess
from pathlib import Path

import pytest


NODE = shutil.which("node")
RENDER_API = Path(__file__).parents[1] / "ui_preview" / "api" / "render-video.js"


@pytest.mark.skipif(NODE is None, reason="Node.js is required for the UI API contract test")
def test_render_voice_falls_back_to_edge_unless_external_tts_is_enabled():
    script = f"""
const fs = require('fs');
const vm = require('vm');
let source = fs.readFileSync({json.dumps(str(RENDER_API))}, 'utf8');
source = source.replace('export default async function handler', 'async function handler');
source += `\nresult = [
  mptVoiceName({{provider:'gemini',voice:'Kore'}}, {{}}),
  mptVoiceName({{provider:'elevenlabs',voice:'voice-123'}}, {{}}),
  mptVoiceName({{provider:'gemini',voice:'Kore'}}, {{MPT_RENDER_GEMINI_TTS_ENABLED:'true'}}),
  mptVoiceName({{provider:'elevenlabs',voice:'voice-123'}}, {{MPT_RENDER_ELEVENLABS_TTS_ENABLED:'1'}}),
  mptVoiceName({{provider:'gemini',voice:'Kore'}}, {{MPT_RENDER_EDGE_VOICE:'vi-VN-NamMinhNeural'}})
];`;
const context = {{process:{{env:{{}}}}, console}};
vm.createContext(context);
vm.runInContext(source, context);
process.stdout.write(JSON.stringify(context.result));
"""
    completed = subprocess.run(
        [NODE, "-e", script],
        check=True,
        capture_output=True,
        text=True,
    )

    assert json.loads(completed.stdout) == [
        "vi-VN-HoaiMyNeural",
        "vi-VN-HoaiMyNeural",
        "gemini:Kore",
        "elevenlabs:voice-123:KTN",
        "vi-VN-NamMinhNeural",
    ]
