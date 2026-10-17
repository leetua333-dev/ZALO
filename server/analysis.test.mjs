import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePrompt,analyzeSession,groundedReply,matchReflection,retrieve} from './analysis.mjs';
import {documents,makeSessions} from './seed.mjs';

test('Rubric distinguishes delegation, clarification, decomposition and challenge',()=>{
  assert.equal(analyzePrompt('Viết giúp em một bài phân tích để em nộp.').score,1);
  assert.equal(analyzePrompt('Ý nghĩa hình ảnh vầng trăng là gì?').score,2);
  assert.equal(analyzePrompt('Hãy chia nhỏ và so sánh từng phần của hai câu luận.').score,3);
  const challenge=analyzePrompt('Em không đồng ý. Dẫn chứng nào hỗ trợ cách hiểu khác?');
  assert.equal(challenge.score,4); assert.ok(challenge.tags.includes('Yêu cầu dẫn chứng'));
  assert.ok(challenge.reason.length>20);
});
test('retrieval excludes unapproved sources and other sessions’ documents',()=>{
  assert.equal(retrieve('xiên ngang rêu đá',documents,'banh-troi').length,0);
  const pending=documents.map(d=>({...d,approved:false}));
  assert.equal(retrieve('xiên ngang rêu đá',pending,'tu-tinh').length,0);
  const chunks=retrieve('xiên ngang rêu đá',documents,'tu-tinh');
  assert.ok(chunks.length>0);
  for(const c of chunks){assert.equal(c.documentId,'tu-tinh');assert.ok(documents[0].content.includes(c.content));}
});
test('unsupported questions abstain; delegation returns scaffolding rather than an essay',()=>{
  assert.equal(groundedReply('quantum xylophone zeppelin',documents,'tu-tinh').citations.length,0);
  assert.match(groundedReply('quantum xylophone zeppelin',documents,'tu-tinh').content,/chưa tìm thấy/);
  assert.match(groundedReply('Viết giúp em một bài phân tích',documents,'tu-tinh').content,/thay vì viết bài/);
});
test('reflection overlap uses assistant text only and preserves exact original offsets',()=>{
  const text='Em nhận ra việc đọc lại từng câu thơ rất cần thiết.';
  const result=matchReflection(text,[{role:'assistant',content:text}]);
  assert.equal(result.overlapPercent,100);assert.equal(result.spans.length,1);
  assert.equal(text.slice(result.spans[0].start,result.spans[0].end),text.slice(0,-1));
  assert.equal(matchReflection(text,[{role:'user',content:text}]).overlapPercent,0);
  const decomposed=text.normalize('NFD');
  const nfd=matchReflection(decomposed,[{role:'assistant',content:text}]);
  assert.equal(nfd.overlapPercent,100);assert.equal(decomposed.slice(nfd.spans[0].start,nfd.spans[0].end),decomposed.slice(0,-1));
});
test('demo reflections fit the submission range and flags have traceable evidence',()=>{
  const sessions=makeSessions(groundedReply);
  for(const s of sessions){const a=analyzeSession(s);if(s.reflection){assert.ok(a.reflection.wordCount>=300&&a.reflection.wordCount<=500);}else assert.equal(a.suggestedGrade,null);}
  const a=analyzeSession(sessions[1]);
  assert.ok(a.reviewReasons.includes('Có yêu cầu làm hộ'));assert.ok(a.reflection.overlapPercent>=20);assert.ok(a.reflection.spans.length>0);
});
