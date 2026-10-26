export type Hero = { id: string; name: string; role: string; hp: number; mana: number; speed: number; color: number; detail: number; crit: number; armor: number };
export const HEROES: Hero[] = [
  { id:'H01', name:'Странник', role:'Сбалансированный боец', hp:100, mana:100, speed:5, color:0xbfc9d8, detail:0xd84f58, crit:.05, armor:0 },
  { id:'H02', name:'Охотница', role:'Скорость и точность', hp:85, mana:100, speed:5.4, color:0x468f73, detail:0xc7a65d, crit:.1, armor:0 },
  { id:'H03', name:'Арканист', role:'Сильная магия', hp:80, mana:120, speed:5, color:0x7551ac, detail:0x66ddf1, crit:.05, armor:0 },
  { id:'H04', name:'Страж', role:'Броня и стойкость', hp:125, mana:100, speed:4.6, color:0xa68553, detail:0xe5c278, crit:.05, armor:3 }
];

export type Biome = { name:string; ground:number; edge:number; rock:number; accent:number; sky:number; foliage:number };
export const BIOMES: Biome[] = [
  { name:'Изумрудные острова', ground:0x75a66b, edge:0x456b57, rock:0x50645b, accent:0x68ead1, sky:0x97cad2, foliage:0x367b60 },
  { name:'Ледяные выси', ground:0xb9d9dd, edge:0x638f9f, rock:0x7899ae, accent:0x80e5fb, sky:0x8aaebe, foliage:0x94bbc7 },
  { name:'Пепельная бездна', ground:0x675b60, edge:0x392f3f, rock:0x433a42, accent:0xff915e, sky:0x8d707e, foliage:0x53434e },
  { name:'Небесный храм', ground:0xd8d9bf, edge:0x9d987e, rock:0xc3ba9e, accent:0xd6bdff, sky:0xa5badb, foliage:0xabbdaf }
];

export const SHAPES = [
  'Кольцо руин','Спираль','Разбитый круг','Три платформы','Озёрный остров','Разветвление','Каменная арка','Четыре полуострова','Ключ','Лабиринт',
  'Цитадель','Когти','Цветок','Водоворот','Кратер','Великая арена','Святилище','Разлом','Звезда','Двойное кольцо',
  'Листовой мост','Террасы друидов','Корни Великана','Затопленные руины','Зелёные соты','Морозная коса','Расколотый ледник','Полярный гребень','Хрустальная корона','Застывший маятник',
  'Обсидиановый серп','Пепельные лестницы','Жерло вулкана','Лавовая восьмёрка','Чёрные зубцы','Орбита монахов','Золотые крылья','Печать созвездий','Зеркальный акведук','Астральные часы'
];

export type Weapon = { id:string; name:string; damage:number; cost:number; rate:number; speed:number; color:number };
const weaponRows: [string,number,number,number][] = [
  ['Искра Путника',9,0,3.8],['Последний Аргумент',16,1,3.25],['Легенда-74 Sidearm',20,1,3.7],['Эфирный Пистолет',24,1,4.15],['Песнь Бури',28,1,4.6],
  ['Синий Шквал',32,1,2.8],['Зелёный Клык',39,1,3.25],['Капитанский Штурм',15,1,3.7],['Полковничий Приказ',19,1,4.15],['Золотой Тигр',23,1,4.6],
  ['Майорский Гром',27,1,2.8],['Призрачный Спецназ',31,1,3.25],['Жёлтая Буря',38,1,3.7],['Морозная Игла',42,1,4.15],['Теневая Винтовка',18,2,2],
  ['Легенда-74',22,2,2.35],['Астральный Карабин',26,2,1.3],['Грозовой Разряд',30,2,1.65],['Священный Фолиант',37,2,2],['Фолиант Бездны',41,2,2.35],
  ['Фолиант Земли',45,2,1.3],['Фолиант Прилива',21,2,1.65],['Гримуар Молний',25,2,2],['Ледяная Королева',29,3,2.35],['Звёздный Стрелок',36,3,1.3],
  ['Гиперсфера',40,3,1.65],['Изумрудная Комета',44,3,2],['Адский Ливень',48,3,2.35],['Громобой',24,5,1.3],['Солнечный Излучатель',28,5,1.65]
];
export const WEAPONS: Weapon[] = weaponRows.map(([name,damage,cost,rate],i)=>({
  id:'W'+String(i+1).padStart(2,'0'), name, damage, cost, rate,
  speed: i>23 ? 14 : i>14 ? 19 : 24,
  color:[0xffd483,0x81f3da,0x89caff,0xff9681,0xceb0ff][i%5]
}));

export type Active = { id:string; name:string; description:string; cost:number; cooldown:number };
const activeRows: [string,string,number,number][] = [
  ['Молниеносный рывок','Рывок вперёд',12,9],['Поступь ветра','Скорость +30% на 4 с',18,12],['Боевая ярость','Урон +25% на 6 с',24,15],
  ['Пробуждение силы','Следующий выстрел наносит двойной урон',30,18],['Абсолютный барьер','Щит на 35 HP',12,21],['Взрывная волна','Урон и отталкивание вокруг героя',18,9],
  ['Живительный поток','Восстановление 25 HP',24,12],['Теневая завеса','Враги теряют прицел на 3 с',30,15],['Небесный вихрь','Урон врагам рядом',12,18],
  ['Хранитель душ','Спутник атакует 8 с',18,21],['Огненный круг','Горящее кольцо на 5 с',24,9],['Ледяной шип','Замораживает ближайшего врага',30,12],
  ['Рунический луч','55 урона по линии прицела',12,15],['Гравитационный импульс','Притягивает врагов на 2 с',18,18],['Призыв сферы','Сфера атакует 8 с',24,21]
];
export const ACTIVES: Active[] = activeRows.map(([name,description,cost,cooldown],i)=>({id:'A'+String(i+1).padStart(2,'0'),name,description,cost,cooldown}));

