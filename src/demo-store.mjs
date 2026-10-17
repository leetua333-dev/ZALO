import { analyzeSession, groundedReply, wordCount } from '../server/analysis.mjs';
import { documents, makeSessions } from '../server/seed.mjs';

export const DEMO_STORAGE_KEY = 'smartlit.demo.v1';
const validString = (value,min,max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const enrich = session => ({...session,analysis:analyzeSession(session)});

// The public demo keeps each visitor's data in their own browser. No server calls.
// Storage is injected so the same workflow can be verified without a browser.
export function createDemoStore(storage) {
  const write = data => {
    try { storage.setItem(DEMO_STORAGE_KEY,JSON.stringify(data)); }
    catch { throw new Error('Không lưu được dữ liệu trong trình duyệt. Kiểm tra dung lượng và quyền lưu trữ; thay đổi này chưa được lưu.'); }
  };
  const read = () => {
    let raw;
    try { raw=storage.getItem(DEMO_STORAGE_KEY); }
    catch { throw new Error('Trình duyệt đang chặn lưu trữ. Hãy cho phép dữ liệu trang web để mở bản dùng thử.'); }
    if (raw === null) {
      const data={version:1,documents:structuredClone(documents),sessions:makeSessions(groundedReply)};
      write(data); return data;
    }
    try {
      const data=JSON.parse(raw);
      if(data.version!==1 || !Array.isArray(data.documents) || !Array.isArray(data.sessions) || !data.sessions.every(s=>typeof s.id==='string'&&Array.isArray(s.messages))) throw new Error('Invalid data');
      return data;
    } catch { throw new Error('Dữ liệu thử nghiệm trong trình duyệt không đọc được. Dữ liệu cũ được giữ nguyên; hãy dùng trình duyệt khác để tiếp tục thử.'); }
  };
  const requireSession = (data,id) => {
    const session=data.sessions.find(s=>s.id===id);
    if(!session) throw new Error('Không tìm thấy phiên học.');
    return session;
  };
  return {
    request(path,{method='GET',body}={}) {
      const data=read();
      if(method==='GET'&&path==='/state') return {sessions:data.sessions.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(enrich),documents:data.documents,mode:'browser-demo'};
      if(method==='GET'&&path==='/health') return {status:'ok',engine:'local-extractive',storage:'browser'};
      if(!body || typeof body!=='object' || Array.isArray(body)) throw new Error('Dữ liệu yêu cầu không hợp lệ.');
      if(method==='POST'&&path==='/sessions') {
        const {name,topic,documentId,className='11A1'}=body;
        if(!validString(name,2,80)||!validString(topic,3,180)||!['11A1','11A2'].includes(className)) throw new Error('Kiểm tra tên học sinh, chủ đề và lớp học.');
        if(!data.documents.some(d=>d.id===documentId&&d.approved)) throw new Error('Chọn ngữ liệu đã được giáo viên duyệt.');
        const now=new Date().toISOString();
        const session={id:crypto.randomUUID(),name:name.trim(),initials:name.trim().split(/\s+/).slice(-2).map(s=>s[0]).join('').toUpperCase(),color:'mint',className,topic:topic.trim(),documentId,messages:[],reflection:'',teacherGrade:null,teacherComment:'',createdAt:now,updatedAt:now,demo:false};
        data.sessions.push(session);write(data);return enrich(session);
      }
      const match=path.match(/^\/sessions\/([^/]+)\/(messages|reflection|grade)$/);
      if(match) {
        const session=requireSession(data,match[1]);
        const action=match[2];
        if(method==='POST'&&action==='messages') {
          if(!validString(body.content,2,3000)) throw new Error('Câu lệnh cần có 2–3.000 ký tự.');
          const content=body.content.trim(),createdAt=new Date().toISOString();
          const reply=groundedReply(content,data.documents,session.documentId);
          session.messages.push({id:crypto.randomUUID(),role:'user',content,createdAt},{id:crypto.randomUUID(),role:'assistant',...reply,createdAt});
          session.teacherGrade=null;session.teacherComment='';
        } else if(method==='POST'&&action==='reflection') {
          if(!validString(body.content,1,15000)) throw new Error('Bài phản tư không hợp lệ.');
          const count=wordCount(body.content);
          if(count<300||count>500) throw new Error(`Bài phản tư hiện có ${count} từ; cần từ 300 đến 500 từ.`);
          if(!session.messages.some(m=>m.role==='user')) throw new Error('Hãy trao đổi với trợ lý trước khi nộp bài phản tư.');
          session.reflection=body.content.trim();session.teacherGrade=null;session.teacherComment='';
        } else if(method==='PATCH'&&action==='grade') {
          if(typeof body.grade!=='number'||!Number.isFinite(body.grade)||body.grade<0||body.grade>10||!validString(body.comment,5,3000)) throw new Error('Điểm cần từ 0 đến 10 và nhận xét cần ít nhất 5 ký tự.');
          if(!session.reflection) throw new Error('Cần có bài phản tư trước khi xác nhận điểm.');
          session.teacherGrade=Math.round(body.grade*10)/10;session.teacherComment=body.comment.trim();
        } else throw new Error('Yêu cầu không được hỗ trợ.');
        session.updatedAt=new Date().toISOString();write(data);return enrich(session);
      }
      if(method==='POST'&&path==='/documents') {
        const {title,author,content,source}=body;
        if(!validString(title,2,150)||!validString(author,2,150)||!validString(content,50,50000)||!validString(source,5,1000)) throw new Error('Điền tên tác phẩm, tác giả, nguồn và ngữ liệu (50–50.000 ký tự).');
        const document={id:crypto.randomUUID(),title:title.trim(),author:author.trim(),content:content.trim(),source:source.trim(),category:'Ngữ liệu bổ sung',grade:'',approved:false};
        data.documents.push(document);write(data);return document;
      }
      const docMatch=path.match(/^\/documents\/([^/]+)$/);
      if(method==='PATCH'&&docMatch) {
        const document=data.documents.find(d=>d.id===docMatch[1]);
        if(!document) throw new Error('Không tìm thấy ngữ liệu.');
        if(typeof body.approved!=='boolean') throw new Error('Trạng thái duyệt không hợp lệ.');
        document.approved=body.approved;write(data);return document;
      }
      throw new Error('Không tìm thấy chức năng trong bản dùng thử.');
    }
  };
}
