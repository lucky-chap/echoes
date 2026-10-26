#!/usr/bin/env python3
"""Evidence-first Qloo feasibility study for Belong.

Uses documented GET /search and /v2/insights parameters only.  It deliberately
does not turn Qloo affinity into a probability or a housing-suitability score.
"""
from __future__ import annotations
import argparse, json, os, random, shutil, sys, time, zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import requests
try:
    from dotenv import load_dotenv
except ImportError:
    # Keep the harness runnable in constrained environments.  requirements.txt
    # still declares python-dotenv for normal use.
    def load_dotenv(path):
        try:
            for line in Path(path).read_text().splitlines():
                if "=" in line and not line.lstrip().startswith("#"):
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        except FileNotFoundError:
            pass

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output"
PROD = "https://api.qloo.com"
PLACE = "urn:entity:place"
LOCALITY = "urn:entity:locality"
NEIGHBORHOODS = [
 ("Williamsburg, Brooklyn, New York, USA", "New York"), ("Greenwich Village, Manhattan, New York, USA", "New York"),
 ("Lower East Side, Manhattan, New York, USA", "New York"), ("Shoreditch, London, UK", "London"),
 ("Notting Hill, London, UK", "London"), ("Camden Town, London, UK", "London"),
 ("Shimokitazawa, Tokyo, Japan", "Tokyo"), ("Shibuya, Tokyo, Japan", "Tokyo"),
 ("Daikanyama, Tokyo, Japan", "Tokyo"), ("Osu, Accra, Ghana", "Accra"), ("East Legon, Accra, Ghana", "Accra")]
PERSONAS = {
 "reflective_creative": {"likes": [("Frank Ocean", "urn:entity:artist"), ("Radiohead", "urn:entity:artist"), ("Studio Ghibli", "urn:entity:brand")], "dislikes": ["loud clubs", "tourist traps", "overly commercial venues"]},
 "social_explorer": {"likes": [("Kendrick Lamar", "urn:entity:artist"), ("Travis Scott", "urn:entity:artist"), ("streetwear", "urn:entity:tag")], "dislikes": ["quiet isolated places", "formal conservative environments"]},
 "curious_minimalist": {"likes": [("Bon Iver", "urn:entity:artist"), ("Japanese design", "urn:entity:tag"), ("independent cinema", "urn:entity:tag")], "dislikes": ["chaotic nightlife", "large crowds", "generic chain establishments"]}}

def now(): return datetime.now(timezone.utc).isoformat()
def safe(v: Any) -> Any:
    if isinstance(v, dict): return {k: safe(x) for k,x in v.items() if k.lower() not in {"x-api-key","authorization","api_key","apikey"}}
    if isinstance(v, list): return [safe(x) for x in v]
    return v
def entities(payload):
    r = payload.get("results", {}) if isinstance(payload, dict) else {}
    return r if isinstance(r, list) else r.get("entities", []) if isinstance(r, dict) else []
def dig(row, *keys):
    v=row
    for k in keys:
        if not isinstance(v, dict): return None
        v=v.get(k)
    return v
def venue(row):
    p=row.get("properties", {}) if isinstance(row,dict) else {}
    geo=p.get("geocode", {}) if isinstance(p,dict) else {}
    return {"id": row.get("entity_id"), "name": row.get("name"), "affinity": dig(row,"query","affinity"),
      "categories": p.get("categories") or p.get("category") or row.get("types"), "address": p.get("address"),
      "coordinates": geo.get("coordinates") or p.get("coordinates"), "geocode": geo,
      "explainability": dig(row,"query","explainability")}

