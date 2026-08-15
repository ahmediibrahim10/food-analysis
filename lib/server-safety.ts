type Bucket = {count:number; reset:number};
const buckets = new Map<string,Bucket>();

const isProd = () => process.env.NODE_ENV === "production";
const redisConfig = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/,""),
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export function hasDistributedInfrastructure() {
  const {url,token}=redisConfig();
  return Boolean(url && token);
}

export function assertProductionInfrastructure() {
  if (isProd() && !hasDistributedInfrastructure()) {
    throw new Error("PRODUCTION_INFRASTRUCTURE_MISSING");
  }
}

export function clientKey(request: Request) {
  return request.headers.get("x-nf-client-connection-ip")
    || request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") || "unknown";
}

export function validateSameOrigin(request: Request) {
  const origin=request.headers.get("origin");
  if(!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export function rateLimit(key:string, limit=30, windowMs=60_000) {
  const now=Date.now(), current=buckets.get(key);
  if(!current || current.reset<=now){ buckets.set(key,{count:1,reset:now+windowMs}); return {ok:true,remaining:limit-1,configurationError:false}; }
  current.count++;
  return {ok:current.count<=limit,remaining:Math.max(0,limit-current.count),configurationError:false};
}

async function redisCommand<T=any>(path:string, init:RequestInit={}):Promise<T|null> {
  const {url,token}=redisConfig();
  if(!url || !token) return null;
  const r=await fetch(`${url}/${path}`,{...init,headers:{Authorization:`Bearer ${token}`,...(init.headers||{})},cache:"no-store"});
  if(!r.ok) return null;
  return await r.json() as T;
}

export async function rateLimitSafe(key:string, limit=30, windowMs=60_000) {
  if(!hasDistributedInfrastructure()) {
    if(isProd()) return {ok:false,remaining:0,configurationError:true};
    return rateLimit(key,limit,windowMs);
  }
  try {
    const bucket=Math.floor(Date.now()/windowMs);
    const redisKey=`healthos:rl:${key}:${bucket}`;
    const data=await redisCommand<{result?:number}>(`incr/${encodeURIComponent(redisKey)}`,{method:"POST"});
    if(!data) return {ok:false,remaining:0,configurationError:true};
    const count=Number(data.result||0);
    if(count===1) void redisCommand(`expire/${encodeURIComponent(redisKey)}/${Math.ceil(windowMs/1000)+5}`,{method:"POST"});
    return {ok:count<=limit,remaining:Math.max(0,limit-count),configurationError:false};
  } catch { return {ok:false,remaining:0,configurationError:true}; }
}

export async function cacheGet<T>(key:string):Promise<T|null> {
  if(!hasDistributedInfrastructure()) return null;
  try {
    const d=await redisCommand<{result?:string|null}>(`get/${encodeURIComponent(`healthos:cache:${key}`)}`);
    return d?.result ? JSON.parse(d.result) as T : null;
  } catch { return null; }
}
export async function cacheSet<T>(key:string,value:T,ttlSeconds:number) {
  if(!hasDistributedInfrastructure()) return false;
  try {
    const d=await redisCommand(`set/${encodeURIComponent(`healthos:cache:${key}`)}/${encodeURIComponent(JSON.stringify(value))}/EX/${ttlSeconds}`,{method:"POST"});
    return Boolean(d);
  } catch { return false; }
}

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs=12_000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try { return await fetch(input,{...init,signal:controller.signal}); }
  finally { clearTimeout(timer); }
}

export function safeServerMessage(error: unknown, fallback: string) {
  if(error instanceof Error && /timeout|abort/i.test(error.message)) return "Provider timeout.";
  if(error instanceof Error && error.message==="PRODUCTION_INFRASTRUCTURE_MISSING") return "Server protection is not configured.";
  return fallback;
}

export function requestSize(request:Request,maxBytes:number) {
  const n=Number(request.headers.get("content-length")||0);
  return !n || n<=maxBytes;
}
export function jsonHeaders(requestId:string) {
  return {"X-Request-Id":requestId,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
}
export function requestId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`; }

export function validateJsonBodySize(body: unknown, maxBytes:number) {
  try { return new TextEncoder().encode(JSON.stringify(body)).byteLength <= maxBytes; }
  catch { return false; }
}

export async function cachedToken(key:string):Promise<{value:string;expiresAt:number}|null> {
  const v=await cacheGet<{value:string;expiresAt:number}>(`token:${key}`);
  return v && v.expiresAt>Date.now()+60_000 ? v : null;
}
export async function saveCachedToken(key:string,value:string,expiresAt:number) {
  const ttl=Math.max(60,Math.ceil((expiresAt-Date.now())/1000));
  return cacheSet(`token:${key}`,{value,expiresAt},ttl);
}
