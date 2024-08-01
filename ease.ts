/* eslint-disable no-param-reassign */

// adapted from: https://github.com/davidfig/pixi-ease

import Events from 'eventemitter3';
import * as PIXI from 'pixi.js';
import { TickerCallback } from 'pixi.js';

import { penner } from '../../pixi-viewport/src/external/penner';

import { AddOptions, EaseParams, Easing, Easing as EasingElement } from './easing';

interface EaseOptions {
  duration?: number;
  ease?: string | ((time: number, start: number, delta: number, duration: number) => number);
  useRAF?: boolean;
  ticker?: PIXI.Ticker | null;
  maxFrame?: number;
}

const defaultEaseOptions: EaseOptions = {
  duration: 1000,
  ease: penner.easeInOutSine,
  maxFrame: 1000 / 60,
  ticker: null,
  useRAF: true,
};

/**
 * Manages a group of eases
 * @extends EventEmitter
 * @example
 * import * as PIXI from 'pixi.js'
 * import { Ease, ease } from 'pixi-ease'
 *
 * const app = new PIXI.Application()
 * const test = app.stage.addChild(new PIXI.Sprite(PIXI.Texture.WHITE))
 *
 * const move = ease.add(test, { x: 20, y: 15, alpha: 0.25 }, { reverse: true })
 * move.once('complete', () => console.log('move ease complete.'))
 *
 * test.generic = 25
 * const generic = ease.add(test, { generic: 0 }, { duration: 1500, ease: 'easeOutQuad' })
 * generic.on('each', () => console.log(test.generic))
 *
 * const secondEase = new Ease({ duration: 3000, ease: 'easeInBack' })
 * const test2 = app.stage.addChild(new PIXI.Sprite(PIXI.Texture.WHITE))
 * test2.tint = 0x0000ff
 * secondEase.add(test2, { blend: [0xff0000, 0x00ff00], scale: 2 })
 */
export class Ease extends Events {
  private options: EaseOptions;
  private easings: EasingElement[];
  private empty: boolean;
  private handleRAF: number | null = null;
  private lastTime: number | null = null;

  public static id: number = 0;
  public static ease: Ease;
  public static List: Ease[] = [];

  public constructor(options?: EaseOptions) {
    super();
    this.options = { ...defaultEaseOptions, ...options };
    this.easings = [];
    this.empty = true;
    if (this.options.ticker) {
      this.options.ticker.add(this.update as unknown as TickerCallback<this>, this);
    }
  }

  /**
   * removes all eases and tickers
   */
  public destroy() {
    this.removeAll();
    if (this.options.ticker) {
      this.options.ticker.remove(this.update as unknown as TickerCallback<this>, this);
    } else if (this.options.useRAF && this.handleRAF) {
      cancelAnimationFrame(this.handleRAF);
      this.handleRAF = null;
    }
  }

  /**
   * add ease(s) to a PIXI.Container element
   */
  public add(element: PIXI.Container | PIXI.Container[], params: EaseParams, options: EaseOptions = {}): EasingElement {
    const myOptions = { ...this.options, ...options } as AddOptions;
    if (typeof options.ease === 'string') {
      myOptions.ease = penner[options.ease as keyof typeof penner] as (
        time: number,
        start: number,
        delta: number,
        duration: number,
      ) => number;
    }
    const easing = new EasingElement(element, params, myOptions);
    this.easings.push(easing);
    if (this.empty && this.options.useRAF) {
      this.handleRAF = requestAnimationFrame(() => this.update());
      this.lastTime = Date.now();
    }
    this.empty = false;
    return easing;
  }

  /**
   * create an ease that changes position (x, y) of the element by moving to the target at the speed
   */
  public target(
    element: PIXI.Container,
    target: PIXI.Container | PIXI.Point,
    speed: number,
    options: EaseOptions = {},
  ): EasingElement {
    const duration = Math.sqrt(Math.pow(element.x - target.x, 2) + Math.pow(element.y - target.y, 2)) / speed;
    options.duration = duration;
    return this.add(element, { x: target.x, y: target.y }, options);
  }

