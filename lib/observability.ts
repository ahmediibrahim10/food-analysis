export type ProviderEvent = {
  requestId:string;
  provider:string;
  operation:string;
  ok:boolean;
  status?:number;
  durationMs?:number;
};

export function logProviderEvent(event:ProviderEvent) {
  // Structured, secret-free logs. Never include tokens, image data, request bodies, or API keys.
  console.info(JSON.stringify({scope:"health-os",type:"provider",...event}));
}
