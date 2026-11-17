#!/usr/bin/env bash
# Backup semanal do D1: exporta o banco remoto e mantém as 4 cópias mais recentes.
# Uso: npm run backup        (agende 1x por semana: cron, launchd ou lembrete)
# Variáveis opcionais: PASTA_BACKUP (padrão: backups), COPIAS (padrão: 4),
#   WRANGLER (padrão: "npx wrangler"), DATA_BACKUP (padrão: hoje; usado nos testes).
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
PASTA="${PASTA_BACKUP:-$RAIZ/backups}"
COPIAS="${COPIAS:-4}"
WRANGLER="${WRANGLER:-npx wrangler}"
DATA="${DATA_BACKUP:-$(date +%F)}"
BANCO="${NOME_BANCO:-jose}"

mkdir -p "$PASTA"
ARQUIVO="$PASTA/jose-$DATA.sql"

# --config aponta o wrangler.toml com o banco remoto
$WRANGLER d1 export "$BANCO" --remote --config "$RAIZ/servidor/wrangler.toml" --output "$ARQUIVO"

if [ ! -s "$ARQUIVO" ]; then
  echo "Backup vazio ou não gerado: $ARQUIVO" >&2
  rm -f "$ARQUIVO"
  exit 1
fi
echo "Backup gerado: $ARQUIVO"

# Mantém só as N cópias mais recentes (os nomes têm a data, então a ordem alfabética é a cronológica).
ls -1 "$PASTA"/jose-*.sql | sort | head -n -"$COPIAS" | while read -r antigo; do
  rm -f "$antigo"
  echo "Removida cópia antiga: $antigo"
done
