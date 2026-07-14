"""
Genera el Refresh Token para la API de Google Ads y lo guarda en agent/.env

Se corre UNA sola vez. Requiere client_secret.json (credencial OAuth tipo
"App de escritorio") en esta misma carpeta.

Abre el navegador para que autorices; luego escribe CLIENT_ID, CLIENT_SECRET y
REFRESH_TOKEN dentro de .env (no los imprime en pantalla, por seguridad).
"""

import json
import os
import sys

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/adwords"]
HERE = os.path.dirname(os.path.abspath(__file__))
CLIENT_SECRET_FILE = os.path.join(HERE, "client_secret.json")
ENV_FILE = os.path.join(HERE, ".env")


def upsert_env(path, updates):
    """Actualiza o agrega claves en un archivo .env sin duplicar."""
    lines = []
    if os.path.exists(path):
        with open(path) as f:
            lines = f.read().splitlines()

    keys = set(updates)
    out = []
    seen = set()
    for line in lines:
        key = line.split("=", 1)[0].strip() if "=" in line else None
        if key in keys:
            out.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, val in updates.items():
        if key not in seen:
            out.append(f"{key}={val}")

    with open(path, "w") as f:
        f.write("\n".join(out) + "\n")


def main():
    if not os.path.exists(CLIENT_SECRET_FILE):
        print("ERROR: falta client_secret.json en", HERE)
        sys.exit(1)

    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
    print("Abriendo el navegador para autorizar… inicia sesión y pulsa Permitir.")
    creds = flow.run_local_server(port=0, access_type="offline", prompt="consent")

    with open(CLIENT_SECRET_FILE) as f:
        info = (json.load(f).get("installed") or {})

    if not creds.refresh_token:
        print("ERROR: Google no devolvió refresh_token. Reintenta (revisa que la app esté publicada).")
        sys.exit(1)

    upsert_env(ENV_FILE, {
        "GOOGLE_ADS_CLIENT_ID": info.get("client_id", ""),
        "GOOGLE_ADS_CLIENT_SECRET": info.get("client_secret", ""),
        "GOOGLE_ADS_REFRESH_TOKEN": creds.refresh_token,
    })

    print("\n✓ Listo. CLIENT_ID, CLIENT_SECRET y REFRESH_TOKEN guardados en agent/.env")
    print("  (no se imprimen aquí por seguridad)")


if __name__ == "__main__":
    main()
