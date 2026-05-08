import Phaser from 'phaser';
import { CAMERA } from '../constants';
import {
  blendVelocity,
  decayVelocity,
  hasExceededDragThreshold,
  toWorldDelta,
} from '../utils/cameraNavigation';

interface CameraKeys {
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

export class CameraSystem {
  private static readonly DRAG_THRESHOLD_PX = 8;
  private static readonly VELOCITY_SMOOTHING = 0.35;
  private static readonly MAX_PAN_VELOCITY = 2.4;
  private static readonly FRICTION_PER_MS = 0.0038;
  private static readonly MIN_VELOCITY = 0.005;

  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private keys?: CameraKeys;
  private pointerDown = false;
  private dragging = false;
  private activePointerId: number | null = null;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastMoveTimeMs: number | null = null;
  private panVelocityX = 0;
  private panVelocityY = 0;
  private draggedThisGesture = false;
  private suppressNextConfirm = false;
  private canStartDragViewport?: () => boolean;

  constructor(
    scene: Phaser.Scene,
    camera: Phaser.Cameras.Scene2D.Camera,
    worldWidth: number,
    worldHeight: number,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  public attach(): void {
    const keyboard = this.scene.input.keyboard;
    if (keyboard) {
      this.keys = keyboard.addKeys({
        w: 'W',
        a: 'A',
        s: 'S',
        d: 'D',
        up: 'UP',
        down: 'DOWN',
        left: 'LEFT',
        right: 'RIGHT',
      }) as CameraKeys;
    }

    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('wheel', this.onWheel, this);
    this.scene.scale.on('resize', this.onResize, this);
    this.constrainCamera();
  }

  public setCanStartDragViewport(callback: () => boolean): void {
    this.canStartDragViewport = callback;
  }

  public update(deltaMs: number): void {
    const delta = deltaMs / 1000;
    const step = (CAMERA.speed * delta) / this.camera.zoom;

    if (this.keys) {
      if (this.keys.left.isDown || this.keys.a.isDown) {
        this.camera.scrollX -= step;
      }
      if (this.keys.right.isDown || this.keys.d.isDown) {
        this.camera.scrollX += step;
      }
      if (this.keys.up.isDown || this.keys.w.isDown) {
        this.camera.scrollY -= step;
      }
      if (this.keys.down.isDown || this.keys.s.isDown) {
        this.camera.scrollY += step;
      }
    }

    if (!this.pointerDown && (this.panVelocityX !== 0 || this.panVelocityY !== 0)) {
      this.camera.scrollX -= this.panVelocityX * deltaMs;
      this.camera.scrollY -= this.panVelocityY * deltaMs;
      this.panVelocityX = decayVelocity(this.panVelocityX, deltaMs, {
        frictionPerMs: CameraSystem.FRICTION_PER_MS,
        minAbs: CameraSystem.MIN_VELOCITY,
      });
      this.panVelocityY = decayVelocity(this.panVelocityY, deltaMs, {
        frictionPerMs: CameraSystem.FRICTION_PER_MS,
        minAbs: CameraSystem.MIN_VELOCITY,
      });
    }

    this.constrainCamera();
    this.stopVelocityAtBounds();
  }

  public destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('wheel', this.onWheel, this);
    this.scene.scale.off('resize', this.onResize, this);
  }

  public consumePointerUpSuppression(): boolean {
    const shouldSuppress = this.suppressNextConfirm;
    this.suppressNextConfirm = false;
    return shouldSuppress;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.canStartDragViewport && !this.canStartDragViewport()) {
      this.pointerDown = false;
      this.dragging = false;
      this.activePointerId = null;
      return;
    }

