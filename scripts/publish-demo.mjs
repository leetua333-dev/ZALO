import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(root,'dist-demo');
const git=(args,options={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',...options}).trim();
if(!existsSync(join(output,'index.html'))||!existsSync(join(output,'assets')))throw new Error('Chạy npm run build:demo trước khi xuất bản.');
function checkFiles(folder){for(const item of readdirSync(folder,{withFileTypes:true})){const path=join(folder,item.name);if(item.isSymbolicLink())throw new Error('Không xuất bản liên kết tượng trưng.');if(item.isDirectory())checkFiles(path);else if(/(^\.env|\.(sqlite|db|log)$)/i.test(item.name))throw new Error('Thư mục xuất bản chứa tệp không phù hợp.');}}
checkFiles(output);
writeFileSync(join(output,'.nojekyll'),'');
const metadata=git(['rev-parse','--absolute-git-dir']);
const temporary=mkdtempSync(join(tmpdir(),'smartlit-publish-'));
try {
  const env={...process.env,GIT_INDEX_FILE:join(temporary,'index')};
  const artifactArgs=[`--git-dir=${metadata}`,`--work-tree=${output}`];
  git([...artifactArgs,'read-tree','--empty'],{env});
  git([...artifactArgs,'add','--all'],{env});
  const tree=git([...artifactArgs,'write-tree'],{env});
  const previous=git(['ls-remote','origin','refs/heads/gh-pages']);
  const parent=previous?previous.split(/\s+/)[0]:null;
  if(parent)git(['fetch','--no-tags','origin','refs/heads/gh-pages']);
  const commit=git(['commit-tree',tree,...(parent?['-p',parent]:[]),'-m','Deploy SmartLit browser demo']);
  const publish=process.argv.includes('--push');
  // Separate index keeps the application checkout and staged source unchanged.
  // No force push, credential extraction, or application database is involved.
  const result=git(['push',...(publish?[]:['--dry-run']),'origin',`${commit}:refs/heads/gh-pages`]);
  if(result)console.log(result);
  console.log(publish?'Published demo files to gh-pages. Enable GitHub Pages from this branch to activate the website.':'Dry run passed. No remote branch was changed.');
} finally {rmSync(temporary,{recursive:true,force:true});}
