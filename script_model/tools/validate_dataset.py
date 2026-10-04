#!/usr/bin/env python3
"""Validate KTN Script Model JSONL datasets using only Python stdlib."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

TASKS={"angle","outline","hook","section","rewrite","qa"}
PLATFORMS={"youtube_long","youtube_short","facebook_short"}
QUALITY={"GOLD","SILVER","REJECT"}
REQUIRED={"id","task","language","platform_mode","channel_profile","content_brief","input","target","quality"}
CHANNEL_REQUIRED={"name","niche","audience","tone","narrator","storytelling"}
BRIEF_REQUIRED={"topic","goal","target_duration"}

def validate_record(row:dict,line_no:int,seen:set[str])->list[str]:
    errors=[]
    missing=REQUIRED-set(row)
    if missing: errors.append(f"line {line_no}: missing {sorted(missing)}")
    rid=str(row.get("id","")).strip()
    if not rid: errors.append(f"line {line_no}: empty id")
    elif rid in seen: errors.append(f"line {line_no}: duplicate id {rid}")
    else: seen.add(rid)
    if row.get("task") not in TASKS: errors.append(f"line {line_no}: invalid task")
    if row.get("language") not in {"vi","en"}: errors.append(f"line {line_no}: invalid language")
    if row.get("platform_mode") not in PLATFORMS: errors.append(f"line {line_no}: invalid platform_mode")
    channel=row.get("channel_profile")
    if not isinstance(channel,dict): errors.append(f"line {line_no}: channel_profile must be object")
    else:
        m=CHANNEL_REQUIRED-set(channel)
        if m: errors.append(f"line {line_no}: channel_profile missing {sorted(m)}")
    brief=row.get("content_brief")
    if not isinstance(brief,dict): errors.append(f"line {line_no}: content_brief must be object")
    else:
        m=BRIEF_REQUIRED-set(brief)
        if m: errors.append(f"line {line_no}: content_brief missing {sorted(m)}")
    quality=row.get("quality")
    if not isinstance(quality,dict): errors.append(f"line {line_no}: quality must be object")
    else:
        if quality.get("label") not in QUALITY: errors.append(f"line {line_no}: invalid quality label")
        if not isinstance(quality.get("reviewed"),bool): errors.append(f"line {line_no}: quality.reviewed must be boolean")
    return errors

def main()->int:
    parser=argparse.ArgumentParser()
    parser.add_argument("path",type=Path)
    parser.add_argument("--training-ready",action="store_true",help="Fail unless every retained row is reviewed GOLD/SILVER.")
    args=parser.parse_args()
    errors=[]
    seen=set()
    count=0
    labels={k:0 for k in QUALITY}
    tasks={k:0 for k in TASKS}
    with args.path.open("r",encoding="utf-8") as handle:
        for line_no,line in enumerate(handle,1):
            if not line.strip(): continue
            count+=1
            try: row=json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append(f"line {line_no}: invalid JSON: {exc}")
                continue
            errors.extend(validate_record(row,line_no,seen))
            q=row.get("quality") if isinstance(row,dict) else {}
            label=q.get("label") if isinstance(q,dict) else None
            if label in labels: labels[label]+=1
            task=row.get("task") if isinstance(row,dict) else None
            if task in tasks: tasks[task]+=1
            if args.training_ready and (label=="REJECT" or not q.get("reviewed",False)):
                errors.append(f"line {line_no}: not training-ready")
    print(json.dumps({"records":count,"labels":labels,"tasks":tasks,"errors":errors},ensure_ascii=False,indent=2))
    return 1 if errors else 0

if __name__=="__main__":
    raise SystemExit(main())
