from pathlib import Path
import json, pymupdf
s = Path(__file__).parent
r = json.loads((s/'run164-runtime.json').read_text())
north = Path(r['root'])/'memory-handoff-north'
sources = [Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-11-23-pdf-direct-page-navigation/field-handbook.pdf'),
           s.parent/'opencorvus-iteration-20261128-shared-discriminator-input/北仓参数完整性复验-preview.pdf']
target = north/'整页阅读结算合册.pdf'
assert not target.exists()
out = pymupdf.open()
facts = []
for source in sources:
    with pymupdf.open(source) as document:
        facts.append({'name':source.name,'bytes':source.stat().st_size,'pages':[{'width':p.rect.width,'height':p.rect.height,'links':len(p.get_links())} for p in document]})
        out.insert_pdf(document)
out.save(target)
out.close()
with pymupdf.open(target) as document:
    assert len(document)==11
    assert len(document[0].get_links())==1
    document[8].get_pixmap(matrix=pymupdf.Matrix(1,1)).save(s/'reference-landscape.png')
result={'target':str(target),'bytes':target.stat().st_size,'sources':facts,'pages':11,'coverLinks':1}
(s/'manual-pdf-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
