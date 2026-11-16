import { mkdir,copyFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const destination=new URL('apps/web-client/public/fixtures/',root);
await mkdir(destination,{recursive:true});
for(const file of ['success.json','no-ack.json','catalog.json'])await copyFile(new URL(`artifacts/m1/${file}`,root),new URL(file,destination));