@dataclass
class Harness:
    key: str; base: str; cap: int; raw: list = field(default_factory=list); calls: list = field(default_factory=list)
    def request(self, path: str, params: dict[str,str], label: str) -> dict:
        if len(self.calls) >= self.cap: raise RuntimeError(f"request cap reached ({self.cap})")
        url=self.base.rstrip("/")+path; started=time.monotonic(); status=None; body: Any={}
        for attempt in range(3):
            try:
                response=requests.get(url, params=params, headers={"Accept":"application/json","X-Api-Key":self.key}, timeout=15)
                status=response.status_code
                try: body=response.json()
                except ValueError: body={"non_json_body":response.text[:1000]}
                if response.status_code == 429 and attempt < 2:
                    time.sleep(min(10, float(response.headers.get("retry-after","1")))); continue
                if response.status_code >= 500 and attempt < 2: time.sleep(2**attempt); continue
                break
            except requests.RequestException as e:
                body={"request_error":str(e)}
                if attempt == 2: break
                time.sleep(2**attempt)
        record={"label":label,"path":path,"params":params,"status":status,"elapsed_ms":round((time.monotonic()-started)*1000,1),"at":now()}
        self.calls.append(record); self.raw.append({**record,"body":safe(body)})
        return {"status":status,"body":body,"record":record}
    def search(self, query, entity_type, label):
        return self.request("/search", {"query":query,"types":entity_type,"take":"5"}, label)
    def insight(self, locality, ids, label, radius=None, take=10, explain=True):
        if not ids: raise ValueError("No verified taste-signal entity IDs; Insights request intentionally skipped.")
        p={"filter.type":PLACE,"filter.location.query":locality,"signal.interests.entities":",".join(ids),"feature.explainability":str(explain).lower(),"take":str(take)}
        if radius is not None: p["filter.location.radius"]=str(radius)
        return self.request("/v2/insights",p,label)

def resolve_personas(h: Harness, results):
    resolved={}
    for name, persona in PERSONAS.items():
        good=[]; unsupported=[]
        for query, typ in persona["likes"]:
            if typ == "urn:entity:tag": unsupported.append({"preference":query,"reason":"free-text/tag resolution is not assumed; no documented entity type was selected"}); continue
            r=h.search(query,typ,f"resolve:{name}:{query}"); rows=entities(r["body"])
            match=next((x for x in rows if x.get("entity_id")),None)
            if match: good.append({"preference":query,"entity_id":match["entity_id"],"name":match.get("name"),"type":match.get("type") or typ})
            else: unsupported.append({"preference":query,"reason":f"HTTP {r['status']}; no resolvable entity"})
        resolved[name]={"signals":good,"unsupported":unsupported,"dislikes":persona["dislikes"],"negative_preference_note":"No negative affinity is sent. Dislikes require documented tag/location/entity exclusions or application-side filtering after inspection."}
    results["persona_resolution"]=resolved; return resolved

