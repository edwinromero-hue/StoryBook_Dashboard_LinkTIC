#!/bin/bash
# LinkTIC Control Panel — Local Server
# Ejecutar: bash start.sh
echo ""
echo "  LinkTIC Control Panel"
echo "  ─────────────────────"
echo "  Abriendo en http://localhost:8080"
echo "  Presiona Ctrl+C para detener"
echo ""
open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null
python3 -m http.server 8080
