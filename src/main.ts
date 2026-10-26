import './style.css';
import { ACTIVES, BOSSES, ELITES, ENEMIES, HEROES, PASSIVES, SHAPES, WEAPONS } from './content';
import { Game, type Mode } from './game';
import { hasAds, initSdk, readCloudSave, setAdAudioHandler, showInterstitial, showRewarded } from './sdk';

const canvas=document.querySelector<HTMLCanvasElement>('#game')!;
const ui=document.querySelector<HTMLDivElement>('#ui')!;
const touch=document.querySelector<HTMLDivElement>('#touch')!;
const stick=document.querySelector<HTMLDivElement>('#stick')!;
const nub=document.querySelector<HTMLDivElement>('#nub')!;
const game=new Game(canvas);
if(import.meta.env.DEV)(window as Window & {__game?:Game}).__game=game;
let panel='';
let selectedHero=0;
let panelTab='enemies';
let previousMode:Mode|null=null;
let sound=true;
let soundCtx:AudioContext|null=null;
setAdAudioHandler(paused=>{if(!soundCtx)return;if(paused)void soundCtx.suspend();else if(sound)void soundCtx.resume();});
const isTouch=matchMedia('(pointer:coarse)').matches;
const keyNames='WASD · мышь · ЛКМ · Q · Space';

