#!/usr/bin/env bash
set -e

configs=(
  "playwright.config.ts:react"
  "playwright.angular.config.ts:angular"
  "playwright.lit.config.ts:lit"
  "playwright.preact.config.ts:preact"
  "playwright.solid.config.ts:solid"
  "playwright.svelte.config.ts:svelte"
  "playwright.vue.config.ts:vue"
)

for entry in "${configs[@]}"; do
  config="${entry%%:*}"
  name="${entry##*:}"
  echo ""
  echo "========================================="
  echo " Running E2E tests: $name"
  echo " Config: $config"
  echo "========================================="
  echo ""
  pnpm exec playwright test --config "$config"
done

echo ""
echo "All E2E test suites passed."
