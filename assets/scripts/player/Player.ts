// LIN's fresh Player controller — composition-based design.
// 取代 assets/scripts/characters/PlayerController.ts（god class）。
// 這個檔目前只負責：左右移動、跳躍、面向翻轉。其餘職責拆給未來的 PlayerInput / PlayerHealth / PlayerShooter / PlayerAnimator。

const { ccclass, property } = cc._decorator;

export enum PlayerState {
    IDLE = 'idle',
    MOVE = 'move',
    JUMP = 'jump',
    FALL = 'fall',
}

@ccclass
export default class Player extends cc.Component {

    @property({ displayName: '走路速度（px/秒）' })
    walkSpeed: number = 200;

    @property({ displayName: '跳躍初速（px/秒）' })
    jumpVelocity: number = 600;

    @property({ displayName: '重力（px/秒²）' })
    gravity: number = 1600;

    @property({ displayName: '允許雙跳' })
    enableDoubleJump: boolean = true;

    @property({ displayName: '暫用地板 Y（之後改用 Tiled 地形）' })
    tempGroundY: number = -200;

    get state(): PlayerState { return this._state; }
    get facingRight(): boolean { return this._facingRight; }

    private _state: PlayerState = PlayerState.IDLE;
    private _moveDir: number = 0;
    private _vy: number = 0;
    private _isGrounded: boolean = false;
    private _facingRight: boolean = true;
    private _jumpsLeft: number = 0;

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP,   this._onKeyUp,   this);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP,   this._onKeyUp,   this);
    }

    update(dt: number) {
        this.node.x += this._moveDir * this.walkSpeed * dt;

        if (!this._isGrounded) {
            this._vy -= this.gravity * dt;
        }
        this.node.y += this._vy * dt;

        if (this.node.y <= this.tempGroundY) {
            this.node.y = this.tempGroundY;
            this._vy = 0;
            if (!this._isGrounded) {
                this._isGrounded = true;
                this._jumpsLeft = this.enableDoubleJump ? 2 : 1;
            }
        }

        this._updateFacing();
        this._refreshState();
    }

    private _onKeyDown(e: cc.Event.EventKeyboard) {
        switch (e.keyCode) {
            case cc.macro.KEY.a:
            case cc.macro.KEY.left:
                this._moveDir = -1;
                break;
            case cc.macro.KEY.d:
            case cc.macro.KEY.right:
                this._moveDir = 1;
                break;
            case cc.macro.KEY.space:
            case cc.macro.KEY.w:
            case cc.macro.KEY.up:
                this._tryJump();
                break;
        }
    }

    private _onKeyUp(e: cc.Event.EventKeyboard) {
        const k = e.keyCode;
        const releasedLeft  = (k === cc.macro.KEY.a || k === cc.macro.KEY.left)  && this._moveDir < 0;
        const releasedRight = (k === cc.macro.KEY.d || k === cc.macro.KEY.right) && this._moveDir > 0;
        if (releasedLeft || releasedRight) this._moveDir = 0;
    }

    private _tryJump() {
        if (this._jumpsLeft <= 0) return;
        this._vy = this.jumpVelocity;
        this._isGrounded = false;
        this._jumpsLeft--;
    }

    private _updateFacing() {
        if (this._moveDir > 0 && !this._facingRight) {
            this._facingRight = true;
            this.node.scaleX =  Math.abs(this.node.scaleX);
        } else if (this._moveDir < 0 && this._facingRight) {
            this._facingRight = false;
            this.node.scaleX = -Math.abs(this.node.scaleX);
        }
    }

    private _refreshState() {
        let next: PlayerState;
        if      (this._vy >  50) next = PlayerState.JUMP;
        else if (this._vy < -50) next = PlayerState.FALL;
        else if (this._moveDir !== 0) next = PlayerState.MOVE;
        else                          next = PlayerState.IDLE;
        if (next !== this._state) {
            this._state = next;
            this.node.emit('player-state-changed', next);
        }
    }
}
