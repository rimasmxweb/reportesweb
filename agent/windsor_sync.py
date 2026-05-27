"""
Rimas MX — Windsor AI Sync Agent
Corre diariamente en la VPS. Jala datos de Windsor AI y los escribe en Supabase.
"""

import os
import re
import json
import unicodedata
import requests
from difflib import SequenceMatcher
from datetime import datetime, timedelta, date
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

WINDSOR_API_KEY   = os.environ["WINDSOR_API_KEY"]
SUPABASE_URL      = os.environ["SUPABASE_URL"]
SUPABASE_KEY      = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

WINDSOR_URL = "https://connectors.windsor.ai/all"

WINDSOR_FIELDS = ",".join([
    "date", "datasource", "account_name", "source", "campaign",
    "clicks", "spend", "impressions", "ctr", "cpm", "frequency", "reach",
    "video_trueview_views",
    "ix_video_views_p100", "ix_video_views_p25", "ix_video_views_p50", "ix_video_views_p75",
    "conversions", "conversions_subscribe_total", "follows",
    "results", "cost_per_result",
])

WINDSOR_ACCOUNTS = ",".join([
    "facebook__1023321915429074",
    "facebook__1583654395714024",
    "facebook__826629156008986",
    "google_ads__297-958-2703",
    "google_ads__348-142-3478",
    "tiktok__7465472041941106695",
])

PLATFORM_MAP = {
    "google":   "google_youtube",
    "facebook": "meta",
    "tiktok":   "tiktok",
}

# Detecta el tipo de campaña de YouTube por palabras clave en el nombre
def detect_youtube_type(name: str) -> str:
    n = name.upper()
    if any(k in n for k in ["FOLLOW", "FOLLOWON", "FOLLOW ON", "FOLLOW-ON"]):
        return "follow_on_views"
    if any(k in n for k in ["SUSCRIPTOR", "SUBSCRIBER", "SUB "]):
        return "subscribers"
    if "THRUVIEW" in n or "THRU VIEW" in n:
        return "thruview"
    return "follow_on_views"


def _norm(text):
    nfkd = unicodedata.normalize('NFKD', text)
    ascii_str = nfkd.encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9\s]', ' ', ascii_str.lower()).strip()

def _tokens(text):
    return [t for t in _norm(text).split() if len(t) > 2]

def _tok_matches(p_tok, name_toks):
    for nt in name_toks:
        if nt.startswith(p_tok) or p_tok.startswith(nt):
            return True
        if len(p_tok) > 3 and SequenceMatcher(None, p_tok, nt).ratio() >= 0.82:
            return True
    return False


def match_artist(campaign_name, artists):
    if not campaign_name:
        return None

    sorted_artists = sorted(
        artists,
        key=lambda a: len(a.get("windsor_name_pattern") or ""),
        reverse=True,
    )

    name_upper = campaign_name.upper()
    name_norm  = _norm(campaign_name)
    name_toks  = _tokens(campaign_name)

    # Pass 1: exact substring (original behaviour)
    for a in sorted_artists:
        pat = (a.get("windsor_name_pattern") or "").upper()
        if pat and pat in name_upper:
            return a

    # Pass 2: accent-stripped substring (handles ñ, é, etc.)
    for a in sorted_artists:
        pat = a.get("windsor_name_pattern") or ""
        if not pat:
            continue
        pat_norm = _norm(pat)
        if pat_norm and pat_norm in name_norm:
            return a

    # Pass 3: all significant tokens match via prefix or fuzzy
    # e.g. "Jordan 23" matches pattern "EL JORDAN 23"
    # e.g. "Viviann Baeza" matches pattern "VIVIAN BAEZA"
    for a in sorted_artists:
        p_toks = _tokens(a.get("windsor_name_pattern") or "")
        if p_toks and all(_tok_matches(pt, name_toks) for pt in p_toks):
            return a

    return None


def get_campaign_name(record):
    # Windsor devuelve el campo como 'campaign' (no 'campaign_name')
    return record.get("campaign") or record.get("campaign_name")


def fetch_windsor(date_from: str, date_to: str) -> list[dict]:
    resp = requests.get(WINDSOR_URL, params={
        "api_key":         WINDSOR_API_KEY,
        "date_from":       date_from,
        "date_to":         date_to,
        "fields":          WINDSOR_FIELDS,
        "select_accounts": WINDSOR_ACCOUNTS,
    }, timeout=120)
    resp.raise_for_status()
    return resp.json().get("data", [])


