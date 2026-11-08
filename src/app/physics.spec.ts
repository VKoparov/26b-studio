import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';
import { PhysicsWorld } from './physics';

const simulate = (world: PhysicsWorld, frames: number) => {
  for (let i = 0; i < frames; i++) world.step();
};

describe('rigid-body playground', () => {
  it('drops, rebounds, and sleeps naturally on the floor', () => {
    const world = new PhysicsWorld(800, 600);
    const body = world.add('disc', 200, 100, 100, 100, 0);
    let bounced = false;
    for (let i = 0; i < 1800; i++) {
      world.step();
      if (body.velocity.y < -1) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(body.position.y).toBeGreaterThan(545);
    expect(body.position.y).toBeLessThan(555);
    expect(world.settled).toBe(true);
    world.destroy();
  });

  it('tumbles on off-centre impact instead of keeping its angle locked', () => {
    const world = new PhysicsWorld(800, 600);
    const body = world.add('block', 200, 150, 100, 100, 0.4);
    simulate(world, 100);
    expect(Math.abs(body.angle - 0.4)).toBeGreaterThan(0.1);
    world.destroy();
  });

  it('swings from the grab point and retains momentum on release', () => {
    const world = new PhysicsWorld(1000, 900);
    const body = world.add('sign', 300, 200, 120, 150, 0);
    world.beginGrab(body, { x: 250, y: 140 });
    for (let i = 0; i < 60; i++) {
      world.moveGrab({ x: 250 + i * 3, y: 140 });
      world.step();
    }
    expect(Math.abs(body.angle)).toBeGreaterThan(0.05);
    world.endGrab();
    const x = body.position.x;
    simulate(world, 6);
    expect(Math.abs(body.position.x - x)).toBeGreaterThan(1);
    expect(body.isStatic).toBe(false);
    world.destroy();
  });

  it('transfers momentum and wakes a sleeping object on collision', () => {
    const world = new PhysicsWorld(800, 600);
    const a = world.add('disc', 150, 550, 100, 100, 0);
    const b = world.add('block', 350, 550, 100, 100, 0);
    Matter.Sleeping.set(b, true);
    Matter.Body.setVelocity(a, { x: 12, y: 0 });
    simulate(world, 50);
    expect(b.position.x).toBeGreaterThan(350);
    world.destroy();
  });

  it('disables gravity without resetting position and can enable it again', () => {
    const world = new PhysicsWorld(800, 600);
    const body = world.add('disc', 300, 200, 100, 100, 0);
    world.setGravity(false);
    simulate(world, 60);
    expect(body.position.y).toBeCloseTo(200);
    world.setGravity(true);
    simulate(world, 60);
    expect(body.position.y).toBeGreaterThan(200);
    world.destroy();
  });

  it('uses hollow and compound geometry instead of square bounds', () => {
    const world = new PhysicsWorld(800, 600);
    const ring = world.add('ring', 200, 150, 160, 160, 0);
    const star = world.add('asterisk', 500, 150, 160, 160, 0);
    expect(ring.parts.length).toBe(25);
    expect(star.parts.length).toBe(5);
    world.destroy();
  });
});
