type AdvCallbacks = { onOpen?:()=>void; onClose?:(wasShown?:boolean)=>void; onError?:(error:unknown)=>void; onRewarded?:()=>void };
type Player = { getData:()=>Promise<Record<string,unknown>>; setData:(data:Record<string,unknown>,flush?:boolean)=>Promise<void> };
type YandexSdk = {
  features?: { LoadingAPI?: { ready:()=>void }; GameplayAPI?: { start:()=>void; stop:()=>void } };
  adv: {
    showFullscreenAdv:(options:{callbacks:AdvCallbacks})=>void;
    showRewardedVideo:(options:{callbacks:AdvCallbacks})=>void;
  };
  getPlayer?:(options:{scopes:boolean})=>Promise<Player>;
};
declare global { interface Window { YaGames?:{init:()=>Promise<YandexSdk>} } }

let sdk:YandexSdk|null=null;
let player:Player|null=null;
let active=false;
let blocked=false;
let audioHandler:((paused:boolean)=>void)|null=null;
export function setAdAudioHandler(handler:(paused:boolean)=>void):void { audioHandler=handler; }

export async function initSdk():Promise<void> {
  if (!window.YaGames) {
    await new Promise<void>((resolve)=>{
      const script=document.createElement('script');
      script.src='https://yandex.ru/games/sdk/v2';
      script.async=true;
      const timer=window.setTimeout(resolve,3500);
      script.onload=()=>{clearTimeout(timer);resolve();};
      script.onerror=()=>{clearTimeout(timer);resolve();};
      document.head.append(script);
    });
  }
  if (!window.YaGames) return;
  try {
    sdk=await window.YaGames.init();
    sdk.features?.LoadingAPI?.ready();
    setGameplayActive(active);
    if (sdk.getPlayer) player=await sdk.getPlayer({scopes:false}).catch(()=>null);
  } catch (error) {
    console.warn('Yandex Games SDK недоступен:',error);
  }
}

export function hasAds():boolean { return sdk!==null; }
export function setGameplayActive(value:boolean):void {
  active=value;
  if (!sdk || blocked) return;
  try {
    if (value && !document.hidden) sdk.features?.GameplayAPI?.start();
    else sdk.features?.GameplayAPI?.stop();
  } catch (error) { console.warn('GameplayAPI:',error); }
}
export function pauseForAd():void {
  blocked=true;
  audioHandler?.(true);
  try { sdk?.features?.GameplayAPI?.stop(); } catch { /* older SDK */ }
}
export function resumeAfterAd():void {
  blocked=false;
  audioHandler?.(false);
  setGameplayActive(active);
}
export async function showInterstitial():Promise<boolean> {
  if (!sdk) return false;
  pauseForAd();
  return await new Promise<boolean>((resolve)=>{
    let done=false;
    const finish=(shown:boolean)=>{
      if (done) return;
      done=true;
      window.clearTimeout(timer);
      resumeAfterAd();
      resolve(shown);
    };
    const timer=window.setTimeout(()=>finish(false),45000);
    try {
      sdk!.adv.showFullscreenAdv({callbacks:{
        onClose:(shown)=>finish(Boolean(shown)),
        onError:()=>finish(false)
      }});
    } catch { finish(false); }
  });
}
export async function showRewarded():Promise<boolean> {
  if (!sdk) return false;
  pauseForAd();
  return await new Promise<boolean>((resolve)=>{
    let done=false;
    let rewarded=false;
    const finish=()=>{
      if (done) return;
      done=true;
      window.clearTimeout(timer);
      resumeAfterAd();
      resolve(rewarded);
    };
    const timer=window.setTimeout(finish,60000);
    try {
      sdk!.adv.showRewardedVideo({callbacks:{
        onRewarded:()=>{ rewarded=true; },
        onClose:finish,
        onError:finish
      }});
    } catch { finish(); }
  });
}
export async function readCloudSave():Promise<unknown> {
  if (!player) return null;
  try { return (await player.getData()).endlessIslands ?? null; } catch { return null; }
}
export async function writeCloudSave(data:unknown):Promise<void> {
  if (!player) return;
  try { await player.setData({endlessIslands:data},true); } catch (error) { console.warn('Облачное сохранение:',error); }
}
