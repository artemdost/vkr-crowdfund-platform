#!/bin/bash
# Watch-режим: при сохранении .bpmn в ../../BPMN/:
#   1. Обновляет .json в tools/sources/ (подхват ручных правок layout)
#   2. Прогоняет валидацию (структура + layout audit)
#   3. Рендерит .png в diagrams/bpmn_renders/
#
# Запустить из tools/: ./watch_bpmn.sh

TOOLS_DIR="$(cd "$(dirname "$0")" && pwd)"
BPMN_DIR="$TOOLS_DIR/../../BPMN"
SOURCES_DIR="$TOOLS_DIR/sources"
RENDER_DIR="$TOOLS_DIR/../diagrams/bpmn_renders"

mkdir -p "$RENDER_DIR"
cd "$BPMN_DIR"

echo "▶ Watching $BPMN_DIR/*.bpmn (Ctrl+C to stop)"
echo ""

npx --prefix "$TOOLS_DIR" chokidar "*.bpmn" -c "
  FILE=\"{path}\"
  BASE=\"\${FILE%.bpmn}\"
  echo ''
  echo '═══ Изменился: '\"\$FILE\"' ═══'

  # 1. Обновить JSON в sources/ (подхватить ручные правки)
  python3 '$TOOLS_DIR'/bpmn_bpmn2json.py \"\$FILE\" '$SOURCES_DIR'/\"\${BASE}.json\" 2>&1 | grep -v '^$' || true

  # 2. Валидация
  python3 '$TOOLS_DIR'/bpmn_json2xml.py '$SOURCES_DIR'/\"\${BASE}.json\" 2>&1 | tail -2 | grep -v '^$'
  python3 '$TOOLS_DIR'/bpmn_audit.py '$SOURCES_DIR'/\"\${BASE}.json\" 2>&1 | tail -3 | grep -v '^$'

  # 3. Рендер в PNG
  npx --prefix '$TOOLS_DIR' bpmn-to-image --no-footer \"\$FILE:$RENDER_DIR/\${BASE}.png\" 2>&1 | grep -v '^$' || true

  echo '✓ PNG → $RENDER_DIR/'\"\${BASE}.png\"
"