  /**
   * helper function to add an ease that changes rotation to face the element at the desired target using the speed
   */
  public face(
    element: PIXI.Container,
    target: PIXI.Container | PIXI.Point,
    speed: number,
    options: EaseOptions = {},
  ): EasingElement {
    const shortestAngle = Easing.shortestAngle(
      element.rotation,
      Math.atan2(target.y - element.y, target.x - element.x),
    );
    const duration = Math.abs(shortestAngle - element.rotation) / speed;
    options.duration = duration;
    return this.add(element, { rotation: shortestAngle }, options);
  }

  /**
   * removes one or more eases from a Container
   */
  private removeEase(element: PIXI.Container, param?: string | string[]) {
    for (let i = 0; i < this.easings.length; i++) {
      if (this.easings[i].remove(element, param)) {
        this.easings.splice(i, 1);
        i--;
      }
    }
    if (this.easings.length === 0) {
      this.empty = true;
      if (this.options.useRAF && this.handleRAF) {
        cancelAnimationFrame(this.handleRAF);
        this.handleRAF = null;
      }
    }
  }

  /**
   * remove all easings
   */
  private removeAll() {
    this.easings = [];
    this.empty = true;
    if (this.options.useRAF && this.handleRAF) {
      cancelAnimationFrame(this.handleRAF);
      this.handleRAF = null;
    }
  }

  /**
   * update frame; this is called automatically if options.useTicker !== false
   */
  private update(elapsed?: number) {
    if (this.options.ticker) {
      elapsed = this.options.ticker.elapsedMS;
    } else if (this.options.useRAF) {
      const now = Date.now();
      elapsed = now - (this.lastTime as number);
      this.lastTime = now;
    }
    elapsed = Math.min(elapsed as number, this.options.maxFrame as number);
    if (!this.empty) {
      const list = this.easings.slice(0);
      for (const easing of list) {
        if (easing.update(elapsed as number)) {
          this.easings.splice(this.easings.indexOf(easing), 1);
        }
      }
      this.emit('each', this);
      if (this.easings.length === 0) {
        this.empty = true;
        this.emit('complete', this);
      }
    }
    if (this.options.useRAF && this.easings.length) {
      this.handleRAF = requestAnimationFrame(() => this.update());
    } else {
      this.handleRAF = null;
    }
  }

  /**
   * number of easings
   */
  public get count(): number {
    return this.easings.length;
  }

  /**
   * number of active easings across all elements
   */
  private countRunning(): number {
    let count = 0;
    for (const entry of this.easings) {
      count += entry.count;
    }
    return count;
  }

  /**
   * default duration for eases.add() (only applies to newly added eases)
   */
  public set duration(duration: number) {
    this.options.duration = duration;
  }
  public get duration(): number {
    return this.options.duration as number;
  }

  /**
   * default ease for eases.add() (only applies to newly added eases)
   */
  public set ease(ease: string | ((time: number, start: number, delta: number, duration: number) => number)) {
    this.options.ease = ease;
  }
  public get ease(): string | ((time: number, start: number, delta: number, duration: number) => number) {
    return this.options.ease as string | ((time: number, start: number, delta: number, duration: number) => number);
  }
}

// manages the ids used to define the Container ease variable (enabled multiple eases attached to the same object)
Ease.id = 0;

/**
 * default instantiated Ease class
 * @type {Ease}
 */
export const ease: Ease = new Ease();

Ease.ease = ease;

export class List {
  public constructor() {
    // eslint-disable-next-line no-console
    console.warn('Ease.List was deprecated. Use new Ease() instead.');
  }
}

/**
 * fires when there are no more eases
 * @event Ease#complete
 * @type {Ease}
 */

/**
 * fires on each loop when there are eases running
 * @event Ease#each
 * @type {Ease}
 */
