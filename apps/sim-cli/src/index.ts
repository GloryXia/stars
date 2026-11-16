import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildM1Timeline, PUBLIC_CATALOG } from '@stars/sim-core';
const root = fileURLToPath(new URL('../../../',import.meta.url));
const output = resolve(root,'artifacts/m1');
await mkdir(output,{recursive:true});
for (const branch of ['success','no-ack','unavailable'] as const) {
  await writeFile(resolve(output,`${branch}.json`),JSON.stringify(buildM1Timeline(branch),null,2)+'\n');
}
await writeFile(resolve(output,'catalog.json'),JSON.stringify(PUBLIC_CATALOG,null,2)+'\n');
console.log(`Exported seat-only M1 timelines and public catalog to ${output}`);
