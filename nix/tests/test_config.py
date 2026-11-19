import json
import os
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
              tunnels = map (tunnel: { inherit (tunnel) ingress default credentialsFile; })
                (builtins.attrValues config.services.cloudflared.tunnels);
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
        (tunnel,) = self.configuration["tunnels"]
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
        admin = re.search(r"&admin (age1\w+)", sops_config).group(1)
        pi = re.search(r"&firefly-pi (age1\w+)", sops_config).group(1)
        metadata = json.loads((repository / "nix/tunnel-credentials.json").read_text())["sops"]
        recipients = {entry["recipient"] for entry in metadata["age"]}
        self.assertEqual(recipients, {admin, pi})


class ClusterHostTests(unittest.TestCase):
    AGENTS = ["firefly-pi-2", "firefly-pi-3", "firefly-pi-4", "firefly-pi-5"]
    CONTROL_PLANE = "100.79.119.115"

    @classmethod
    def setUpClass(cls):
        cls.repository = Path(__file__).resolve().parents[2]
        result = subprocess.run([
            "nix", "eval", "--json", f"{cls.repository}/nix#nixosConfigurations",
            "--apply", """hosts: builtins.mapAttrs (_: host: let c = host.config; in {
              hostName = c.networking.hostName;
              k3s = c.services.k3s.enable;
              role = c.services.k3s.role;
              server = c.services.k3s.serverAddr;
              tokenFile = c.services.k3s.tokenFile;
              flags = c.services.k3s.extraFlags;
              tunnel = c.services.cloudflared.enable;
              secrets = builtins.attrNames c.sops.secrets;
              tokenPath = c.sops.secrets.k3s-agent-token.path or null;
              trusted = c.networking.firewall.trustedInterfaces;
              tcp = c.networking.firewall.allowedTCPPorts;
              nodeIpScript = c.systemd.services.k3s.preStart or null;
              restart = c.systemd.services.k3s.serviceConfig.Restart or null;
              separateNodeIpUnit = c.systemd.services ? k3s-node-ip;
            }) hosts""",
        ], check=True, capture_output=True, text=True)
        cls.hosts = json.loads(result.stdout)

    def test_every_host_has_its_own_name(self):
        self.assertEqual(set(self.hosts), {"firefly-pi", "firefly-pi-image", *self.AGENTS})
        names = [host["hostName"] for host in self.hosts.values()]
        self.assertEqual(len(names), len(set(names)))
        for name in ["firefly-pi", *self.AGENTS]:
            self.assertEqual(self.hosts[name]["hostName"], name)

    def test_image_is_only_a_bootstrap(self):
        image = self.hosts["firefly-pi-image"]
        self.assertFalse(image["k3s"])
        self.assertEqual(image["hostName"], "firefly-new")

    def test_only_the_control_plane_is_a_server_or_runs_the_tunnel(self):
        server = self.hosts["firefly-pi"]
        self.assertEqual(server["role"], "server")
        self.assertTrue(server["tunnel"])
        self.assertNotIn("k3s-agent-token", server["secrets"])
        for flag in [
            "--write-kubeconfig-mode=0600", "--secrets-encryption", "--flannel-iface=tailscale0",
            f"--advertise-address={self.CONTROL_PLANE}", f"--tls-san={self.CONTROL_PLANE}",
            "--cluster-cidr=10.42.0.0/16", "--service-cidr=10.43.0.0/16", "--node-label=role=control",
        ]:
            self.assertIn(flag, server["flags"])
        for name in self.AGENTS:
            self.assertFalse(self.hosts[name]["tunnel"])

    def test_agents_join_over_tailscale_with_the_agent_token(self):
        for name in self.AGENTS:
            agent = self.hosts[name]
            self.assertEqual(agent["role"], "agent")
            self.assertEqual(agent["server"], f"https://{self.CONTROL_PLANE}:6443")
            self.assertEqual(agent["tokenFile"], agent["tokenPath"])
            self.assertIn("--flannel-iface=tailscale0", agent["flags"])

    def test_node_roles_match_the_design(self):
        for name in self.AGENTS[:3]:
            self.assertIn("--node-label=serve=true", self.hosts[name]["flags"])
            self.assertFalse(any(flag.startswith("--node-taint") for flag in self.hosts[name]["flags"]))
        builder = self.hosts["firefly-pi-5"]["flags"]
        self.assertIn("--node-label=role=builder", builder)
        self.assertIn("--node-taint=builder=true:NoSchedule", builder)
        self.assertNotIn("--node-label=serve=true", builder)

    def test_cluster_traffic_stays_off_the_lan(self):
        for name in ["firefly-pi", *self.AGENTS]:
            host = self.hosts[name]
            self.assertIn("tailscale ip -4", host["nodeIpScript"])
            # One try per start: k3s's own Restart=always retries, so a slow boot recovers on its own.
            self.assertEqual(host["restart"], "always")
            self.assertFalse(host["separateNodeIpUnit"])
            self.assertIn("tailscale0", host["trusted"])
            self.assertIn("flannel.1", host["trusted"])
            self.assertFalse({6443, 10250} & set(host["tcp"]))

    def run_node_ip_script(self, directory, tailscale_body):
        tools = Path(directory) / "bin"
        tools.mkdir()
        calls = Path(directory) / "calls"
        tool = tools / "tailscale"
        tool.write_text(f"#!/bin/sh\necho x >> {calls}\n{tailscale_body}\n")
        tool.chmod(0o755)
        target = Path(directory) / "config.yaml.d"
        script = self.hosts["firefly-pi-2"]["nodeIpScript"].replace("/etc/rancher/k3s/config.yaml.d", str(target))
        result = subprocess.run(
            ["bash", "-eu", "-c", script], capture_output=True, text=True,
            env={"PATH": f"{tools}:{os.environ['PATH']}"},
        )
        tries = len(calls.read_text().splitlines()) if calls.exists() else 0
        return result, target / "10-node-ip.yaml", tries

    def test_node_ip_comes_from_tailscale(self):
        with tempfile.TemporaryDirectory() as directory:
            result, output, _ = self.run_node_ip_script(directory, "echo 100.64.0.2")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(output.read_text(), "node-ip: 100.64.0.2\n")

    def test_k3s_does_not_start_before_tailscale_login(self):
        with tempfile.TemporaryDirectory() as directory:
            result, output, tries = self.run_node_ip_script(directory, "exit 1")
            self.assertEqual(result.returncode, 1)
            self.assertEqual(tries, 1)
            self.assertIn("tailscale up", result.stderr)
            self.assertFalse(output.exists())

    def test_agent_token_excludes_the_wifi_image_recipient(self):
        sops_config = (self.repository / "nix/.sops.yaml").read_text()
        admin = re.search(r"&admin (age1\w+)", sops_config).group(1)
        image = re.search(r"&wifi-image (age1\w+)", sops_config).group(1)
        metadata = json.loads((self.repository / "nix/k3s-agent-token.json").read_text())["sops"]
        recipients = {entry["recipient"] for entry in metadata["age"]}
        self.assertIn(admin, recipients)
        self.assertNotIn(image, recipients)


if __name__ == "__main__":
    unittest.main()
