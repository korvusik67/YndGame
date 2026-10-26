import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { BIOMES, HEROES, islandRadius, seeded, type EnemyKind, type Boss } from './content';

const vec=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const mat=(color:number,metalness=0,roughness=.8)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const emissive=(color:number)=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.65,roughness:.35});
function mesh(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0):THREE.Mesh {
  const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o;
}
function box(w:number,h:number,d:number,color:number,x=0,y=0,z=0):THREE.Mesh {
  return mesh(new THREE.BoxGeometry(w,h,d),mat(color),x,y,z);
}
function ball(r:number,color:number,x=0,y=0,z=0,seg=12):THREE.Mesh {
  return mesh(new THREE.IcosahedronGeometry(r,seg<10?0:1),mat(color),x,y,z);
}
function cylinder(rt:number,rb:number,h:number,color:number,x=0,y=0,z=0,segments=10):THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat(color),x,y,z);
}
function ring(r:number,tube:number,color:number,x=0,y=0,z=0):THREE.Mesh {
  const o=mesh(new THREE.TorusGeometry(r,tube,7,32),emissive(color),x,y,z);return o;
}

export type Obstacle = { kind:'crate'|'barrel'|'fountain'|'crystal'|'column'; mesh:THREE.Group; x:number; z:number; hp:number; collider:RAPIER.Collider|null };
export class WorldView {
  scene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-14,14,10,-10,.1,200);
  renderer:THREE.WebGLRenderer;
  physics!:RAPIER.World;
  heroBody:RAPIER.RigidBody|null=null;
  heroMesh:THREE.Group|null=null;
  islandObjects=new THREE.Group();
  effects=new THREE.Group();
  obstacles:Obstacle[]=[];
  portal:THREE.Group|null=null;
  shape=0;
  biome=0;
  time=0;
  private cloudGroups:THREE.Group[]=[];
  private follow=vec(0,0,0);
  private light:THREE.DirectionalLight;

  constructor(canvas:HTMLCanvasElement) {
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.35;
    this.scene.add(new THREE.HemisphereLight(0xcceaff,0x354257,2.1));
    this.light=new THREE.DirectionalLight(0xffe3b4,3.1);
    this.light.position.set(-8,18,10);
    this.light.castShadow=true;
    this.light.shadow.mapSize.set(1024,1024);
    this.light.shadow.camera.left=-22;this.light.shadow.camera.right=22;
    this.light.shadow.camera.top=22;this.light.shadow.camera.bottom=-22;
    this.light.shadow.bias=-.0003;
    this.scene.add(this.light);
    this.scene.add(this.islandObjects,this.effects);
    this.resize();
    window.addEventListener('resize',()=>this.resize());
  }
  async init():Promise<void> {
    await RAPIER.init();
    this.physics=new RAPIER.World({x:0,y:-22,z:0});
  }
  resize():void {
    const w=window.innerWidth,h=window.innerHeight;
    this.renderer.setSize(w,h,false);
    const aspect=w/h;
    const half=aspect<1?14:11;
    this.camera.left=-half*aspect;this.camera.right=half*aspect;
    this.camera.top=half;this.camera.bottom=-half;
    this.camera.updateProjectionMatrix();
  }
  clearIsland():void {
    this.heroBody=null;this.heroMesh=null;this.portal=null;this.obstacles=[];
    this.scene.remove(this.islandObjects,this.effects);
    this.disposeObject(this.islandObjects);this.disposeObject(this.effects);
    this.islandObjects=new THREE.Group();this.effects=new THREE.Group();
    this.scene.add(this.islandObjects,this.effects);
    this.physics=new RAPIER.World({x:0,y:-22,z:0});
    this.cloudGroups=[];
  }
  private disposeObject(object:THREE.Object3D):void {
    object.traverse(o=>{
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      const materials=Array.isArray(o.material)?o.material:[o.material];
      materials.forEach(m=>m.dispose());
    });
  }
  removeVisual(object:THREE.Object3D):void {
    object.removeFromParent();
    this.disposeObject(object);
  }
  onIsland(x:number,z:number):boolean {
    const a=Math.atan2(z,x);
    return Math.hypot(x,z)<islandRadius(a,this.shape)-.4;
  }
  buildIsland(biomeIndex:number,shape:number,seed:number,lobby=false):void {
    this.clearIsland();
    this.biome=biomeIndex;this.shape=shape;
    const biome=BIOMES[biomeIndex];
    this.scene.background=new THREE.Color(biome.sky);
    this.scene.fog=new THREE.FogExp2(biome.sky,.013);
    const rng=seeded(seed);
    const count=96;
    const vertices:number[]=[0,0,0];
    const colors:number[]=[];
    const c=new THREE.Color(biome.ground);
    colors.push(c.r,c.g,c.b);
    for(let i=0;i<=count;i++){
      const a=i/count*Math.PI*2;
      const r=islandRadius(a,shape);
      vertices.push(Math.cos(a)*r,0,Math.sin(a)*r);
      const v=new THREE.Color(biome.ground).multiplyScalar(.9+rng()*.18);
      colors.push(v.r,v.g,v.b);
    }
    const indices:number[]=[];
    for(let i=1;i<=count;i++) indices.push(0,i,i+1);
    const groundGeo=new THREE.BufferGeometry();
    groundGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    groundGeo.setIndex(indices);groundGeo.computeVertexNormals();
    const ground=mesh(groundGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
    ground.receiveShadow=true;ground.castShadow=false;
    this.islandObjects.add(ground);
    const collider=this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.physics.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(indices)),collider);
    const sideVerts:number[]=[];const sideIndices:number[]=[];
    for(let i=0;i<=count;i++){
      const a=i/count*Math.PI*2;
      const r=islandRadius(a,shape);
      sideVerts.push(Math.cos(a)*r,0,Math.sin(a)*r);
      sideVerts.push(Math.cos(a)*(r*.57),-4.1-rng()*1.8,Math.sin(a)*(r*.57));
    }
    for(let i=0;i<count;i++){
      const n=i*2;sideIndices.push(n,n+1,n+2,n+1,n+3,n+2);
    }
    const sideGeo=new THREE.BufferGeometry();
    sideGeo.setAttribute('position',new THREE.Float32BufferAttribute(sideVerts,3));
    sideGeo.setIndex(sideIndices);sideGeo.computeVertexNormals();
    this.islandObjects.add(mesh(sideGeo,mat(biome.edge)));
    this.islandObjects.add(mesh(new THREE.ConeGeometry(5.7,5.5,12),mat(biome.rock),0,-6.7,0));
    for(let i=0;i<32;i++){
      const a=rng()*Math.PI*2,r=2.5+rng()*7.5,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if (!this.onIsland(x,z)) continue;
      if(rng()<.62){
        const pebble=ball(.08+rng()*.14,biome.rock,x,.08,z,6);
        pebble.scale.y=.4;this.islandObjects.add(pebble);
      } else {
        const grass=cylinder(.02,.035,.27,biome.foliage,x,.13,z,5);
        grass.rotation.z=rng()*.6-.3;this.islandObjects.add(grass);
      }
    }
    for(let i=0;i<15;i++){
      const a=i/15*Math.PI*2+rng()*.28,r=7.3+rng()*2.2,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(!this.onIsland(x,z))continue;
      if(i%4===0)this.addRuin(x,z,biome.rock,biome.accent);
      else if(biomeIndex===3)this.addObelisk(x,z,biome);
      else if(i%3===0)this.addCrystal(x,z,biome.accent);
      else this.addTree(x,z,biome.foliage,biomeIndex);
    }
    for(let layer=0;layer<3;layer++){
      const cloudGroup=new THREE.Group();
      for(let i=0;i<13;i++){
        const a=rng()*Math.PI*2,r=13+rng()*35;
        const cloud=ball(1.8+rng()*2.8,0xffffff,Math.cos(a)*r,-8-layer*4+rng()*2,Math.sin(a)*r);
        cloud.material=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.12+layer*.045,depthWrite:false});
        cloud.scale.set(1.9,.45,1);
        cloud.castShadow=false;
        cloudGroup.add(cloud);
      }
      this.islandObjects.add(cloudGroup);this.cloudGroups.push(cloudGroup);
    }
    for(let i=0;i<5;i++){
      const a=i/5*Math.PI*2+1.2,r=27+i*7;
      const distant=new THREE.Group();
      distant.add(cylinder(2.5,2.9,.5,biome.ground));
      distant.add(mesh(new THREE.ConeGeometry(2.2,3.5,8),mat(biome.rock),0,-2,0));
      distant.position.set(Math.cos(a)*r,-5-i*.45,Math.sin(a)*r);
      distant.scale.setScalar(.8+i*.13);this.islandObjects.add(distant);
    }
    if(lobby){
      const dais=cylinder(2.1,2.3,.24,0xb2a785,0,.12,0,12);
      this.islandObjects.add(dais,ring(2.05,.05,biome.accent,0,.24,0));
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2;
        const hero=this.makeHero(i);
        hero.position.set(Math.sin(a)*3.5,0,Math.cos(a)*3.5);
        hero.rotation.y=a+Math.PI;
        this.islandObjects.add(hero);
      }
    } else {
      for(let i=0;i<5;i++){
        const a=i*Math.PI*2/5+.4,x=Math.cos(a)*(4.6+rng()*1.1),z=Math.sin(a)*(4.6+rng()*1.1);
        if(i===0)this.addObstacle('fountain',x,z);
        else if(i===1)this.addObstacle('crystal',x,z);
        else this.addObstacle(i%2===0?'barrel':'crate',x,z);
      }
    }
    this.follow.set(0,0,0);
  }
  private addTree(x:number,z:number,color:number,biome:number):void {
    const group=new THREE.Group();group.position.set(x,0,z);
    group.add(cylinder(.19,.29,1.7,biome===2?0x382f31:0x735e49,0,.85,0));
    for(let j=0;j<4;j++){
      const a=j*2.4,r=j===0?0:.54;
      const leaf=ball(.9-j*.07,color,Math.cos(a)*r,1.9+(j%2)*.4,Math.sin(a)*r);
      group.add(leaf);
    }
    this.islandObjects.add(group);
    this.staticBall(x,z,.29);
  }
  private addRuin(x:number,z:number,color:number,accent:number):void {
    const group=new THREE.Group();group.position.set(x,0,z);
    group.add(cylinder(.4,.47,.22,color,0,.12,0,8));
    group.add(cylinder(.25,.28,1.8,color,0,1.05,0,8));
    group.add(cylinder(.43,.35,.2,color,0,2,0,8));
    group.add(ring(.22,.025,accent,0,1.37,0));
    this.islandObjects.add(group);this.staticBall(x,z,.38);
  }
  private addObelisk(x:number,z:number,biome:typeof BIOMES[number]):void {
    const group=new THREE.Group();group.position.set(x,0,z);
    group.add(box(.65,1.9,.65,biome.rock,0,.95,0));
    group.add(mesh(new THREE.ConeGeometry(.48,.75,4),emissive(biome.accent),0,2.23,0));
    this.islandObjects.add(group);this.staticBall(x,z,.42);
  }
  private addCrystal(x:number,z:number,color:number):void {
    const group=new THREE.Group();group.position.set(x,0,z);
    const crystal=mesh(new THREE.OctahedronGeometry(.68),emissive(color),0,.7,0);
    crystal.scale.y=1.65;group.add(crystal);
    group.add(ring(.7,.03,color,0,.1,0));this.islandObjects.add(group);
    this.staticBall(x,z,.4);
  }
  private staticBall(x:number,z:number,r:number):RAPIER.Collider {
    return this.physics.createCollider(RAPIER.ColliderDesc.ball(r).setTranslation(x,.45,z),this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
  }
  addObstacle(kind:Obstacle['kind'],x:number,z:number):Obstacle {
    const g=new THREE.Group();g.position.set(x,0,z);
    const b=BIOMES[this.biome];
    if(kind==='crate'){
      g.add(box(.9,.85,.9,0x96734d,0,.43,0));
      for(const v of [-.38,.38])g.add(box(.07,.88,.07,0xb99a66,v,.44,v));
    } else if(kind==='barrel'){
      g.add(cylinder(.46,.46,.95,0x865a42,0,.48,0,10));
      g.add(cylinder(.47,.47,.08,0x483f42,0,.16,0),cylinder(.47,.47,.08,0x483f42,0,.78,0));
    } else if(kind==='fountain'){
      g.add(cylinder(.95,1.1,.42,b.rock,0,.22,0,12),cylinder(.35,.42,1.15,b.rock,0,.8,0,10));
      g.add(ball(.3,b.accent,0,1.5,0));
    } else if(kind==='crystal'){
      g.add(mesh(new THREE.OctahedronGeometry(.62),emissive(b.accent),0,.77,0));
      g.children[0].scale.y=1.5;
    } else g.add(cylinder(.38,.43,1.8,b.rock,0,.9,0));
    this.islandObjects.add(g);
    const collider=this.staticBall(x,z,kind==='fountain'?.85:.48);
    const obstacle={kind,mesh:g,x,z,hp:kind==='fountain'?3:kind==='crystal'?2:kind==='column'?99:1,collider};
    this.obstacles.push(obstacle);
    return obstacle;
  }
  removeObstacle(o:Obstacle):void {
    this.removeVisual(o.mesh);
    if(o.collider)this.physics.removeCollider(o.collider,true);
    o.collider=null;
    this.obstacles=this.obstacles.filter(x=>x!==o);
  }
  spawnHero(heroIndex:number):THREE.Group {
    this.heroMesh=this.makeHero(heroIndex);
    this.islandObjects.add(this.heroMesh);
    const body=this.physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,1.05,5.2).lockRotations());
    this.physics.createCollider(RAPIER.ColliderDesc.capsule(.52,.32).setFriction(.1).setRestitution(0),body);
    this.heroBody=body;
    return this.heroMesh;
  }
  makeHero(index:number):THREE.Group {
    const h=HEROES[index],g=new THREE.Group();
    const torso=cylinder(.43,.52,.78,h.color,0,1.05,0,8);g.add(torso);
    g.add(cylinder(.4,.45,.18,h.detail,0,1.45,0,8));
    const head=ball(.36,index===3?0xb7a48a:0xeac9ad,0,1.78,0);
    g.add(head);
    const hair=ball(.38,index===0?0xf4f0de:index===1?0x354b3f:index===2?0x4b396d:0x645443,0,2.0,-.05);
    hair.scale.y=.53;g.add(hair);
    if(index===1){
      const hood=mesh(new THREE.ConeGeometry(.5,.55,8),mat(h.color),0,2.24,-.1);g.add(hood);
    } else if(index===2){
      const hat=mesh(new THREE.ConeGeometry(.48,.7,8),mat(0x514173),0,2.35,0);g.add(hat);
      g.add(ball(.12,h.detail,0,1.3,.5));
    } else if(index===3){
      g.add(box(.38,.35,.6,h.detail,-.48,1.43,0),box(.38,.35,.6,h.detail,.48,1.43,0));
    } else {
      g.add(box(.22,.1,1.05,h.detail,.15,1.46,-.35));
    }
    const leftLeg=cylinder(.15,.17,.7,0x313d47,-.2,.36,0,8);
    const rightLeg=cylinder(.15,.17,.7,0x313d47,.2,.36,0,8);
    const leftArm=cylinder(.12,.15,.67,h.color,-.58,1.08,.1,8);
    const rightArm=cylinder(.12,.15,.67,h.color,.58,1.08,.1,8);
    g.add(leftLeg,rightLeg,leftArm,rightArm);
    const gun=new THREE.Group();gun.position.set(.58,1.25,.34);
    gun.add(box(.19,.2,.73,0x384657,0,0,.2));
    gun.add(box(.12,.12,.45,h.detail,0,.05,.65));
    gun.add(ball(.1,h.detail,0,.05,.89));
    g.add(gun);
    g.userData={leftLeg,rightLeg,leftArm,rightArm,gun};
    return g;
  }
  makeEnemy(kind:EnemyKind|Boss,boss=false):THREE.Group {
    const g=new THREE.Group();
    const biome=BIOMES[kind.biome];
    const wings:THREE.Object3D[]=[];
    const addGlow=(r:number,x:number,y:number,z:number)=>{
      const o=mesh(new THREE.IcosahedronGeometry(r,1),emissive(biome.accent),x,y,z);
      g.add(o);return o;
    };
    const addWing=(side:number,x:number,y:number,w:number,h:number)=>{
      const o=ball(1,biome.accent,x,y,-.08);
      o.scale.set(w,h,.11);
      o.rotation.z=side*.24;
      g.add(o);wings.push(o);return o;
    };
    if(boss){
      const id=Number(kind.id.slice(1))-1;
      if(id===0){
        g.add(cylinder(.45,.8,1.5,0x6a5948,0,-.1,0,9));
        g.add(ball(.73,0x4b805b,0,.9,0));
        for(const side of [-1,1]){
          const branch=cylinder(.12,.21,1.2,0x695744,side*.7,.25,0,7);
          branch.rotation.z=side*.8;g.add(branch);
          g.add(ball(.35,0x5c9466,side*1.14,.72,0));
        }
        addGlow(.28,0,.28,.7);
      } else if(id===1){
        g.add(mesh(new THREE.ConeGeometry(.8,1.8,10),mat(0x90c9df),0,-.42,0));
        g.add(ball(.34,0xe4edf4,0,.68,0));
        for(let i=0;i<5;i++){
          const a=i*Math.PI*2/5;
          g.add(mesh(new THREE.ConeGeometry(.12,.55,5),emissive(biome.accent),Math.sin(a)*.31,1.05,Math.cos(a)*.31));
        }
        g.add(ring(.77,.05,biome.accent,0,-.4,0));
      } else if(id===2){
        const body=ball(.66,0x6f7496);
        body.scale.set(1,.7,1.3);g.add(body);
        for(const side of [-1,1])for(let i=0;i<4;i++){
          const wing=mesh(new THREE.ConeGeometry(.23,1.7-i*.18,6),mat(i%2?0x7aa6d2:0xb8b8ed),side*(.8+i*.3),.35-i*.12,-.2);
          wing.rotation.z=side*1.15;g.add(wing);wings.push(wing);
        }
        const beak=mesh(new THREE.ConeGeometry(.2,.65,5),mat(0xe4bf75),0,-.12,.75);
        beak.rotation.x=Math.PI/2;g.add(beak);
        addGlow(.2,0,.16,.65);
      } else if(id===3){
        g.add(box(1.2,1.1,.85,0x443d43,0,0,0));
        g.add(box(.78,.72,.7,0x50434a,0,.86,0));
        for(const side of [-1,1]){
          g.add(box(.42,.9,.5,0x3e3941,side*.86,-.2,0));
          g.add(box(.36,.75,.45,0x332e38,side*.36,-.9,0));
        }
        addGlow(.32,0,.1,.55);
      } else if(id===4){
        g.add(mesh(new THREE.ConeGeometry(.77,1.8,9),mat(0x312d47),0,-.35,0));
        g.add(ball(.31,0x504365,0,.67,0));
        g.add(box(.55,.18,.42,0x30293e,0,.86,0));
        const handle=cylinder(.045,.06,2.2,0x9a8fa2,.86,0,.1,7);
        handle.rotation.z=-.22;g.add(handle);
        const blade=mesh(new THREE.TorusGeometry(.56,.08,7,18,Math.PI*1.2),emissive(0xc99df1),.62,1.1,.1);
        blade.rotation.z=.8;g.add(blade);
        addGlow(.15,0,.57,.3);
      } else if(id===5){
        g.add(cylinder(.38,.64,1.4,0xf0d6a1,0,-.18,0,9));
        g.add(ball(.32,0xffe4b5,0,.72,0));
        for(const side of [-1,1])for(let i=0;i<3;i++){
          const wing=ball(.55,0xf5d48d,side*(.65+i*.35),.55-i*.38,-.35);
          wing.scale.set(1.5,.32,.25);wing.rotation.z=side*(.4+i*.2);
          g.add(wing);wings.push(wing);
        }
        g.add(ring(.52,.055,0xffe4a0,0,1.12,0));
        addGlow(.18,0,.25,.46);
      } else {
        const heart=mesh(new THREE.OctahedronGeometry(.8,1),emissive(0xc6a6ff));
        heart.scale.set(1,1.22,.85);g.add(heart);
        for(let i=0;i<3;i++){
          const orbit=ring(1.18+i*.25,.055,biome.accent,0,0,0);
          orbit.rotation.set(i*.8,.4+i*.7,i*.5);g.add(orbit);
        }
        for(let i=0;i<5;i++){
          const a=i*Math.PI*2/5;
          g.add(mesh(new THREE.OctahedronGeometry(.2),emissive(biome.accent),Math.sin(a)*1.45,Math.cos(a)*1.1,0));
        }
      }
      g.scale.setScalar(2.1);
    } else {
      const b=kind as EnemyKind;
      switch(b.behavior){
        case 0: {
          const core=mesh(new THREE.ConeGeometry(.44,1.05,8),mat(biome.foliage),0,-.08,0);
          core.rotation.x=Math.PI;g.add(core);addGlow(.23,0,.17,.27);
          for(const side of [-1,1])addWing(side,side*.58,.16,.42,.22);
          break;
        }
        case 1: {
          const body=ball(.46,0xc9a45c);body.scale.set(.76,.7,1.45);g.add(body);
          for(const z of [-.22,.05,.3])g.add(cylinder(.33,.33,.08,0x493e41,0,0,z,9));
          for(const side of [-1,1])addWing(side,side*.47,.34,.37,.14);
          const sting=mesh(new THREE.ConeGeometry(.1,.43,6),mat(0x473d3c),0,0,-.8);
          sting.rotation.x=-Math.PI/2;g.add(sting);
          break;
        }
        case 2: {
          g.add(ball(.55,biome.rock));
          const iris=ball(.36,0xf3e3b9,0,.03,.43);iris.scale.z=.3;g.add(iris);
          addGlow(.17,0,.03,.55);
          g.add(ring(.7,.045,biome.accent,0,0,0));
          break;
        }
        case 3: {
          const robe=mesh(new THREE.ConeGeometry(.57,1.2,9),mat(biome.rock),0,-.25,0);
          robe.rotation.x=Math.PI;g.add(robe);
          g.add(ball(.42,0x5d657f,0,.3,0));
          for(const side of [-1,1])addGlow(.075,side*.16,.31,.37);
          break;
        }
        case 4: {
          g.add(mesh(new THREE.DodecahedronGeometry(.48),mat(biome.rock)));
          for(let i=0;i<5;i++){
            const a=i*Math.PI*2/5;
            g.add(mesh(new THREE.OctahedronGeometry(.2),emissive(biome.accent),Math.sin(a)*.65,Math.cos(a)*.65,0));
          }
          break;
        }
        case 5: {
          g.add(cylinder(.15,.2,.77,biome.rock,0,0,0,8));
          for(const side of [-1,1]){
            addWing(side,side*.44,.29,.45,.34);
            addWing(side,side*.43,-.24,.38,.28);
          }
          addGlow(.14,0,.33,.16);
          break;
        }
        case 6: {
          g.add(ball(.49,biome.rock));
          for(let i=0;i<8;i++){
            const a=i*Math.PI/4;
            const thorn=mesh(new THREE.ConeGeometry(.13,.55,6),mat(biome.accent),Math.sin(a)*.52,Math.cos(a)*.52,0);
            thorn.rotation.z=-a;g.add(thorn);
          }
          addGlow(.17,0,0,.46);
          break;
        }
        case 7: {
          g.add(mesh(new THREE.OctahedronGeometry(.43),emissive(biome.accent)));
          for(const side of [-1,1])addWing(side,side*.52,.02,.54,.4);
          g.add(ring(.57,.035,biome.accent,0,.13,0));
          break;
        }
        case 8: {
          const lantern=ball(.43,biome.rock);lantern.scale.set(.83,1.2,.85);g.add(lantern);
          addGlow(.31,0,-.14,.15);
          for(const side of [-1,1])addWing(side,side*.43,.4,.33,.23);
          break;
        }
        default: {
          g.add(cylinder(.38,.5,.7,biome.rock,0,-.16,0,7));
          g.add(mesh(new THREE.ConeGeometry(.38,.62,7),mat(biome.rock),0,.4,0));
          addGlow(.17,0,.15,.38);
          const halo=ring(.68,.045,biome.accent,0,.32,0);halo.rotation.x=.6;g.add(halo);
        }
      }
      if(b.elite){
        g.add(ring(.67,.045,biome.accent,0,-.62,0));
        for(const side of [-1,1])g.add(mesh(new THREE.ConeGeometry(.12,.35,5),emissive(biome.accent),side*.27,.72,0));
      }
      g.scale.setScalar(b.elite?1.45:1);
    }
    g.userData={wings,baseY:1.5};
    return g;
  }
  makeProjectile(color:number,r=.13):THREE.Group {
    const g=new THREE.Group();
    const core=mesh(new THREE.IcosahedronGeometry(r,1),emissive(color));
    g.add(core);
    const tail=mesh(new THREE.ConeGeometry(r*.55,r*2,7),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.42}),0,0,-r*1.4);
    tail.rotation.x=Math.PI/2;g.add(tail);
    return g;
  }
  makePickup(kind:'hp'|'mana'|'ammo'|'coin'):THREE.Group {
    const g=new THREE.Group();
    const color=kind==='hp'?0xf56b80:kind==='mana'?0x6dd8f4:kind==='ammo'?0xe7b866:0xffd671;
    g.add(mesh(new THREE.OctahedronGeometry(.23),emissive(color),0,.34,0));
    const halo=ring(.32,.025,color,0,.2,0);halo.rotation.x=Math.PI/2;g.add(halo);
    return g;
  }
  spawnPortal(x:number,z:number):THREE.Group {
    const g=new THREE.Group();g.position.set(x,0,z);
    const color=BIOMES[this.biome].accent;
    const arch=ring(1.15,.13,color,0,1.35,0);arch.rotation.y=.2;g.add(arch);
    const inner=mesh(new THREE.CircleGeometry(.98,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.25,side:THREE.DoubleSide,depthWrite:false}),0,1.35,0);
    g.add(inner);
    g.add(cylinder(1.2,1.35,.2,BIOMES[this.biome].rock,0,.1,0,12));
    this.islandObjects.add(g);this.portal=g;return g;
  }
  animate(dt:number,heroMoving:boolean):void {
    this.time+=dt;
    if(this.heroMesh&&this.heroBody){
      const p=this.heroBody.translation();
      this.heroMesh.position.set(p.x,p.y-.89,p.z);
      const {leftLeg,rightLeg,leftArm,rightArm}=this.heroMesh.userData as Record<string,THREE.Object3D>;
      const step=heroMoving?Math.sin(this.time*12)*.48:Math.sin(this.time*2)*.035;
      leftLeg.rotation.x=step;rightLeg.rotation.x=-step;
      leftArm.rotation.x=-step*.5;rightArm.rotation.x=step*.5-.55;
    }
    if(this.portal){
      this.portal.children[0].rotation.z+=dt*.6;
      this.portal.children[1].rotation.z-=dt*.25;
    }
    this.cloudGroups.forEach((g,i)=>{g.rotation.y+=dt*(i%2?-.002:.003);});
  }
  render(dt:number,followHero:boolean):void {
    const target=followHero&&this.heroBody?this.heroBody.translation():{x:0,y:0,z:0};
    this.follow.lerp(vec(target.x,0,target.z),Math.min(1,dt*3));
    this.camera.position.copy(this.follow).add(vec(17,23,26));
    this.camera.lookAt(this.follow.x,0,this.follow.z);
    this.renderer.render(this.scene,this.camera);
  }
  aimAt(screenX:number,screenY:number):THREE.Vector3 {
    const ndc=new THREE.Vector2(screenX/window.innerWidth*2-1,1-screenY/window.innerHeight*2);
    const ray=new THREE.Raycaster();ray.setFromCamera(ndc,this.camera);
    const at=new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-1.1),at);
    return at;
  }
}
