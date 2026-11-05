import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


KEY_PATH = "/var/lib/firefly/wifi.agekey"


def run(*arguments, **options):
    try:
        return subprocess.run(arguments, check=True, capture_output=True, **options).stdout
    except subprocess.CalledProcessError:
        raise ValueError(f"{arguments[0]} failed; no image published") from None


def prepare_image(base, key, secret, output):
    base, key, secret, output = map(Path, (base, key, secret, output))
    if output.exists() or output.is_symlink():
        raise FileExistsError("Output already exists; choose a new filename")
    if key.stat().st_mode & 0o077:
        raise ValueError("Bootstrap key must not be readable by other users")
    identity = key.read_bytes()
    run("age-keygen", "-y", str(key.resolve()))

    with tempfile.TemporaryDirectory(prefix="firefly-image-") as temporary:
        work = Path(temporary)
        environment = {name: value for name, value in os.environ.items() if not name.startswith("SOPS_")}
        environment.update(SOPS_AGE_KEY_FILE=str(key.resolve()), HOME=str(work), XDG_CONFIG_HOME=str(work))
        decrypted = json.loads(run(
            "sops", "--decrypt", "--input-type", "yaml", "--output-type", "json", str(secret.resolve()),
            env=environment,
        ))
        if not isinstance(decrypted, dict) or set(decrypted) != {"wireless_env"} or not isinstance(decrypted["wireless_env"], str):
            raise ValueError("The image identity must decrypt a Wi-Fi-only document")
        if not decrypted["wireless_env"].startswith("psk_home=") or not decrypted["wireless_env"][9:]:
            raise ValueError("Wi-Fi secret must contain a nonempty psk_home value")
        del decrypted

        disk = work / "disk.img"
        with disk.open("wb") as stream:
            subprocess.run(["zstd", "-q", "--decompress", "--stdout", str(base.resolve())], stdout=stream, stderr=subprocess.PIPE, check=True)
        table = json.loads(run("sfdisk", "--json", str(disk)))["partitiontable"]
        roots = [partition for partition in table["partitions"] if partition["type"] == "83"]
        if table["label"] != "dos" or table.get("sectorsize") != 512 or len(roots) != 1:
            raise ValueError("Expected the pinned NixOS DOS layout with one Linux root partition")
        offset, size = roots[0]["start"] * 512, roots[0]["size"] * 512
        if offset < 512 or size <= 0 or offset + size > disk.stat().st_size:
            raise ValueError("Root partition is outside the image")
        filesystem = work / "root.ext4"
        with disk.open("rb") as source, filesystem.open("wb") as target:
            source.seek(offset)
            remaining = size
            while remaining:
                chunk = source.read(min(remaining, 1024 * 1024))
                if not chunk:
                    raise ValueError("Truncated root partition")
                target.write(chunk)
                remaining -= len(chunk)

        def debugfs(command, write=False):
            arguments = ["debugfs"] + (["-w"] if write else [])
            return run(*arguments, "-R", command, str(filesystem), cwd=work)

        for path in [
            KEY_PATH, "/var/lib/tailscale", "/var/lib/rancher/k3s",
            "/etc/ssh/ssh_host_ed25519_key", "/etc/ssh/ssh_host_rsa_key", "/etc/ssh/ssh_host_ecdsa_key",
        ]:
            if b"Inode:" in debugfs(f"stat {path}"):
                raise ValueError("Use a fresh Nix-built image, not a previously provisioned card")
        for directory in ["/var", "/var/lib", "/var/lib/firefly"]:
            if b"Inode:" not in debugfs(f"stat {directory}"):
                debugfs(f"mkdir {directory}", write=True)
        private_key = work / "identity"
        private_key.write_bytes(identity)
        private_key.chmod(0o600)
        debugfs(f"write identity {KEY_PATH}", write=True)
        for path, mode in [("/var/lib/firefly", "040700"), (KEY_PATH, "0100600")]:
            for field, value in [("mode", mode), ("uid", "0"), ("gid", "0")]:
                debugfs(f"sif {path} {field} {value}", write=True)
            metadata = debugfs(f"stat {path}").decode()
            if not re.search(rf"Mode:\s+{mode[-4:]}", metadata) or not re.search(r"User:\s+0\s+Group:\s+0", metadata):
                raise ValueError("Injected key permissions could not be verified")
        if debugfs(f"cat {KEY_PATH}") != identity:
            raise ValueError("Injected key contents could not be verified")
        run("e2fsck", "-f", "-n", str(filesystem))
        with disk.open("r+b") as target, filesystem.open("rb") as source:
            target.seek(offset)
            shutil.copyfileobj(source, target)

        descriptor, pending_name = tempfile.mkstemp(prefix=".firefly-image-", dir=output.parent)
        pending = Path(pending_name)
        try:
            with os.fdopen(descriptor, "wb") as stream:
                subprocess.run(["zstd", "-q", "--stdout", str(disk)], stdout=stream, stderr=subprocess.PIPE, check=True)
                stream.flush()
                os.fsync(stream.fileno())
            run("zstd", "-q", "--test", str(pending))
            os.link(pending, output)
        finally:
            pending.unlink(missing_ok=True)


if __name__ == "__main__":
    os.umask(0o077)
    if len(sys.argv) != 5:
        sys.exit("Usage: prepare-image.py <base.img.zst> <wifi.agekey> <secrets.yaml> <private.img.zst>")
    try:
        prepare_image(*sys.argv[1:])
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        sys.exit(f"Image preparation failed: {error}")
    print("Private Wi-Fi image prepared; protect it like the Wi-Fi password.")
