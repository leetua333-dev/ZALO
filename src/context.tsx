import { createContext, useContext } from 'react';
import type { AppData, Session } from './types';
export type AppContextValue = { data:AppData; refresh:()=>Promise<void>; updateSession:(s:Session)=>void; className:string; setClassName:(c:string)=>void; sessions:Session[]; notify:(message:string)=>void; openCreate:()=>void };
export const AppContext=createContext<AppContextValue|null>(null);
export const useApp = () => {const value=useContext(AppContext); if(!value) throw new Error('Missing app context'); return value;};
