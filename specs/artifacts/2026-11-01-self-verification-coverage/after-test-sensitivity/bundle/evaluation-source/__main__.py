"""Copy manifest-selected files into a ZIP without interpreting payload bytes."""
import argparse
import json
import ntpath
import os
from pathlib import Path
import tempfile
import zipfile
INDEX_PATH = '_bundle_index.json'

def source_path(root, value):
    """Sources use filesystem paths, not ZIP destination syntax."""
    if isinstance(value, str) and '\\' in value:
        raise ValueError('evaluation-only native source rejection')
    if not isinstance(value, str) or not value or '\x00' in value:
        raise ValueError('source must be a nonempty path')
    path = Path(value)
    if path.is_absolute() or ntpath.splitdrive(value)[0]:
        raise ValueError('source must be relative')
    if any((part == '..' for part in path.parts)):
        raise ValueError('source must not contain traversal')
    resolved = (root / path).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        raise ValueError('source escapes the input directory')
    if not resolved.is_file():
        raise ValueError('source is not a file: ' + value)
    return resolved

def target_path(value):
    if not isinstance(value, str) or not value or '\x00' in value:
        raise ValueError('target must be a nonempty path')
    if '\\' in value or ntpath.splitdrive(value)[0]:
        raise ValueError('target must be a relative forward-slash path')
    if any((part in ('', '.', '..') for part in value.split('/'))):
        raise ValueError('target contains an absolute, empty or traversal component')
    if value == INDEX_PATH:
        raise ValueError('target is reserved for the bundle index')
    return value

def load_entries(root):
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    if not isinstance(manifest, dict) or not isinstance(manifest.get('files'), list):
        raise ValueError('manifest must contain a files array')
    entries = []
    seen = set()
    for row in manifest['files']:
        if not isinstance(row, dict) or 'source' not in row or 'target' not in row:
            raise ValueError('each file requires source and target')
        target = target_path(row['target'])
        if target in seen:
            raise ValueError('duplicate target: ' + target)
        seen.add(target)
        entries.append((target, source_path(root, row['source'])))
    return sorted(entries)

def bundle(input_directory, output_zip):
    root = Path(input_directory).resolve()
    entries = load_entries(root)
    output = Path(output_zip).resolve()
    fd, temporary = tempfile.mkstemp(prefix='.bundle-', suffix='.zip', dir=output.parent)
    os.close(fd)
    try:
        index = []
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for target, source in entries:
                size = 0
                with source.open('rb') as incoming, archive.open(target, 'w', force_zip64=True) as outgoing:
                    while True:
                        chunk = incoming.read(1024 * 1024)
                        if not chunk:
                            break
                        outgoing.write(chunk)
                        size += len(chunk)
                index.append({'path': target, 'bytes': size})
            archive.writestr(INDEX_PATH, json.dumps({'files': index}, ensure_ascii=False).encode('utf-8'))
        os.replace(temporary, output)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', help='directory containing manifest.json')
    parser.add_argument('--output', required=True, help='destination ZIP file')
    args = parser.parse_args()
    try:
        bundle(args.input, args.output)
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        parser.exit(2, 'error: {}\n'.format(error))
if __name__ == '__main__':
    main()
