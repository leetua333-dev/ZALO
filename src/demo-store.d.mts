export const DEMO_STORAGE_KEY:string;
export function createDemoStore(storage:Pick<Storage,'getItem'|'setItem'>):{
  request(path:string,options?:{method?:string;body?:unknown}):unknown;
};
