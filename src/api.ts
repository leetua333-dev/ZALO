import type { AppData } from './types';
export const isBrowserDemo=import.meta.env.VITE_STORAGE_MODE==='browser';
export async function api<T>(path:string, options?:RequestInit):Promise<T> {
  if(isBrowserDemo) {
    const {createDemoStore}=await import('./demo-store.mjs');
    return createDemoStore(window.localStorage).request(path,{method:options?.method||'GET',body:options?.body?JSON.parse(String(options.body)):undefined}) as T;
  }
  const response=await fetch(`/api${path}`,{...options,headers:{'Content-Type':'application/json',...options?.headers}});
  const data=await response.json().catch(()=>({error:'Không đọc được phản hồi từ máy chủ.'}));
  if (!response.ok) throw new Error(data.error||'Yêu cầu không thành công.');
  return data as T;
}
export async function exportGrades(className:string) {
  let blob:Blob;
  if(isBrowserDemo) {
    const [{default:ExcelJS},{populateGradeWorkbook},state]=await Promise.all([import('exceljs'),import('../server/workbook.mjs'),api<AppData>('/state')]);
    const book=populateGradeWorkbook(new ExcelJS.Workbook(),state.sessions.filter(s=>className==='all'||s.className===className));
    const bytes=await book.xlsx.writeBuffer();
    blob=new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  } else {
    const response=await fetch(`/api/export/grades.xlsx${className==='all'?'':`?className=${encodeURIComponent(className)}`}`);
    if(!response.ok)throw new Error('Chưa xuất được Excel. Vui lòng thử lại.');
    blob=await response.blob();
  }
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='SmartLit-diem-qua-trinh.xlsx';document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export const send = <T>(path:string, body:unknown, method='POST') => api<T>(path,{method,body:JSON.stringify(body)});
export const countWords = (text:string) => text.trim() ? text.trim().split(/\s+/u).length : 0;
export const number = (n:number) => new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(n);
export const date = (text:string) => new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(text));
