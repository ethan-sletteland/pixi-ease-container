// adapted from: https://github.com/davidfig/pixi-ease

/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Events from 'eventemitter3';
import * as PIXI from 'pixi.js';

export interface EaseParams {
  [key: string]: any;
}

export interface AddOptions {
  ease: (time: number, start: number, delta: number, duration: number) => number;
  duration: number;
  reverse?: boolean;
  repeat?: boolean | number;
  wait?: number;
}

interface Ease {
  element: PIXI.Container;
  entry: string;
  update: (ease: Ease) => void;
  start: any;
  to: any;
  delta: any;
}

export class Easing extends Events {
  private elements: PIXI.Container[];
  private eases: Ease[];
  private options: AddOptions;
  private time: number;

  public constructor(element: PIXI.Container | PIXI.Container[], params: EaseParams, options: AddOptions) {
    super();

    this.elements = Array.isArray(element) ? element : [element];
    this.eases = [];
    this.options = options || ({} as AddOptions);
    this.time = 0;
    for (const param in params) {
      for (const container of this.elements) {
        this.addParam(container, param, params[param]);
      }
    }
  }

  private addParam(element: PIXI.Container, entry: string, param: any) {
    let start,
      to,
      delta,
      update,
      name = entry;
    switch (entry) {
      case 'scaleX':
      case 'skewX':
        name = entry.substr(0, entry.length - 1);
        start = (element as any)[name].x;
        to = param;
        delta = param - start;
        update = (ease: Ease) => this.updateCoord(ease, name, 'x');
        break;

      case 'scaleY':
      case 'skewY':
        name = entry.substr(0, entry.length - 1);
        start = (element as any)[name].y;
        to = param;
        delta = param - start;
        update = (ease: Ease) => this.updateCoord(ease, name, 'y');
        break;

      case 'tint':
      case 'blend':
        // eslint-disable-next-line no-case-declarations
        const colors = Array.isArray(param) ? param : [(element as any).tint, param];
        start = 0;
        to = colors.length;
        delta = to;
        update =
          entry === 'tint'
            ? (ease: Ease) => this.updateTint(ease, colors)
            : (ease: Ease) => this.updateBlend(ease, colors);
        break;

      case 'shake':
        start = { x: element.x, y: element.y };
        to = param;
        update = (ease: Ease) => this.updateShake(ease);
        break;

      case 'position':
        start = { x: element.x, y: element.y };
        to = { x: param.x, y: param.y };
        delta = { x: to.x - start.x, y: to.y - start.y };
        update = (ease: Ease) => this.updatePosition(ease);
        break;

      case 'skew':
      case 'scale':
        start = (element as any)[entry].x;
        to = param;
        delta = param - start;
        update = (ease: Ease) => this.updatePoint(ease, entry);
        break;

      case 'face':
        start = element.rotation;
        to = Easing.shortestAngle(start, Math.atan2(param.y - element.y, param.x - element.x));
        delta = to - start;
        update = (ease: Ease) => this.updateOne(ease, 'rotation');
        break;

      default:
        start = (element as any)[entry];
        to = param;
        delta = param - start;
        update = (ease: Ease) => this.updateOne(ease, entry);
    }
    this.eases.push({ element, entry, update, start, to, delta });
  }

  public static shortestAngle(start: number, finish: number): number {
    function mod(a: number, n: number): number {
      return ((a % n) + n) % n;
    }

    const PI_2 = Math.PI * 2;
    let diff = Math.abs(start - finish) % PI_2;
    diff = diff > Math.PI ? PI_2 - diff : diff;

    const simple = finish - start;
    const sign = mod(simple + Math.PI, PI_2) - Math.PI > 0 ? 1 : -1;

    return diff * sign;
  }

  public remove(element?: PIXI.Container, params?: any | any[]): boolean {
    if (arguments.length === 0) {
      this.eases = [];
    } else {
      if (typeof params === 'string') {
        params = [params];
      }
      for (let i = 0; i < this.eases.length; i++) {
        const ease = this.eases[i];
        if ((!element || ease.element === element) && (!params || (params as string[]).indexOf(ease.entry) !== -1)) {
          this.eases.splice(i, 1);
          i--;
        }
      }
    }
    return this.eases.length === 0;
  }

  private updateOne(ease: Ease, entry: string) {
    (ease.element as any)[entry] = this.options.ease(this.time, ease.start, ease.delta, this.options.duration);
  }

  private updatePoint(ease: Ease, entry: string) {
    (ease.element as any)[entry].x = (ease.element as any)[entry].y = this.options.ease(
      this.time,
      ease.start,
      ease.delta,
      this.options.duration,
    );
  }

  private updatePosition(ease: Ease) {
    ease.element.x = this.options.ease(this.time, ease.start.x, ease.delta.x, this.options.duration);
    ease.element.y = this.options.ease(this.time, ease.start.y, ease.delta.y, this.options.duration);
  }

  private updateCoord(ease: Ease, name: string, coord: 'x' | 'y') {
    (ease.element as any)[name][coord] = this.options.ease(this.time, ease.start, ease.delta, this.options.duration);
  }

  private updateTint(ease: Ease, colors: number[]) {
    let index = Math.floor(this.options.ease(this.time, ease.start, ease.delta, this.options.duration));
    if (index === colors.length) {
      index = colors.length - 1;
    }
    (ease.element as any).tint = colors[index];
  }

