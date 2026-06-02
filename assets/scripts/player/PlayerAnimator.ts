// PlayerAnimator — 逐幀貼圖版（frame array）
//
// 為什麼不用 cc.Animation？
//   cc.Animation 要開 Animation 編輯器拉 keyframe 做 .anim 檔，繁瑣。
//   逐幀切 spriteFrame 更直觀：Inspector 拉一堆圖片進陣列、設 FPS，就會跑。
//
// 用法：
//   1. 同節點掛 cc.Sprite（或 Sprite 子節點，把它拉到 Inspector 的 Target Sprite）
//   2. 每個狀態（idle/walk/jump/fall）的 frames 陣列拉幾張圖片 + 設 FPS
//   3. 沒拉圖片的狀態 → 該狀態保持上一張，不會錯
//
// 元件不改任何遊戲邏輯，只訂閱 Player 的 state-changed / facing-changed 做視覺反應。
// 詳細設計請看 LIN/player_design.md。

import { PlayerState } from './Player';

const { ccclass, property } = cc._decorator;

@ccclass
export default class PlayerAnimator extends cc.Component {

    @property({ displayName: '目標 Sprite', type: cc.Sprite, tooltip: '要換 spriteFrame 的 Sprite；留空 → 自動找同節點上的 cc.Sprite' })
    targetSprite: cc.Sprite = null;

    @property({ displayName: '翻面節點', type: cc.Node, tooltip: '用 scaleX 正負翻面；留空 → 翻自己節點' })
    flipNode: cc.Node = null;

    // ── IDLE ────────────────────────────────
    @property({ displayName: 'IDLE 影格', type: [cc.SpriteFrame] })
    idleFrames: cc.SpriteFrame[] = [];

    @property({ displayName: 'IDLE FPS', tooltip: '每秒幾張' })
    idleFps: number = 4;

    // ── WALK ────────────────────────────────
    @property({ displayName: 'WALK 影格', type: [cc.SpriteFrame] })
    walkFrames: cc.SpriteFrame[] = [];

    @property({ displayName: 'WALK FPS' })
    walkFps: number = 10;

    // ── JUMP ────────────────────────────────
    @property({ displayName: 'JUMP 影格', type: [cc.SpriteFrame] })
    jumpFrames: cc.SpriteFrame[] = [];

    @property({ displayName: 'JUMP FPS' })
    jumpFps: number = 8;

    @property({ displayName: 'JUMP 結尾停最後一張', tooltip: '勾 → 播完停在最後一張；不勾 → 循環' })
    jumpHoldLast: boolean = true;

    // ── FALL ────────────────────────────────
    @property({ displayName: 'FALL 影格', type: [cc.SpriteFrame] })
    fallFrames: cc.SpriteFrame[] = [];

    @property({ displayName: 'FALL FPS' })
    fallFps: number = 8;

    @property({ displayName: 'FALL 結尾停最後一張' })
    fallHoldLast: boolean = true;

    // ── 內部狀態 ─────────────────────────────
    private _frames: cc.SpriteFrame[] = [];
    private _fps: number = 1;
    private _holdLast: boolean = false;
    private _idx: number = 0;
    private _accum: number = 0;
    private _done: boolean = false;

    onLoad() {
        if (!this.targetSprite) this.targetSprite = this.getComponent(cc.Sprite);
        if (!this.flipNode) this.flipNode = this.node;

        this.node.on('state-changed', this._onStateChanged, this);
        this.node.on('facing-changed', this._onFacingChanged, this);
    }

    start() {
        // 進場先放 IDLE 第一張，避免出現 default frame
        this._switchTo(PlayerState.IDLE);
    }

    onDestroy() {
        this.node.off('state-changed', this._onStateChanged, this);
        this.node.off('facing-changed', this._onFacingChanged, this);
    }

    update(dt: number) {
        if (!this.targetSprite || this._frames.length === 0) return;
        if (this._done) return;

        const period = 1 / Math.max(1, this._fps);
        this._accum += dt;
        while (this._accum >= period) {
            this._accum -= period;
            this._idx++;
            if (this._idx >= this._frames.length) {
                if (this._holdLast) {
                    this._idx = this._frames.length - 1;
                    this._done = true;
                    break;
                }
                this._idx = 0;  // 循環
            }
        }
        this.targetSprite.spriteFrame = this._frames[this._idx];
    }

    private _onStateChanged(e: { from: PlayerState, to: PlayerState }) {
        this._switchTo(e.to);
    }

    private _onFacingChanged(faceRight: boolean) {
        if (!this.flipNode) return;
        const abs = Math.abs(this.flipNode.scaleX) || 1;
        this.flipNode.scaleX = faceRight ? abs : -abs;
    }

    private _switchTo(s: PlayerState) {
        const cfg = this._configFor(s);
        if (!cfg.frames || cfg.frames.length === 0) return;  // 該狀態沒設圖 → 保持上一張

        this._frames = cfg.frames;
        this._fps = cfg.fps;
        this._holdLast = cfg.holdLast;
        this._idx = 0;
        this._accum = 0;
        this._done = false;
        if (this.targetSprite) this.targetSprite.spriteFrame = this._frames[0];
    }

    private _configFor(s: PlayerState): { frames: cc.SpriteFrame[], fps: number, holdLast: boolean } {
        switch (s) {
            case PlayerState.IDLE: return { frames: this.idleFrames, fps: this.idleFps, holdLast: false };
            case PlayerState.WALK: return { frames: this.walkFrames, fps: this.walkFps, holdLast: false };
            case PlayerState.JUMP: return { frames: this.jumpFrames, fps: this.jumpFps, holdLast: this.jumpHoldLast };
            case PlayerState.FALL: return { frames: this.fallFrames, fps: this.fallFps, holdLast: this.fallHoldLast };
            default: return { frames: [], fps: 1, holdLast: false };
        }
    }
}
