#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# != 3 ]]; then
  printf 'Usage: %s <name> <build-dir> <manifest>\n' "$0" >&2
  exit 2
fi
name=$1
build_dir=$2
manifest=$3
if [[ ! "$name" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ || ! -d "$build_dir" || ! -f "$manifest" ]]; then
  printf 'Use a lowercase app name, an existing build directory and a manifest file.\n' >&2
  exit 2
fi

tag=$(git rev-parse --short HEAD)
if [[ -n "$(git status --porcelain -- "$build_dir")" ]]; then
  tag="$tag-dirty-$(date +%s)"
fi
image="firefly/$name:$tag"
docker build --platform linux/arm64 -t "$image" "$build_dir"
architecture=$(docker image inspect -f '{{.Architecture}}' "$image")
if [[ "$architecture" != arm64 ]]; then
  printf 'Refusing to ship %s: expected arm64, got %s.\n' "$image" "$architecture" >&2
  exit 1
fi

ssh_options=(-o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3)
docker save "$image" | ssh "${ssh_options[@]}" firefly-pi sudo k3s ctr images import -
sed "s|IMAGE|$image|g" "$manifest" | ssh "${ssh_options[@]}" firefly-pi k3s kubectl apply -f -
ssh "${ssh_options[@]}" firefly-pi k3s kubectl rollout restart "deploy/$name"
ssh "${ssh_options[@]}" firefly-pi k3s kubectl rollout status "deploy/$name" --timeout=120s
