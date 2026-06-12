// PlayerAnimator — TopDown 四方向逐幀貼圖版
//
// 用法：
// 1. 同節點掛 cc.Sprite，或把 Sprite 拉到 Target Sprite
// 2. Down Walk Frames：放正面/往下走，例如 WALK1~WALK4
// 3. Up Walk Frames：放背面/往上走，例如 WALK5~WALK7
// 4. Side Walk Frames：放側面走，如果沒有就先放 Down Walk Frames 測試
// 5. 你的玩家移動腳本要 emit：
//      this.node.emit('move-dir-changed', moveDir);
//    moveDir 是 cc.Vec2，例如 cc.v2(1,0)、cc.v2(0,1)

const { ccclass, property } = cc._decorator;

enum PlayerState {
    IDLE = "IDLE",
    WALK = "WALK",
    JUMP = "JUMP",
    FALL = "FALL",
}
enum FaceDir {
    DOWN = 0,
    UP = 1,
    LEFT = 2,
    RIGHT = 3,
}

@ccclass
export default class PlayerAnimator extends cc.Component {

    @property({
        displayName: '目標 Sprite',
        type: cc.Sprite,
        tooltip: '要換 spriteFrame 的 Sprite；留空 → 自動找同節點上的 cc.Sprite'
    })
    targetSprite: cc.Sprite = null;

    @property({
        displayName: '翻面節點',
        type: cc.Node,
        tooltip: '用 scaleX 正負翻面；留空 → 翻自己節點'
    })
    flipNode: cc.Node = null;

    // ── DOWN / FRONT ────────────────────────────────
    @property({ displayName: 'DOWN IDLE 影格', type: [cc.SpriteFrame] })
    downIdleFrames: cc.SpriteFrame[] = [];

    @property({ displayName: 'DOWN WALK 影格', type: [cc.SpriteFrame] })
    downWalkFrames: cc.SpriteFrame[] = [];

    // ── UP / BACK ────────────────────────────────
    @property({ displayName: 'UP IDLE 影格', type: [cc.SpriteFrame] })
    upIdleFrames: cc.SpriteFrame[] = [];

    @property({ displayName: 'UP WALK 影格', type: [cc.SpriteFrame], tooltip: '這裡放 WALK5 ~ WALK7，也就是角色往後走的圖片' })
    upWalkFrames: cc.SpriteFrame[] = [];

    // ── SIDE / LEFT RIGHT ────────────────────────────────
    @property({ displayName: 'SIDE IDLE 影格', type: [cc.SpriteFrame] })
    sideIdleFrames: cc.SpriteFrame[] = [];

    @property({ displayName: 'SIDE WALK 影格', type: [cc.SpriteFrame] })
    sideWalkFrames: cc.SpriteFrame[] = [];

    @property({ displayName: 'IDLE FPS' })
    idleFps: number = 4;

    @property({ displayName: 'WALK FPS' })
    walkFps: number = 10;

    // 如果你還有跳躍，保留這些；TopDown 通常用不到
    @property({ displayName: 'JUMP 影格', type: [cc.SpriteFrame] })
    jumpFrames: cc.SpriteFrame[] = [];

    @property({ displayName: 'JUMP FPS' })
    jumpFps: number = 8;

    @property({ displayName: 'JUMP 結尾停最後一張' })
    jumpHoldLast: boolean = true;

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

    private _currentState: PlayerState = PlayerState.IDLE;
    private _faceDir: FaceDir = FaceDir.DOWN;
    private _baseScaleX: number = 1;

    onLoad() {
        if (!this.targetSprite) {
            this.targetSprite = this.getComponent(cc.Sprite);
        }

        if (!this.flipNode) {
            this.flipNode = this.node;
        }

        this._baseScaleX = Math.abs(this.flipNode.scaleX) || 1;

        this.node.on('state-changed', this._onStateChanged, this);
        this.node.on('facing-changed', this._onFacingChanged, this);

        // TopDown 用：玩家移動方向改變時更新前後左右
        this.node.on('move-dir-changed', this._onMoveDirChanged, this);
    }

    start() {
        this._switchTo(PlayerState.IDLE);
    }

