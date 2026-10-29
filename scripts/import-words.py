"""Build licensed, deduplicated static word banks; not needed by the website or CI."""
import gzip
import hashlib
import json
import re
import sys
import time
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'artifacts' / 'word-tools'))
from wordfreq import top_n_list
from importlib.metadata import distribution

CACHE = ROOT / 'artifacts' / 'word-sources'
CACHE.mkdir(parents=True, exist_ok=True)
SOURCE = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'
source_file = CACHE / 'cedict.u8.gz'
if not source_file.exists():
    request = urllib.request.Request(SOURCE, headers={'User-Agent': 'ZiJianWordBank/1.0 (educational typing practice)'})
    started = time.monotonic()
    chunks = []
    with urllib.request.urlopen(request, timeout=20) as response:
        while True:
            chunk = response.read(16384)
            if not chunk:
                break
            chunks.append(chunk)
            if time.monotonic() - started > 90:
                raise RuntimeError('CC-CEDICT download is too slow. Save the official .gz to artifacts/word-sources/cedict.u8.gz and retry.')
    source_file.write_bytes(b''.join(chunks))
raw = gzip.decompress(source_file.read_bytes()).decode('utf-8')
header = '\n'.join(line for line in raw.splitlines() if line.startswith('#'))
if 'creativecommons.org/licenses/by-sa/4.0' not in header:
    raise RuntimeError('Review the CC-CEDICT source licence before importing this snapshot')

seed = json.loads((ROOT / 'data' / 'seed-words.json').read_text(encoding='utf-8'))
dictionary = {}
for line in raw.splitlines():
    match = re.match(r'^(\S+) (\S+) \[([^]]+)\] /(.*)/$', line)
    if not match:
        continue
    traditional, simplified, pinyin, definitions = match.groups()
    traditional = unicodedata.normalize('NFC', traditional)
    if not re.fullmatch(r'[\u3400-\u9fff]{2,4}', traditional):
        continue
    if re.search(r'[A-Z]', pinyin) or re.search(r'\b(?:surname|variant of|archaic|vulgar|obscene)\b', definitions, re.I):
        continue
    dictionary.setdefault(simplified, []).append(traditional)

def unique(values):
    return list(dict.fromkeys(values))

zh = unique(seed['zh'])
seen = set(zh)
for token in top_n_list('zh', 200000):
    for word in dictionary.get(token, []):
        if word not in seen:
            seen.add(word)
            zh.append(word)
        if len(zh) == 5000:
            break
    if len(zh) == 5000:
        break

excluded = set('http https www com org html htm php xml jpg gif png pdf lol lmao rofl fuck fucking fucked shit bullshit bitch asshole dick pussy cunt porn porno pornography xxx'.split())
en = unique(seed['en'])
seen = set(en)
for token in top_n_list('en', 50000):
    if re.fullmatch(r'[a-z]{2,14}', token) and token not in excluded and token not in seen:
        en.append(token)
        seen.add(token)
    if len(en) == 5000:
        break
if len(zh) != 5000 or len(en) != 5000:
    raise RuntimeError(f'Insufficient unique words: zh={len(zh)}, en={len(en)}')

data = {'zh': zh, 'en': en}
output = '// Generated word-bank DATA, CC BY-SA 4.0. See public/word-sources.json and public/licenses/.\n'
output += '// Regenerate with scripts/import-words.py; website runtime has no Python dependency.\n'
output += 'export const words = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n'
(ROOT / 'src' / 'words.js').write_text(output, encoding='utf-8')
licences = ROOT / 'public' / 'licenses'
licences.mkdir(parents=True, exist_ok=True)
metadata = distribution('wordfreq')
description = (metadata.read_text('METADATA') or '').split('\n\n', 1)[-1]
(licences / 'wordfreq-notice.md').write_text(
    '# wordfreq 3.1.1 source notice\n\nSource: https://github.com/rspeer/wordfreq\n\n'
    'Word-frequency data: CC BY-SA 4.0. Package code: Apache-2.0.\n\n' + description,
    encoding='utf-8')
(licences / 'cc-cedict-notice.txt').write_text(
    'CC-CEDICT contributors\nSource: https://www.mdbg.net/chinese/dictionary?page=cedict\n\n' + header + '\n',
    encoding='utf-8')
manifest = {
    'generatedAt': datetime.now(timezone.utc).isoformat(), 'counts': {'zh': len(zh), 'en': len(en)},
    'previousUniqueCounts': {'zh': len(set(seed['zh'])), 'en': len(set(seed['en']))},
    'license': 'CC BY-SA 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'sources': [
        {'name': 'CC-CEDICT', 'authors': 'CC-CEDICT contributors', 'url': 'https://www.mdbg.net/chinese/dictionary?page=cedict',
         'download': SOURCE, 'sha256': hashlib.sha256(source_file.read_bytes()).hexdigest(),
         'notice': 'public/licenses/cc-cedict-notice.txt'},
        {'name': 'wordfreq 3.1.1', 'authors': 'Robyn Speer, Luminoso Technologies, and contributors; underlying sources credited in notice',
         'url': 'https://github.com/rspeer/wordfreq', 'notice': 'public/licenses/wordfreq-notice.md'},
    ],
    'changes': 'Original seed words retained; Chinese traditional headwords (2–4 Han characters) selected from CC-CEDICT and ordered using wordfreq simplified-token frequency. Proper-name readings and selected variant/archaic/vulgar definitions excluded. English lowercase tokens (2–14 letters) selected by wordfreq rank with a small exclusion list. Deduplicated and limited to 5,000 per language. No definitions or corpus passages included.',
    'generatedDataSha256': hashlib.sha256(output.encode('utf-8')).hexdigest(),
}
(ROOT / 'public' / 'word-sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'counts': manifest['counts'], 'previousUniqueCounts': manifest['previousUniqueCounts'],
                  'chineseSample': zh[298:318], 'englishSample': en[371:391]}, ensure_ascii=False))