def run(args):
    load_dotenv(ROOT/".env"); load_dotenv(ROOT.parent/".env.local")
    key=os.getenv("QLOO_API_KEY", ""); base=os.getenv("QLOO_BASE_URL",PROD).rstrip("/")
    OUT.mkdir(exist_ok=True)
    results={"metadata":{"started_at":now(),"mode":"full" if args.full else "smoke","base_url":base,"request_cap":args.max_requests,"seed":0,"documentation":{"deep_dive":"https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md","openapi":"https://github.com/qloo/docs-public/blob/main/openapi-schema.json"}},"calls":[],"errors":[]}
    if not key:
        results["errors"].append("BLOCKED: QLOO_API_KEY is absent. No API requests or synthetic results were generated.")
        write_outputs(results, [], blocked=True); return 2
    h=Harness(key,base,args.max_requests); random.seed(0)
    try:
        # Smoke resolves one known artist and checks strict locality + one place insight.
        persona=resolve_personas(h,results)
        locations=NEIGHBORHOODS if args.full else NEIGHBORHOODS[:1]
        coverage=[]
        for locality, city in locations:
            ids=[x["entity_id"] for x in persona["reflective_creative"]["signals"]]
            if not ids:
                coverage.append({"requested":locality,"city":city,"strict_status":None,"matched_locality":None,"venue_count":0,"venues":[],"missing_coordinates":0,"ambiguity":"Skipped: no verified Reflective Creative signals."}); continue
            strict=h.insight(locality,ids,f"coverage:strict:{locality}",radius=0,take=10)
            rows=entities(strict["body"]); locality_signal=dig(strict["body"],"query","locality","signal")
            item={"requested":locality,"city":city,"strict_status":strict["status"],"matched_locality":locality_signal,"venue_count":len(rows),"venues":[venue(x) for x in rows],"missing_coordinates":sum(1 for x in rows if not venue(x)["coordinates"]),"ambiguity":None if locality_signal else "No query.locality.signal returned; cannot verify neighborhood resolution."}
            if args.full and (not rows or locality in ["Williamsburg, Brooklyn, New York, USA","Osu, Accra, Ghana"]):
                expanded=h.insight(locality,ids,f"coverage:expanded:{locality}",radius=1000,take=10); item["expanded"]={"status":expanded["status"],"venue_count":len(entities(expanded["body"])),"matched_locality":dig(expanded["body"],"query","locality","signal")}
            coverage.append(item)
        results["coverage"]=coverage
        # Equivalent persona calls make ranking/overlap observable, without claiming score comparability across calls.
        chosen=NEIGHBORHOODS if args.full else NEIGHBORHOODS[:1]; personalized={}
        for locality,_ in chosen:
            personalized[locality]={}
            for name,p in persona.items():
                ids=[x["entity_id"] for x in p["signals"]]
                if not ids:
                    personalized[locality][name]={"status":None,"top10":[],"skipped":"No verified taste signals."}; continue
                r=h.insight(locality,ids,f"persona:{name}:{locality}",radius=0,take=10)
                personalized[locality][name]={"status":r["status"],"top10":[venue(x) for x in entities(r["body"])]}
        results["personalization"]=personalized
        overlaps={}
        for locality, sets in personalized.items():
            names=sorted(sets)
            overlaps[locality]={}
            for i,a in enumerate(names):
                for b in names[i+1:]:
                    aa={x.get("id") for x in sets[a]["top10"] if x.get("id")}; bb={x.get("id") for x in sets[b]["top10"] if x.get("id")}
                    overlaps[locality][f"{a}__{b}"]={"shared_top10":len(aa&bb),"jaccard":round(len(aa&bb)/len(aa|bb),3) if aa|bb else None}
        results["persona_overlap_metrics"]=overlaps
        results["method_notes"]={"comparison":"Independent query affinity values are retained as API output but are not treated as a globally comparable neighborhood-fit score. Pairwise overlap and per-query descriptive summaries are exploratory only.","negative_preferences":"The harness does not invent negative affinity. It records only documented exclusion mechanisms if returned metadata permits an application-side rule.","itinerary":"Only returned place metadata may support a three-stop itinerary; hours/walkability are unknown unless returned."}
        # Robustness: malformed locality, unknown entity, and repeated query.
        ids=[x["entity_id"] for x in persona["reflective_creative"]["signals"]]
        if ids:
            results["robustness"]={"invalid_location":h.insight("Definitely Not A Real Neighborhood 999",ids,"robustness:invalid",radius=0)["record"],"unknown_entity":h.insight(chosen[0][0],["urn:entity:artist:does-not-exist"],"robustness:unknown",radius=0)["record"]}
            first=h.insight(chosen[0][0],ids,"robustness:repeat-1",radius=0); second=h.insight(chosen[0][0],ids,"robustness:repeat-2",radius=0)
            results["robustness"]["repeat"]={"first":first["record"],"second":second["record"],"same_top_ids":[x.get("entity_id") for x in entities(first["body"])][:10]==[x.get("entity_id") for x in entities(second["body"])][:10]}
    except Exception as e: results["errors"].append(f"Harness stopped safely: {type(e).__name__}: {e}")
    results["calls"]=h.calls; results["metadata"]["finished_at"]=now(); write_outputs(results,h.raw,blocked=False); return 0