  private updateBlend(ease: Ease, colors: number[]) {
    const calc = this.options.ease(this.time, ease.start, ease.delta, this.options.duration);
    let index = Math.floor(calc);
    if (index === colors.length) {
      index = colors.length - 1;
    }
    let next = index + 1;
    if (next === colors.length) {
      next = this.options.reverse ? index - 1 : this.options.repeat ? 0 : index;
    }
    const percent = calc - index;
    const color1 = colors[index];
    const color2 = colors[next];
    const r1 = color1 >> 16;
    const g1 = (color1 >> 8) & 0x0000ff;
    const b1 = color1 & 0x0000ff;
    const r2 = color2 >> 16;
    const g2 = (color2 >> 8) & 0x0000ff;
    const b2 = color2 & 0x0000ff;
    const percent1 = 1 - percent;
    const r = percent1 * r1 + percent * r2;
    const g = percent1 * g1 + percent * g2;
    const b = percent1 * b1 + percent * b2;
    (ease.element as any).tint = (r << 16) | (g << 8) | b;
  }

  private updateShake(ease: Ease) {
    function random(n: number): number {
      return Math.floor(Math.random() * n) - Math.floor(n / 2);
    }
    ease.element.x = ease.start.x + random(ease.to);
    ease.element.y = ease.start.y + random(ease.to);
  }

  public complete(ease: Ease) {
    if (ease.entry === 'shake') {
      ease.element.x = ease.start.x;
      ease.element.y = ease.start.y;
    }
  }

  private reverse(ease: Ease) {
    if (ease.entry === 'position') {
      const swapX = ease.to.x;
      const swapY = ease.to.y;
      ease.to.x = ease.start.x;
      ease.to.y = ease.start.y;
      ease.start.x = swapX;
      ease.start.y = swapY;
      ease.delta.x = -ease.delta.x;
      ease.delta.y = -ease.delta.y;
    } else {
      const swap = ease.to;
      ease.to = ease.start;
      ease.start = swap;
      ease.delta = -ease.delta;
    }
  }

  private repeat(ease: Ease) {
    switch (ease.entry) {
      case 'skewX':
        (ease.element as any).skew.x = ease.start;
        break;

      case 'skewY':
        (ease.element as any).skew.y = ease.start;
        break;

      case 'skew':
        (ease.element as any).skew.x = ease.start;
        (ease.element as any).skew.y = ease.start;
        break;

      case 'scaleX':
        (ease.element as any).scale.x = ease.start;
        break;

      case 'scaleY':
        (ease.element as any).scale.y = ease.start;
        break;

      case 'scale':
        (ease.element as any).scale.x = ease.start;
        (ease.element as any).scale.y = ease.start;
        break;

      case 'position':
        ease.element.x = ease.start.x;
        ease.element.y = ease.start.y;
        break;

      default:
        (ease.element as any)[ease.entry] = ease.start;
    }
  }

  public update(elapsed: number): boolean {
    if (this.eases.length === 0) {
      return true;
    }
    if (this.options.wait) {
      this.options.wait -= elapsed;
      if (this.options.wait > 0) {
        this.emit('wait', this);
        return false;
      } else {
        elapsed = -this.options.wait;
        this.options.wait = 0;
        this.emit('wait-end', this);
      }
    }
    this.time += elapsed;
    let leftover = 0;
    if (this.time >= this.options.duration) {
      leftover = this.time - this.options.duration;
      this.time = this.options.duration;
    }
    for (let i = 0; i < this.eases.length; i++) {
      const ease = this.eases[i];
      if ((ease.element as any)._destroyed) {
        this.eases.splice(i, 1);
        i--;
      } else {
        ease.update(ease);
      }
    }
    this.emit('each', this);
    if (this.time >= this.options.duration) {
      if (this.options.reverse) {
        this.eases.forEach((ease) => this.reverse(ease));
        this.time = leftover;
        if (leftover) {
          this.eases.forEach((ease) => ease.update(ease));
        }
        this.emit('reverse', this);
        if (!this.options.repeat) {
          this.options.reverse = false;
        } else if (this.options.repeat !== true) {
          this.options.repeat--;
        }
      } else if (this.options.repeat) {
        this.eases.forEach((ease) => this.repeat(ease));
        this.time = leftover;
        if (leftover) {
          this.eases.forEach((ease) => ease.update(ease));
        }
        if (this.options.repeat !== true) {
          this.options.repeat--;
        }
        this.emit('repeat', this);
      } else {
        this.eases.forEach((ease) => this.complete(ease));
        this.emit('complete', this);
        return true;
      }
    }
    return false;
  }

  public get count(): number {
    return this.eases.length;
  }
}

/**
 * fires when easings are finished
 * @event EaseElement#complete
 * @type {EaseElement}
 */

/**
 * fires on each loop where there are easings
 * @event EaseElement#each
 * @type {EaseElement}
 */

/**
 * fires when easings repeats
 * @event EaseElement#repeat
 * @type {EaseElement}
 */

/**
 * fires when easings reverse
 * @event EaseElement#reverse
 * @type {EaseElement}
 */

/**
 * fires on each frame while a wait is counting down
 * @event EaseElement#wait
 * @type {object}
 * @property {EaseElement} element
 * @property {number} wait
 */

/**
 * fires after a wait expires
 * @event EaseElement#wait-end
 * @type { EaseElement }
 */
