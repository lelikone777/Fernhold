import Phaser from 'phaser';
import { CAMERA } from '../constants';

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
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private keys?: CameraKeys;
  private dragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
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
    if (!this.keys) {
      return;
    }

    const delta = deltaMs / 1000;
    const step = (CAMERA.speed * delta) / this.camera.zoom;

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

    this.constrainCamera();
  }

  public destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('wheel', this.onWheel, this);
    this.scene.scale.off('resize', this.onResize, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.canStartDragViewport && !this.canStartDragViewport()) {
      this.dragging = false;
      return;
    }
    this.dragging = true;
    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;
  }

  private onPointerUp(): void {
    this.dragging = false;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) {
      return;
    }

    const deltaX = (pointer.x - this.lastPointerX) / this.camera.zoom;
    const deltaY = (pointer.y - this.lastPointerY) / this.camera.zoom;

    this.camera.scrollX -= deltaX;
    this.camera.scrollY -= deltaY;
    this.constrainCamera();

    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;
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
}
