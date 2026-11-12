import test from 'node:test';
import assert from 'node:assert/strict';
import {guardTokenIssuer} from '../pravo4u-max/edge-token-guard.js';

const req=(path,method='POST',headers={})=>new Request('https://lex.example'+path,{method,headers});
test('only protects anonymous token minting',async()=>{
 const shouldSkip=[
  req('/land/api/intake-token','GET'),req('/security/api/intake-config','GET'),
  req('/max/webhook'),req('/api/pay/result'),req('/compose'),req('/land/api/leads')
 ];
 for(const request of shouldSkip){
  let used=false;
  const result=await guardTokenIssuer(request,{LEX_TOKEN_RATE_LIMITER:{limit:async()=>{used=true;return {success:false}}}});
  assert.equal(result,null);
  assert.equal(used,false);
 }
});
test('rate-limits token routes by route, not by client details',async()=>{
 for(const path of ['/land/api/intake-token','/security/api/intake-token']){
  let got;
  const denied=await guardTokenIssuer(req(path,'POST',{'cf-connecting-ip':'203.0.113.12'}),{
   LEX_TOKEN_RATE_LIMITER:{limit:async({key})=>{got=key;return {success:false}}}
  });
  assert.equal(got,path);
  assert.equal(denied.status,429);
  assert.equal(denied.headers.get('retry-after'),'60');
  assert.equal((await denied.json()).error,'rate_limited');
 }
});
test('allows requests below quota',async()=>{
 assert.equal(await guardTokenIssuer(req('/land/api/intake-token'),{
  LEX_TOKEN_RATE_LIMITER:{limit:async()=>({success:true})}
 }),null);
});
test('rejects oversized declared request bodies',async()=>{
 let called=false;
 const result=await guardTokenIssuer(req('/land/api/intake-token','POST',{'content-length':'3000'}),{
  LEX_TOKEN_RATE_LIMITER:{limit:async()=>{called=true;return {success:true}}}
 });
 assert.equal(result.status,413);assert.equal(called,false);
});
test('unavailable optional Cloudflare binding never creates an outage',async()=>{
 assert.equal(await guardTokenIssuer(req('/land/api/intake-token'),{}),null);
 const originalWarn=console.warn;console.warn=()=>{};
 try{
  assert.equal(await guardTokenIssuer(req('/land/api/intake-token'),{
   LEX_TOKEN_RATE_LIMITER:{limit:async()=>{throw Error('failed')}}
  }),null);
 }finally{console.warn=originalWarn}
});
