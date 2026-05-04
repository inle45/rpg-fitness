#!/usr/bin/env bash
# Lance un serveur statique sur le dossier preview/.
# Le serveur sera accessible depuis ton téléphone Android sur le même
# réseau Wi-Fi à l'adresse http://<ip-machine>:8080/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8080}"
cd "$ROOT/preview"
echo "PixelQuest – preview en ligne sur http://0.0.0.0:$PORT/"
exec python3 -m http.server "$PORT" --bind 0.0.0.0