function playTone(freq:number,duration=.07):void {
  if(!sound)return;
  try {
    soundCtx??=new AudioContext();
    if(soundCtx.state==='suspended')void soundCtx.resume();
    const oscillator=soundCtx.createOscillator(),gain=soundCtx.createGain();
    oscillator.type='sine';oscillator.frequency.setValueAtTime(freq,soundCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(freq*.66,soundCtx.currentTime+duration);
    gain.gain.setValueAtTime(.035,soundCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,soundCtx.currentTime+duration);
    oscillator.connect(gain).connect(soundCtx.destination);
    oscillator.start();oscillator.stop(soundCtx.currentTime+duration);
  } catch {/* sound unavailable */}
}
function button(label:string,action:string,secondary=false,disabled=false):string {
  return '<button class="button '+(secondary?'secondary':'')+'" data-action="'+action+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
}
function card(title:string,desc:string,action:string,selected=false,badge=''):string {
  return '<button class="card '+(selected?'selected':'')+'" data-action="'+action+'">'+(badge?'<span class="badge">'+badge+'</span>':'')+'<strong>'+title+'</strong><small>'+desc+'</small></button>';
}
function panelMarkup(title:string,body:string,footer='',showBack=true):string {
  return '<div class="screen"><section class="panel modal"><div class="eyebrow">Бесконечные острова</div><h2>'+title+'</h2>'+body+'<div class="stack" style="margin-top:20px">'+footer+(showBack?button('Назад','close',true):'')+'</div></section></div>';
}
function renderPanel():string {
  if(panel==='heroes')return panelMarkup('Герои','<div class="grid">'+HEROES.map((h,i)=>card(h.name,h.role+' · '+h.hp+' HP · '+h.mana+' мана','select-hero-'+i,selectedHero===i,h.id)).join('')+'</div>',button('Выбрать героя','lobby'));
  if(panel==='equipment')return panelMarkup('Арсенал','<p>Во время забега второй слот открывается через портал. Стартовое оружие не тратит боезапас.</p><div class="grid">'+WEAPONS.map(w=>card(w.name,w.damage+' урона · '+w.cost+' боезапас · '+w.rate+' выстр./с','noop',false,w.id)).join('')+'</div>');
  if(panel==='upgrades')return panelMarkup('Способности и развитие','<p>После каждого острова портал предлагает три улучшения. Активная способность использует ману.</p><div class="grid">'+ACTIVES.map(a=>card(a.name,a.description+' · '+a.cost+' маны','noop',false,a.id)).join('')+'</div><h2>Пассивные способности</h2><div class="grid">'+PASSIVES.map(p=>card(p.name,p.description,'noop',false,p.id)).join('')+'</div>');
  if(panel==='codex'){
    const options=[['enemies','Враги'],['elites','Элита'],['bosses','Боссы'],['islands','Острова']];
    const list=panelTab==='enemies'?ENEMIES:panelTab==='elites'?ELITES:panelTab==='bosses'?BOSSES:SHAPES.map((name,i)=>({id:String(i+1),name}));
    return panelMarkup('Кодекс','<div class="stack">'+options.map(([id,name])=>button(name,'tab-'+id,panelTab!==id)).join('')+'</div><div class="grid" style="margin-top:16px">'+list.map(v=>card(v.name,'id' in v?String(v.id):'','noop')).join('')+'</div>');
  }
  if(panel==='settings')return panelMarkup('Настройки','<p>Управление: '+keyNames+'. Смена оружия — 1 / 2 / колесо, характеристики — C, инвентарь — Tab, пауза — Esc.</p><div class="grid">'+card('Звук',sound?'Включён':'Выключен','sound',sound)+card('Качество','Изменить масштаб рендера','quality')+'</div>');
  if(panel==='achievements'){
    let meta:{wins?:number;best?:number}={};
    try{meta=JSON.parse(localStorage.getItem('endless-islands-meta-v1')||'{}');}catch{/* storage disabled */}
    return panelMarkup('Достижения','<div class="grid">'+card('Первый шаг','Достигните второго острова','noop',game.island>1)+card('Покоритель небес','Пройдите все 20 островов','noop',(meta.wins||0)>0)+card('Победы',String(meta.wins||0),'noop')+card('Лучший результат',String(meta.best||0)+' / 20','noop')+'</div>');
  }
  if(panel==='stats'){
    const h=HEROES[game.heroIndex];
    const values=[
      ['Живучесть',10+game.maxHpBonus/10],['Сила',10+Math.round(game.damageBonus*100)],['Стойкость',10+h.armor],['Ловкость',10+Math.round(game.speedBonus*100)],['Интеллект',10],['Удача',10],
      ['HP',Math.ceil(game.hp)+' / '+game.maxHealth],['Атака','+'+Math.round(game.damageBonus*100)+'%'],['Защита',h.armor+(game.passives.includes(2)?3:0)],
      ['Сила активной способности','100%'],['Скорость',Math.round((1+game.speedBonus)*100)+'%'],['Критический шанс',Math.round(h.crit*100)+'%'],
      ['Критический урон','150%'],['Регенерация HP',game.passives.includes(3)?'0.2/с':'0/с'],['Снижение КД','0%'],['Регенерация маны','0.5/с']
    ];
    return panelMarkup('Характеристики','<div class="grid">'+values.map(([name,value])=>card(String(name),String(value),'noop')).join('')+'</div>');
  }
  if(panel==='inventory')return panelMarkup('Инвентарь','<div class="grid">'+game.weapons.map((n,i)=>card('Оружие '+(i+1),n<0?'Пустой слот':WEAPONS[n].name,'weapon-'+i,i===game.weaponSlot)).join('')+card('Активная способность',game.ability.name,'noop')+card('Боезапас',String(game.ammo),'noop')+card('Монеты',String(game.coins),'noop')+'</div><h2>Пассивные способности</h2><div class="grid">'+(game.passives.length?game.passives.map(n=>card(PASSIVES[n].name,PASSIVES[n].description,'noop')).join(''):'<p>Пока нет</p>')+'</div>');
  if(panel==='dev')return panelMarkup('Меню разработчика','<p>Инструменты отладки локального забега.</p><div class="stack">'+button('Полное восстановление','debug-heal')+button('Следующий остров','debug-next')+button('Предыдущий остров','debug-prev')+'</div><p>Seed: '+game.seed+' · остров: '+game.island+'</p>');
  return '';
}
function menuMarkup():string {
  return '<div class="screen"><section class="panel menu"><div class="eyebrow">3D action roguelite · приключение среди облаков</div><h1 class="title">Бесконечные<br>Острова</h1><p class="subtitle">Четыре героя. Четыре мира. Двадцать островов между вами и Сердцем Островов.</p><div class="stack">'+
    button('Новая игра','lobby')+button('Продолжить','continue',true,!game.getSave())+button('Герои','open-heroes',true)+button('Снаряжение','open-equipment',true)+button('Улучшения','open-upgrades',true)+button('Кодекс','open-codex',true)+button('Достижения','open-achievements',true)+button('Настройки','open-settings',true)+'</div><p class="hint">Управление: '+keyNames+'<br>В браузере игра сохраняется после перехода на новый остров.</p></section></div>';
}
function lobbyMarkup():string {
  return '<section class="panel lobby"><div class="eyebrow">Небесная гавань · выбор героя</div><h2>Кто отправится в путь?</h2><div class="grid">'+HEROES.map((h,i)=>card(h.name,h.role+' · '+h.hp+' HP','select-hero-'+i,selectedHero===i,h.id)).join('')+'</div><div class="lobby-footer"><span class="hint">Стартовое оружие: Искра Путника · способность: Молниеносный рывок</span><div class="stack">'+button('В меню','menu',true)+button('Начать забег','start')+'</div></div></section>';
}
function rewardMarkup():string {
  if(game.transitioning)return panelMarkup('Следующий остров','<p>Подготавливаем переход…</p>','',false);
  return panelMarkup('Дар портала','<p>Остров '+game.island+' пройден. Выберите одно усиление для следующего острова.</p><div class="grid reward">'+game.rewardChoices.map((r,i)=>
    '<button class="card" data-action="reward-'+i+'"><span class="badge rarity-'+r.rarity+'">'+({common:'Обычная',rare:'Редкая',epic:'Эпическая',legendary:'Легендарная'} as Record<string,string>)[r.rarity]+'</span><strong>'+r.title+'</strong><small>'+r.description+'</small></button>'
  ).join('')+'</div>','',false);
}
function overlayMarkup():string {
  if(panel)return renderPanel();
  if(game.mode==='menu')return menuMarkup();
  if(game.mode==='lobby')return lobbyMarkup();
  if(game.mode==='reward')return rewardMarkup();
  if(game.mode==='paused')return panelMarkup('Пауза','<p>Забег на острове '+game.island+'. Сохранение доступно на начале каждого острова.</p>',button('Продолжить','resume')+button('В главное меню','menu',true),false);
  if(game.mode==='dead')return panelMarkup('Забег окончен','<p>Остров '+game.island+' · побеждено врагов: '+game.kills+' · собрано монет: '+game.coins+'.</p><p>Попробуйте нового героя или измените способности в следующем забеге.</p>',(hasAds()&&!game.revived?button('Смотреть рекламу и воскреснуть','revive'):'')+button('Новый забег','lobby'),false);
  if(game.mode==='won')return panelMarkup('Сердце Островов повержено','<p>Вы прошли все двадцать островов. Победа сохранена в истории.</p><p>Врагов побеждено: '+game.kills+' · монет собрано: '+game.coins+'.</p>',button('Новый забег','lobby'),false);
  return '';
}
function hudMarkup():string {
  if(!['playing','paused'].includes(game.mode))return '';
  const hp=Math.max(0,game.hp/game.maxHealth*100),mana=Math.max(0,game.mana/game.maxMagic*100),boss=game.boss;
  return '<div class="hud"><div class="hud-top"><div class="hud-panel"><div class="hud-name">'+HEROES[game.heroIndex].name+' · уровень '+game.level+'</div><div class="bar"><i style="width:'+hp+'%"></i></div><div class="hud-num">HP '+Math.ceil(game.hp)+' / '+game.maxHealth+'</div><div class="bar mana"><i style="width:'+mana+'%"></i></div><div class="hud-num">Мана '+Math.floor(game.mana)+' / '+game.maxMagic+'</div></div><div class="hud-panel hud-right"><div class="hud-name">Остров '+game.island+' / 20</div><div class="hud-num">'+game.biome.name+'</div><div class="hud-num">✦ '+game.coins+' монет · '+game.ammo+' боезапас</div><div class="bar xp"><i style="width:'+Math.min(100,game.xp/100*100)+'%"></i></div></div></div>'+
    (boss?'<div class="hud-panel bossbar">'+boss.kind.name+' · фаза '+boss.phase+'<div class="bar"><i style="width:'+Math.max(0,boss.hp/boss.maxHp*100)+'%"></i></div></div>':'')+
    '<div class="hud-bottom">'+game.weapons.map((n,i)=>'<button class="slot '+(i===game.weaponSlot?'active':'')+'" data-action="weapon-'+i+'"><b>'+(i+1)+' · '+game.clips[i]+'</b>'+(n<0?'Пусто':WEAPONS[n].name)+'</button>').join('')+'<button class="slot" data-action="skill"><b>Q</b>'+game.ability.name+(game.skillCooldown>0?' '+Math.ceil(game.skillCooldown)+'с':'')+'</button><button class="slot" data-action="pause"><b>Ⅱ</b>Пауза</button></div>'+
    '<div class="hud-help">WASD — движение · ЛКМ — огонь · Q — способность · Space — рывок<br>1 / 2 — оружие · R — перезарядка · C — характеристики · Tab — инвентарь · Esc — пауза</div>'+
    (game.toastTime>0?'<div class="toast">'+game.toast+'</div>':'')+'</div>';
}
function render():void {
  const hudRoot=ui.querySelector<HTMLDivElement>('#hud-root');
  const overlayRoot=ui.querySelector<HTMLDivElement>('#overlay-root');
  if(hudRoot)hudRoot.innerHTML=hudMarkup();
  if(overlayRoot)overlayRoot.innerHTML=overlayMarkup();
  touch.classList.toggle('hidden',!isTouch||game.mode!=='playing'||Boolean(panel));
}
function updateHud():void {
  const hudRoot=ui.querySelector<HTMLDivElement>('#hud-root');
  if(hudRoot)hudRoot.innerHTML=hudMarkup();
}
function openPanel(name:string):void {
  if(panel)return;
  previousMode=game.mode;
  if(game.mode==='playing')game.pause();
  panel=name;render();
}
function closePanel():void {
  panel='';
  if(previousMode==='playing'&&game.mode==='paused')game.pause();
  previousMode=null;render();
}
async function doAction(action:string):Promise<void> {
  if(action==='noop')return;
  if(action==='close'){closePanel();return;}
  if(action==='menu'){panel='';game.menu();return;}
  if(action==='lobby'){panel='';game.lobby();return;}
  if(action==='continue'){game.resume();return;}
  if(action==='start'){game.newRun(selectedHero);playTone(560,.2);return;}
  if(action==='resume'||action==='pause'){game.pause();return;}
  if(action==='skill'){game.useSkill();return;}
  if(action==='reload'){game.startReload();return;}
  if(action==='revive'){
    const earned=await showRewarded();
    if(earned){game.revive();game.saveCheckpoint();}
    else {game.showToast('Награда не получена');render();}
    return;
  }
  if(action==='sound'){sound=!sound;render();return;}
  if(action==='quality'){
    const current=game.world.renderer.getPixelRatio();
    game.world.renderer.setPixelRatio(current>1?1:Math.min(devicePixelRatio,1.75));
    render();return;
  }
  if(action==='debug-heal'){game.debugHeal();render();return;}
  if(action==='debug-next'){game.debugIsland(game.island+1);panel='';return;}
  if(action==='debug-prev'){game.debugIsland(game.island-1);panel='';return;}
  if(action.startsWith('open-')){openPanel(action.slice(5));return;}
  if(action.startsWith('tab-')){panelTab=action.slice(4);render();return;}
  if(action.startsWith('select-hero-')){selectedHero=Number(action.slice(12));render();return;}
  if(action.startsWith('weapon-')){game.switchWeapon(Number(action.slice(7)));render();return;}
  if(action.startsWith('reward-')){playTone(760,.18);await game.chooseReward(Number(action.slice(7)));return;}
}
ui.addEventListener('click',event=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if(target){void doAction(target.dataset.action||'');}
});
window.addEventListener('keydown',event=>{
  if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
  if(event.repeat&&['Escape','Tab','KeyC','F3','Digit1','Digit2'].includes(event.code))return;
  if(event.code==='Escape'){
    if(panel)closePanel();else game.pause();
  } else if(event.code==='Tab') {
    if(panel==='inventory')closePanel();else openPanel('inventory');
  } else if(event.code==='KeyC') {
    if(panel==='stats')closePanel();else openPanel('stats');
  } else if(event.code==='F3') {
    if(panel==='dev')closePanel();else openPanel('dev');
  } else if(event.code==='Digit1')game.switchWeapon(0);
  else if(event.code==='Digit2')game.switchWeapon(1);
  else if(event.code==='KeyR')game.startReload();
  else game.input.keys.add(event.code);
});
window.addEventListener('keyup',event=>game.input.keys.delete(event.code));
window.addEventListener('blur',()=>{game.input.keys.clear();game.input.fire=false;if(game.mode==='playing')game.pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.mode==='playing')game.pause();});
canvas.addEventListener('pointermove',event=>{game.input.mouseX=event.clientX;game.input.mouseY=event.clientY;});
canvas.addEventListener('pointerdown',event=>{
  if(game.mode!=='playing')return;
  if(event.button===0){game.input.fire=true;playTone(450);}
  if(event.button===2){game.useSkill();playTone(790);}
});
window.addEventListener('pointerup',()=>game.input.fire=false);
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('wheel',event=>{
  if(game.mode!=='playing')return;
  event.preventDefault();game.switchWeapon(event.deltaY>0?1:0);
},{passive:false});

