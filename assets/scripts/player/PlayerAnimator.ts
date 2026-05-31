// PlayerAnimator — 訂閱 Player 的狀態事件，切動畫 + 翻面
//
// 設計上 PlayerAnimator 不改任何遊戲邏輯，只「看 Player 發了什麼 → 視覺反應」。
// 沒掛這個元件，Player 仍會正常跑物理，只是動畫不會切、不會翻面。
//
// 所有 clip 名稱用 @property 讓設計師在 Inspector 填，留空或找不到 → 安靜跳過，
// 動畫素材還沒就位也不會 console 噴錯。
//
// 詳細設計請看 LIN/player_design.md。

import { PlayerState } from './Player';

const { ccclass, property } = cc._decorator;

@ccclass
export default class PlayerAnimator extends cc.Component {

    @property({ displayName: 'cc.Animation 元件', type: cc.Animation, tooltip: '留空 → 自動找同節點上的 cc.Animation' })
    animation: cc.Animation = null;

    @property({ displayName: '翻面節點', type: cc.Node, tooltip: '用 scaleX 正負翻面；留空 → 翻自己節點' })
    flipNode: cc.Node = null;

    @property({ displayName: 'IDLE clip 名稱' })
    clipIdle: string = '';

    @property({ displayName: 'WALK clip 名稱' })
    clipWalk: string = '';

    @property({ displayName: 'JUMP clip 名稱' })
    clipJump: string = '';

    @property({ displayName: 'FALL clip 名稱' })
    clipFall: string = '';

    private _currentClip = '';

    onLoad() {
        if (!this.animation) this.animation = this.getComponent(cc.Animation);
        if (!this.flipNode) this.flipNode = this.node;

        this.node.on('state-changed', this._onStateChanged, this);
        this.node.on('facing-changed', this._onFacingChanged, this);
    }

    start() {
        // 進場先放 idle，避免在第一次 state-changed 前畫面是 default frame
        this._play(this.clipIdle);
    }

    onDestroy() {
        this.node.off('state-changed', this._onStateChanged, this);
        this.node.off('facing-changed', this._onFacingChanged, this);
    }

    private _onStateChanged(e: { from: PlayerState, to: PlayerState }) {
        this._play(this._stateToClip(e.to));
    }

    private _onFacingChanged(faceRight: boolean) {
        if (!this.flipNode) return;
        const abs = Math.abs(this.flipNode.scaleX) || 1;
        this.flipNode.scaleX = faceRight ? abs : -abs;
    }

    private _stateToClip(s: PlayerState): string {
        switch (s) {
            case PlayerState.IDLE: return this.clipIdle;
            case PlayerState.WALK: return this.clipWalk;
            case PlayerState.JUMP: return this.clipJump;
            case PlayerState.FALL: return this.clipFall;
            default: return '';
        }
    }

    private _play(clipName: string) {
        if (!clipName || clipName === this._currentClip) return;
        if (!this.animation) return;
        // getAnimationState(name) 沒註冊會回 null/undefined — 安靜跳過，不噴 console warn
        if (!this.animation.getAnimationState(clipName)) return;
        this.animation.play(clipName);
        this._currentClip = clipName;
    }
}
