export type Citation = {documentId:string; title:string; author:string; chunkId:string; content:string; source:string};
export type Message = {id:string; role:'user'|'assistant'; content:string; citations?:Citation[]; createdAt:string};
export type Prompt = {messageId:string; content:string; score:number; tags:string[]; reason:string; label:string};
export type ReflectionAnalysis = {wordCount:number; overlapPercent:number; spans:{start:number;end:number}[]; paragraphs:{text:string;start:number;end:number;label:string;words:number}[]; method:string};
export type Analysis = {prompts:Prompt[]; promptScore:number; reflection:ReflectionAnalysis; citationCount:number; reviewReasons:string[]; suggestedGrade:number|null; hasCriticalThinking:boolean; hasDecomposition:boolean};
export type Session = {id:string; name:string; initials:string; color:string; className:string; topic:string; documentId:string; messages:Message[]; reflection:string; teacherGrade:number|null; teacherComment:string; createdAt:string; updatedAt:string; demo:boolean; analysis:Analysis};
export type CorpusDocument = {id:string; title:string; author:string; category:string; grade:string; source:string; approved:boolean; content:string};
export type AppData = {sessions:Session[]; documents:CorpusDocument[]; mode:string};
