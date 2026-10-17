import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Uses the existing GitHub CLI authentication. Never reads or prints tokens.
export async function configurePages({request,repository='leetua333-dev/ZALO'}) {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))throw new Error('Tên kho GitHub không hợp lệ.');
  const endpoint=`repos/${repository}`;
  const repo=await request('GET',endpoint);
  if(repo.archived||repo.disabled)throw new Error('Kho đang lưu trữ hoặc vô hiệu hóa; chưa thể cấu hình website.');
  let previous;
  try {previous=await request('GET',`${endpoint}/pages`);}
  catch(error){if(error.httpStatus!==404)throw error;}
  const correct=previous?.build_type==='legacy'&&previous?.source?.branch==='gh-pages'&&previous?.source?.path==='/';
  if(!correct)await request(previous?'PUT':'POST',`${endpoint}/pages`,{build_type:'legacy',source:{branch:'gh-pages',path:'/'}});
  const site=correct?previous:await request('GET',`${endpoint}/pages`);
  if(site?.source?.branch!=='gh-pages'||site?.source?.path!=='/'||site?.build_type!=='legacy')throw new Error('GitHub chưa xác nhận cấu hình gh-pages / (root).');
  let build;
  try {build=await request('GET',`${endpoint}/pages/builds/latest`);}
  catch(error){if(error.httpStatus!==404)throw error;}
  if(!correct||!build||build.status==='errored') {
    try {build=await request('POST',`${endpoint}/pages/builds`,{});}
    catch(error){if(error.httpStatus!==409)throw error;build={status:'queued'};}
  }
  return {repository,changed:!correct,source:site.source,url:site.html_url||null,buildStatus:build?.status||'pending',buildError:build?.error?.message||null};
}

export function githubRequest(method,endpoint,body) {
  const args=['api','--method',method,'-H','Accept: application/vnd.github+json','-H','X-GitHub-Api-Version: 2022-11-28',endpoint];
  if(body!==undefined)args.push('--input','-');
  try {
    const text=execFileSync('gh',args,{encoding:'utf8',input:body===undefined?undefined:JSON.stringify(body),stdio:['pipe','pipe','pipe']});
    return text.trim()?JSON.parse(text):{};
  } catch(cause) {
    const detail=String(cause.stderr||'');
    const status=detail.match(/HTTP (\d{3})/);
    const error=new Error(status?`GitHub API trả HTTP ${status[1]} khi ${method} ${endpoint}.`:detail.includes('Forbidden')||detail.includes('Tunnel')?'Mạng đang chặn API GitHub. Hãy áp dụng tên miền api.github.com trong cài đặt môi trường.':detail.includes('authentication')||detail.includes('auth login')?'Xác thực GitHub hiện có chưa dùng được cho API quản trị Pages.':'Không gọi được GitHub API. Kiểm tra kết nối và quyền Pages của tài khoản.');
    error.httpStatus=status?Number(status[1]):undefined;
    throw error;
  }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  configurePages({request:githubRequest}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
