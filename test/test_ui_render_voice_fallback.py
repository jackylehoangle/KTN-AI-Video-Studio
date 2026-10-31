import json
import hashlib
import hmac
import shutil
import subprocess
from pathlib import Path

import pytest


NODE = shutil.which("node")
RENDER_API = Path(__file__).parents[1] / "ui_preview" / "api" / "render-video.js"
DOWNLOAD_API = Path(__file__).parents[1] / "ui_preview" / "api" / "render-video-download.js"
APP_JS = Path(__file__).parents[1] / "ui_preview" / "app.js"


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


@pytest.mark.skipif(NODE is None, reason="Node.js is required for the UI API contract test")
def test_render_returns_short_lived_signed_task_download_url():
    script = f"""
const fs = require('fs');
const vm = require('vm');
let source = fs.readFileSync({json.dumps(str(RENDER_API))}, 'utf8');
source = source.replace('export default async function handler', 'async function handler');
source += `\nresultPromise = signedVideoUrl(
  {{baseUrl:'https://worker.test',apiKey:'render-secret'}},
  '/tasks/task-123/final-1.mp4',
  1000
);`;
const context = {{process:{{env:{{}}}}, console, URL}};
vm.createContext(context);
vm.runInContext(source, context, {{importModuleDynamically: specifier => import(specifier)}});
context.resultPromise.then(result => process.stdout.write(result));
"""
    completed = subprocess.run(
        [NODE, "--experimental-vm-modules", "-e", script],
        check=True,
        capture_output=True,
        text=True,
    )
    expected = hmac.new(
        b"render-secret",
        b"/tasks/task-123/final-1.mp4\n4600",
        hashlib.sha256,
    ).hexdigest()

    assert completed.stdout == (
        "https://worker.test/tasks/task-123/final-1.mp4"
        f"?expires=4600&signature={expected}&download=1"
    )


@pytest.mark.skipif(NODE is None, reason="Node.js is required for the UI contract test")
def test_completed_render_triggers_a_local_mp4_download():
    script = f"""
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync({json.dumps(str(APP_JS))}, 'utf8');
const start = source.indexOf('function renderedVideoFilename');
const end = source.indexOf('async function pollRenderTask');
const helperSource = source.slice(start, end);
const calls = [];
const anchor = {{
  style: {{}},
  click() {{ calls.push('click'); }},
  remove() {{ calls.push('remove'); }}
}};
const documentRef = {{
  createElement(tag) {{ calls.push(tag); return anchor; }},
  body: {{appendChild() {{ calls.push('append'); }}}}
}};
const context = {{calls, anchor, documentRef}};
vm.createContext(context);
vm.runInContext(helperSource + `\ntriggerRenderedVideoDownload(
  'https://worker.test/tasks/task-123/final-1.mp4?signature=signed',
  'task-123',
  documentRef
); result = {{calls,href:anchor.href,download:anchor.download}};`, context);
process.stdout.write(JSON.stringify(context.result));
"""
    completed = subprocess.run(
        [NODE, "-e", script], check=True, capture_output=True, text=True
    )

    assert json.loads(completed.stdout) == {
        "calls": ["a", "append", "click", "remove"],
        "href": "https://worker.test/tasks/task-123/final-1.mp4?signature=signed",
        "download": "ktn-ai-video-task-123.mp4",
    }


@pytest.mark.skipif(NODE is None, reason="Node.js is required for the UI contract test")
def test_completed_render_downloads_same_origin_chunks_before_saving_blob():
    script = f"""
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync({json.dumps(str(APP_JS))}, 'utf8');
const start = source.indexOf('function renderedVideoFilename');
const end = source.indexOf('async function pollRenderTask');
const helperSource = source.slice(start, end);
const calls = [];
const responses = [
  {{status:206,ok:true,headers:{{get:(name)=>name==='x-ktn-video-size'?'5':null}},arrayBuffer:async()=>Uint8Array.from([1,2,3]).buffer}},
  {{status:206,ok:true,headers:{{get:(name)=>name==='x-ktn-video-size'?'5':null}},arrayBuffer:async()=>Uint8Array.from([4,5]).buffer}}
];
const anchor = {{style:{{}},click(){{calls.push('click');}},remove(){{calls.push('remove');}}}};
const documentRef = {{createElement(){{return anchor;}},body:{{appendChild(){{calls.push('append');}}}}}};
const fetchImpl = async url => {{calls.push(url); return responses.shift();}};
class BlobRef {{constructor(parts,options){{this.parts=parts;this.type=options.type;}}}}
const URLRef = {{createObjectURL(blob){{calls.push(['blob',blob.parts.map(x=>x.byteLength),blob.type]);return 'blob:test';}},revokeObjectURL(){{}}}};
const context = {{console,setTimeout:()=>0}};
vm.createContext(context);
vm.runInContext(helperSource + `\nresultPromise=downloadRenderedVideo(
  '/api/render-video-download?task_id=task-123','task-123',
  {{fetchImpl,documentRef,URLRef,BlobRef}}
);`, Object.assign(context,{{fetchImpl,documentRef,URLRef,BlobRef,calls}}));
context.resultPromise.then(result=>process.stdout.write(JSON.stringify({{result,calls,href:anchor.href}})));
"""
    completed = subprocess.run(
        [NODE, "-e", script], check=True, capture_output=True, text=True
    )

    assert json.loads(completed.stdout) == {
        "result": {"bytes": 5, "parts": 2},
        "calls": [
            "/api/render-video-download?task_id=task-123&offset=0",
            "/api/render-video-download?task_id=task-123&offset=3",
            ["blob", [3, 2], "video/mp4"],
            "append",
            "click",
            "remove",
        ],
        "href": "blob:test",
    }


def test_render_download_api_uses_bounded_authenticated_range_requests():
    source = DOWNLOAD_API.read_text(encoding="utf-8")

    assert "const CHUNK_BYTES=2*1024*1024" in source
    assert "'x-api-key':cfg.apiKey" in source
    assert "range:'bytes='+offset+'-'+end" in source
    assert "res.statusCode=206" in source
    assert "x-ktn-video-size" in source