def write_outputs(results, raw, blocked):
    (OUT/"belong_results.json").write_text(json.dumps(safe(results),indent=2,ensure_ascii=False))
    (OUT/"belong_raw_responses.json").write_text(json.dumps(safe(raw),indent=2,ensure_ascii=False))
    coverage=results.get("coverage",[]); resolved=results.get("persona_resolution",{})
    failed=[x for x in results.get("calls",[]) if x.get("status") is None]
    lines=["# Belong — Qloo feasibility report","",f"Generated: {now()}","", "## Executive summary", "" ]
    if blocked or failed: lines += ["**NO LIVE VERDICT — BLOCKED.** Authentication/network access did not yield usable Qloo responses; this package contains no fabricated API evidence.",""]
    else: lines += ["This report separates observed response data in the JSON artifacts from product assumptions. Qloo affinity is not represented as a satisfaction probability or a universally comparable neighborhood score.",""]
    lines += ["## Connectivity and entity resolution","",f"Calls recorded: {len(results.get('calls',[]))}. Transport/no-response calls: {len(failed)}. Harness errors: {len(results.get('errors',[]))}.",""]
    for name,p in resolved.items(): lines.append(f"- {name}: {len(p['signals'])} named signals resolved; {len(p['unsupported'])} unsupported/ambiguous preferences.")
    lines += ["", "## Neighborhood coverage", "", "| Requested locality | Strict HTTP | Venues | Coordinates missing | Resolution caveat |", "|---|---:|---:|---:|---|"]
    for x in coverage: lines.append(f"| {x['requested']} | {x['strict_status']} | {x['venue_count']} | {x['missing_coordinates']} | {x['ambiguity'] or 'matched signal recorded'} |")
    lines += ["", "## Limits and decision", "", "- `filter.location.query` is fuzzy; strict `filter.location.radius=0` is used before any expanded boundary. No city-wide substitution is made.", "- Explainability and raw affinity are preserved in `belong_results.json` when returned; absent fields remain absent.", "- Negative preference is not modeled as negative affinity. Any future filtering must be documented and transparent.", "- A responsible neighborhood comparison needs shared candidates/descriptive evidence; this harness does not claim Qloo provides a global location-fit score.", "", "## Recommendation", "", "**CONDITIONAL GO** only if the live coverage, persona differentiation, and explainability records in this run are adequate for the target neighborhoods. If blocked or thin/ambiguous, treat this as **NO-GO for neighborhood ranking** and test a city-level discovery MVP instead."]
    (OUT/"belong_report.md").write_text("\n".join(lines)+"\n")
    (OUT/"belong_verdict.md").write_text("# Belong verdict\n\n" + ("**BLOCKED — no usable live Qloo response was collected.** Do not make a product decision from this run.\n" if blocked or failed else "**CONDITIONAL GO.** Review the accompanying raw evidence before committing. Build venue discovery and explanation first; cut universal neighborhood-fit scoring, housing suitability claims, and unsupported negative-affinity features.\n"))
    zip_path=ROOT/"belong-feasibility-results.zip"
    with zipfile.ZipFile(zip_path,"w",zipfile.ZIP_DEFLATED) as z:
        for p in [ROOT/"run_tests.py",ROOT/"README.md",ROOT/"requirements.txt",OUT/"belong_report.md",OUT/"belong_results.json",OUT/"belong_raw_responses.json",OUT/"belong_verdict.md"]:
            if p.exists(): z.write(p,p.relative_to(ROOT))
    print("Generated:", *(str(p) for p in [OUT/"belong_report.md",OUT/"belong_results.json",OUT/"belong_raw_responses.json",OUT/"belong_verdict.md",zip_path]),sep="\n")
if __name__ == "__main__":
    ap=argparse.ArgumentParser(); g=ap.add_mutually_exclusive_group(); g.add_argument("--smoke",action="store_true"); g.add_argument("--full",action="store_true"); ap.add_argument("--max-requests",type=int,default=120); a=ap.parse_args(); sys.exit(run(a))
