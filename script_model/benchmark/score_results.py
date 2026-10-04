#!/usr/bin/env python3
"""Create/validate human scorecards for KTN Script Model benchmark."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

DIMS=[
 ("contract_adherence",15),
 ("vietnamese_naturalness",15),
 ("channel_dna",15),
 ("retention",15),
 ("coherence",15),
 ("specificity",10),
 ("factual_discipline",10),
 ("editorial_control",5),
]

def main()->int:
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path,required=True)
    p.add_argument("--scorecard",type=Path,required=True)
    p.add_argument("--summarize",action="store_true")
    args=p.parse_args()
    results=[json.loads(x) for x in args.results.read_text(encoding="utf-8").splitlines() if x.strip()]
    if not args.summarize:
        args.scorecard.parent.mkdir(parents=True,exist_ok=True)
        with args.scorecard.open("w",encoding="utf-8-sig",newline="") as f:
            w=csv.writer(f)
            w.writerow(["case_id","task","model",*[d for d,_ in DIMS],"hard_fail","notes"])
            for r in results:
                w.writerow([r["case_id"],r["task"],r["model"],*([""]*len(DIMS)),"",""])
        print(args.scorecard)
        return 0
    rows=list(csv.DictReader(args.scorecard.open("r",encoding="utf-8-sig")))
    totals=[]
    for row in rows:
        if str(row.get("hard_fail","")).strip().lower() in {"1","true","yes","y"}:
            score=0
        else:
            score=sum(max(0,min(mx,float(row[d]))) for d,mx in DIMS)
        totals.append(score)
    summary={
        "rows":len(rows),
        "mean_score":round(sum(totals)/len(totals),2) if totals else 0,
        "min_score":min(totals) if totals else 0,
        "max_score":max(totals) if totals else 0
    }
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
