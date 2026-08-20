#!/usr/bin/env bash
set -euo pipefail

: "${CELLD_BUCKET:?Set CELLD_BUCKET to a dedicated s3:// bucket}"
AWS_REGION="${AWS_REGION:-us-east-2}"
CELLD_ADDR="${CELLD_ADDR:-127.0.0.1:8080}"
export AWS_REGION CELLD_ADDR

command -v celld >/dev/null || {
  echo "celld is required: curl -fsSL https://celld.dev/install.sh | sh" >&2
  exit 1
}
command -v esbuild >/dev/null || {
  echo "esbuild is required to deploy Worker code" >&2
  exit 1
}

args=(--bucket "$CELLD_BUCKET" --region "$AWS_REGION")
if [[ -n "${S3_ENDPOINT:-}" ]]; then
  args+=(--endpoint "$S3_ENDPOINT")
fi

celld deploy "$(dirname "$0")" "${args[@]}"
exec celld "${args[@]}" --listen "$CELLD_ADDR"
