#!/usr/bin/env bash
set -e

# Each entry: config:framework:idp_port:app_port
configs=(
  "playwright.config.ts:React:10001:20001"
  "playwright.angular.config.ts:Angular:10002:20002"
  "playwright.lit.config.ts:Lit:10003:20003"
  "playwright.preact.config.ts:Preact:10004:20004"
  "playwright.solid.config.ts:Solid:10005:20005"
  "playwright.svelte.config.ts:Svelte:10006:20006"
  "playwright.vue.config.ts:Vue:10007:20007"
  "playwright.kasper.config.ts:Kasper:10008:20008"
)

MAX_PARALLEL=${MAX_PARALLEL:-1}
pids=()
names=()
results=()
failed=0

for entry in "${configs[@]}"; do
  IFS=: read -r config name idp_port app_port <<< "$entry"

  # Wait if we've hit the max parallel limit
  while [ "${#pids[@]}" -ge "$MAX_PARALLEL" ]; do
    # Wait for any one pid to finish
    for i in "${!pids[@]}"; do
      if ! kill -0 "${pids[$i]}" 2>/dev/null; then
        if wait "${pids[$i]}"; then
          results+=("✓ ${names[$i]}")
        else
          results+=("✗ ${names[$i]}")
          failed=1
        fi
        unset 'pids[i]' 'names[i]'
        # Re-index arrays
        pids=("${pids[@]}")
        names=("${names[@]}")
        break
      fi
    done
    sleep 0.2
  done

  echo "Starting E2E: $name (IDP:$idp_port APP:$app_port)"
  E2E_IDP_PORT=$idp_port \
  E2E_APP_PORT=$app_port \
  E2E_FRAMEWORK=$name \
  VITE_IDP_PORT=$idp_port \
  VITE_APP_PORT=$app_port \
  pnpm exec playwright test --config "$config" "$@" &
  pids+=($!)
  names+=("$name")
done

# Wait for remaining
for i in "${!pids[@]}"; do
  if wait "${pids[$i]}"; then
    results+=("✓ ${names[$i]}")
  else
    results+=("✗ ${names[$i]}")
    failed=1
  fi
done

echo ""
echo "========================================="
echo " E2E Results"
echo "========================================="
for r in "${results[@]}"; do
  echo "  $r"
done
echo "========================================="

if [ $failed -ne 0 ]; then
  echo "Some suites failed."
  exit 1
fi

echo ""
echo "All E2E test suites passed."
