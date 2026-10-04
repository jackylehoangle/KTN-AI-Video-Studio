#!/usr/bin/env python3
"""Run identical KTN benchmark cases against an OpenAI-compatible model server."""
from __future__ import annotations

import argparse
import json
import os
import time
import urllib.request
from pathlib import Path

SYSTEM="""You are KTN Script Model under evaluation.
Follow the task contract exactly. Write natural Vietnamese when language=vi.
Obey Channel Profile DNA and forbidden rules. Do not fabricate facts.
Return only the requested output, with valid JSON when the request asks for JSON."""

def prompt_for(case:dict)->str:
    payload={
        "task":case["task"],
        "language":case["language"],
        "platform_mode":case["platform_mode"],
        "channel_profile":case["channel_profile"],
        "content_brief":case["content_brief"],
        "input":case["input"],
        "facts":case.get("facts",[]),
        "constraints":case.get("constraints",[])
    }
    return json.dumps(payload,ensure_ascii=False,indent=2)

def post_json(url:str,payload:dict,api_key:str)->dict:
    body=json.dumps(payload,ensure_ascii=False).encode("utf-8")
    headers={"content-type":"application/json","accept":"application/json"}
    if api_key: headers["authorization"]="Bearer "+api_key
    req=urllib.request.Request(url,data=body,headers=headers,method="POST")
    with urllib.request.urlopen(req,timeout=300) as res:
        return json.loads(res.read().decode("utf-8"))

def main()->int:
    p=argparse.ArgumentParser()
    p.add_argument("--cases",type=Path,default=Path(__file__).with_name("cases_v1.jsonl"))
    p.add_argument("--base-url",default=os.environ.get("KTN_MODEL_BASE_URL","http://127.0.0.1:8000"))
    p.add_argument("--model",required=True)
    p.add_argument("--api-key",default=os.environ.get("KTN_MODEL_API_KEY",""))
    p.add_argument("--out",type=Path,required=True)
    p.add_argument("--temperature",type=float,default=0.7)
    p.add_argument("--max-tokens",type=int,default=4096)
    args=p.parse_args()
    endpoint=args.base_url.rstrip("/")+"/v1/chat/completions"
    rows=[]
    for line in args.cases.read_text(encoding="utf-8").splitlines():
        if not line.strip(): continue
        case=json.loads(line)
        started=time.time()
        try:
            data=post_json(endpoint,{
                "model":args.model,
                "messages":[
                    {"role":"system","content":SYSTEM},
                    {"role":"user","content":prompt_for(case)}
                ],
                "temperature":args.temperature,
                "max_tokens":args.max_tokens
            },args.api_key)
            output=data.get("choices",[{}])[0].get("message",{}).get("content","")
            error=""
        except Exception as exc:
            output=""
            error=str(exc)
        rows.append({
            "case_id":case["id"],
            "task":case["task"],
            "model":args.model,
            "latency_seconds":round(time.time()-started,3),
            "output":output,
            "error":error
        })
        print(case["id"],"OK" if not error else "FAIL",rows[-1]["latency_seconds"])
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text("\n".join(json.dumps(row,ensure_ascii=False) for row in rows)+"\n",encoding="utf-8")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