    onDestroy() {
        this.node.off('state-changed', this._onStateChanged, this);
        this.node.off('facing-changed', this._onFacingChanged, this);
        this.node.off('move-dir-changed', this._onMoveDirChanged, this);
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

                this._idx = 0;
            }
        }

        this.targetSprite.spriteFrame = this._frames[this._idx];
    }

    private _onStateChanged(e: { from: PlayerState, to: PlayerState }) {
        this._currentState = e.to;
        this._switchTo(this._currentState);
    }

    private _onFacingChanged(faceRight: boolean) {
        // 保留舊事件：如果你的 Player.ts 只會發 facing-changed，也還能左右翻
        this._faceDir = faceRight ? FaceDir.RIGHT : FaceDir.LEFT;
        this._applyFlip();
        this._switchTo(this._currentState);
    }

    private _onMoveDirChanged(moveDir: cc.Vec2) {
        if (!moveDir) return;

        // 沒有移動時，不改面向，保持最後方向
        if (moveDir.magSqr() < 0.0001) {
            return;
        }

        // 判斷主要方向
        if (Math.abs(moveDir.x) > Math.abs(moveDir.y)) {
            this._faceDir = moveDir.x > 0 ? FaceDir.RIGHT : FaceDir.LEFT;
        } else {
            this._faceDir = moveDir.y > 0 ? FaceDir.UP : FaceDir.DOWN;
        }

        this._applyFlip();
        this._switchTo(this._currentState);
    }

    private _applyFlip() {
        if (!this.flipNode) return;

        if (this._faceDir === FaceDir.LEFT) {
            this.flipNode.scaleX = -this._baseScaleX;
        } else {
            this.flipNode.scaleX = this._baseScaleX;
        }
    }

    private _switchTo(s: PlayerState) {
        const cfg = this._configFor(s);

        if (!cfg.frames || cfg.frames.length === 0) {
            return;
        }

        this._frames = cfg.frames;
        this._fps = cfg.fps;
        this._holdLast = cfg.holdLast;
        this._idx = 0;
        this._accum = 0;
        this._done = false;

        if (this.targetSprite) {
            this.targetSprite.spriteFrame = this._frames[0];
        }
    }

    private _configFor(s: PlayerState): { frames: cc.SpriteFrame[], fps: number, holdLast: boolean } {
        switch (s) {
            case PlayerState.IDLE:
                return {
                    frames: this._getIdleFramesByDirection(),
                    fps: this.idleFps,
                    holdLast: false
                };

            case PlayerState.WALK:
                return {
                    frames: this._getWalkFramesByDirection(),
                    fps: this.walkFps,
                    holdLast: false
                };

            case PlayerState.JUMP:
                return {
                    frames: this.jumpFrames,
                    fps: this.jumpFps,
                    holdLast: this.jumpHoldLast
                };

            case PlayerState.FALL:
                return {
                    frames: this.fallFrames,
                    fps: this.fallFps,
                    holdLast: this.fallHoldLast
                };

            default:
                return {
                    frames: [],
                    fps: 1,
                    holdLast: false
                };
        }
    }

    private _getIdleFramesByDirection(): cc.SpriteFrame[] {
        switch (this._faceDir) {
            case FaceDir.UP:
                return this.upIdleFrames.length > 0
                    ? this.upIdleFrames
                    : this.downIdleFrames;

            case FaceDir.LEFT:
            case FaceDir.RIGHT:
                return this.sideIdleFrames.length > 0
                    ? this.sideIdleFrames
                    : this.downIdleFrames;

            case FaceDir.DOWN:
            default:
                return this.downIdleFrames;
        }
    }

    private _getWalkFramesByDirection(): cc.SpriteFrame[] {
        switch (this._faceDir) {
            case FaceDir.UP:
                return this.upWalkFrames.length > 0
                    ? this.upWalkFrames
                    : this.downWalkFrames;

            case FaceDir.LEFT:
            case FaceDir.RIGHT:
                return this.sideWalkFrames.length > 0
                    ? this.sideWalkFrames
                    : this.downWalkFrames;

            case FaceDir.DOWN:
            default:
                return this.downWalkFrames;
        }
    }
}