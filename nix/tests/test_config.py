import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest


class BootstrapConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repository = Path(__file__).resolve().parents[2]
        result = subprocess.run([
            "nix", "eval", "--json", f"{repository}/nix#nixosConfigurations.firefly-pi.config",
            "--apply", """config: {
              keyFile = config.sops.age.keyFile;
              generateKey = config.sops.age.generateKey;
              hostKeys = config.sops.age.sshKeyPaths;
              owner = config.sops.secrets.wireless_env.owner;
              mode = config.sops.secrets.wireless_env.mode;
              keyActivation = config.system.activationScripts.generate-age-key.text;
              secretDependencies = config.system.activationScripts.setupSecrets.deps;
              tunnel = {
                inherit (config.services.cloudflared.tunnels."c316183f-58f5-4dc3-9046-bb258677cbbc") ingress default credentialsFile;
              };
              tunnelSecretPath = config.sops.secrets.cloudflared-tunnel.path;
            }""",
        ], check=True, capture_output=True, text=True)
        cls.configuration = json.loads(result.stdout)

    def test_existing_host_fallback_and_secret_permissions_remain(self):
        self.assertEqual(self.configuration["keyFile"], "/var/lib/firefly/wifi.agekey")
        self.assertTrue(self.configuration["generateKey"])
        self.assertIn("/etc/ssh/ssh_host_ed25519_key", self.configuration["hostKeys"])
        self.assertEqual(self.configuration["owner"], "wpa_supplicant")
        self.assertEqual(self.configuration["mode"], "0400")
        self.assertIn("generate-age-key", self.configuration["secretDependencies"])

    def test_one_wildcard_tunnel_routes_to_traefik(self):
        tunnel = self.configuration["tunnel"]
        self.assertEqual(tunnel["ingress"], {"*.diamondjdev.me": "http://localhost:80"})
        self.assertEqual(tunnel["default"], "http_status:404")
        self.assertEqual(tunnel["credentialsFile"], self.configuration["tunnelSecretPath"])

    def test_missing_identity_is_generated_and_existing_identity_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            key = Path(directory) / "firefly" / "wifi.agekey"
            activation = self.configuration["keyActivation"].replace(self.configuration["keyFile"], str(key))
            subprocess.run(["bash", "-eu", "-c", activation], check=True, capture_output=True)
            identity = key.read_bytes()
            self.assertEqual(key.stat().st_mode & 0o777, 0o600)
            subprocess.run(["bash", "-eu", "-c", activation], check=True, capture_output=True)
            self.assertEqual(key.read_bytes(), identity)

    def test_bootstrap_policy_cannot_encrypt_application_secret_files(self):
        repository = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "application-secrets.yaml"
            source.write_text('{"application_token": "fixture"}')
            result = subprocess.run([
                "sops", "--config", str(repository / "nix/.sops.yaml"),
                "--encrypt", "--input-type", "json", "--output-type", "yaml", str(source),
            ], capture_output=True)
            self.assertNotEqual(result.returncode, 0, "Wi-Fi image recipients must not apply to other secret files")


class ReusableImageTests(unittest.TestCase):
    def test_image_config_only_needs_secrets_the_wifi_image_key_can_decrypt(self):
        # sops-install-secrets installs nothing if any secret fails, so one extra secret means no Wi-Fi on a fresh card.
        repository = Path(__file__).resolve().parents[2]
        result = subprocess.run([
            "nix", "eval", "--json", f"{repository}/nix#nixosConfigurations.firefly-pi-image.config",
            "--apply", "config: { secrets = builtins.attrNames config.sops.secrets; tunnel = config.services.cloudflared.enable; }",
        ], check=True, capture_output=True, text=True)
        self.assertEqual(json.loads(result.stdout), {"secrets": ["wireless_env"], "tunnel": False})


class TunnelSecretTests(unittest.TestCase):
    def test_tunnel_credentials_exclude_wifi_image_recipient(self):
        repository = Path(__file__).resolve().parents[2]
        sops_config = (repository / "nix/.sops.yaml").read_text()
        wifi_image = re.search(r"&wifi-image (age1\w+)", sops_config).group(1)
        admin = re.search(r"&admin (age1\w+)", sops_config).group(1)
        pi = re.search(r"&firefly-pi (age1\w+)", sops_config).group(1)
        metadata = json.loads((repository / "nix/tunnel-credentials.json").read_text())["sops"]
        recipients = {entry["recipient"] for entry in metadata["age"]}
        self.assertEqual(recipients, {admin, pi})
        self.assertNotIn(wifi_image, recipients)


if __name__ == "__main__":
    unittest.main()
