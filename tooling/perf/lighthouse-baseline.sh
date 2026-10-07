#!/usr/bin/env bash
# Lighthouse baseline for the public site: 3 runs per route, mobile and desktop.
# Usage: tooling/perf/lighthouse-baseline.sh http://localhost:3000 /tmp/lh
# Point it at a production build (`next start`), never `next dev`.
set -euo pipefail
base=${1:?base url}
out=${2:?output dir}
runs=${RUNS:-3}
mkdir -p "$out"
routes=(home:/ explore:/explore place:/places/apollo-theater walks:/walks ar:/ar)
for preset in mobile desktop; do
  for r in "${routes[@]}"; do
    name=${r%%:*}
    path=${r#*:}
    for i in $(seq 1 "$runs"); do
      extra=()
      [[ $preset == desktop ]] && extra=(--preset=desktop)
      npx -y lighthouse@13 "$base$path" "${extra[@]}" --quiet \
        --output=json --output-path="$out/$preset-$name-$i.json" \
        --chrome-flags="--headless=new --incognito --no-first-run"
    done
  done
done