export type Passive = { id:string; name:string; description:string };
const passiveRows: [string,string][] = [
  ['Несокрушимая жизнь','+20 максимального HP'],['Внутренняя сила','+8% урона'],['Каменная кожа','+3 брони'],['Вечное исцеление','+1 HP каждые 5 с'],
  ['Глаз хищника','+5% шанс крита'],['Крылья странника','+7% скорости'],['Кровавый договор','6% вампиризма'],['Благословение фортуны','Больше редкой добычи'],
  ['Терновый доспех','Отражает 10% урона'],['Золотое сердце','+20% монет'],['Мастер перезарядки','Быстрее перезарядка'],['Холодный рассудок','Устойчивость к контролю'],
  ['Магический резерв','+20 максимальной маны'],['Песнь ветра','+8% уклонения'],['Ярость охотника','Урон при низком HP'],['Энергетический щит','Щит раз в 30 с'],
  ['Острые осколки','Дополнительный снаряд при крите'],['Благодать света','+10% лечения'],['Печать бездны','+8% урона по элите'],['Астральная точность','Снаряды быстрее']
];
export const PASSIVES: Passive[] = passiveRows.map(([name,description],i)=>({id:'P'+String(i+1).padStart(2,'0'),name,description}));

const normalNames = [
  'Лесной дух','Шипастая оса','Крылатый глаз','Моховой призрак','Каменный спрайт','Руническая бабочка','Колючий шар','Кристальный мотылёк','Ядовитый светляк','Дух руин',
  'Морозный дух','Снежный мотылёк','Ледяной глаз','Холодный призрак','Снежный спрайт','Морозная оса','Кристалл-страж','Ледяной ворон','Инеевый шар','Замёрзший наблюдатель',
  'Пепельный бес','Огненная оса','Лавовый глаз','Угольный призрак','Пламенный спрайт','Вулканический шар','Искровой череп','Жар-птица','Огненный мотылёк','Пепельный смотритель',
  'Астральный глаз','Световой мотылёк','Небесный страж','Звёздный фантом','Рунический ангелок','Световой осколок','Летучий храмовый идол','Серафим-искатель','Эфирный шар','Проводник пустоты'
];
const eliteNames = [
  'Великий моховой призрак','Королева ос','Живой тотем корней','Кристальный хранитель','Колючий древень',
  'Морозная вдова','Ледяной страж','Кристаллический жук','Полярный дух','Снежный архонт',
  'Пожиратель углей','Инфернальная оса','Пепельный голем','Лавовый шаман','Огненный идол',
  'Храмовый серафим','Астральный арбитр','Световой паладин','Звёздный жрец','Эфирный тюремщик'
];
export type EnemyKind = { id:string; name:string; hp:number; damage:number; biome:number; behavior:number; elite:boolean };
export const ENEMIES: EnemyKind[] = normalNames.map((name,i)=>({
  id:'E'+String(i+1).padStart(2,'0'),name,biome:Math.floor(i/10),hp:35+Math.floor(i/10)*12+(i%10)*8,
  damage:6+Math.floor(i/10)*2+(i%4)*2,behavior:i%10,elite:false
}));
export const ELITES: EnemyKind[] = eliteNames.map((name,i)=>({
  id:'X'+String(i+1).padStart(2,'0'),name,biome:Math.floor(i/5),hp:175+i*12,
  damage:12+Math.floor(i/3),behavior:(i*2+1)%10,elite:true
}));
export type Boss = { id:string; name:string; hp:number; damage:number; biome:number };
export const BOSSES: Boss[] = [
  {id:'B01',name:'Лесной Страж',hp:1000,damage:18,biome:0},
  {id:'B02',name:'Королева Льда',hp:1550,damage:21,biome:1},
  {id:'B03',name:'Повелитель Гроз',hp:2100,damage:24,biome:1},
  {id:'B04',name:'Лавовый Титан',hp:2650,damage:27,biome:2},
  {id:'B05',name:'Жнец Бездны',hp:3200,damage:30,biome:2},
  {id:'B06',name:'Небесный Серафим',hp:3750,damage:33,biome:3},
  {id:'B07',name:'Сердце Островов',hp:4300,damage:36,biome:3}
];
export const BOSS_ISLANDS = [4,7,10,13,16,18,20];

export function seeded(seed:number):()=>number {
  let state=seed>>>0;
  return ()=>{
    state+=0x6d2b79f5;
    let t=state;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
export function biomeForIsland(island:number):number { return Math.min(3,Math.floor((island-1)/5)); }
export function shapeForIsland(seed:number,island:number):number { return (seed*13+island*7)%SHAPES.length; }
export function islandRadius(angle:number,shape:number):number {
  const family=shape%8;
  const ripple=[2,3,4,5,6,7,8,12][family];
  const phase=shape*.87;
  return 10.5+Math.sin(angle*ripple+phase)*(family===7?1.3:1.9)+Math.sin(angle*(ripple+3)-phase)*.55;
}
