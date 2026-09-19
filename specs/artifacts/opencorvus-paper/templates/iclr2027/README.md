# ICLR 2027 official LaTeX template

Downloaded on 2026-09-10 from the template URL linked by the [ICLR 2027 Author Guidelines](https://iclr.cc/Conferences/2027/AuthorGuidelines): [official ZIP](https://media.iclr.cc/Conferences/ICLR2027/iclr-2027-style-files.zip).

The unchanged [local ZIP](iclr-2027-style-files.zip) is the canonical stored input. Its SHA-256 is `0d940dfa9398ae99a18f24a85a8a683f367204b6af6d17d2899e60a67102529e`. The seven archive files were inspected and extracted without modification. The extracted `source/` directory is an ignored local convenience copy that can be recreated from the archive; it is not a second maintained template source.

From this directory, extract the archive when `source/` does not already exist:

```powershell
Expand-Archive -LiteralPath .\iclr-2027-style-files.zip -DestinationPath .\source
```

The LaTeX entry point is `source/iclr2027/iclr2027_conference.tex`. The package also contains `iclr2027_conference.sty`, `iclr2027_conference.bst`, `iclr2027_conference.bib`, `math_commands.tex`, `natbib.sty`, and `fancyhdr.sty`. The entry point loads the bundled style and notation, and leaves `\iclrfinalcopy` commented for the anonymous review format. All upstream notices are preserved in the archive and extraction.

The download check established ZIP readability, bounded extraction paths, seven expected files, and individual SHA-256 digests. It did not compile or alter the official example. The current manuscript now uses this official style and bibliography style directly from the ignored extraction. Its main source applies document-level working-draft status text; official files remain unchanged. See the manuscript README for the single build path.

The current official guide specifies a nine-page main-text limit at submission, excluding references and appendices, and requires an AI use statement. These are future manuscript-adaptation requirements, not evidence that the existing working paper is ready for submission. Consult the linked guide again before submitting.
