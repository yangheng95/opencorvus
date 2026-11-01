"""Preserve native source visibility/outline metadata after Artifact Tool authorship.

Only sheet presentation attributes are copied. Values, formulas, cell styles and
calculation caches remain those produced by Artifact Tool. This is not a second
financial calculation or an alternative writer.
"""
import argparse
import json
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def preserve(root, output):
    metadata = json.loads((root / "source-normalization.json").read_text(encoding="utf-8"))["metadata"]
    mapping = json.loads((output.parent / "layout-map.json").read_text(encoding="utf-8"))
    with zipfile.ZipFile(output) as archive:
        members = {n: archive.read(n) for n in archive.namelist()}
    workbook = ET.fromstring(members["xl/workbook.xml"])
    relationships = ET.fromstring(members["xl/_rels/workbook.xml.rels"])
    targets = {x.attrib["Id"]: x.attrib["Target"] for x in relationships}
    sheets = {}
    for sheet in workbook.find(f"{{{NS}}}sheets"):
        target = targets[sheet.attrib[f"{{{REL}}}id"]]
        sheets[sheet.attrib["name"]] = target.lstrip("/") if target.startswith("/") else "xl/" + target
    for item in mapping:
        info = metadata[item["file"]][item["source_sheet"]]
        member = sheets[item["target"]]
        sheet = ET.fromstring(members[member])
        columns = sheet.find(f"{{{NS}}}cols")
        if columns is not None:
            expanded = {}
            for col in columns:
                for i in range(int(col.attrib["min"]), int(col.attrib["max"]) + 1):
                    expanded[i] = dict(col.attrib, min=str(i), max=str(i))
            for dim in info["column_dimensions"]:
                for i in range(dim["min"], dim["max"] + 1):
                    attributes = expanded.setdefault(i, {"min": str(i), "max": str(i)})
                    if dim["hidden"]:
                        attributes["hidden"] = "1"
                    if dim["outline"]:
                        attributes["outlineLevel"] = str(dim["outline"])
                    if dim["collapsed"]:
                        attributes["collapsed"] = "1"
            columns.clear()
            for _, attributes in sorted(expanded.items()):
                ET.SubElement(columns, f"{{{NS}}}col", attributes)
        rows = {int(x.attrib["r"]): x for x in sheet.find(f"{{{NS}}}sheetData")}
        for dim in info["row_dimensions"]:
            if dim["row"] in rows:
                for source, target in [("hidden", "hidden"), ("collapsed", "collapsed"), ("outline", "outlineLevel")]:
                    if dim[source]:
                        rows[dim["row"]].set(target, str(int(dim[source])))
        # Existing merge handling is owned by the authoring library. No copied
        # style indices, source links, formulas or cells are inserted here.
        members[member] = ET.tostring(sheet, encoding="utf-8", xml_declaration=True)
    before = output.with_name("before-native-layout.xlsx")
    output.replace(before)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return {"sheets_with_source_layout": len(mapping), "operation": "native visibility/outline attributes only", "retained_before": str(before)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = preserve(args.root, args.output)
    (args.output.parent / "layout-receipt.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))
