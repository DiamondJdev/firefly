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

  outputs =
    { nixos-raspberrypi, ... }:
    {
      # Build the SD image with `path:` so the gitignored wifi.nix is included:
      #   nix build "path:./nix#nixosConfigurations.firefly-pi.config.system.build.sdImage"
      nixosConfigurations.firefly-pi = nixos-raspberrypi.lib.nixosSystem {
        modules = [
          nixos-raspberrypi.nixosModules.raspberry-pi-5.base
          nixos-raspberrypi.nixosModules.sd-image
          ./pi.nix
        ];
      };
    };
}
