#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077

if [[ $# != 0 ]]; then
  printf 'Usage: bash nix/build-image.sh\n' >&2
  exit 2
fi
key=.private/wifi-image.agekey
output=.private/firefly-wifi.img.zst
for path in "$key" "$output"; do
  if ! git check-ignore --no-index --quiet "$path" || [[ -n "$(git ls-files -- "$path")" ]]; then
    printf 'Refusing to use a key or image path that Git can track.\n' >&2
    exit 1
  fi
done
if [[ ! -f "$key" || -L .private || -L "$key" || -e "$output" || -L "$output" ]]; then
  printf 'Create the private bootstrap key first; the output must not already exist. See README.md.\n' >&2
  exit 1
fi
chmod 700 .private

docker exec -i firefly-nix sh -se <<'LINUX'
umask 077
cd /work
tools=$(nix build --no-link --print-out-paths ./nix#image-tools)
export PATH="$tools/bin:$PATH"
base=$(nix build --no-link --print-out-paths ./nix#nixosConfigurations.firefly-pi-image.config.system.build.sdImage)
set -- "$base"/sd-image/*.img.zst
test "$#" -eq 1 && test -f "$1"
python3 nix/prepare-image.py "$1" .private/wifi-image.agekey nix/secrets.yaml .private/firefly-wifi.img.zst
LINUX
printf 'Flash .private/firefly-wifi.img.zst; keep this credential-bearing image private.\n'