    this.pointerDown = true;
    this.dragging = false;
    this.draggedThisGesture = false;
    this.activePointerId = pointer.id;
    this.pointerDownX = pointer.x;
    this.pointerDownY = pointer.y;
    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;
    this.lastMoveTimeMs = this.getPointerTimeMs(pointer);
    this.suppressNextConfirm = false;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== null && pointer.id !== this.activePointerId) {
      return;
    }
    this.pointerDown = false;
    this.dragging = false;
    this.activePointerId = null;
    this.lastMoveTimeMs = null;
    this.suppressNextConfirm = this.draggedThisGesture;
    if (!this.draggedThisGesture) {
      this.panVelocityX = 0;
      this.panVelocityY = 0;
    }
    this.draggedThisGesture = false;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.pointerDown || (this.activePointerId !== null && pointer.id !== this.activePointerId)) {
      return;
    }

    if (
      !this.dragging &&
      !hasExceededDragThreshold(
        this.pointerDownX,
        this.pointerDownY,
        pointer.x,
        pointer.y,
        CameraSystem.DRAG_THRESHOLD_PX,
      )
    ) {
      return;
    }

    if (!this.dragging) {
      this.dragging = true;
      this.draggedThisGesture = true;
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
      this.lastMoveTimeMs = this.getPointerTimeMs(pointer);
      this.panVelocityX = 0;
      this.panVelocityY = 0;
      return;
    }

    const deltaX = toWorldDelta(pointer.x - this.lastPointerX, this.camera.zoom);
    const deltaY = toWorldDelta(pointer.y - this.lastPointerY, this.camera.zoom);

    this.camera.scrollX -= deltaX;
    this.camera.scrollY -= deltaY;
    this.constrainCamera();
    this.stopVelocityAtBounds();

    const nowMs = this.getPointerTimeMs(pointer);
    const deltaMs = nowMs !== null && this.lastMoveTimeMs !== null
      ? Math.max(1, Math.min(40, nowMs - this.lastMoveTimeMs))
      : 16;
    this.panVelocityX = blendVelocity(this.panVelocityX, deltaX, deltaMs, {
      smoothing: CameraSystem.VELOCITY_SMOOTHING,
      maxAbs: CameraSystem.MAX_PAN_VELOCITY,
    });
    this.panVelocityY = blendVelocity(this.panVelocityY, deltaY, deltaMs, {
      smoothing: CameraSystem.VELOCITY_SMOOTHING,
      maxAbs: CameraSystem.MAX_PAN_VELOCITY,
    });

    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;
    this.lastMoveTimeMs = nowMs;
  }

  private onWheel(
    _pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    const direction = deltaY > 0 ? -1 : 1;
    const nextZoom = Phaser.Math.Clamp(
      this.camera.zoom + direction * CAMERA.zoomStep,
      this.getMinZoom(),
      CAMERA.zoomMax,
    );
    this.camera.setZoom(nextZoom);
    this.constrainCamera();
  }

  private onResize(): void {
    this.constrainCamera();
  }

  private getPointerTimeMs(pointer: Phaser.Input.Pointer): number | null {
    const candidate = (pointer as unknown as { event?: { timeStamp?: number } }).event?.timeStamp;
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      return null;
    }
    return candidate;
  }

  private getMinZoom(): number {
    return Math.max(
      CAMERA.zoomMin,
      this.camera.width / this.worldWidth,
      this.camera.height / this.worldHeight,
    );
  }

  private constrainCamera(): void {
    const minZoom = this.getMinZoom();
    if (this.camera.zoom < minZoom) {
      this.camera.setZoom(minZoom);
    }

    const visibleWidth = this.camera.width / this.camera.zoom;
    const visibleHeight = this.camera.height / this.camera.zoom;
    const maxScrollX = Math.max(0, this.worldWidth - visibleWidth);
    const maxScrollY = Math.max(0, this.worldHeight - visibleHeight);

    this.camera.scrollX = Phaser.Math.Clamp(this.camera.scrollX, 0, maxScrollX);
    this.camera.scrollY = Phaser.Math.Clamp(this.camera.scrollY, 0, maxScrollY);
  }

  private stopVelocityAtBounds(): void {
    const visibleWidth = this.camera.width / this.camera.zoom;
    const visibleHeight = this.camera.height / this.camera.zoom;
    const maxScrollX = Math.max(0, this.worldWidth - visibleWidth);
    const maxScrollY = Math.max(0, this.worldHeight - visibleHeight);

    if (this.camera.scrollX <= 0 && this.panVelocityX > 0) {
      this.panVelocityX = 0;
    } else if (this.camera.scrollX >= maxScrollX && this.panVelocityX < 0) {
      this.panVelocityX = 0;
    }

    if (this.camera.scrollY <= 0 && this.panVelocityY > 0) {
      this.panVelocityY = 0;
    } else if (this.camera.scrollY >= maxScrollY && this.panVelocityY < 0) {
      this.panVelocityY = 0;
    }
  }
}
