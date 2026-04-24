#!/bin/bash
# Render BPMN files to PNG.
# Source: ../../BPMN/*.bpmn
# Output: PNG рядом с .bpmn (в BPMN/)
#
# Для вставки в ВКР.docx: PNG копируется в Текст_ВКР/diagrams/bpmn_renders/
# (отдельная папка, чтобы не засорять BPMN/)
#
# Usage: ./render_bpmn.sh [model1 model2 ...]

set -e
TOOLS_DIR="$(cd "$(dirname "$0")" && pwd)"
BPMN_DIR="$TOOLS_DIR/../../BPMN"
RENDER_DIR="$TOOLS_DIR/../diagrams/bpmn_renders"

mkdir -p "$RENDER_DIR"
cd "$BPMN_DIR"

MODELS=("$@")
if [ ${#MODELS[@]} -eq 0 ]; then
    for f in *.bpmn; do
        MODELS+=("${f%.bpmn}")
    done
fi

ARGS=""
for m in "${MODELS[@]}"; do
    ARGS="$ARGS ${m}.bpmn:$RENDER_DIR/${m}.png"
done

npx --prefix "$TOOLS_DIR" bpmn-to-image --no-footer $ARGS

echo ""
echo "Готово. PNG → $RENDER_DIR"
echo "Модели: ${MODELS[@]}"
