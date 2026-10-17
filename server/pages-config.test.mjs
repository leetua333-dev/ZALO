import test from 'node:test';
import assert from 'node:assert/strict';
import {configurePages} from '../scripts/configure-pages.mjs';

const site={build_type:'legacy',source:{branch:'gh-pages',path:'/'},html_url:'https://example.github.io/project/'};
const missing=()=>Object.assign(new Error('Not found'),{httpStatus:404});
test('Pages configuration creates missing site and verifies the source before requesting a build',async()=>{
  const calls=[];let created=false;
  const request=async(method,path,body)=>{
    calls.push({method,path,body});
    if(path==='repos/leetua333-dev/ZALO')return {archived:false};
    if(path.endsWith('/pages')&&method==='GET'){if(!created)throw missing();return site;}
    if(path.endsWith('/pages')&&method==='POST'){created=true;return site;}
    if(path.endsWith('/latest'))throw missing();
    if(path.endsWith('/builds')&&method==='POST')return {status:'queued'};
    throw new Error('Unexpected request');
  };
  const result=await configurePages({request});
  assert.equal(result.changed,true);assert.equal(result.buildStatus,'queued');
  const mutation=calls.find(c=>c.method==='POST'&&c.path.endsWith('/pages'));
  assert.deepEqual(mutation.body,{build_type:'legacy',source:{branch:'gh-pages',path:'/'}});
});
test('Pages configuration leaves an existing correct, built website unchanged',async()=>{
  const request=async(method,path)=>{assert.equal(method,'GET');return path.endsWith('/latest')?{status:'built'}:path.endsWith('/pages')?site:{};};
  const result=await configurePages({request});assert.equal(result.changed,false);assert.equal(result.buildStatus,'built');
});
test('Pages configuration updates an incorrect source without replacing custom domain settings',async()=>{
  let corrected=false;const writes=[];
  const request=async(method,path,body)=>{
    if(method==='PUT'){writes.push(body);corrected=true;return site;}
    if(method==='POST')return {status:'queued'};
    if(path.endsWith('/latest'))return {status:'built'};
    if(path.endsWith('/pages'))return corrected?site:{build_type:'workflow',source:{branch:'main',path:'/'},cname:'class.example.org'};
    return {};
  };
  assert.equal((await configurePages({request})).changed,true);
  assert.equal(writes.length,1);assert.equal('cname' in writes[0],false);
});
test('Pages configuration stops on access denial and does not guess a new credential',async()=>{
  const calls=[];
  const request=async(method,path)=>{calls.push(method);if(path.endsWith('/pages'))throw Object.assign(new Error('Forbidden'),{httpStatus:403});return {};};
  await assert.rejects(configurePages({request}),/Forbidden/);assert.deepEqual(calls,['GET','GET']);
});
test('Pages configuration reports a queued build when GitHub says a build is already running',async()=>{
  const request=async(method,path)=>{
    if(method==='POST')throw Object.assign(new Error('Build in progress'),{httpStatus:409});
    if(path.endsWith('/latest'))return {status:'errored'};
    if(path.endsWith('/pages'))return site;
    return {};
  };
  const result=await configurePages({request});assert.equal(result.changed,false);assert.equal(result.buildStatus,'queued');
});
