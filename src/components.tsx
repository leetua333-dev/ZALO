import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight, BookOpen, Check, ChevronRight, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Session } from './types';
import { date, number } from './api';

export function Logo({small=false}:{small?:boolean}) {return <div className={`logo ${small?'small':''}`}><span className="logo-mark"><BookOpen size={23} strokeWidth={1.8}/><i/></span><span>smartlit<span className="logo-ai">AI</span></span></div>;}
export function Badge({children,tone='green'}:{children:ReactNode;tone?:string}) {return <span className={`badge ${tone}`}><span className="badge-dot"/>{children}</span>;}
export function Avatar({session,size='normal'}:{session:Pick<Session,'initials'|'color'>;size?:string}) {return <span className={`avatar ${session.color} ${size}`}>{session.initials}</span>;}
export function Heading({eyebrow,title,description,children}:{eyebrow?:string;title:string;description:string;children?:ReactNode}) {return <div className="page-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{children}</div></div>;}
export function Empty({title='Chưa có dữ liệu',text='Dữ liệu sẽ xuất hiện khi bạn bắt đầu một phiên học.',children}:{title?:string;text?:string;children?:ReactNode}) {return <div className="empty"><span className="empty-icon"><BookOpen size={28}/></span><h3>{title}</h3><p>{text}</p>{children}</div>;}
export function Score({value}:{value:number}) {return <div className="score"><span>{value?number(value):'—'}<small> / 4</small></span><span className="score-track"><i style={{width:`${value/4*100}%`}}/></span></div>;}
export function Modal({title,description,onClose,children,wide=false}:{title:string;description?:string;onClose:()=>void;children:ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const selector='button, input, select, textarea, a[href], [tabindex="0"]';
    (ref.current?.querySelector(selector) as HTMLElement)?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape') onClose();
      if(e.key==='Tab') {const nodes=ref.current?.querySelectorAll<HTMLElement>(selector); if(!nodes?.length)return; const first=nodes[0],last=nodes[nodes.length-1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();} else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    };
    document.addEventListener('keydown',key);
    return ()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus();};
  },[onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title}><button className="icon-button modal-close" aria-label="Đóng" onClick={onClose}><X size={20}/></button><h2>{title}</h2>{description&&<p className="modal-description">{description}</p>}{children}</div></div>;
}
export function SearchInput({value,onChange,placeholder='Tìm học sinh, chủ đề...'}:{value:string;onChange:(s:string)=>void;placeholder?:string}) {return <div className="search-input"><Search size={17}/><input aria-label={placeholder} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{value&&<button className="icon-button" aria-label="Xóa tìm kiếm" onClick={()=>onChange('')}><X size={14}/></button>}</div>;}
export function SessionsTable({sessions,compact=false}:{sessions:Session[];compact?:boolean}) {
  if(!sessions.length)return <Empty title="Không tìm thấy phiên học" text="Thử thay đổi bộ lọc hoặc tạo một phiên học mới."/>;
  return <div className="table-scroll"><table className="sessions-table"><thead><tr><th>Học sinh</th><th>Chủ đề phiên học</th><th>Chất lượng prompt</th><th>Bài phản tư</th><th>Trạng thái</th><th><span className="sr-only">Chi tiết</span></th></tr></thead><tbody>{sessions.map(s=><tr key={s.id}><td><Link className="student-cell" to={`/sessions/${s.id}`}><Avatar session={s}/><span><strong>{s.name}</strong><small>Lớp {s.className}{s.demo?' · Minh họa':''}</small></span></Link></td><td><Link className="topic-cell" to={`/sessions/${s.id}`}><span>{compact?'Tự tình (bài II)':s.topic}</span><small>{date(s.updatedAt)} · {s.analysis.prompts.length} câu lệnh</small></Link></td><td><Score value={s.analysis.promptScore}/></td><td>{s.reflection?<span className={`reflection-state ${s.analysis.reflection.overlapPercent>=20?'warning':''}`}>{s.analysis.reflection.overlapPercent>=20?<Search size={13}/>:<Check size={13}/>} {s.analysis.reflection.overlapPercent>=20?'Cần đối soát':'Đã nộp'}</span>:<span className="muted">Chưa nộp</span>}</td><td><Badge tone={s.teacherGrade!==null?'green':s.reflection?'amber':'gray'}>{s.teacherGrade!==null?'Đã duyệt':s.reflection?'Chờ giáo viên':'Đang thực hiện'}</Badge></td><td><Link className="row-link" aria-label={`Xem báo cáo ${s.name}`} to={`/sessions/${s.id}`}><ArrowUpRight size={17}/></Link></td></tr>)}</tbody></table></div>;
}
export function CardTitle({title,subtitle,children}:{title:string;subtitle?:string;children?:ReactNode}) {return <div className="card-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{children}</div>;}
export function TextLink({to,children}:{to:string;children:ReactNode}) {return <Link className="text-link" to={to}>{children}<ChevronRight size={15}/></Link>;}
