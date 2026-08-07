{
  lib,
  stdenvNoCC,
  callPackage,
  bun,
  sysctl,
  makeBinaryWrapper,
  ripgrep,
  installShellFiles,
  versionCheckHook,
  writableTmpDirAsHomeHook,
  node_modules ? callPackage ./node-modules.nix { },
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "opencorvus";
  inherit (node_modules) version src;
  inherit node_modules;

  nativeBuildInputs = [
    bun
    installShellFiles
    makeBinaryWrapper
    writableTmpDirAsHomeHook
  ];

  configurePhase = ''
    runHook preConfigure

    cp -R ${finalAttrs.node_modules}/. .

    runHook postConfigure
  '';

  env.OPENCORVUS_VERSION = finalAttrs.version;
  env.OPENCORVUS_CHANNEL = "local";

  buildPhase = ''
    runHook preBuild

    cd ./packages/opencorvus
    bun --bun ./script/build.ts --single --skip-install
    bun --bun ./script/schema.ts schema.json

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    install -Dm755 dist/opencorvus-*/opencorvus $out/bin/opencorvus
    install -Dm644 schema.json $out/share/opencorvus/schema.json

    wrapProgram $out/bin/opencorvus \
      --prefix PATH : ${
        lib.makeBinPath (
          [
            ripgrep
          ]
          # bun runs sysctl to detect if dunning on rosetta2
          ++ lib.optional stdenvNoCC.hostPlatform.isDarwin sysctl
        )
      }

    runHook postInstall
  '';

  postInstall = lib.optionalString (stdenvNoCC.buildPlatform.canExecute stdenvNoCC.hostPlatform) ''
    # trick yargs into also generating zsh completions
    installShellCompletion --cmd opencorvus \
      --bash <($out/bin/opencorvus completion) \
      --zsh <(SHELL=/bin/zsh $out/bin/opencorvus completion)
  '';

  nativeInstallCheckInputs = [
    versionCheckHook
    writableTmpDirAsHomeHook
  ];
  doInstallCheck = true;
  versionCheckKeepEnvironment = [ "HOME" ];
  versionCheckProgramArg = "--version";

  passthru = {
    jsonschema = "${placeholder "out"}/share/opencorvus/schema.json";
  };

  meta = {
    description = "The open source coding agent";
    homepage = "https://opencorvus.ai/";
    license = lib.licenses.mit;
    mainProgram = "opencorvus";
    inherit (node_modules.meta) platforms;
  };
})
