import Matter from 'matter-js';

export type PhysicsBody = Matter.Body;
export type Shape = 'ring' | 'disc' | 'asterisk' | 'block' | 'sign';
const { Bodies, Body, Composite, Constraint, Engine, Sleeping } = Matter;

/** Fixed-step rigid bodies, independent of DOM rendering and Angular change detection. */
export class PhysicsWorld {
  readonly engine = Engine.create({
    enableSleeping: true,
    positionIterations: 8,
    velocityIterations: 8,
    constraintIterations: 4,
  });
  readonly bodies: PhysicsBody[] = [];
  private walls: PhysicsBody[] = [];
  private grab: Matter.Constraint | null = null;

  constructor(width: number, height: number) {
    this.engine.gravity.y = 1.35;
    this.resize(width, height);
  }

  add(shape: Shape, x: number, y: number, width: number, height: number, angle: number) {
    const options: Matter.IBodyDefinition = {
      restitution: shape === 'ring' || shape === 'disc' ? 0.62 : 0.35,
      friction: 0.38,
      frictionStatic: 0.65,
      frictionAir: 0.008,
      density: shape === 'block' ? 0.002 : 0.0012,
      sleepThreshold: 75,
    };
    let body: PhysicsBody;
    if (shape === 'disc') {
      body = Bodies.circle(x, y, width / 2, options, 40);
    } else if (shape === 'ring') {
      // A hollow compound ring lets smaller objects interact with its inner edge.
      const radius = width * 0.43,
        thickness = width * 0.14;
      const parts = Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12;
        return Bodies.rectangle(
          x + Math.cos(a) * radius,
          y + Math.sin(a) * radius,
          width * 0.13,
          thickness,
          { angle: a + Math.PI / 2 },
        );
      });
      body = Body.create({ ...options, parts });
    } else if (shape === 'asterisk') {
      body = Body.create({
        ...options,
        parts: Array.from({ length: 4 }, (_, i) =>
          Bodies.rectangle(x, y, width * 0.9, height * 0.17, { angle: (i * Math.PI) / 4 }),
        ),
      });
    } else {
      body = Bodies.rectangle(x, y, width, height, { ...options, chamfer: { radius: 4 } });
    }
    Body.setAngle(body, angle);
    Composite.add(this.engine.world, body);
    this.bodies.push(body);
    return body;
  }

  resize(width: number, height: number) {
    this.walls.forEach((wall) => Composite.remove(this.engine.world, wall));
    const options = { isStatic: true, friction: 0.5, restitution: 0.2 };
    this.walls = [
      Bodies.rectangle(width / 2, height + 100, width + 400, 200, options),
      Bodies.rectangle(width / 2, -100, width + 400, 200, options),
      Bodies.rectangle(-100, height / 2, 200, height + 400, options),
      Bodies.rectangle(width + 100, height / 2, 200, height + 400, options),
    ];
    Composite.add(this.engine.world, this.walls);
    this.bodies.forEach((body) => {
      const dx =
        body.bounds.min.x < 0 ? -body.bounds.min.x : Math.min(0, width - body.bounds.max.x);
      const dy =
        body.bounds.min.y < 0 ? -body.bounds.min.y : Math.min(0, height - body.bounds.max.y);
      Body.translate(body, { x: dx, y: dy });
      Sleeping.set(body, false);
    });
  }

  beginGrab(body: PhysicsBody, point: Matter.Vector) {
    this.endGrab();
    Sleeping.set(body, false);
    this.grab = Constraint.create({
      pointA: { ...point },
      bodyB: body,
      pointB: { x: point.x - body.position.x, y: point.y - body.position.y },
      length: 0,
      stiffness: 0.2,
      damping: 0.14,
    });
    Composite.add(this.engine.world, this.grab);
  }

  moveGrab(point: Matter.Vector) {
    if (!this.grab) return;
    this.grab.pointA = { ...point };
    if (this.grab.bodyB) Sleeping.set(this.grab.bodyB, false);
  }

  endGrab() {
    if (this.grab) Composite.remove(this.engine.world, this.grab);
    this.grab = null;
    // The solver's existing linear and angular velocities carry through release.
  }

  nudge(body: PhysicsBody, x: number, y: number) {
    Sleeping.set(body, false);
    Body.setVelocity(body, { x: x * 0.35, y: y * 0.35 });
  }

  setGravity(enabled: boolean) {
    this.engine.gravity.y = enabled ? 1.35 : 0;
    this.bodies.forEach((body) => Sleeping.set(body, false));
  }

  step() {
    Engine.update(this.engine, 1000 / 120);
  }

  get settled() {
    return !this.grab && this.bodies.every((body) => body.isSleeping);
  }

  destroy() {
    this.endGrab();
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}
