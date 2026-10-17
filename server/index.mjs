import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { analyzeSession, groundedReply, wordCount } from './analysis.mjs';
import { documents, makeSessions } from './seed.mjs';
import { populateGradeWorkbook } from './workbook.mjs';

export function createApp({ dbPath = process.env.SMARTLIT_DB_PATH || resolve('.data/smartlit.db') } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), {recursive:true,mode:0o700});
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  const put = (table,item) => db.prepare(`INSERT INTO ${table} (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(item.id,JSON.stringify(item));
  const all = table => db.prepare(`SELECT data FROM ${table}`).all().map(row => JSON.parse(row.data));
  const get = (table,id) => { const row = db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id); return row ? JSON.parse(row.data) : null; };
  if (!db.prepare("SELECT value FROM metadata WHERE key='seeded'").get()) {
    db.exec('BEGIN');
    try {
      for (const d of documents) put('documents',d);
      for (const s of makeSessions(groundedReply)) put('sessions',s);
      db.prepare('INSERT INTO metadata(key,value) VALUES (?,?)').run('seeded','1');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit:'256kb'}));
  app.use('/api', (req,res,next) => {
    res.set('Cache-Control','no-store');
    if (['POST','PATCH','PUT'].includes(req.method) && !req.is('application/json')) return res.status(415).json({error:'Yêu cầu cần gửi dữ liệu JSON.'});
    if (['POST','PATCH','PUT'].includes(req.method) && (!req.body || Array.isArray(req.body))) return res.status(400).json({error:'Dữ liệu yêu cầu không hợp lệ.'});
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin')) {
      try { if (new URL(req.get('origin')).host !== req.get('host')) return res.status(403).json({error:'Nguồn yêu cầu không hợp lệ.'}); }
      catch { return res.status(403).json({error:'Nguồn yêu cầu không hợp lệ.'}); }
    }
    next();
  });
  const fail = (res,message,status=400) => res.status(status).json({error:message});
  const validString = (x,min,max) => typeof x === 'string' && x.trim().length >= min && x.trim().length <= max;
  const enriched = s => ({...s,analysis:analyzeSession(s)});
  app.get('/api/health',(_req,res) => res.json({status:'ok',engine:'local-extractive',database:db.prepare('SELECT 1 AS ready').get().ready===1}));
  app.get('/api/state',(_req,res) => res.json({sessions:all('sessions').sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map(enriched),documents:all('documents'),mode:'research-demo'}));
  app.post('/api/sessions',(req,res) => {
    const {name,topic,documentId,className='11A1'} = req.body;
    if (!validString(name,2,80) || !validString(topic,3,180) || !['11A1','11A2'].includes(className)) return fail(res,'Kiểm tra tên học sinh, chủ đề và lớp học.');
    const doc = get('documents',String(documentId));
    if (!doc?.approved) return fail(res,'Chọn ngữ liệu đã được giáo viên duyệt.');
    const now = new Date().toISOString();
    const session = {id:randomUUID(),name:name.trim(),initials:name.trim().split(/\s+/).slice(-2).map(s=>s[0]).join('').toUpperCase(),color:'mint',className,topic:topic.trim(),documentId,messages:[],reflection:'',teacherGrade:null,teacherComment:'',createdAt:now,updatedAt:now,demo:false};
    put('sessions',session); res.status(201).json(enriched(session));
  });
  app.post('/api/sessions/:id/messages',(req,res) => {
    const session=get('sessions',req.params.id);
    if (!session) return fail(res,'Không tìm thấy phiên học.',404);
    if (!validString(req.body.content,2,3000)) return fail(res,'Câu lệnh cần có 2–3.000 ký tự.');
    const content=req.body.content.trim(); const createdAt=new Date().toISOString();
    const reply=groundedReply(content,all('documents'),session.documentId);
    session.messages.push({id:randomUUID(),role:'user',content,createdAt},{id:randomUUID(),role:'assistant',...reply,createdAt});
    session.teacherGrade=null; session.teacherComment=''; session.updatedAt=createdAt;
    put('sessions',session); res.json(enriched(session));
  });
  app.post('/api/sessions/:id/reflection',(req,res) => {
    const session=get('sessions',req.params.id);
    if (!session) return fail(res,'Không tìm thấy phiên học.',404);
    if (!validString(req.body.content,1,15000)) return fail(res,'Bài phản tư không hợp lệ.');
    const count=wordCount(req.body.content);
    if (count<300 || count>500) return fail(res,`Bài phản tư hiện có ${count} từ; cần từ 300 đến 500 từ.`);
    if (!session.messages.some(m=>m.role==='user')) return fail(res,'Hãy trao đổi với trợ lý trước khi nộp bài phản tư.');
    session.reflection=req.body.content.trim(); session.updatedAt=new Date().toISOString(); session.teacherGrade=null; session.teacherComment='';
    put('sessions',session); res.json(enriched(session));
  });
  app.patch('/api/sessions/:id/grade',(req,res) => {
    const session=get('sessions',req.params.id);
    if (!session) return fail(res,'Không tìm thấy phiên học.',404);
    const {grade,comment}=req.body;
    if (typeof grade !== 'number' || !Number.isFinite(grade) || grade<0 || grade>10 || !validString(comment,5,3000)) return fail(res,'Điểm cần từ 0 đến 10 và nhận xét cần ít nhất 5 ký tự.');
    if (!session.reflection) return fail(res,'Cần có bài phản tư trước khi xác nhận điểm.');
    session.teacherGrade=Math.round(grade*10)/10; session.teacherComment=comment.trim(); session.updatedAt=new Date().toISOString();
    put('sessions',session); res.json(enriched(session));
  });
  app.post('/api/documents',(req,res) => {
    const {title,author,content,source}=req.body;
    if (!validString(title,2,150)||!validString(author,2,150)||!validString(content,50,50000)||!validString(source,5,1000)) return fail(res,'Điền tên tác phẩm, tác giả, nguồn và ngữ liệu (50–50.000 ký tự).');
    const document={id:randomUUID(),title:title.trim(),author:author.trim(),content:content.trim(),source:source.trim(),category:'Ngữ liệu bổ sung',grade:'',approved:false};
    put('documents',document); res.status(201).json(document);
  });
  app.patch('/api/documents/:id',(req,res) => {
    const document=get('documents',req.params.id);
    if (!document) return fail(res,'Không tìm thấy ngữ liệu.',404);
    if (typeof req.body.approved !== 'boolean') return fail(res,'Trạng thái duyệt không hợp lệ.');
    document.approved=req.body.approved; put('documents',document); res.json(document);
  });
  app.get('/api/export/grades.xlsx',async(req,res,next) => {
    try {
      const book=populateGradeWorkbook(new ExcelJS.Workbook(),all('sessions').filter(s=>!req.query.className||s.className===req.query.className));
      res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition','attachment; filename="SmartLit-diem-qua-trinh.xlsx"');
      await book.xlsx.write(res); res.end();
    } catch(error) {next(error);}
  });
  app.use('/api',(_req,res) => fail(res,'Không tìm thấy tài nguyên.',404));
  const dist=resolve('dist');
  if (existsSync(dist)) { app.use(express.static(dist)); app.get('/{*path}',(_req,res)=>res.sendFile(resolve(dist,'index.html'))); }
  app.use((error,_req,res,_next)=> { if (!['entity.too.large','entity.parse.failed'].includes(error.type)) console.error(error.message); res.status(error.type==='entity.too.large'?413:error.type==='entity.parse.failed'?400:500).json({error:error.type==='entity.too.large'?'Nội dung vượt quá giới hạn.':error.type==='entity.parse.failed'?'Dữ liệu JSON không hợp lệ.':'Không thể xử lý yêu cầu. Vui lòng thử lại.'}); });
  return {app,db};
}
if (process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  const {app,db}=createApp(); const port=Number(process.env.PORT||3001);
  const server=app.listen(port,'0.0.0.0',()=>console.log(`SmartLit API ready on port ${port} (research demo)`));
  for (const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
}
