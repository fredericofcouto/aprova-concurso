import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cache=new Map();
export function readModule(relative){
 const path=resolve(root,relative);if(cache.has(path))return cache.get(path);
 if(extname(path)==='.json')return JSON.parse(readFileSync(path,'utf8'));
 const result={exports:{}};
 const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;
 vm.runInNewContext(source,{module:result,exports:result.exports,require(name){if(!name.startsWith('.'))throw Error('Unexpected import');const full=resolve(dirname(path),name);return readModule(full+(extname(full)?'':'.ts'));},console});
 cache.set(path,result.exports);return result.exports;
}
export function readBank(){return readModule('data/bank.ts').curatedBank;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const bank=readBank();const offset=Number(process.argv[2]||0);const size=Number(process.argv[3]||bank.length);
 console.log(JSON.stringify(bank.slice(offset,offset+size)));
}
