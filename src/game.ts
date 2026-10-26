import * as THREE from 'three';
import { ACTIVES, BIOMES, BOSSES, BOSS_ISLANDS, ELITES, ENEMIES, HEROES, PASSIVES, SHAPES, WEAPONS, biomeForIsland, seeded, shapeForIsland, type Boss, type EnemyKind } from './content';
import { WorldView } from './world';
import { setGameplayActive, writeCloudSave } from './sdk';

export type Mode='menu'|'lobby'|'playing'|'reward'|'paused'|'dead'|'won';
export type Reward={kind:'weapon'|'passive'|'active'|'stat';id:number;title:string;description:string;rarity:string};
type Enemy={kind:EnemyKind|Boss;boss:boolean;mesh:THREE.Group;x:number;z:number;y:number;hp:number;maxHp:number;cooldown:number;phase:number;time:number;slow:number};
type Projectile={mesh:THREE.Group;x:number;z:number;vx:number;vz:number;life:number;damage:number;hostile:boolean;radius:number};
type Pickup={mesh:THREE.Group;x:number;z:number;kind:'hp'|'mana'|'ammo'|'coin';time:number};
type Pulse={mesh:THREE.Mesh;age:number;duration:number;radius:number};
type Save={version:1;heroIndex:number;island:number;seed:number;hp:number;mana:number;ammo:number;coins:number;xp:number;level:number;weapons:number[];clips:number[];passives:number[];active:number;damageBonus:number;speedBonus:number;maxHpBonus:number;maxManaBonus:number;kills:number};
const SAVE_KEY='endless-islands-run-v1';
const META_KEY='endless-islands-meta-v1';
export type Input={keys:Set<string>;fire:boolean;touchAim:boolean;mouseX:number;mouseY:number;touchX:number;touchZ:number};

export class Game {
  readonly world:WorldView;
  readonly input:Input={keys:new Set(),fire:false,touchAim:false,mouseX:innerWidth/2,mouseY:innerHeight/2,touchX:0,touchZ:0};
  mode:Mode='menu';
  heroIndex=0;
  island=1;
  seed=1;
  hp=100;maxHp=100;mana=100;maxMana=100;ammo=100;coins=0;xp=0;level=1;kills=0;
  weapons=[0,-1];clips=[18,18];weaponSlot=0;passives:number[]=[];active=0;
  damageBonus=0;speedBonus=0;maxHpBonus=0;maxManaBonus=0;
  enemies:Enemy[]=[];projectiles:Projectile[]=[];pickups:Pickup[]=[];
  pulses:Pulse[]=[];
  fireCooldown=0;skillCooldown=0;buff=0;speedBuff=0;shield=0;shieldTimer=30;invulnerable=0;dashCooldown=0;reload=0;reloadSlot=0;statusSlow=0;nextShotDouble=false;
  fireAura=0;whirlAura=0;orbAura=0;auraTick=0;
  rewardChoices:Reward[]=[];rewardRounds=1;transitioning=false;
  portalOpen=false;revived=false;
  toast='';toastTime=0;
  onModeChange:()=>void=()=>{};
  onBreak:()=>Promise<void>=async()=>{};
  private runTime=0;
  private lastSave='';
  constructor(canvas:HTMLCanvasElement){this.world=new WorldView(canvas);}

