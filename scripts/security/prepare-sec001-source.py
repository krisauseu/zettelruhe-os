#!/usr/bin/env python3
"""Create a source offer from tracked core files, excluding local agent configuration.
Usage: python3 scripts/security/prepare-sec001-source.py /absolute/new/output
No .env, node_modules, data volumes or adjacent repositories are read.
"""
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile

root = Path(__file__).resolve().parents[2]
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=False)
source = out / 'source'
source.mkdir()
files = set(subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0'))
files.update(str(p.relative_to(root)) for p in (root / 'scripts/security').glob('*') if p.is_file())
hashes = {}
for name in sorted(files):
    if not name or name.startswith(('.codex/', '.agents/', 'docs/security/')):
        continue
    original = root / name
    if not original.is_file():
        continue
    data = original.read_bytes()
    target = source / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    target.chmod(original.stat().st_mode & 0o777)
    hashes[name] = hashlib.sha256(data).hexdigest()
manifest = json.dumps(hashes, sort_keys=True, indent=2) + '\n'
(out / 'source-hashes.json').write_text(manifest)
source_hash = hashlib.sha256(manifest.encode()).hexdigest()
(out / 'source-hash.txt').write_text(source_hash + '\n')
# Explicit build inputs; source Dockerfiles remain unchanged in the source offer.
node = 'node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32'
alpine = 'alpine:3.21@sha256:f27cad9117495d32d067133afff942cb2dc745dfe9163e949f6bfe8a6a245339'
(out / 'Next.Dockerfile').write_text((source / 'app/Dockerfile').read_text().replace('node:22-alpine', node))
(out / 'PocketBase.Dockerfile').write_text((source / 'pocketbase/Dockerfile').read_text().replace('alpine:3.21', alpine))
with (out / 'zettelruhe-os-source.tar.gz').open('wb') as dest:
    with gzip.GzipFile(filename='', mode='wb', fileobj=dest, mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode='w') as archive:
            for p in sorted(source.rglob('*')):
                if not p.is_file():
                    continue
                data = p.read_bytes()
                info = tarfile.TarInfo('zettelruhe-os/' + str(p.relative_to(source)))
                info.size, info.mtime, info.uid, info.gid = len(data), 0, 0, 0
                info.mode = p.stat().st_mode & 0o777
                archive.addfile(info, io.BytesIO(data))
archive_hash = hashlib.sha256((out / 'zettelruhe-os-source.tar.gz').read_bytes()).hexdigest()
(out / 'SHA256SUMS').write_text(archive_hash + '  zettelruhe-os-source.tar.gz\n')
(out / 'index.html').write_text('<!doctype html><html lang="de"><meta charset="utf-8"><title>Zettelruhe Quellcode</title><h1>Zettelruhe SEC-001</h1><p>Dieser lokale Kandidat enthält Zettelruhe unter AGPL-3.0. Vollständiger Kernquellcode einschließlich Änderungen und Bauanleitungen:</p><a href="zettelruhe-os-source.tar.gz">Quellcode herunterladen</a><p>SHA-256: ' + archive_hash + '</p><p>Entwicklungskandidat, kein veröffentlichter Release.</p></html>')
print(json.dumps({'output': str(out), 'sourceHash': source_hash, 'archiveHash': archive_hash}))