def upsert_campaign(sb, record: dict, artist_id: str) -> str:
    platform     = PLATFORM_MAP.get(record["source"], record["source"])
    campaign_id   = str(record.get("campaign_id", record.get("datasource","") + "_" + str(hash(get_campaign_name(record) or ""))[:8]))
    campaign_name = get_campaign_name(record) or f"Campaña {campaign_id}"
    youtube_type  = detect_youtube_type(campaign_name) if platform == "google_youtube" else None

    row = {
        "artist_id":           artist_id,
        "windsor_campaign_id": campaign_id,
        "name":                campaign_name,
        "platform":            platform,
        "youtube_type":        youtube_type,
        "status":              "active",
        "updated_at":          datetime.utcnow().isoformat(),
    }

    result = sb.table("campaigns").upsert(
        row,
        on_conflict="windsor_campaign_id,platform"
    ).execute()

    return result.data[0]["id"]


def build_metrics_row(record: dict, campaign_id: str) -> dict:
    platform = PLATFORM_MAP.get(record.get("source", ""), record.get("source", ""))

    def v(key):
        val = record.get(key)
        return float(val) if val not in (None, "") else None

    # CTR: Windsor devuelve 0.0069 = 0.69% → guardamos como porcentaje
    ctr_raw = v("ctr")
    ctr = round(ctr_raw * 100, 4) if ctr_raw is not None else None

    # Retención = video visto al 100%
    retention_raw = v("ix_video_views_p100")
    video_retention = round(retention_raw * 100, 2) if retention_raw is not None else None

    campaign_name_val = get_campaign_name(record) or ""

    row = {
        "campaign_id":  campaign_id,
        "date":         record["date"],
        "impressions":  int(v("impressions") or 0),
        "total_spend":  v("spend"),
        "ctr":          ctr,
        "cpm":          v("cpm"),
        "frequency":    v("frequency"),
        "raw_data":     json.dumps(record),
    }

    if platform == "google_youtube":
        thruviews = int(v("video_trueview_views") or 0)
        subs = int(v("conversions_subscribe_total") or 0)
        follows = int(v("follows") or 0)
        is_subs = any(k in campaign_name_val.upper() for k in ["SUSCRI", "SUBSCRI", "SUB "])
        is_follow = any(k in campaign_name_val.upper() for k in ["FOLLOW", "FOLLOWON"])
        row.update({
            "thruviews":                  thruviews,
            "public_views":               thruviews,
            "subscriber_conversions":     subs if is_subs else 0,
            "follow_on_view_conversions": follows if is_follow else 0,
            "video_retention":            video_retention,
            "view_rate":                  round(v("ix_video_views_p25") * 100, 2) if v("ix_video_views_p25") else None,
            "cost_per_view":              round(v("spend") / v("clicks"), 4) if v("spend") and v("clicks") else None,
            "cost_per_conversion":        v("cost_per_result"),
        })
    else:
        reach_val = v("reach")
        row.update({
            "reach":           int(reach_val) if reach_val is not None else 0,
            "thruplay":        int(v("results") or 0),
            "result_count":    int(v("results") or 0),
            "cost_per_result": v("cost_per_result"),
        })

    return row


def log_action(sb, action: str, status: str, details: dict):
    sb.table("agent_logs").insert({
        "action":  action,
        "status":  status,
        "details": json.dumps(details),
    }).execute()


def sync(days_back: int = 7):
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    date_to   = date.today().isoformat()
    date_from = (date.today() - timedelta(days=days_back)).isoformat()

    print(f"[{datetime.now():%H:%M:%S}] Sincronizando {date_from} → {date_to}")

    # Cargar artistas con sus patrones
    artists = sb.table("artists").select("id,name,slug,windsor_name_pattern").eq("active", True).execute().data
    print(f"  Artistas activos: {len(artists)}")

    # Jalar datos de Windsor
    records = fetch_windsor(date_from, date_to)
    print(f"  Registros de Windsor: {len(records)}")

    synced = 0
    unmatched_campaigns = set()

    for record in records:
        campaign_name = get_campaign_name(record)
        source        = record.get("source")

        if not source or not record.get("date"):
            continue

        artist = match_artist(campaign_name, artists)

        if not artist:
            if campaign_name:
                unmatched_campaigns.add(campaign_name)
            continue

        try:
            campaign_id = upsert_campaign(sb, record, artist["id"])
            metrics_row = build_metrics_row(record, campaign_id)
            sb.table("campaign_metrics").upsert(
                metrics_row,
                on_conflict="campaign_id,date"
            ).execute()
            synced += 1
        except Exception as e:
            print(f"  ERROR en {campaign_name}: {e}")
            log_action(sb, "sync_record", "error", {"campaign": campaign_name, "error": str(e)})

    print(f"  ✓ Sincronizados: {synced} registros")

    if unmatched_campaigns:
        print(f"  ⚠ Sin artista asignado ({len(unmatched_campaigns)}):")
        for c in sorted(unmatched_campaigns):
            print(f"    - {c}")

    log_action(sb, "sync_meta", "success", {
        "date_from":   date_from,
        "date_to":     date_to,
        "total":       len(records),
        "synced":      synced,
        "unmatched":   list(unmatched_campaigns),
    })

    return synced


if __name__ == "__main__":
    import sys
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 365
    sync(days_back=days)
