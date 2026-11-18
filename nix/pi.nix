# Shared by every Pi 5: Wi-Fi, SSH, Tailscale and what k3s needs from the OS.
{ config, lib, ... }:
{
  sops.defaultSopsFile = ./secrets.yaml;
  sops.age.keyFile = "/var/lib/firefly/wifi.agekey";
  sops.age.generateKey = true;
  sops.age.sshKeyPaths = [ "/etc/ssh/ssh_host_ed25519_key" ];
  sops.secrets.wireless_env = {
    owner = "wpa_supplicant";
    restartUnits = [ "wpa_supplicant.service" ];
  };

  boot.supportedFilesystems.zfs = lib.mkForce false; # sd-image base enables ZFS; skip compiling it for the Pi kernel
  networking.wireless.enable = true;
  networking.wireless.secretsFile = config.sops.secrets.wireless_env.path;
  networking.wireless.networks."FBI Surveillance Van".pskRaw = "ext:psk_home";

  # ponytail: no user password, so no console login; SSH key only. Add one if you need the HDMI console.
  users.users.diamondjdev = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    openssh.authorizedKeys.keys = [ "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJiSCGJgwYLRkQ1ChiLNmYI2innNQ838QGIl/zEHLRWB" ];
  };
  security.sudo.wheelNeedsPassword = false;
  nix.settings.trusted-users = [ "@wheel" ]; # allows nixos-rebuild --target-host from the Mac

  services.openssh = {
    enable = true;
    settings.PasswordAuthentication = false;
    settings.PermitRootLogin = "no";
  };

  # First SSH via firefly-new.local, before Tailscale is logged in.
  services.avahi = {
    enable = true;
    nssmdns4 = true;
    publish = {
      enable = true;
      addresses = true;
    };
  };

  # Log in once with `sudo tailscale up`; no auth key stored in config.
  services.tailscale.enable = true;

  # Pi kernels ship with the memory cgroup off; k3s won't start without it.
  boot.kernelParams = [
    "cgroup_enable=cpuset"
    "cgroup_enable=memory"
    "cgroup_memory=1"
  ];
  # 29GB SD card: compressed RAM for swap, so no swap writes, and a store that cleans itself.
  zramSwap.enable = true;
  nix.gc = {
    automatic = true;
    options = "--delete-older-than 14d";
  };
  nix.settings.auto-optimise-store = true;

  # k3s API, node traffic and apps reachable only over Tailscale. cni0 and flannel.1 let pods on
  # any node reach the API. LAN gets SSH only.
  networking.firewall.trustedInterfaces = [
    "tailscale0"
    "cni0"
    "flannel.1"
  ];

  system.stateVersion = "26.05";
}
