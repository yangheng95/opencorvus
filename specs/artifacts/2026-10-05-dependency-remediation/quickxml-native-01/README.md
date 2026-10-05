# Original canonical native build failure

The actual original checker passed compiler/version/metadata and the first Vite61s phase, then failed the packaged supervisor compile because the isolated environment could not resolve MSVC link.exe. Original stdout/stderr/result/metadata are retained; no native contract or completed full build is claimed here. Later source-identical native03 restores the installed compiler environment and reruns the original complete checker. No binary, PDB or public test-key bytes are archived.