  async init():Promise<void> {
    await this.world.init();
    this.world.buildIsland(0,0,343,true);
  }
  setMode(mode:Mode):void {
    this.mode=mode;
    setGameplayActive(mode==='playing');
    this.onModeChange();
  }
  showToast(message:string):void {this.toast=message;this.toastTime=3.3;}
  lobby():void {
    this.clearActors();
    this.world.buildIsland(0,0,343,true);
    this.setMode('lobby');
  }
  menu():void {
    this.clearActors();
    this.world.buildIsland(0,0,343,true);
    this.setMode('menu');
  }
  newRun(heroIndex:number):void {
    this.heroIndex=heroIndex;
    this.seed=(Date.now() ^ Math.floor(Math.random()*1e9))>>>0;
    this.island=1;
    this.weapons=[0,-1];this.clips=[18,18];this.weaponSlot=0;this.passives=[];this.active=0;
    this.damageBonus=0;this.speedBonus=0;this.maxHpBonus=0;this.maxManaBonus=0;
    this.hp=HEROES[heroIndex].hp;this.mana=HEROES[heroIndex].mana;
    this.ammo=100;this.coins=0;this.xp=0;this.level=1;this.kills=0;
    this.revived=false;this.buff=0;this.speedBuff=0;this.shield=0;this.shieldTimer=30;this.nextShotDouble=false;
    this.startIsland();
  }
  getSave():Save|null {
    try {
      const raw=localStorage.getItem(SAVE_KEY);
      if(!raw)return null;
      const value=JSON.parse(raw) as Save;
      return value.version===1&&value.island>=1&&value.island<=20&&value.heroIndex>=0&&value.heroIndex<4&&Array.isArray(value.weapons)&&Array.isArray(value.passives)?value:null;
    } catch { return null; }
  }
  resume():boolean {
    const s=this.getSave();if(!s)return false;
    this.heroIndex=s.heroIndex;this.island=s.island;this.seed=s.seed;
    this.hp=s.hp;this.mana=s.mana;this.ammo=s.ammo;this.coins=s.coins;this.xp=s.xp;this.level=s.level;
    this.weapons=s.weapons;this.clips=s.clips||[18,18];this.passives=s.passives;this.active=s.active;
    this.damageBonus=s.damageBonus;this.speedBonus=s.speedBonus;this.maxHpBonus=s.maxHpBonus;this.maxManaBonus=s.maxManaBonus;this.kills=s.kills;
    this.startIsland();return true;
  }
  private save():void {
    const s:Save={version:1,heroIndex:this.heroIndex,island:this.island,seed:this.seed,hp:this.hp,mana:this.mana,ammo:this.ammo,coins:this.coins,xp:this.xp,level:this.level,weapons:this.weapons,clips:this.clips,passives:this.passives,active:this.active,damageBonus:this.damageBonus,speedBonus:this.speedBonus,maxHpBonus:this.maxHpBonus,maxManaBonus:this.maxManaBonus,kills:this.kills};
    const raw=JSON.stringify(s);
    if(raw===this.lastSave)return;
    this.lastSave=raw;
    try{localStorage.setItem(SAVE_KEY,raw);}catch{/* storage disabled */}
    void writeCloudSave(s);
  }
  private finishRun(win:boolean):void {
    try{localStorage.removeItem(SAVE_KEY);}catch{/* storage disabled */}
    void writeCloudSave(null);
    this.lastSave='';
    if(win){
      try{
        const old=JSON.parse(localStorage.getItem(META_KEY)||'{}') as {wins?:number;best?:number};
        localStorage.setItem(META_KEY,JSON.stringify({wins:(old.wins||0)+1,best:20}));
      }catch{/* storage disabled */}
    }
    this.setMode(win?'won':'dead');
  }
  private clearActors():void {
    for(const e of this.enemies)this.world.removeVisual(e.mesh);
    for(const p of this.projectiles)this.world.removeVisual(p.mesh);
    for(const p of this.pickups)this.world.removeVisual(p.mesh);
    for(const p of this.pulses)this.world.removeVisual(p.mesh);
    this.enemies=[];this.projectiles=[];this.pickups=[];this.pulses=[];
  }
  startIsland():void {
    this.transitioning=false;
    this.clearActors();
    const biome=biomeForIsland(this.island);
    const shape=shapeForIsland(this.seed,this.island);
    this.world.buildIsland(biome,shape,this.seed+this.island*101);
    this.world.spawnHero(this.heroIndex);
    this.portalOpen=false;
    this.fireCooldown=.4;this.skillCooldown=0;this.invulnerable=1.5;this.dashCooldown=0;
    const bossIndex=BOSS_ISLANDS.indexOf(this.island);
    const rng=seeded(this.seed+this.island*991);
    if(bossIndex>=0){
      this.spawnEnemy(BOSSES[bossIndex],true,0,-3);
    } else {
      const count=3+Math.min(3,Math.floor(this.island/4));
      for(let i=0;i<count;i++){
        const a=(i+.5)/count*Math.PI*2;
        const kind=ENEMIES[biome*10+Math.floor(rng()*10)];
        this.spawnEnemy(kind,false,Math.cos(a)*4.5,Math.sin(a)*4.5-1);
      }
      if(this.island%3===0) {
        const elite=ELITES[biome*5+Math.floor(rng()*5)];
        this.spawnEnemy(elite,false,0,-4);
      }
    }
    this.showToast('Остров '+this.island+' · '+SHAPES[shape]);
    this.setMode('playing');
    this.save();
  }
  private spawnEnemy(kind:EnemyKind|Boss,boss:boolean,x:number,z:number):Enemy {
    const model=this.world.makeEnemy(kind,boss);
    model.position.set(x,1.75,z);
    this.world.islandObjects.add(model);
    const enemy:Enemy={kind,boss,mesh:model,x,z,y:1.75,hp:kind.hp,maxHp:kind.hp,cooldown:1+Math.random(),phase:1,time:0,slow:0};
    this.enemies.push(enemy);
    return enemy;
  }
  get activeWeapon(){return WEAPONS[this.weapons[this.weaponSlot]??0]||WEAPONS[0];}
  get boss(){return this.enemies.find(e=>e.boss)||null;}
  get biome(){return BIOMES[biomeForIsland(this.island)];}
  get ability(){return ACTIVES[this.active];}
  get maxHealth(){return HEROES[this.heroIndex].hp+this.maxHpBonus+(this.passives.includes(0)?20:0);}
  get maxMagic(){return HEROES[this.heroIndex].mana+this.maxManaBonus+(this.passives.includes(12)?20:0);}
  private firePlayer(target:THREE.Vector3):void {
    const body=this.world.heroBody;if(!body)return;
    const weapon=this.activeWeapon;
    if(this.fireCooldown>0||this.reload>0)return;
    if(this.clips[this.weaponSlot]<=0){this.startReload();return;}
    if(weapon.cost>this.ammo){this.showToast('Недостаточно боезапаса · клавиша 1 — Искра Путника');return;}
    this.ammo-=weapon.cost;this.clips[this.weaponSlot]--;
    const p=body.translation(),dx=target.x-p.x,dz=target.z-p.z,len=Math.hypot(dx,dz)||1;
    const vx=dx/len,vz=dz/len;
    const bonus=1+this.damageBonus+(this.passives.includes(1)?.08:0)+(this.buff>0?.25:0)+(this.hp<this.maxHealth*.35&&this.passives.includes(14)?.12:0);
    const crit=Math.random()<(HEROES[this.heroIndex].crit+(this.passives.includes(4)?.05:0));
    const damage=weapon.damage*bonus*(crit?1.5:1)*(this.nextShotDouble?2:1);
    this.nextShotDouble=false;
    const projectileSpeed=weapon.speed*(this.passives.includes(19)?1.08:1);
    this.createProjectile(p.x+vx*.5,p.z+vz*.5,vx*projectileSpeed,vz*projectileSpeed,damage,false,weapon.color);
    if(crit&&this.passives.includes(16))this.createProjectile(p.x,p.z,(vx*.96-vz*.22)*weapon.speed,(vz*.96+vx*.22)*weapon.speed,damage*.5,false,weapon.color);
    this.fireCooldown=1/weapon.rate;
    this.world.heroMesh!.userData.gun.rotation.x=-.15;
  }
  private createProjectile(x:number,z:number,vx:number,vz:number,damage:number,hostile:boolean,color:number):void {
    const m=this.world.makeProjectile(color,hostile?.19:.14);
    m.position.set(x,hostile?1.25:1.35,z);
    m.rotation.y=Math.atan2(vx,vz);
    this.world.effects.add(m);
    this.projectiles.push({mesh:m,x,z,vx,vz,life:hostile?4:2,damage,hostile,radius:hostile?.35:.46});
  }
  private damageEnemy(e:Enemy,damage:number):void {
    if(e.kind.id.startsWith('X')&&this.passives.includes(18))damage*=1.08;
    e.hp-=damage;
    if(this.passives.includes(6))this.hp=Math.min(this.maxHealth,this.hp+damage*.06);
    if(e.hp>0)return;
    this.world.removeVisual(e.mesh);
    this.enemies=this.enemies.filter(x=>x!==e);
    this.kills++;this.xp+=e.boss?120:e.kind.id.startsWith('X')?35:12;
    this.coins+=Math.round((e.boss?80:e.kind.id.startsWith('X')?20:5)*(this.passives.includes(9)?1.2:1));
    const r=Math.random()-(this.passives.includes(7)?.1:0);
    this.drop(e.x,e.z,r<.22?'hp':r<.4?'mana':r<.75?'ammo':'coin');
    if(this.enemies.length===0&&!this.portalOpen){
      this.portalOpen=true;
      this.world.spawnPortal(0,-5.4);
      this.showToast('Остров очищен · войдите в портал');
    }
  }
  private damageHero(amount:number):void {
    if(this.invulnerable>0||this.mode!=='playing')return;
    if(this.passives.includes(13)&&Math.random()<.08)return;
    let value=Math.max(1,amount-HEROES[this.heroIndex].armor-(this.passives.includes(2)?3:0));
    const absorbed=Math.min(this.shield,value);this.shield-=absorbed;value-=absorbed;
    this.hp=Math.max(0,this.hp-value);
    if(this.passives.includes(8)){
      const p=this.world.heroBody?.translation();
      if(p){const enemy=this.nearestEnemy(p.x,p.z);if(enemy&&Math.hypot(enemy.x-p.x,enemy.z-p.z)<2)this.damageEnemy(enemy,value*.1);}
    }
    if(this.biome===BIOMES[1])this.statusSlow=this.passives.includes(11)?.65:1.1;
    this.invulnerable=.45;
    if(this.hp<=0)this.finishRun(false);
  }
  private drop(x:number,z:number,kind:Pickup['kind']):void {
    const m=this.world.makePickup(kind);m.position.set(x,0,z);this.world.effects.add(m);
    this.pickups.push({mesh:m,x,z,kind,time:0});
  }
  private pulse(x:number,z:number,radius:number,color=this.biome.accent):void {
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false});
    const m=new THREE.Mesh(new THREE.TorusGeometry(1,.035,6,36),material);
    m.rotation.x=Math.PI/2;m.position.set(x,.16,z);
    m.scale.setScalar(.15);
    this.world.effects.add(m);
    this.pulses.push({mesh:m,age:0,duration:.55,radius});
  }
  private updatePulses(dt:number):void {
    for(const p of [...this.pulses]){
      p.age+=dt;
      const ratio=p.age/p.duration;
      p.mesh.scale.setScalar(.15+p.radius*ratio);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.8*(1-ratio));
      if(ratio>=1){
        this.world.removeVisual(p.mesh);
        this.pulses.splice(this.pulses.indexOf(p),1);
      }
    }
  }
  private useAbility(target:THREE.Vector3):void {
    if(this.skillCooldown>0||this.mana<this.ability.cost)return;
    const body=this.world.heroBody;if(!body)return;
    this.mana-=this.ability.cost;this.skillCooldown=this.ability.cooldown;
    const p=body.translation(),a=this.active;
    this.pulse(p.x,p.z,a===0?1.5:a===12?5:3.5);
    if(a===0){
      const dx=target.x-p.x,dz=target.z-p.z,len=Math.hypot(dx,dz)||1;
      let x=p.x,z=p.z;
      for(let i=0;i<12;i++){
        const nx=x+dx/len*.65,nz=z+dz/len*.65;
        if(!this.world.onIsland(nx,nz))break;
        if(this.world.obstacles.some(o=>Math.hypot(o.x-nx,o.z-nz)<.8))break;
        x=nx;z=nz;
      }
      body.setTranslation({x,y:p.y,z},true);this.invulnerable=.3;
    } else if(a===1){this.speedBuff=4;}
    else if(a===2){this.buff=6;}
    else if(a===3){this.nextShotDouble=true;}
    else if(a===4){this.shield+=35;}
    else if(a===6){this.hp=Math.min(this.maxHealth,this.hp+25*(this.passives.includes(17)?1.1:1));}
    else if(a===7){this.invulnerable=3;}
    else if(a===11){const nearest=this.nearestEnemy(p.x,p.z);if(nearest)nearest.slow=3;}
    else if(a===12){
      const dx=target.x-p.x,dz=target.z-p.z,len=Math.hypot(dx,dz)||1;
      for(const e of [...this.enemies]){
        const along=(e.x-p.x)*dx/len+(e.z-p.z)*dz/len;
        const side=Math.abs((e.x-p.x)*dz/len-(e.z-p.z)*dx/len);
        if(along>0&&along<12&&side<1.2)this.damageEnemy(e,55);
      }
    } else if(a===8){this.whirlAura=4;}
    else if(a===9||a===14){this.orbAura=8;}
    else if(a===10){this.fireAura=5;}
    else {
      const radius=a===5?3.2:a===13?5:4.3;
      for(const e of [...this.enemies]){
        const d=Math.hypot(e.x-p.x,e.z-p.z);
        if(d<radius){
          this.damageEnemy(e,a===5?25:20);
          if(a===13){e.x+=(p.x-e.x)*.25;e.z+=(p.z-e.z)*.25;}
          if(a===5){e.x+=(e.x-p.x)/Math.max(d,.1)*1.2;e.z+=(e.z-p.z)/Math.max(d,.1)*1.2;}
          if(a===14||a===9)e.slow=2;
        }
      }
    }
    this.showToast(this.ability.name);
  }
  private nearestEnemy(x:number,z:number):Enemy|null {
    let best:Enemy|null=null,d=Infinity;
    for(const e of this.enemies){const q=Math.hypot(e.x-x,e.z-z);if(q<d){d=q;best=e;}}
    return best;
  }
  private fireEnemy(e:Enemy,targetX:number,targetZ:number):void {
    const dx=targetX-e.x,dz=targetZ-e.z;
    const behavior=e.boss?e.phase:(e.kind as EnemyKind).behavior;
    const n=e.boss?Math.min(9,e.phase*2+1):behavior===3||behavior===6?3:1;
    const spread=n===1?0:.18;
    for(let i=0;i<n;i++){
      const a=Math.atan2(dx,dz)+(i-(n-1)/2)*spread;
      const speed=e.boss?7.3:behavior===2?9:6.7;
      this.createProjectile(e.x,e.z,Math.sin(a)*speed,Math.cos(a)*speed,e.kind.damage,true,this.biome.accent);
    }
  }
  private updateEnemies(dt:number,px:number,pz:number):void {
    for(const e of this.enemies){
      e.time+=dt;e.cooldown-=dt;e.slow=Math.max(0,e.slow-dt);
      const dx=px-e.x,dz=pz-e.z,d=Math.hypot(dx,dz)||1;
      const behavior=e.boss?3:(e.kind as EnemyKind).behavior;
      const speed=(e.boss?1.1:e.kind.id.startsWith('X')?2:2.4)*(e.slow>0?.35:1);
      const desired=e.boss?4.5:behavior===0||behavior===1||behavior===6?2.5:5.3;
      if(d>desired){
        const nx=e.x+dx/d*speed*dt,nz=e.z+dz/d*speed*dt;
        if(Math.hypot(nx,nz)<12.6){e.x=nx;e.z=nz;}
      } else if(d<desired-1){
        e.x-=dx/d*speed*.45*dt;e.z-=dz/d*speed*.45*dt;
      }
      if(e.boss){
        const phase=e.hp/e.maxHp>.66?1:e.hp/e.maxHp>.33?2:3;
        if(phase!==e.phase){e.phase=phase;this.showToast(e.kind.name+' · фаза '+phase);}
      }
      if(e.cooldown<=0){
        if(d<12)this.fireEnemy(e,px,pz);
        e.cooldown=e.boss?Math.max(1.1,2.4-e.phase*.35):behavior===2?1.6:2.1;
      }
      if(d<.9)this.damageHero(e.kind.damage*dt*1.5);
      e.mesh.position.set(e.x,1.7+Math.sin(e.time*3)*.18,e.z);
      e.mesh.rotation.y=Math.atan2(dx,dz);
      e.mesh.rotation.z=Math.sin(e.time*7)*.08;
      const wings=e.mesh.userData.wings as THREE.Object3D[];
      wings.forEach((wing,i)=>{
        if(wing.userData.baseZ===undefined)wing.userData.baseZ=wing.rotation.z;
        wing.rotation.z=(wing.userData.baseZ as number)+Math.sin(e.time*10+i*.6)*(i%2?-.23:.23);
      });
    }
  }
  private updateProjectiles(dt:number,px:number,pz:number):void {
    for(const p of [...this.projectiles]){
      p.x+=p.vx*dt;p.z+=p.vz*dt;p.life-=dt;
      p.mesh.position.x=p.x;p.mesh.position.z=p.z;
      let hit=false;
      if(p.hostile){
        if(Math.hypot(p.x-px,p.z-pz)<p.radius+.3){this.damageHero(p.damage);hit=true;}
      } else {
        for(const e of [...this.enemies]){
          if(Math.hypot(e.x-p.x,e.z-p.z)<p.radius+(e.boss?1.25:e.kind.id.startsWith('X')?.8:.54)){
            this.damageEnemy(e,p.damage);hit=true;break;
          }
        }
        if(!hit){
          const object=this.world.obstacles.find(o=>o.hp<99&&Math.hypot(o.x-p.x,o.z-p.z)<p.radius+.5);
          if(object){
            object.hp--;hit=true;
            if(object.hp<=0){
              this.world.removeObstacle(object);
              this.drop(object.x,object.z,Math.random()<.5?'ammo':'coin');
            }
          }
        }
      }
      if(hit||p.life<=0||Math.hypot(p.x,p.z)>16){
        this.projectiles.splice(this.projectiles.indexOf(p),1);
        this.world.removeVisual(p.mesh);
      }
    }
  }
  private updatePickups(dt:number,px:number,pz:number):void {
    for(const p of [...this.pickups]){
      p.time+=dt;p.mesh.position.y=Math.sin(p.time*3)*.12;
      p.mesh.rotation.y+=dt*1.4;
      if(Math.hypot(p.x-px,p.z-pz)<.85){
        if(p.kind==='hp')this.hp=Math.min(this.maxHealth,this.hp+25);
        if(p.kind==='mana')this.mana=Math.min(this.maxMagic,this.mana+25);
        if(p.kind==='ammo')this.ammo+=25;
        if(p.kind==='coin')this.coins+=15;
        this.world.removeVisual(p.mesh);
        this.pickups.splice(this.pickups.indexOf(p),1);
      }
    }
  }
  update(dt:number):void {
    dt=Math.min(dt,.05);
    this.world.animate(dt,this.mode==='playing'&&this.moving());
    if(this.mode==='playing')this.updatePulses(dt);
    this.world.render(dt,this.mode==='playing'||this.mode==='paused'||this.mode==='reward');
    if(this.toastTime>0)this.toastTime=Math.max(0,this.toastTime-dt);
    if(this.mode!=='playing')return;
    this.runTime+=dt;
    this.fireCooldown=Math.max(0,this.fireCooldown-dt);
    this.skillCooldown=Math.max(0,this.skillCooldown-dt);
    this.dashCooldown=Math.max(0,this.dashCooldown-dt);
    this.invulnerable=Math.max(0,this.invulnerable-dt);
    this.buff=Math.max(0,this.buff-dt);
    this.speedBuff=Math.max(0,this.speedBuff-dt);
    this.statusSlow=Math.max(0,this.statusSlow-dt);
    if(this.reload>0){this.reload=Math.max(0,this.reload-dt);if(this.reload===0)this.clips[this.reloadSlot]=this.clipCapacity(this.reloadSlot);}
    if(this.passives.includes(15)){this.shieldTimer-=dt;if(this.shieldTimer<=0){this.shield=Math.max(this.shield,15);this.shieldTimer=30;}}
    this.fireAura=Math.max(0,this.fireAura-dt);this.whirlAura=Math.max(0,this.whirlAura-dt);this.orbAura=Math.max(0,this.orbAura-dt);
    this.mana=Math.min(this.maxMagic,this.mana+dt*.5);
    if(this.passives.includes(3))this.hp=Math.min(this.maxHealth,this.hp+dt*.2);
    const body=this.world.heroBody;if(!body)return;
    let mx=(this.input.keys.has('KeyD')||this.input.keys.has('ArrowRight')?1:0)-(this.input.keys.has('KeyA')||this.input.keys.has('ArrowLeft')?1:0)+this.input.touchX;
    let mz=(this.input.keys.has('KeyS')||this.input.keys.has('ArrowDown')?1:0)-(this.input.keys.has('KeyW')||this.input.keys.has('ArrowUp')?1:0)+this.input.touchZ;
    const mag=Math.hypot(mx,mz);
    if(mag>1){mx/=mag;mz/=mag;}
    const speed=HEROES[this.heroIndex].speed*(1+this.speedBonus+(this.passives.includes(5)?.07:0)+(this.speedBuff>0?.3:0))*(this.statusSlow>0?.7:1);
    const vel=body.linvel();
    body.setLinvel({x:mx*speed,y:vel.y,z:mz*speed},true);
    this.world.physics.timestep=dt;
    this.world.physics.step();
    const p=body.translation();
    if(p.y<-.2){
      if(p.y<-4)this.finishRun(false);
      return;
    }
    let target=this.world.aimAt(this.input.mouseX,this.input.mouseY);
    if(this.input.touchAim){
      const nearest=this.nearestEnemy(p.x,p.z);
      if(nearest)target=new THREE.Vector3(nearest.x,1,nearest.z);
    }
    if(this.world.heroMesh)this.world.heroMesh.rotation.y=Math.atan2(target.x-p.x,target.z-p.z);
    if(this.input.fire)this.firePlayer(target);
    if(this.input.keys.has('KeyQ')){this.input.keys.delete('KeyQ');this.useAbility(target);}
    if(this.input.keys.has('Space')&&this.dashCooldown<=0){
      this.input.keys.delete('Space');
      const dash=ACTIVES[0],old=this.active;
      if(old===0)this.useAbility(target);
      else {
        const len=Math.hypot(mx,mz)||1;
        const nx=p.x+mx/len*2.3,nz=p.z+mz/len*2.3;
        if(this.world.onIsland(nx,nz))body.setTranslation({x:nx,y:p.y,z:nz},true);
        this.dashCooldown=5;this.invulnerable=.18;
      }
      void dash;
    }
    this.updateEnemies(dt,p.x,p.z);
    this.auraTick-=dt;
    if(this.auraTick<=0&&(this.fireAura>0||this.whirlAura>0||this.orbAura>0)){
      this.auraTick=.5;
      const radius=this.fireAura>0?3.4:this.whirlAura>0?3:5;
      const damage=this.fireAura>0?10:this.whirlAura>0?8:8;
      this.pulse(p.x,p.z,radius,this.fireAura>0?0xff8c5c:this.whirlAura>0?0x9de6e7:0xb7a1ff);
      for(const e of [...this.enemies])if(Math.hypot(e.x-p.x,e.z-p.z)<radius)this.damageEnemy(e,damage);
    }
    this.updateProjectiles(dt,p.x,p.z);
    this.updatePickups(dt,p.x,p.z);
    if(this.portalOpen&&Math.hypot(p.x,p.z+5.4)<1.2)this.enterPortal();
  }
  private moving():boolean {
    return this.input.touchX!==0||this.input.touchZ!==0||['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>this.input.keys.has(k));
  }
  enterPortal():void {
    if(!this.portalOpen||this.mode!=='playing')return;
    if(this.island===20){this.finishRun(true);return;}
    this.rewardRounds=1+Math.floor(this.xp/(70+this.level*20));
    this.xp=this.xp%(70+this.level*20);
    this.level+=this.rewardRounds;
    this.makeRewards();
    this.setMode('reward');
  }
  private makeRewards():void {
    const rng=seeded(this.seed+this.island*177+this.rewardRounds*37);
    const choices:Reward[]=[];
    const used=new Set<string>();
    for(let i=0;i<3;i++){
      const kindIndex=(i+Math.floor(rng()*4))%4;
      const rarity=rng()<.05?'legendary':rng()<.14?'epic':rng()<.36?'rare':'common';
      let item:Reward;
      if(kindIndex===0){
        const id=Math.floor(rng()*3);
        item={kind:'stat',id,title:['Живучесть','Сила','Ловкость'][id],description:['+20 максимального HP и исцеление','+12% урона','+8% скорости'][id],rarity};
      } else if(kindIndex===1){
        const id=Math.floor(rng()*PASSIVES.length);
        item={kind:'passive',id,title:PASSIVES[id].name,description:PASSIVES[id].description,rarity};
      } else if(kindIndex===2){
        const id=1+Math.floor(rng()*(Math.min(29,4+this.island*2)));
        item={kind:'weapon',id,title:WEAPONS[id].name,description:String(WEAPONS[id].damage)+' урона · '+String(WEAPONS[id].cost)+' боезапас',rarity};
      } else {
        const id=Math.floor(rng()*ACTIVES.length);
        item={kind:'active',id,title:ACTIVES[id].name,description:ACTIVES[id].description,rarity};
      }
      const key=item.kind+item.id;
      if(used.has(key)){i--;continue;}
      used.add(key);choices.push(item);
    }
    this.rewardChoices=choices;
  }
  async chooseReward(index:number):Promise<void> {
    if(this.mode!=='reward'||this.transitioning)return;
    const r=this.rewardChoices[index];if(!r)return;
    if(r.kind==='stat'){
      if(r.id===0){this.maxHpBonus+=20;this.hp=Math.min(this.maxHealth,this.hp+30);}
      if(r.id===1)this.damageBonus+=.12;
      if(r.id===2)this.speedBonus+=.08;
    } else if(r.kind==='passive'){
      if(!this.passives.includes(r.id))this.passives.push(r.id);
      else {this.damageBonus+=.04;}
    } else if(r.kind==='weapon'){
      const slot=this.weapons[1]===-1?1:1-this.weaponSlot;
      this.weapons[slot]=r.id;
      this.clips[slot]=this.clipCapacity(slot);
      this.ammo+=30;
    } else this.active=r.id;
    this.rewardRounds--;
    if(this.rewardRounds>0){this.makeRewards();this.onModeChange();return;}
    this.transitioning=true;this.onModeChange();
    this.island++;
    this.hp=Math.min(this.maxHealth,this.hp+15);
    this.mana=Math.min(this.maxMagic,this.mana+30);
    if(this.island%5===0)await this.onBreak();
    this.startIsland();
  }
  revive():void {
    if(this.mode!=='dead'||this.revived)return;
    this.revived=true;this.hp=Math.ceil(this.maxHealth*.55);
    this.mana=Math.ceil(this.maxMagic*.5);
    this.invulnerable=3;
    const p=this.world.heroBody?.translation();
    if(p&&p.y<0)this.world.heroBody?.setTranslation({x:0,y:1.2,z:5.2},true);
    this.setMode('playing');
  }
  switchWeapon(slot:number):void {
    if(this.weapons[slot]>=0){this.weaponSlot=slot;this.showToast(this.activeWeapon.name);}
  }
  clipCapacity(slot:number):number {return this.weapons[slot]===0?18:this.weapons[slot]>=20?8:14;}
  startReload():void {
    if(this.mode!=='playing'||this.reload>0||this.weapons[this.weaponSlot]<0||this.clips[this.weaponSlot]>=this.clipCapacity(this.weaponSlot))return;
    this.reloadSlot=this.weaponSlot;
    this.reload=1.4*(this.passives.includes(10)?.85:1);
    this.showToast('Перезарядка');
  }
  pause():void {if(this.mode==='playing')this.setMode('paused');else if(this.mode==='paused')this.setMode('playing');}
  useSkill():void {
    if(this.mode!=='playing')return;
    const p=this.world.heroBody?.translation();if(!p)return;
    const nearest=this.nearestEnemy(p.x,p.z);
    const target=nearest?new THREE.Vector3(nearest.x,1,nearest.z):this.world.aimAt(this.input.mouseX,this.input.mouseY);
    this.useAbility(target);
  }
  public saveCheckpoint():void { if(this.mode==='playing'||this.mode==='paused')this.save(); }
  public debugIsland(n:number):void {this.island=Math.max(1,Math.min(20,n));this.startIsland();}
  public debugHeal():void {this.hp=this.maxHealth;this.mana=this.maxMagic;this.ammo=999;}
}
