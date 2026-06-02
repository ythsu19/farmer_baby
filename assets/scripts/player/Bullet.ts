// Bullet — box2d 版子彈（sensor + Kinematic）
//
// 為什麼用 box2d 而不是 cc.Collider 系統？
//   farmer_baby 統一用 box2d（PhysicsBoxCollider + RigidBody）
//   舊版 assets/scripts/characters/Bullet.ts 用 cc.Collider — 不要在新場景用，會跟物理系統衝突。
//
// 子彈節點建議結構（在 Bullet.prefab）：
//   - cc.Sprite                       ← 拉子彈圖
//   - cc.RigidBody                    ← Kinematic、Fixed Rotation、gravityScale=0、enabledContactListener=true
//   - cc.PhysicsBoxCollider           ← 勾 Is Sensor、size 配子彈圖
//   - Bullet.ts（本元件）
//   - 節點 Group 設為 `bullet`（在 Project Settings → Group Manager 加入）
//
// 設計：
//   - 由 PlayerCombat.spawn 後呼叫 init(dirVec, pool) 設方向向量 + 記錄回收用的 pool
//   - 任意方向（不限左右）→ 子彈可以朝滑鼠瞄準的方向射出
//   - 子彈節點會 rotate 對齊飛行方向（node.angle = atan2 deg）
//   - lifetime 到了自動回收（避免飛到場景外無限存在）
//   - 撞到非 player / 非 bullet 的東西 → 試著對對方呼叫 takeDamage(damage, attacker)，然後回收
//   - 找不到 takeDamage → 撞到牆/地形 → 直接回收
//
// 對方元件介面：對方需要有 takeDamage(damage: number, attacker?: cc.Node) 方法才能掉血。
// 之後 Phase 4-B 寫 PlayerHealth、敵人 Monster 元件補上 takeDamage 即可。

const { ccclass, property, requireComponent } = cc._decorator;

@ccclass
@requireComponent(cc.RigidBody)
export default class Bullet extends cc.Component {

    @property({ displayName: '速度 (px/s)' })
    speed: number = 800;

    @property({ displayName: '傷害' })
    damage: number = 20;

    @property({ displayName: '存活時間 (s)', tooltip: '超過就回收，避免子彈飛到天涯海角還活著' })
    lifetime: number = 1.5;

    private _rb: cc.RigidBody = null;
    private _timer = 0;
    private _pool: cc.NodePool = null;
    /** 已標記回收避免一幀內被多個 contact 多次回收 */
    private _dead = false;

    onLoad() {
        this._rb = this.getComponent(cc.RigidBody);
        // 即使 prefab 沒勾，也保險開啟，否則 onBeginContact 不會觸發
        this._rb.enabledContactListener = true;
    }

    /**
     * PlayerCombat 從池取出 / 新建後立刻呼叫；外面已把 node.parent / position 設好。
     * dirVec：飛行方向（不需要先 normalize，這裡會自己做）
     */
    init(dirVec: cc.Vec2, pool: cc.NodePool) {
        this._pool = pool;
        this._timer = 0;
        this._dead = false;

        // 正規化方向
        let dx = dirVec.x;
        let dy = dirVec.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.0001) { dx /= len; dy /= len; }
        else { dx = 1; dy = 0; }  // 防呆：零向量 → 朝右

        // 視覺：旋轉子彈讓圖朝飛行方向（子彈素材預設朝右畫，旋轉是逆時針正）
        this.node.angle = Math.atan2(dy, dx) * 180 / Math.PI;
        // scaleX 留給 prefab 設計時用，不在這裡動

        // box2d 速度
        this._rb.linearVelocity = cc.v2(dx * this.speed, dy * this.speed);
    }

    update(dt: number) {
        if (this._dead) return;
        this._timer += dt;
        if (this._timer >= this.lifetime) this._recycle();
    }

    onBeginContact(_contact: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        if (this._dead) return;

        const group = other.node.group;
        // 不打自己人 / 別的子彈（保險，正常 group matrix 已過濾）
        if (group === 'player' || group === 'bullet') return;

        // 對方有 takeDamage 就掉血（Damageable / Monster / EnemyBase / PlayerHealth 都實作這個介面）
        const target: any = other.getComponent('Damageable')
            || other.getComponent('Monster')
            || other.getComponent('EnemyBase')
            || other.getComponent('PlayerHealth');
        if (target && typeof target.takeDamage === 'function') {
            target.takeDamage(this.damage, this.node);
        }

        this._recycle();
    }

    private _recycle() {
        if (this._dead) return;
        this._dead = true;
        this._rb.linearVelocity = cc.v2();

        if (this._pool) {
            this.node.active = false;
            this._pool.put(this.node);
        } else {
            this.node.destroy();
        }
    }
}
