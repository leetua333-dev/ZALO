import { analyzeSession } from './analysis.mjs';

export function populateGradeWorkbook(book,sessions) {
  book.creator='SmartLit AI';
  const sheet=book.addWorksheet('Điểm quá trình');
  sheet.columns=[{header:'Học sinh',key:'name',width:26},{header:'Lớp',key:'className',width:10},{header:'Chủ đề',key:'topic',width:50},{header:'Prompt (/4)',key:'prompt',width:16},{header:'Số từ phản tư',key:'words',width:18},{header:'Trùng từ vựng (%)',key:'overlap',width:20},{header:'Gợi ý (/10), chưa duyệt',key:'suggestion',width:26},{header:'Điểm GV xác nhận (/10)',key:'grade',width:27},{header:'Nhận xét của GV',key:'comment',width:70},{header:'Lưu ý',key:'note',width:65}];
  for(const s of sessions) {
    const a=analyzeSession(s);
    sheet.addRow({name:s.name,className:s.className,topic:s.topic,prompt:a.promptScore||null,words:a.reflection.wordCount,overlap:s.reflection?a.reflection.overlapPercent:null,suggestion:a.suggestedGrade,grade:s.teacherGrade,comment:s.teacherComment,note:'Bản thử nghiệm; đối sánh từ vựng không xác định gian lận. Điểm gợi ý cần giáo viên thẩm định.'});
  }
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF176C55'}};
  sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter='A1:J1';
  return book;
}
