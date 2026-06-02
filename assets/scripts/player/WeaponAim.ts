// WeaponAim — 武器跟著滑鼠轉、Player 面向跟著滑鼠 x 方向翻
//
// 掛在 Player 節點上。每幀讀 PlayerInput.aimWorldPos()：
//   1. 算 weaponNode 對滑鼠的角度 → weaponNode.angle
//   2. 滑鼠在左半邊 → weaponNode.scaleY = -|sy|（武器上下翻，槍管朝外不朝下）
//      滑鼠在右半邊 → weaponNode.scaleY = +|sy|
//   3. 滑鼠 x 跨過 weapon 中心 → emit 'facing-changed'（讓 PlayerAnimator 翻角色 sprite）
//
// 為什麼放 update 不放 input:aim 事件：
//   鏡頭跟隨時，玩家移動但滑鼠不動，世界座標仍會變 → 每幀 recompute 保持武器朝向正確。
//
// 沒有 PlayerInput / 滑鼠還沒動 → 武器停在預設角度（angle=0 朝右），不會出怪狀。

import PlayerInput from './PlayerInput';

const { ccclass, property } = cc._decorator;

@ccclass
export default class WeaponAim extends cc.Component {

    @property({ displayName: '武器節點', type: cc.Node, tooltip: '會被旋轉的節點（拉 Player/Weapon）；留空 → 不轉武器，只更新 Player 面向' })
    weaponNode: cc.Node = null;

    @property({ displayName: '面向死區 (px)', tooltip: '滑鼠跟武器 x 軸距離小於這值就不切換面向，避免在中線抖動' })
    facingDeadzone: number = 8;

    private _input: PlayerInput = null;
    private _facingRight: boolean = true;
    private _facingInitialized: boolean = false;

    onLoad() {
        this._input = this.getComponent(PlayerInput);
    }

    update(_dt: number) {
        if (!this._input || !this._input.hasAim()) return;

        // 旋轉中心（通常是武器節點的世界座標）
        const pivot = this.weaponNode
            ? (this.weaponNode.parent
                ? this.weaponNode.parent.convertToWorldSpaceAR(this.weaponNode.position)
                : cc.v2(this.weaponNode.x, this.weaponNode.y))
            : (this.node.parent
                ? this.node.parent.convertToWorldSpaceAR(this.node.position)
                : cc.v2(this.node.x, this.node.y));

        const aim = this._input.aimWorldPos();
        const dx = aim.x - pivot.x;
        const dy = aim.y - pivot.y;

        // 更新武器旋轉與上下翻
        if (this.weaponNode) {
            const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
            this.weaponNode.angle = angleDeg;

            const aimLeft = dx < 0;
            const absSY = Math.abs(this.weaponNode.scaleY) || 1;
            this.weaponNode.scaleY = aimLeft ? -absSY : absSY;
        }

        // 更新 Player 面向（用死區避免在 x=0 附近抖）
        const wantRight = dx > this.facingDeadzone
            ? true
            : dx < -this.facingDeadzone
                ? false
                : this._facingRight;
        if (!this._facingInitialized || wantRight !== this._facingRight) {
            this._facingInitialized = true;
            this._facingRight = wantRight;
            this.node.emit('facing-changed', wantRight);
        }
    }
}
