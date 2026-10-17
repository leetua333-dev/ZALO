export const wordCount = text => text.trim() ? text.trim().split(/\s+/u).length : 0;
const normalize = text => text.toLocaleLowerCase('vi').normalize('NFC');
const words = text => [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu)].map(m => ({ word: normalize(m[0]), start: m.index, end: m.index + m[0].length }));
const has = (text, pattern) => pattern.test(normalize(text));

export function analyzePrompt(text) {
  const tags = [];
  let score = 2;
  let reason = 'Đặt câu hỏi tìm hiểu hoặc làm rõ nội dung.';
  if (has(text, /viết hộ|làm hộ|làm giúp|chép|viết (giúp|cho) em (một )?(bài|đoạn)|cho em (bài văn|đáp án)/u)) {
    score = 1; tags.push('Nhờ làm hộ'); reason = 'Có yêu cầu giao việc viết hoặc trả lời thay cho người học.';
  } else {
    if (has(text, /so sánh|từng bước|chia nhỏ|tách thành|từng phần|trước tiên|lần lượt|liên hệ|vì sao/u)) {
      score = 3; tags.push('Phân tách / liên hệ'); reason = 'Có yêu cầu phân tách, so sánh hoặc tìm quan hệ giữa các ý.';
    }
    if (has(text, /dẫn chứng|bằng chứng|câu thơ nào|trích dẫn|dựa vào đâu/u)) tags.push('Yêu cầu dẫn chứng');
    if (has(text, /phản biện|không đồng ý|chưa thuyết phục|có chắc|dựa vào đâu|cách hiểu khác|bác bỏ/u)) {
      score = 4; tags.push('Dấu hiệu phản biện'); reason = 'Có lời chất vấn, yêu cầu kiểm chứng hoặc đề xuất cách hiểu khác.';
    }
  }
  if (!tags.length) tags.push('Tìm hiểu nội dung');
  return { score, tags, reason, label: ['','Thụ động','Tìm hiểu','Phân tích','Phản biện'][score] };
}

export function matchReflection(reflection, messages) {
  const shingles = new Set();
  for (const message of messages.filter(m => m.role === 'assistant')) {
    const tokens = words(message.content);
    for (let i = 0; i <= tokens.length - 6; i++) shingles.add(tokens.slice(i, i + 6).map(t => t.word).join(' '));
  }
  const tokens = words(reflection);
  const matched = new Set();
  for (let i = 0; i <= tokens.length - 6; i++) {
    if (shingles.has(tokens.slice(i, i + 6).map(t => t.word).join(' '))) for (let j = i; j < i + 6; j++) matched.add(j);
  }
  const spans = [];
  for (const i of [...matched].sort((a,b) => a-b)) {
    const last = spans.at(-1);
    if (last && i === last.lastIndex + 1) { last.end = tokens[i].end; last.lastIndex = i; }
    else spans.push({ start: tokens[i].start, end: tokens[i].end, lastIndex: i });
  }
  let offset = 0;
  const paragraphs = reflection.split(/\n\n+/).filter(Boolean).map(text => {
    const start = reflection.indexOf(text, offset); offset = start + text.length;
    const segmentTokens = tokens.filter(t => t.start >= start && t.end <= offset);
    const overlap = spans.reduce((sum, s) => sum + (s.start < offset && s.end > start ? Math.max(0,Math.min(s.end,offset)-Math.max(s.start,start)) : 0), 0);
    const ratio = text.length ? Math.min(1,overlap/text.length) : 0;
    return { text, start, end: offset, label: ratio > .35 ? 'Trùng diễn đạt' : has(text,/ban đầu|tuy nhiên|sau khi|không đồng ý|em nhận ra|theo em/u) ? 'Có dấu hiệu phản tư' : 'Cần đọc đối chiếu', words: segmentTokens.length };
  });
  return { wordCount: wordCount(reflection), overlapPercent: tokens.length ? Math.round(matched.size / tokens.length * 100) : 0, spans: spans.map(({start,end}) => ({start,end})), paragraphs, method: 'Đối sánh từ vựng: chuỗi 6 từ liên tiếp. Chưa phải đo tương đồng ngữ nghĩa; trích dẫn hợp lệ cũng có thể được đánh dấu.' };
}

