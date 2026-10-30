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


@pytest.mark.skipif(NODE is None, reason="Node.js is required for the UI API contract test")
def test_render_stages_gemini_voiceover_on_worker_without_exposing_audio_to_browser():
    script = f"""
const fs = require('fs');
const vm = require('vm');
let source = fs.readFileSync({json.dumps(str(RENDER_API))}, 'utf8');
source = source.replace('export default async function handler', 'async function handler');
source += `\nresultPromise = stageGeminiVoiceover(
  {{baseUrl:'https://worker.test',apiKey:'worker-secret'}},
  {{script:'Xin chào Việt Nam.',voice:'Kore',languageCode:'vi-VN',stylePreset:'documentary'}}
);`;

const calls = [];
const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(80)]).toString('base64');
class FakeFormData {{ append(...args) {{ this.args = args; }} }}
class FakeBlob {{ constructor(parts, options) {{ this.parts = parts; this.type = options.type; }} }}
const fetch = async (url, options) => {{
  calls.push({{url, method:options.method, headers:options.headers}});
  if(url.includes('generativelanguage.googleapis.com')) {{
    return {{ok:true,status:200,json:async()=>({{steps:[{{type:'model_output',content:[{{type:'audio',data:wav,mime_type:'audio/wav'}}]}}]}})}};
  }}
  return {{ok:true,status:200,json:async()=>({{status:200,data:{{file:'voiceover-key.wav'}}}})}};
}};
const context = {{
  process:{{env:{{GEMINI_API_KEY:'gemini-secret'}}}}, console, Buffer,
  FormData:FakeFormData, Blob:FakeBlob, fetch
}};
vm.createContext(context);
vm.runInContext(source, context);
context.resultPromise.then(result => {{
  process.stdout.write(JSON.stringify({{result,calls}}));
}}).catch(error => {{ console.error(error); process.exitCode=1; }});
"""
    completed = subprocess.run(
        [NODE, "-e", script],
        check=True,
        capture_output=True,
        text=True,
    )
    output = json.loads(completed.stdout)

    assert output["result"] == {
        "file": "voiceover-key.wav",
        "model": "gemini-3.8-flash-lite-tts",
        "voice": "Kore",
        "bytes": 84,
    }
    assert [call["url"] for call in output["calls"]] == [
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        "https://worker.test/api/v1/musics",
    ]
    assert output["calls"][1]["headers"] == {"x-api-key": "worker-secret"}
