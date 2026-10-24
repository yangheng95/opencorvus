"""Local, dependency-free DOCX conversion and full reading-order verification."""

from pathlib import Path
import argparse
import csv
import re
import sys
from zipfile import ZipFile, ZIP_DEFLATED
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outputs/growth-plan.md"
TARGET = ROOT / "outputs/growth-plan.docx"
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}


def blocks(text):
    result = []
    for line in text.splitlines():
        if not line.strip():
            continue
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            if all(re.fullmatch(r":?-+:?", c) for c in cells):
                continue
            result.append(("row", cells))
        else:
            result.append(("p", re.sub(r"^#+\s+", "", line)))
    return result


def paragraph(text, heading=False, keep_next=False):
    props = "<w:pPr><w:keepNext/></w:pPr>" if heading or keep_next else ""
    bold = "<w:b/>" if heading else ""
    return (
        f"<w:p>{props}<w:r><w:rPr>{bold}"
        '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/>'
        '<w:sz w:val="20"/><w:lang w:val="zh-CN" w:eastAsia="zh-CN"/>'
        f'</w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'
    )


def build():
    text = SOURCE.read_text(encoding="utf-8")
    content, table = [], False
    for kind, value in blocks(text):
        if kind == "row":
            header = not table
            if not table:
                content.append(
                    '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>'
                    "<w:tblBorders>"
                    + "".join(
                        f'<w:{side} w:val="single" w:sz="4" w:color="AAAAAA"/>'
                        for side in (
                            "top",
                            "left",
                            "bottom",
                            "right",
                            "insideH",
                            "insideV",
                        )
                    )
                    + "</w:tblBorders></w:tblPr><w:tblGrid>"
                    + "".join(
                        f'<w:gridCol w:w="{15138 // len(value)}"/>' for _ in value
                    )
                    + "</w:tblGrid>"
                )
                table = True
            content.append(
                "<w:tr><w:trPr><w:cantSplit/>"
                + ("<w:tblHeader/>" if header else "")
                + "</w:trPr>"
                + "".join(
                    '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>'
                    + paragraph(cell, keep_next=header)
                    + "</w:tc>"
                    for cell in value
                )
                + "</w:tr>"
            )
        else:
            if table:
                content.append("</w:tbl>")
                table = False
            content.append(
                paragraph(value, bool(re.match(r"^(本地内部|\d+\.)", value)))
            )
    if table:
        content.append("</w:tbl>")
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W}"><w:body>'
        + "".join(content)
        + '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'
        '<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/>'
        "</w:sectPr></w:body></w:document>"
    )
    with ZipFile(TARGET, "w", ZIP_DEFLATED) as package:
        package.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        package.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>",
        )
        package.writestr("word/document.xml", document)


def verify_table_layout(body):
    tables = body.findall("w:tbl", NS)
    assert tables, "No tables to verify"
    for table in tables:
        rows = table.findall("w:tr", NS)
        assert len(rows) >= 2, "Header needs a first data row"
        for index, row in enumerate(rows):
            assert row.find("w:trPr/w:cantSplit", NS) is not None
            assert (row.find("w:trPr/w:tblHeader", NS) is not None) == (index == 0)
            for cell in row.findall("w:tc", NS):
                for p in cell.findall("w:p", NS):
                    # Only the header links forward; body rows remain free to paginate.
                    assert (p.find("w:pPr/w:keepNext", NS) is not None) == (index == 0)
    return len(tables)


def verify(baseline=None):
    if baseline is not None:
        original = Path(baseline).read_bytes()
        current = SOURCE.read_bytes()
        assert current == original, "Canonical Markdown changed from frozen original"
        print(
            f"PASS: frozen Markdown and current file directly equal, {len(current)} bytes"
        )
    text = SOURCE.read_text(encoding="utf-8")
    expected = blocks(text)
    with ZipFile(TARGET) as package:
        assert package.testzip() is None
        for name in package.namelist():
            ET.fromstring(package.read(name))
        body = ET.fromstring(package.read("word/document.xml")).find("w:body", NS)
    table_count = verify_table_layout(body)
    actual = []
    for node in body:
        if node.tag == f"{{{W}}}p":
            actual.append(("p", "".join(node.itertext())))
        elif node.tag == f"{{{W}}}tbl":
            for row in node.findall("w:tr", NS):
                actual.append(
                    ("row", ["".join(c.itertext()) for c in row.findall("w:tc", NS)])
                )
    assert actual == expected, "Full paragraph/table reading-order mismatch"
    assert "\ufffd" not in text and not any("\ufffd" in str(b) for b in actual)
    assert len(re.findall(r"^## ", text, re.M)) == 9
    with (ROOT / "campaign.csv").open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    assert len(rows) == 3
    totals = [
        sum(int(r[k]) for r in rows)
        for k in ("impressions", "clicks", "leads", "cost_cny")
    ]
    assert totals == [6000, 370, 47, 1900]
    assert [int(r["cost_cny"]) / int(r["leads"]) for r in rows] == [20, 50, 60]
    assert round(totals[3] / totals[2], 2) == 40.43
    for row in rows:
        channel = row["channel"]
        values = [row[k] for k in ("impressions", "clicks", "leads", "cost_cny")]
        assert f"| {channel} | " + " | ".join(values) + " |" in text
    for required in (
        "1900/47≈40.43",
        "370/6000≈6.17%",
        "47/370≈12.70%",
        "47/6000≈0.78%",
        "300+250+200+100+50+200=1100",
        "1200-1100=100",
        "3000元初稿→1200元现行上限",
        "7点击需至少4次",
        "本Task未执行",
        "工时、费率",
    ):
        assert required in text, required
    assert sum([300, 250, 200, 100, 50, 200]) == 1100
    assert not (ROOT / "artifacts/marketing-growth/campaign-plan.md").exists()
    assert sorted(p.name for p in (ROOT / "outputs").iterdir()) == [
        "growth-plan.docx",
        "growth-plan.md",
    ]
    print("FULL DOCX READING ORDER — all paragraphs and table cells:")
    for kind, value in actual:
        print(" | ".join(value) if kind == "row" else value)
    print(
        f"PASS: {len(actual)} ordered blocks; 9 sections; "
        f"{sum(k == 'row' for k, _ in actual)} table rows; no missing/drifting text; "
        "source arithmetic and budget checked; no second canonical body."
    )
    print(
        f"PASS: {table_count} tables have repeating first-row headers, header-only "
        "keep-next and unsplit rows. Rendering and visual acceptance are separate."
    )


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", action="store_true")
    parser.add_argument(
        "--baseline", type=Path, help="Exact materialized frozen Markdown"
    )
    args = parser.parse_args()
    if args.baseline is not None:
        assert SOURCE.read_bytes() == args.baseline.read_bytes(), (
            "Markdown baseline mismatch"
        )
    if args.build:
        build()
    verify(args.baseline)
