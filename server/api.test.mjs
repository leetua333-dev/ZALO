import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
import {createApp} from './index.mjs';

async function harness(t,dbPath=':memory:') {
  const {app,db}=createApp({dbPath});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(path,body,method=body?'POST':'GET')=>{
    const response=await fetch(`${base}/api${path}`,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json()};
  };
  return {request,base};
}
test('state is seeded once and database answers readiness checks',async t=>{
  const {request}=await harness(t);assert.equal((await request('/health')).data.database,true);
  const {data}=await request('/state');assert.equal(data.sessions.length,8);assert.equal(data.documents.length,3);assert.equal(data.mode,'research-demo');
  assert.equal(data.sessions.find(s=>s.id==='s1').teacherGrade,9);
});
test('complete workflow: corpus approval, session, grounded chat, reflection, teacher grade',async t=>{
  const {request}=await harness(t);
  const added=await request('/documents',{title:'Nguồn thử nghiệm',author:'Nhóm nghiên cứu',source:'Tài liệu tự biên soạn cho kiểm thử.',content:'Hình ảnh dòng sông gợi sự vận động liên tục của thời gian. Người đọc cần chứng minh nhận định bằng từ ngữ và cấu trúc của văn bản.'});
  assert.equal(added.status,201);assert.equal(added.data.approved,false);
  const body={name:'Học sinh thử nghiệm',className:'11A2',topic:'Phân tích hình ảnh dòng sông',documentId:added.data.id};
  assert.equal((await request('/sessions',body)).status,400);
  await request(`/documents/${added.data.id}`,{approved:true},'PATCH');
  const created=await request('/sessions',body);assert.equal(created.status,201);const id=created.data.id;
  const chatted=await request(`/sessions/${id}/messages`,{content:'Hãy so sánh dòng sông và thời gian, chỉ ra dẫn chứng.'});
  assert.equal(chatted.status,200);assert.equal(chatted.data.messages.length,2);
  assert.ok(chatted.data.messages[1].citations.length>0);
  assert.equal((await request(`/sessions/${id}/grade`,{grade:8,comment:'Chưa đủ dữ liệu.'},'PATCH')).status,400);
  assert.equal((await request(`/sessions/${id}/reflection`,{content:'Bài quá ngắn.'})).status,400);
  const fixture=(await request('/state')).data.sessions.find(s=>s.id==='s1').reflection;
  assert.equal((await request(`/sessions/${id}/reflection`,{content:fixture})).status,200);
  const approved=await request(`/sessions/${id}/grade`,{grade:8.5,comment:'Biết tìm dẫn chứng, cần làm rõ lập luận riêng.'},'PATCH');
  assert.equal(approved.data.teacherGrade,8.5);
  assert.equal((await request(`/sessions/${id}/grade`,{grade:11,comment:'Điểm vượt thang.'},'PATCH')).status,400);
  await request(`/documents/${added.data.id}`,{approved:false},'PATCH');
  const followup=await request(`/sessions/${id}/messages`,{content:'Hình ảnh dòng sông và thời gian có liên hệ nào?'});
  assert.equal(followup.data.messages.at(-1).citations.length,0);
  assert.equal(followup.data.teacherGrade,null,'new evidence invalidates the previous grade');
});
test('Excel separates tentative suggestions from confirmed teacher grades',async t=>{
  const {base}=await harness(t);const response=await fetch(`${base}/api/export/grades.xlsx?className=11A1`);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/spreadsheetml/);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const sheet=workbook.worksheets[0];assert.equal(sheet.rowCount,9);
  const rows=[];sheet.eachRow((row,index)=>{if(index>1)rows.push(row.values);});
  assert.equal(rows.find(r=>r[1]==='Nguyễn Minh Anh')[8],9);
  assert.equal(rows.find(r=>r[1]==='Lê Phương Linh')[8],undefined);
  assert.ok(rows.find(r=>r[1]==='Lê Phương Linh')[7]>0);
});
test('foreign origins, malformed inputs and nonexistent sessions fail safely',async t=>{
  const {request,base}=await harness(t);
  const response=await fetch(`${base}/api/sessions`,{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,403);
  assert.equal((await request('/sessions',{})).status,400);
  assert.equal((await request('/sessions/absent/messages',{content:'Câu hỏi hợp lệ'})).status,404);
  assert.equal((await request('/sessions/s1/messages',{content:5})).status,400);
  const bad=await fetch(`${base}/api/sessions`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});assert.equal(bad.status,400);
});
test('new sessions survive closing and reopening SQLite without duplicate seed data',async t=>{
  const folder=mkdtempSync(join(tmpdir(),'smartlit-db-test-'));const dbPath=join(folder,'data.db');
  t.after(()=>rmSync(folder,{recursive:true,force:true}));
  const first=createApp({dbPath});const statement=first.db.prepare('INSERT INTO sessions(id,data) VALUES (?,?)');
  const fixture=JSON.parse(first.db.prepare("SELECT data FROM sessions WHERE id='s1'").get().data);fixture.id='persisted-test';statement.run(fixture.id,JSON.stringify(fixture));first.db.close();
  const second=createApp({dbPath});assert.equal(second.db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count,9);second.db.close();
});
