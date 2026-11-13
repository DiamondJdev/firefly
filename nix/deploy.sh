#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

remote=firefly-pi
ssh_options=(-o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3)
unit="firefly-switch-$(date +%s)-$$"
git ls-files -z nix | COPYFILE_DISABLE=1 tar --no-xattrs -c --null -T - | ssh "${ssh_options[@]}" "$remote" \
  "set -eu; incoming=\$(mktemp -d \"\$HOME/.nix-upload.XXXXXX\"); tar -x --strip-components=1 -C \"\$incoming\"; if test -e \"\$HOME/nix\"; then mv \"\$HOME/nix\" \"\$HOME/nix.previous-$unit\"; fi; mv \"\$incoming\" \"\$HOME/nix\""

launch_status=0
ssh "${ssh_options[@]}" "$remote" \
  "sudo systemd-run --unit=$unit --service-type=exec --property=RemainAfterExit=yes --setenv=PATH=/run/current-system/sw/bin nixos-rebuild switch --flake \$HOME/nix#firefly-pi" || launch_status=$?
if [[ "$launch_status" != 0 && "$launch_status" != 255 ]]; then
  exit "$launch_status"
fi

deadline=$((SECONDS + 1800))
while (( SECONDS < deadline )); do
  if result=$(ssh "${ssh_options[@]}" "$remote" \
    "state=\$(systemctl show $unit --property=SubState --value); case \$state in exited|failed) systemctl show $unit --property=ExecMainStatus --value ;; *) exit 75 ;; esac"); then
    if [[ "$result" =~ ^[0-9]+$ ]]; then
      ssh "${ssh_options[@]}" "$remote" "sudo journalctl --unit=$unit --no-pager -n 30; sudo systemctl stop $unit; sudo systemctl reset-failed $unit 2>/dev/null || true" || true
      exit "$result"
    fi
  fi
  sleep 2
done
printf 'Timed out waiting for %s; inspect it with: ssh %s sudo journalctl -u %s\n' "$unit" "$remote" "$unit" >&2
exit 1
