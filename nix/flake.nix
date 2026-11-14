{
  description = "Phoenix Firefly nodes";

  # Prebuilt Pi kernel/firmware, so nothing big compiles locally.
  nixConfig = {
    extra-substituters = [ "https://nixos-raspberrypi.cachix.org" ];
    extra-trusted-public-keys = [
      "nixos-raspberrypi.cachix.org-1:4iMO9LXa8BqhU+Rpg6LQKiGa2lsNh/j2oiYLNOQ5sPI="
    ];
  };

  # Keep nixos-raspberrypi's own nixpkgs pin: overriding it misses the binary cache.
  # flake.lock pins that nixpkgs, which pins the k3s version.
  inputs.nixos-raspberrypi.url = "github:nvmd/nixos-raspberrypi/main";
  inputs.sops-nix = {
    url = "github:Mic92/sops-nix";
    inputs.nixpkgs.follows = "nixos-raspberrypi/nixpkgs";
  };

  outputs =
    { nixos-raspberrypi, sops-nix, ... }:
    {
      packages.aarch64-linux.image-tools =
        let
          pkgs = nixos-raspberrypi.inputs.nixpkgs.legacyPackages.aarch64-linux;
        in
        pkgs.buildEnv {
          name = "firefly-image-tools";
          paths = with pkgs; [
            python3
            e2fsprogs
            util-linux
            zstd
            sops
            age
          ];
        };

      # nix build ./nix#nixosConfigurations.firefly-pi.config.system.build.sdImage
      nixosConfigurations =
        let
          base = [
            nixos-raspberrypi.nixosModules.raspberry-pi-5.base
            nixos-raspberrypi.nixosModules.sd-image
            sops-nix.nixosModules.sops
            ./pi.nix
          ];
        in
        {
          firefly-pi = nixos-raspberrypi.lib.nixosSystem { modules = base ++ [ ./tunnel.nix ]; };
          # Reusable Wi-Fi image: only secrets the wifi-image key can decrypt.
          firefly-pi-image = nixos-raspberrypi.lib.nixosSystem { modules = base; };
        };
    };
}
