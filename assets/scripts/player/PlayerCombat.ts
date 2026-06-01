// PlayerCombat — 訂閱 input:attack-down/up，從槍口朝滑鼠方向生子彈
//
// 角色拿著武器（Player 子節點，純視覺）；武器轉向由 WeaponAim 負責。
// PlayerCombat 只負責「按了攻擊鍵 → 在槍口位置朝滑鼠方向生子彈」。
//
// 依賴：
//   - 同節點上的 PlayerInput.ts（發 input:attack-down / up，並提供 aimWorldPos()）
//   - bulletPrefab：見 Bullet.ts 檔頭描述
//   - muzzle 節點：建議是 Weapon 子節點下的空節點，標記槍口位置；
//     由於武器會被 WeaponAim 轉動，muzzle 跟著轉到槍口前端 → 取世界座標時就是真正的槍口位置
//   - muzzle 留空 → 用 Player 節點自己（沒武器素材時 fallback）
//
// 設計：
//   - 按住滑鼠左鍵 → 持續射擊（受 fireCooldown 限制射速）
//   - 鬆開停止
//   - 每發子彈方向 = normalize(滑鼠世界座標 − muzzle 世界座標)
//   - 用 NodePool 池化子彈
//   - 子彈 parent = Player 兄弟層，不受 Player / Weapon 的 scale / rotation 影響
//
// 對外事件：
//   shot { dir: cc.Vec2 }  — 每發一顆子彈時，給音效 / 後座力 / 鏡頭抖動旁聽

import PlayerInput from './PlayerInput';
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

    private _input: PlayerInput = null;
    private _pool: cc.NodePool = null;
    private _cooldownTimer = 0;
    private _attackHeld = false;

    onLoad() {
        this._input = this.getComponent(PlayerInput);
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

        // 計算槍口世界座標
        const muzzleWorld = this.muzzle.parent
            ? this.muzzle.parent.convertToWorldSpaceAR(this.muzzle.position)
            : cc.v2(this.muzzle.x, this.muzzle.y);

        // 計算瞄準方向（滑鼠世界座標 - 槍口世界座標）
        // 沒有滑鼠輸入 → fallback 朝右射
        let dx = 1, dy = 0;
        if (this._input && this._input.hasAim()) {
            const aim = this._input.aimWorldPos();
            dx = aim.x - muzzleWorld.x;
            dy = aim.y - muzzleWorld.y;
            const len2 = dx * dx + dy * dy;
            if (len2 < 1) {
                // 滑鼠太貼近槍口，避免方向亂跳 → 不開火
                this._cooldownTimer = this.fireCooldown;
                return;
            }
        }

        this._cooldownTimer = this.fireCooldown;

        // 從池取 / 沒了再新建
        const node = this._pool.size() > 0
            ? this._pool.get()
            : cc.instantiate(this.bulletPrefab);

        // 子彈當 Player 的兄弟節點 — 不受 Player / Weapon 的 scale / rotation 影響
        node.parent = this.node.parent;
        node.active = true;

        // 把 muzzle 世界座標換成 node.parent 局部座標
        const local = node.parent
            ? node.parent.convertToNodeSpaceAR(muzzleWorld)
            : muzzleWorld;
        node.setPosition(local.x, local.y);

        const dirVec = cc.v2(dx, dy);
        const bullet = node.getComponent(Bullet);
        if (bullet) bullet.init(dirVec, this._pool);

        this.node.emit('shot', { dir: dirVec });
    }
}
