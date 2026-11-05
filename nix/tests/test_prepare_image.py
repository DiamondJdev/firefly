import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[1] / "prepare-image.py"
SPEC = importlib.util.spec_from_file_location("prepare_image", MODULE_PATH)
image = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(image)


def run(*arguments, **options):
    return subprocess.run(arguments, check=True, capture_output=True, **options)


class PrepareImageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.key = self.root / "wifi.agekey"
        run("age-keygen", "-o", str(self.key))
        self.recipient = run("age-keygen", "-y", str(self.key)).stdout.decode().strip()
        self.secret = self.root / "secrets.yaml"
        self.encrypt({"wireless_env": "psk_home=fixture password, not a real credential"})
        self.filesystem = self.root / "root.ext4"
        with self.filesystem.open("wb") as stream:
            stream.truncate(32 * 1024 * 1024)
        run("mkfs.ext4", "-q", "-F", str(self.filesystem))
        self.disk = self.root / "base.img"
        with self.disk.open("wb") as stream:
            stream.truncate(33 * 1024 * 1024)
        run("sfdisk", str(self.disk), input=b"label: dos\nstart=2048, size=65536, type=83\n")
        self.base = self.root / "base.img.zst"
        self.compress()
        self.output = self.root / "private.img.zst"

    def encrypt(self, content):
        plaintext = self.root / "fixture.json"
        plaintext.write_text(json.dumps(content))
        self.secret.write_bytes(run(
            "sops", "--encrypt", "--age", self.recipient,
            "--input-type", "json", "--output-type", "yaml", str(plaintext),
        ).stdout)

    def compress(self):
        with self.disk.open("r+b") as target, self.filesystem.open("rb") as source:
            target.seek(1024 * 1024)
            shutil.copyfileobj(source, target)
        run("zstd", "-q", "-f", str(self.disk), "-o", str(self.base))

    def prepare(self):
        image.prepare_image(self.base, self.key, self.secret, self.output)

    def test_injects_private_root_key_without_changing_base(self):
        before = hashlib.sha256(self.base.read_bytes()).digest()
        self.prepare()
        self.assertEqual(hashlib.sha256(self.base.read_bytes()).digest(), before)
        self.assertEqual(self.output.stat().st_mode & 0o777, 0o600)
        unpacked = self.root / "result.img"
        run("zstd", "-q", "-d", str(self.output), "-o", str(unpacked))
        with unpacked.open("rb") as stream:
            stream.seek(1024 * 1024)
            self.filesystem.write_bytes(stream.read(32 * 1024 * 1024))
        result = run("debugfs", "-R", "cat /var/lib/firefly/wifi.agekey", str(self.filesystem))
        self.assertEqual(result.stdout, self.key.read_bytes())
        for path, mode in [("/var/lib/firefly", "0700"), ("/var/lib/firefly/wifi.agekey", "0600")]:
            metadata = run("debugfs", "-R", f"stat {path}", str(self.filesystem)).stdout.decode()
            self.assertRegex(metadata, rf"Mode:\s+{mode}")
            self.assertRegex(metadata, r"User:\s+0\s+Group:\s+0")
        run("e2fsck", "-f", "-n", str(self.filesystem))

    def test_wrong_key_cannot_fall_back_to_an_admin_environment(self):
        wrong_key = self.root / "wrong.agekey"
        run("age-keygen", "-o", str(wrong_key))
        with patch.dict(os.environ, {"SOPS_AGE_KEY_FILE": str(self.key), "SOPS_AGE_KEY": self.key.read_text()}):
            with self.assertRaises(ValueError):
                image.prepare_image(self.base, wrong_key, self.secret, self.output)
        self.assertFalse(self.output.exists())

    def test_rejects_a_document_with_application_secrets(self):
        self.encrypt({"wireless_env": "psk_home=fixture", "app_token": "do not share this"})
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertFalse(self.output.exists())

    def test_never_overwrites_an_existing_output(self):
        self.output.write_bytes(b"keep this image")
        with self.assertRaises(FileExistsError):
            self.prepare()
        self.assertEqual(self.output.read_bytes(), b"keep this image")

    def test_rejects_a_readable_private_key(self):
        self.key.chmod(0o644)
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertFalse(self.output.exists())

    def test_rejects_an_image_with_existing_ssh_identity(self):
        run("debugfs", "-w", "-R", "mkdir /etc", str(self.filesystem))
        run("debugfs", "-w", "-R", "mkdir /etc/ssh", str(self.filesystem))
        run("debugfs", "-w", "-R", f"write {self.key} /etc/ssh/ssh_host_ed25519_key", str(self.filesystem))
        self.compress()
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertFalse(self.output.exists())

    def test_rejects_invalid_partition_layout(self):
        self.base.write_bytes(run("zstd", "-q", "--stdout", input=b"not a disk image").stdout)
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertFalse(self.output.exists())

    def test_detects_debugfs_write_errors_even_with_zero_exit_status(self):
        original = subprocess.run

        def fail_write(arguments, **options):
            if arguments[0] == "debugfs" and any(str(argument).startswith("write ") for argument in arguments):
                return subprocess.CompletedProcess(arguments, 0, b"", b"write: No space left on device")
            return original(arguments, **options)

        with patch.object(subprocess, "run", side_effect=fail_write):
            with self.assertRaises(ValueError):
                self.prepare()
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