let stickId:number|null=null;
stick.addEventListener('pointerdown',event=>{stickId=event.pointerId;stick.setPointerCapture(event.pointerId);});
stick.addEventListener('pointermove',event=>{
  if(stickId!==event.pointerId)return;
  const r=stick.getBoundingClientRect(),x=(event.clientX-r.left-r.width/2)/(r.width/2),y=(event.clientY-r.top-r.height/2)/(r.height/2);
  const length=Math.max(1,Math.hypot(x,y));
  game.input.touchX=x/length;game.input.touchZ=y/length;
  nub.style.transform='translate('+(game.input.touchX*35)+'px,'+(game.input.touchZ*35)+'px)';
});
const releaseStick=()=>{stickId=null;game.input.touchX=0;game.input.touchZ=0;nub.style.transform='';};
stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);
const touchFire=document.querySelector<HTMLButtonElement>('#touch-fire')!;
touchFire.addEventListener('pointerdown',event=>{event.preventDefault();game.input.fire=true;game.input.touchAim=true;});
touchFire.addEventListener('pointerup',()=>{game.input.fire=false;game.input.touchAim=false;});
touchFire.addEventListener('pointercancel',()=>{game.input.fire=false;game.input.touchAim=false;});
document.querySelector('#touch-skill')!.addEventListener('pointerdown',event=>{event.preventDefault();game.useSkill();});
document.querySelector('#touch-dash')!.addEventListener('pointerdown',event=>{event.preventDefault();game.input.keys.add('Space');});

async function boot():Promise<void> {
  ui.innerHTML='<div class="screen"><div class="panel menu"><div class="eyebrow">Бесконечные острова</div><h1 class="title">Загрузка мира…</h1></div></div>';
  await game.init();
  ui.innerHTML='<div id="hud-root"></div><div id="overlay-root"></div>';
  game.onModeChange=render;
  game.onBreak=async()=>{
    if(!hasAds())return;
    await showInterstitial();
  };
  render();
  void initSdk().then(async()=>{
    const cloud=await readCloudSave();
    if(cloud&&!game.getSave()){
      try{localStorage.setItem('endless-islands-run-v1',JSON.stringify(cloud));}catch{/* storage disabled */}
    }
    render();
  });
  let previous=performance.now(),hudClock=0;
  function frame(now:number):void {
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    game.update(dt);
    hudClock+=dt;
    if(hudClock>.12){hudClock=0;updateHud();}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
void boot().catch(error=>{
  console.error(error);
  ui.innerHTML='<div class="screen"><section class="panel menu"><h1 class="title">Не удалось запустить игру</h1><p>Обновите страницу. Если ошибка повторится, проверьте поддержку WebGL в браузере.</p></section></div>';
});
