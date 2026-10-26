import { describe, expect, it } from 'vitest';
import { ACTIVES, BIOMES, BOSSES, BOSS_ISLANDS, ELITES, ENEMIES, HEROES, PASSIVES, SHAPES, WEAPONS, biomeForIsland, islandRadius, seeded, shapeForIsland } from './content';

describe('20-island campaign data',()=>{
  it('has playable content for each biome and all planned boss islands',()=>{
    expect(HEROES).toHaveLength(4);
    expect(BIOMES).toHaveLength(4);
    expect(SHAPES).toHaveLength(40);
    expect(ENEMIES).toHaveLength(40);
    expect(ELITES).toHaveLength(20);
    expect(BOSSES).toHaveLength(7);
    expect(WEAPONS).toHaveLength(30);
    expect(ACTIVES).toHaveLength(15);
    expect(PASSIVES).toHaveLength(20);
    expect(BOSS_ISLANDS).toEqual([4,7,10,13,16,18,20]);
    for(let island=1;island<=20;island++){
      const biome=biomeForIsland(island);
      expect(ENEMIES.filter(e=>e.biome===biome)).toHaveLength(10);
      expect(ELITES.filter(e=>e.biome===biome)).toHaveLength(5);
    }
  });
  it('keeps the starting point and portal inside every island outline',()=>{
    for(let shape=0;shape<SHAPES.length;shape++){
      for(let step=0;step<360;step++){
        const a=step*Math.PI/180;
        expect(islandRadius(a,shape)).toBeGreaterThan(6.1);
      }
    }
  });
  it('repeats map choices from a seed',()=>{
    for(const seed of [1,13453,4294967295]){
      expect(seeded(seed)()).toBe(seeded(seed)());
      for(let island=1;island<=20;island++)expect(shapeForIsland(seed,island)).toBe(shapeForIsland(seed,island));
    }
  });
});
