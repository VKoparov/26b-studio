import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import type { PhysicsBody, PhysicsWorld, Shape } from './physics';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly playground = viewChild<ElementRef<HTMLElement>>('playground');
  readonly physicsEnabled = signal(false);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  readonly physicsLoading = signal(false);
  readonly physicsError = signal(false);
  private world: PhysicsWorld | null = null;
  private bodies = new Map<HTMLElement, { body: PhysicsBody; originX: number; originY: number }>();
  private frame = 0;
  private lastFrame = 0;
  private accumulator = 0;
  private loadVersion = 0;

  constructor() {
    afterNextRender(() => {
      const observer = new ResizeObserver(() => {
        if (!this.world) return;
        // Recreate bodies at their responsive dimensions after a viewport resize.
        const gravityOn = this.physicsEnabled();
        this.reset();
        void this.dropObjects(gravityOn);
      });
      observer.observe(this.playground()!.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
    this.destroyRef.onDestroy(() => {
      this.loadVersion++;
      if (this.frame) cancelAnimationFrame(this.frame);
      this.world?.destroy();
    });
  }

  async toggleGravity() {
    if (this.physicsLoading()) return;
    if (!this.world) {
      await this.dropObjects();
      return;
    }
    const enabled = !this.physicsEnabled();
    this.world.setGravity(enabled);
    this.physicsEnabled.set(enabled);
    this.wake();
  }

  private async dropObjects(gravityOn = true) {
    if (this.physicsEnabled() || this.physicsLoading()) return;
    this.physicsLoading.set(true);
    this.physicsError.set(false);
    const version = ++this.loadVersion;
    try {
      const { PhysicsWorld } = await import('./physics');
      if (version !== this.loadVersion) return;
      const stage = this.playground()!.nativeElement;
      const bounds = stage.getBoundingClientRect();
      this.world = new PhysicsWorld(bounds.width, bounds.height);
      stage.querySelectorAll<HTMLElement>('.object').forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = rect.left + rect.width / 2 - bounds.left;
        const y = rect.top + rect.height / 2 - bounds.top;
        const position = this.positions.get(element) ?? { x: 0, y: 0 };
        const angle =
          (parseFloat(getComputedStyle(element).getPropertyValue('--angle')) * Math.PI) / 180 || 0;
        const shape = ['ring', 'disc', 'asterisk', 'block', 'sign'].find((name) =>
          element.classList.contains(name),
        ) as Shape;
        const body = this.world!.add(shape, x, y, element.offsetWidth, element.offsetHeight, angle);
        this.bodies.set(element, { body, originX: x - position.x, originY: y - position.y });
      });
      this.world.setGravity(gravityOn);
      this.physicsEnabled.set(gravityOn);
      this.wake();
    } catch {
      if (version === this.loadVersion) {
        this.world?.destroy();
        this.world = null;
        this.bodies.clear();
        this.physicsEnabled.set(false);
        this.physicsError.set(true);
      }
    } finally {
      if (version === this.loadVersion) this.physicsLoading.set(false);
    }
  }

  private wake() {
    if (this.frame) return;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.zone.runOutsideAngular(() => {
      this.frame = requestAnimationFrame(this.tick);
    });
  }

  private readonly tick = (time: number) => {
    if (!this.world) {
      this.frame = 0;
      return;
    }
    this.accumulator += this.lastFrame ? Math.min(time - this.lastFrame, 50) : 1000 / 60;
    this.lastFrame = time;
    while (this.accumulator >= 1000 / 120) {
      this.world.step();
      this.accumulator -= 1000 / 120;
    }
    this.bodies.forEach(({ body, originX, originY }, element) => {
      this.move(element, body.position.x - originX, body.position.y - originY);
      element.style.setProperty('--physics-angle', `${body.angle}rad`);
    });
    if (!this.world.settled || this.active) this.frame = requestAnimationFrame(this.tick);
    else this.frame = 0;
  };

  private pointerPosition(event: PointerEvent) {
    const bounds = this.playground()!.nativeElement.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  }

  private active: {
    element: HTMLElement;
    pointer: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null = null;
  private readonly positions = new Map<HTMLElement, { x: number; y: number }>();

  startDrag(event: PointerEvent) {
    if (event.button !== 0 || this.active) return;
    const element = event.currentTarget as HTMLElement;
    const position = this.positions.get(element) ?? { x: 0, y: 0 };
    this.active = {
      element,
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      ...position,
    };
    const entry = this.bodies.get(element);
    if (entry) {
      this.world!.beginGrab(entry.body, this.pointerPosition(event));
      this.wake();
    }
    element.setPointerCapture(event.pointerId);
    element.classList.add('dragging');
  }

  drag(event: PointerEvent) {
    const active = this.active;
    const stage = this.playground()?.nativeElement;
    if (!active || active.pointer !== event.pointerId || !stage) return;
    if (this.world && this.bodies.has(active.element)) {
      this.world.moveGrab(this.pointerPosition(event));
      this.wake();
      return;
    }
    const bounds = stage.getBoundingClientRect();
    const rect = active.element.getBoundingClientRect();
    const current = this.positions.get(active.element) ?? { x: 0, y: 0 };
    const x = Math.max(
      current.x + bounds.left - rect.left,
      Math.min(active.x + event.clientX - active.startX, current.x + bounds.right - rect.right),
    );
    const y = Math.max(
      current.y + bounds.top - rect.top,
      Math.min(active.y + event.clientY - active.startY, current.y + bounds.bottom - rect.bottom),
    );
    this.move(active.element, x, y);
  }

  endDrag(event: PointerEvent) {
    if (this.active?.pointer !== event.pointerId) return;
    this.world?.endGrab();
    if (this.world) this.wake();
    this.active.element.classList.remove('dragging');
    this.active = null;
  }

  moveWithKeys(event: KeyboardEvent) {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-16, 0],
      ArrowRight: [16, 0],
      ArrowUp: [0, -16],
      ArrowDown: [0, 16],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const element = event.currentTarget as HTMLElement;
    const entry = this.bodies.get(element);
    if (entry) {
      this.world!.nudge(entry.body, ...direction);
      this.wake();
      return;
    }
    const { x, y } = this.positions.get(element) ?? { x: 0, y: 0 };
    const stage = this.playground()!.nativeElement.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    this.move(
      element,
      x + Math.max(stage.left - rect.left, Math.min(direction[0], stage.right - rect.right)),
      y + Math.max(stage.top - rect.top, Math.min(direction[1], stage.bottom - rect.bottom)),
    );
  }

  reset() {
    this.loadVersion++;
    this.physicsLoading.set(false);
    this.physicsError.set(false);
    this.world?.destroy();
    this.world = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.bodies.clear();
    this.physicsEnabled.set(false);
    this.positions.forEach((_, element) => {
      element.classList.remove('dragging');
      element.style.removeProperty('--physics-angle');
      this.move(element, 0, 0);
    });
    this.active = null;
  }

  private move(element: HTMLElement, x: number, y: number) {
    this.positions.set(element, { x, y });
    element.style.setProperty('--x', `${x}px`);
    element.style.setProperty('--y', `${y}px`);
  }
}
