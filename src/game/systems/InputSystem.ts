import Phaser from 'phaser';

type PointerCallback = (pointer: Phaser.Input.Pointer) => void;
type CancelCallback = () => void;
type ConfirmGuardCallback = (pointer: Phaser.Input.Pointer) => boolean;

export class InputSystem {
  private readonly scene: Phaser.Scene;
  private onPointerMove?: PointerCallback;
  private onPointerConfirm?: PointerCallback;
  private onCancel?: CancelCallback;
  private canConfirmPointer?: ConfirmGuardCallback;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public bind(): void {
    this.scene.input.on('pointermove', this.handlePointerMove, this);
    this.scene.input.on('pointerup', this.handlePointerUp, this);
    this.scene.input.keyboard?.on('keydown-ESC', this.handleCancel, this);
  }

  public setPointerMoveCallback(callback: PointerCallback): void {
    this.onPointerMove = callback;
  }

  public setConfirmCallback(callback: PointerCallback): void {
    this.onPointerConfirm = callback;
  }

  public setCancelCallback(callback: CancelCallback): void {
    this.onCancel = callback;
  }

  public setCanConfirmCallback(callback: ConfirmGuardCallback): void {
    this.canConfirmPointer = callback;
  }

  public destroy(): void {
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
    this.scene.input.keyboard?.off('keydown-ESC', this.handleCancel, this);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    this.onPointerMove?.(pointer);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 2) {
      return;
    }
    if (this.canConfirmPointer && !this.canConfirmPointer(pointer)) {
      return;
    }
    this.onPointerConfirm?.(pointer);
  }

  private handleCancel(): void {
    this.onCancel?.();
  }
}
