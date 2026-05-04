#!/usr/bin/env bash
# Boucle "debugger auto-correctif" :
#   1. Exécute les tests Node de la preview
#   2. Exécute les tests JVM du module shared
#   3. Si une ou plusieurs assertions cassent, affiche un diagnostic
#      compact que Claude/un outil peut consommer pour corriger.
#
# Le harnais d'invariants in-game (Invariants.autoFix) est lui appelé en
# RUNTIME par l'app (à chaque mutation et au chargement). Ce script-ci
# couvre la phase BUILD/DEV.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRADLE_BIN="${GRADLE_BIN:-/tmp/gradle-8.7/bin/gradle}"
status=0

echo "=========================================="
echo "  PixelQuest – Auto-debug pipeline"
echo "=========================================="

echo
echo "[1/2] Tests preview (Node)"
node -e "
const fs = require('fs');
global.window = global;
const path = '$ROOT/preview/js/';
eval(fs.readFileSync(path+'engine.js','utf8'));
eval(fs.readFileSync(path+'tests.js','utf8'));
const r = global.PixelTests.runFunctionalTests();
let pass=0,fail=0;
r.forEach(t => { if(t.ok) pass++; else { fail++; console.log('FAIL',t.id,'-',t.msg);} });
console.log('Functional: '+pass+'/'+r.length);
const s = global.PixelQuest.defaultState();
const ir = global.PixelTests.runInvariants(s);
let ip=0,ifail=0;
ir.forEach(t=>{ if(t.ok) ip++; else { ifail++; console.log('INV FAIL',t.id);}});
console.log('Invariants: '+ip+'/'+ir.length);
process.exit(fail+ifail===0?0:1);
" || status=1

echo
echo "[2/2] Tests JVM (Kotlin shared)"
if [ -x "$GRADLE_BIN" ]; then
  cd "$ROOT/android"
  "$GRADLE_BIN" :shared:test --no-daemon -q || status=1
else
  echo "WARN gradle introuvable à $GRADLE_BIN, tests JVM ignorés"
fi

echo
if [ $status -eq 0 ]; then
  echo "[OK] Toutes les vérifications passent."
else
  echo "[KO] Des tests ont échoué. Voir la sortie ci-dessus."
fi
exit $status
