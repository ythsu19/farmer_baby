// PlayerCombat — 訂閱 input:attack-down/up，從槍口生子彈
//
// 角色拿著武器（Player 子節點，純視覺）；PlayerCombat 不畫東西，
// 只負責「按了攻擊鍵 → 在槍口位置生子彈、朝面向方向飛」。
//
// 依賴：
//   - 同節點上的 Player.ts（讀 facingRight 決定子彈方向）
//   - 同節點上的 PlayerInput.ts（發 input:attack-down / input:attack-up）
//   - bulletPrefab：見 Bullet.ts 檔頭描述
//   - muzzle 節點：建議是 Weapon 子節點下的空節點，標記槍口位置；留空 → 用 Player 節點自己
//
// 設計：
//   - 按住攻擊鍵 → 持續射擊（受 fireCooldown 限制射速）
//   - 鬆開攻擊鍵 → 停止
//   - 用 NodePool 池化子彈避免頻繁建/銷
//   - 子彈跟 Player 同層（parent = Player.node.parent），不會跟著 Player 翻 scaleX 翻成負速度
//
// 對外事件：
//   shot { dir: -1|1 }  — 每發一顆子彈時，給音效 / 後座力 / 鏡頭抖動旁聽

import Player from './Player';
import Bullet from './Bullet';

const { ccclass, property } = cc._decorator;

@ccclass
export default class PlayerCombat extends cc.Component {

    @property({ displayName: '子彈 Prefab', type: cc.Prefab, tooltip: '空著就無法射擊' })
    bulletPrefab: cc.Prefab = null;

    @property({ displayName: '槍口節點', type: cc.Node, tooltip: '子彈從這個節點的世界位置生；留空 → 用 Player 節點自己' })
    muzzle: cc.Node = null;

    @property({ displayName: '射擊冷卻 (s)', tooltip: '兩發子彈間最短間隔' })
    fireCooldown: number = 0.18;

    @property({ displayName: '池預先大小', min: 1, tooltip: 'onLoad 預先建幾顆子彈放池子裡' })
    poolSize: number = 16;

    private _player: Player = null;
    private _pool: cc.NodePool = null;
    private _cooldownTimer = 0;
    private _attackHeld = false;

    onLoad() {
        this._player = this.getComponent(Player);
        if (!this.muzzle) this.muzzle = this.node;

        this._pool = new cc.NodePool();
        if (this.bulletPrefab) {
            for (let i = 0; i < this.poolSize; i++) {
                const n = cc.instantiate(this.bulletPrefab);
                this._pool.put(n);
            }
        }

        this.node.on('input:attack-down', this._onAttackDown, this);
        this.node.on('input:attack-up', this._onAttackUp, this);
    }

    onDestroy() {
        this.node.off('input:attack-down', this._onAttackDown, this);
        this.node.off('input:attack-up', this._onAttackUp, this);
        if (this._pool) this._pool.clear();
    }

    update(dt: number) {
        this._cooldownTimer = Math.max(0, this._cooldownTimer - dt);
        if (this._attackHeld) this._tryFire();
    }

    private _onAttackDown() {
        this._attackHeld = true;
        this._tryFire();  // 按下瞬間若 cooldown 已歸零就立刻射，不用等 update tick
    }

    private _onAttackUp() {
        this._attackHeld = false;
    }

    private _tryFire() {
        if (!this.bulletPrefab) return;
        if (this._cooldownTimer > 0) return;
        this._cooldownTimer = this.fireCooldown;

        const facingRight = this._player ? this._player.facingRight : true;
        const dir = facingRight ? 1 : -1;

        // 從池取 / 沒了再新建
        const node = this._pool.size() > 0
            ? this._pool.get()
            : cc.instantiate(this.bulletPrefab);

        // 子彈當 Player 的兄弟節點 — 不受 Player 的 scale 影響
        node.parent = this.node.parent;
        node.active = true;

        // 把 muzzle 世界座標換成 node.parent 局部座標
        const muzzleWorld = this.muzzle.parent
            ? this.muzzle.parent.convertToWorldSpaceAR(this.muzzle.position)
            : cc.v2(this.muzzle.x, this.muzzle.y);
        const local = node.parent
            ? node.parent.convertToNodeSpaceAR(muzzleWorld)
            : muzzleWorld;
        node.setPosition(local.x, local.y);

        const bullet = node.getComponent(Bullet);
        if (bullet) bullet.init(dir, this._pool);

        this.node.emit('shot', { dir });
    }
}
