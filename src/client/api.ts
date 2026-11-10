export async function api<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
 const response=await fetch(`/api/${path}`,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});
 const data=await response.json();if(!response.ok)throw Error(data.message||'Request could not complete.');return data as T;
}