const stopWords = new Set('em tôi là và của trong một những các có không hãy cho về với được đã này đó thì gì thế nào giúp bài thơ tác giả'.split(' '));
export function retrieve(query, documents, documentId) {
  const terms = [...new Set(words(query).map(t => t.word).filter(w => w.length > 1 && !stopWords.has(w)))];
  if (!terms.length) return [];
  const chunks = documents.filter(d => d.approved && (!documentId || d.id === documentId)).flatMap(d =>
    d.content.split(/\n\n+/).filter(Boolean).map((content,index) => ({ documentId:d.id, title:d.title, author:d.author, source:d.source, chunkId:`${d.id}:${index+1}`, content })));
  const ranked = chunks.map(c => {
    const body = new Set(words(c.content).map(t => t.word));
    const title = new Set(words(c.title).map(t => t.word));
    const score = terms.reduce((sum,w) => sum + (body.has(w) ? 1 : 0) + (title.has(w) ? .2 : 0),0);
    return {...c, score};
  }).filter(c => c.score >= 1).sort((a,b) => b.score-a.score);
  return ranked.slice(0,2);
}

export function groundedReply(query, documents, documentId) {
  if (analyzePrompt(query).score === 1) return { content:'Mình sẽ đồng hành cùng em xây dựng ý, thay vì viết bài để nộp. Em hãy chọn một hình ảnh hoặc câu thơ trong ngữ liệu và nêu cách hiểu ban đầu của mình. Em muốn bắt đầu từ chi tiết nào?', citations:[] };
  const citations = retrieve(query,documents,documentId);
  if (!citations.length) return { content:'Mình chưa tìm thấy dẫn chứng phù hợp trong ngữ liệu đã duyệt của phiên học. Em hãy hỏi cụ thể hơn về một câu thơ hoặc hình ảnh trong văn bản. Với nội dung ngoài kho, cần giáo viên bổ sung và thẩm định nguồn trước.', citations:[] };
  return { content:`Ngữ liệu đã duyệt có đoạn sau:\n\n${citations.map((c,i) => `“${c.content}” [${i+1}]`).join('\n\n')}\n\nTừ dẫn chứng này, em nhận thấy từ ngữ hoặc hình ảnh nào đáng chú ý? Hãy thử nêu cách hiểu của em và chỉ ra chi tiết làm căn cứ.`, citations };
}

export function analyzeSession(session) {
  const prompts = session.messages.filter(m => m.role === 'user').map(m => ({...analyzePrompt(m.content), messageId:m.id, content:m.content}));
  const promptScore = prompts.length ? Math.round(prompts.reduce((s,p) => s+p.score,0)/prompts.length*10)/10 : 0;
  const reflection = matchReflection(session.reflection || '',session.messages);
  const citations = session.messages.filter(m => m.role === 'assistant').flatMap(m => m.citations || []);
  const reviewReasons = [];
  if (prompts.some(p => p.score === 1)) reviewReasons.push('Có yêu cầu làm hộ');
  if (reflection.overlapPercent >= 20) reviewReasons.push('Bài phản tư có đoạn trùng diễn đạt');
  if (session.reflection && (reflection.wordCount < 300 || reflection.wordCount > 500)) reviewReasons.push('Độ dài phản tư ngoài 300–500 từ');
  const suggestedGrade = session.reflection && prompts.length ? Math.min(10,Math.round((promptScore + (reflection.wordCount >= 300 && reflection.wordCount <= 500 ? 2 : 1) + (citations.length ? 2 : 0) + (prompts.some(p => p.tags.includes('Yêu cầu dẫn chứng')) ? 1 : 0) + (prompts.some(p => p.score === 4) ? 1 : 0))*10)/10) : null;
  return {prompts,promptScore,reflection,citationCount:citations.length,reviewReasons,suggestedGrade,hasCriticalThinking:prompts.some(p => p.score===4), hasDecomposition:prompts.some(p => p.tags.includes('Phân tách / liên hệ'))};
}
