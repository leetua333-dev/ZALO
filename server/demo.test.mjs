import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoStore, DEMO_STORAGE_KEY } from '../src/demo-store.mjs';

function memoryStorage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
test('public demo preserves each visitor’s sessions and does not share browser data',()=>{
  const storage=memoryStorage(),store=createDemoStore(storage);
  const initial=store.request('/state');assert.equal(initial.mode,'browser-demo');assert.equal(initial.sessions.length,8);
  const session=store.request('/sessions',{method:'POST',body:{name:'Học sinh trình duyệt',topic:'Đọc hai câu luận',documentId:'tu-tinh',className:'11A2'}});
  assert.equal(createDemoStore(storage).request('/state').sessions.length,9);
  assert.equal(createDemoStore(memoryStorage()).request('/state').sessions.length,8);
  assert.equal(store.request('/state').sessions.find(s=>s.id===session.id).className,'11A2');
});
test('browser demo supports the approved-corpus → chat → reflection → confirmed grade workflow',()=>{
  const store=createDemoStore(memoryStorage());
  const doc=store.request('/documents',{method:'POST',body:{title:'Dòng sông',author:'Nhóm thử nghiệm',source:'Văn bản tự biên soạn.',content:'Hình ảnh dòng sông gợi sự vận động liên tục của thời gian. Người đọc cần chứng minh nhận định bằng từ ngữ trong văn bản.'}});
  const create={method:'POST',body:{name:'Người học mẫu',topic:'Khám phá dòng sông',documentId:doc.id}};
  assert.throws(()=>store.request('/sessions',create),/đã được giáo viên duyệt/);
  store.request(`/documents/${doc.id}`,{method:'PATCH',body:{approved:true}});
  const session=store.request('/sessions',create),root=`/sessions/${session.id}`;
  const chatted=store.request(root+'/messages',{method:'POST',body:{content:'Vì sao dòng sông gợi thời gian? Hãy chỉ ra dẫn chứng.'}});
  assert.ok(chatted.messages.at(-1).citations.length>0);
  assert.throws(()=>store.request(root+'/reflection',{method:'POST',body:{content:'Bài ngắn.'}}),/300 đến 500/);
  const reflection=store.request('/state').sessions.find(s=>s.id==='s1').reflection;
  store.request(root+'/reflection',{method:'POST',body:{content:reflection}});
  const graded=store.request(root+'/grade',{method:'PATCH',body:{grade:8.5,comment:'Biết đối chiếu nguồn và giải thích cách hiểu.'}});
  assert.equal(graded.teacherGrade,8.5);
  store.request(`/documents/${doc.id}`,{method:'PATCH',body:{approved:false}});
  const changed=store.request(root+'/messages',{method:'POST',body:{content:'Hình ảnh dòng sông có ý nghĩa gì?'}});
  assert.equal(changed.messages.at(-1).citations.length,0);assert.equal(changed.teacherGrade,null);
});
test('storage errors do not silently reset data or report unsuccessful changes as saved',()=>{
  const storage=memoryStorage();storage.setItem(DEMO_STORAGE_KEY,'broken data');
  assert.throws(()=>createDemoStore(storage).request('/state'),/được giữ nguyên/);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY),'broken data');
  const good=memoryStorage();const store=createDemoStore(good);store.request('/state');
  const previous=good.getItem(DEMO_STORAGE_KEY);good.setItem=()=>{throw new Error('Quota exceeded');};
  assert.throws(()=>store.request('/sessions/s1/messages',{method:'POST',body:{content:'Em muốn phân tích câu luận.'}}),/chưa được lưu/);
  assert.equal(good.getItem(DEMO_STORAGE_KEY),previous);
});
test('browser demo rejects invalid grades, missing sessions and invalid approval flags',()=>{
  const store=createDemoStore(memoryStorage());
  assert.throws(()=>store.request('/sessions/s1/grade',{method:'PATCH',body:{grade:11,comment:'Điểm không hợp lệ.'}}),/0 đến 10/);
  assert.throws(()=>store.request('/sessions/missing/messages',{method:'POST',body:{content:'Câu hỏi mới.'}}),/Không tìm thấy/);
  assert.throws(()=>store.request('/documents/tu-tinh',{method:'PATCH',body:{approved:'yes'}}),/không hợp lệ/);
});
