import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { vi } from 'vitest';

describe('Maintenance page', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('renders the launch message and email contact links', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toContain('In the making.');
    expect(page.querySelectorAll('a[href="mailto:contact@26b.studio"]').length).toBe(3);
    expect(page.querySelector('img')?.getAttribute('alt')).toBe('26B Creative Studio');
  });

  it('toggles gravity in both directions and reset switches it off', async () => {
    const request = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const fixture = TestBed.createComponent(App);
    try {
      await fixture.whenStable();
      const page = fixture.nativeElement as HTMLElement;
      (page.querySelector('.drop-button') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(fixture.componentInstance.physicsEnabled()).toBe(true));
      fixture.detectChanges();
      expect(fixture.componentInstance.physicsEnabled()).toBe(true);
      expect((page.querySelector('.drop-button') as HTMLButtonElement).disabled).toBe(false);
      expect(page.querySelector('.drop-button')?.textContent).toContain('Turn gravity off');
      (page.querySelector('.drop-button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.componentInstance.physicsEnabled()).toBe(false);
      expect(page.querySelector('.drop-button')?.textContent).toContain('Turn gravity on');
      (page.querySelector('.drop-button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.componentInstance.physicsEnabled()).toBe(true);
      expect(request).toHaveBeenCalled();
      (page.querySelector('.reset') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.componentInstance.physicsEnabled()).toBe(false);
      expect((page.querySelector('.drop-button') as HTMLButtonElement).disabled).toBe(false);
      expect(cancel).toHaveBeenCalledWith(42);
    } finally {
      fixture.destroy();
      request.mockRestore();
      cancel.mockRestore();
    }
  });

  it('moves shapes with arrow keys, keeps them inside the stage, and resets them', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const stage = page.querySelector('.playground') as HTMLElement;
    const shape = page.querySelector('.ring') as HTMLElement;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600 }) as DOMRect;
    shape.getBoundingClientRect = () =>
      ({ left: 100, top: 100, right: 250, bottom: 250 }) as DOMRect;
    shape.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(shape.style.getPropertyValue('--x')).toBe('16px');
    shape.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(shape.style.getPropertyValue('--y')).toBe('16px');
    (page.querySelector('.reset') as HTMLButtonElement).click();
    expect(shape.style.getPropertyValue('--x')).toBe('0px');
    expect(shape.style.getPropertyValue('--y')).toBe('0px');
    shape.getBoundingClientRect = () =>
      ({ left: 650, top: 100, right: 800, bottom: 250 }) as DOMRect;
    shape.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(shape.style.getPropertyValue('--x')).toBe('0px');
  });
});
