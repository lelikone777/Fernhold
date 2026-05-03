import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#152016');
    this.scene.start('PreloadScene');
  }
}
