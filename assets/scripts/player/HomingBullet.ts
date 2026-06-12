// HomingBullet — 追蹤子彈（P2 技能用）
//
// 行為：
//   1. spawn 時用 Player2Combat 給的初始方向飛（通常朝上 90° ± spread）
//   2. 經過 homingDelay 秒 → 在場景內找最近的「敵人」鎖定一次
//      敵人 = 任何掛 Monster / EnemyBase / BossWeakPoint / BossMinion 元件的節點
//   3. 鎖定後每幀以 turnRate 限制的角速度往目標轉向 → 飛彈感
//   4. 沒找到敵人 / 目標 destroy / 超出 lifetime → 沿當前方向直線飛 / 回收
//
// 跟 Bullet.ts 的差異：
//   - 一定向上發射，不吃外部 dir（dir 只控制初始 spread 角度）
//   - 多 homingDelay / turnRate 兩個 @property
//   - update 多了「鎖目標 + 連續轉向」邏輯
//   - 碰撞 / 池化 / takeDamage 介面跟 Bullet.ts 完全一樣（為了讓打到 Monster 行為一致）
//
// 不重用 Bullet.ts 加 @property 開關的原因：
//   行為差異太大（追蹤狀態機 + 目標管理）— 把 if 寫進 Bullet 會讓兩種子彈都變難讀。
//   獨立檔案，pool / takeDamage 邏輯複製即可。

const { ccclass, property, requireComponent } = cc._decorator;

@ccclass
@requireComponent(cc.RigidBody)
export default class HomingBullet extends cc.Component {

    @property({ displayName: '速度 (px/s)' })
    speed: number = 700;

    @property({ displayName: '傷害' })
    damage: number = 25;

    @property({ displayName: '存活時間 (s)', tooltip: '超過就回收' })
    lifetime: number = 3.5;

    @property({ displayName: '啟動追蹤前等待 (s)', tooltip: '這段時間直線飛行' })
    homingDelay: number = 0.3;

    @property({ displayName: '轉向速率 (deg/s)', tooltip: '越大反應越快；太大像瞬間轉向沒飛彈感' })
    turnRate: number = 720;

    @property({ displayName: '追蹤偵測範圍 (px)', tooltip: '0 = 無限大；只在這範圍內找最近敵人' })
    detectRange: number = 0;

    private _rb: cc.RigidBody = null;
    private _timer = 0;
    private _pool: cc.NodePool = null;
    private _dead = false;
    /** 當前飛行方向（單位向量） — 鎖定前 / 失去目標時用 */
    private _dir: cc.Vec2 = cc.v2(0, 1);
    private _target: cc.Node = null;
    private _searched = false;

    onLoad() {
        this._rb = this.getComponent(cc.RigidBody);
        this._rb.enabledContactListener = true;
    }

    /**
     * Player2Combat 從池取出 / 新建後立刻呼叫；外面已把 node.parent / position 設好。
     * dirVec：初始方向（一般是朝上 + 微小 spread 角度，HomingBullet 會 normalize）
     */
    init(dirVec: cc.Vec2, pool: cc.NodePool) {
        this._pool = pool;
        this._timer = 0;
        this._dead = false;
        this._target = null;
        this._searched = false;

        let dx = dirVec.x, dy = dirVec.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.0001) { dx /= len; dy /= len; }
        else { dx = 0; dy = 1; }  // 防呆：零向量 → 朝上

        this._dir.x = dx;
        this._dir.y = dy;

        this.node.angle = Math.atan2(dy, dx) * 180 / Math.PI;
        this._rb.linearVelocity = cc.v2(dx * this.speed, dy * this.speed);
    }

    update(dt: number) {
        if (this._dead) return;

        this._timer += dt;
        if (this._timer >= this.lifetime) { this._recycle(); return; }

        // 過了 delay → 第一次找最近敵人鎖定
        if (!this._searched && this._timer >= this.homingDelay) {
            this._searched = true;
            this._target = this._findNearestEnemy();
        }

        // 還沒搜 / 沒目標 / 目標已 destroy → 維持當前方向直線飛
        if (!this._searched) return;
        if (!this._target || !this._target.isValid || !this._target.active) {
            this._target = null;
            return;
        }

        // 連續追蹤：算出目標方向，以 turnRate 限速轉向
        const myWorld = this.node.parent
            ? this.node.parent.convertToWorldSpaceAR(this.node.position)
            : cc.v2(this.node.x, this.node.y);
        const tgtWorld = this._target.parent
            ? this._target.parent.convertToWorldSpaceAR(this._target.position)
            : cc.v2(this._target.x, this._target.y);

        let tx = tgtWorld.x - myWorld.x;
        let ty = tgtWorld.y - myWorld.y;
        const tlen = Math.sqrt(tx * tx + ty * ty);
        if (tlen < 0.0001) return;
        tx /= tlen; ty /= tlen;

        const currentDeg = Math.atan2(this._dir.y, this._dir.x) * 180 / Math.PI;
        const targetDeg = Math.atan2(ty, tx) * 180 / Math.PI;
        let delta = targetDeg - currentDeg;
        // normalize 到 [-180, 180] → 永遠走最短弧度
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;

        const maxTurn = this.turnRate * dt;
        if (delta > maxTurn) delta = maxTurn;
        else if (delta < -maxTurn) delta = -maxTurn;

        const newDeg = currentDeg + delta;
        const newRad = newDeg * Math.PI / 180;
        this._dir.x = Math.cos(newRad);
        this._dir.y = Math.sin(newRad);

        this.node.angle = newDeg;
        this._rb.linearVelocity = cc.v2(this._dir.x * this.speed, this._dir.y * this.speed);
    }

    onBeginContact(_c: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        if (this._dead) return;

        const group = other.node.group;
        if (group === 'player' || group === 'bullet') return;  // 不打玩家、不打別的子彈

        // 傷害介面跟 Bullet.ts 一致 — 對 Monster / EnemyBase / BossWeakPoint / BossMinion / 一般 Damageable 都有效
        const target: any = other.getComponent('Damageable')
            || other.getComponent('Monster')
            || other.getComponent('EnemyBase')
            || other.getComponent('BossWeakPoint')
            || other.getComponent('BossMinion');
        if (target && typeof target.takeDamage === 'function') {
            target.takeDamage(this.damage, this.node);
        }

        this._recycle();
    }

    /**
     * 從場景 root 走訪所有節點，找最近的敵人。
     * 5 顆子彈每顆掃一次 — 對小規模場景無感；之後敵人很多再做註冊表優化。
     * 不用 cc.find（專案規則禁），直接遞迴 cc.director.getScene().children。
     */
    private _findNearestEnemy(): cc.Node {
        const scene = cc.director.getScene();
        if (!scene) return null;

        const myWorld = this.node.parent
            ? this.node.parent.convertToWorldSpaceAR(this.node.position)
            : cc.v2(this.node.x, this.node.y);

        let best: cc.Node = null;
        let bestDistSq = this.detectRange > 0 ? this.detectRange * this.detectRange : Infinity;

        const visit = (n: cc.Node) => {
            if (!n || !n.isValid || !n.active) return;
            if (this._isEnemy(n)) {
                const wp = n.parent
                    ? n.parent.convertToWorldSpaceAR(n.position)
                    : cc.v2(n.x, n.y);
                const dx = wp.x - myWorld.x;
                const dy = wp.y - myWorld.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < bestDistSq) {
                    bestDistSq = d2;
                    best = n;
                }
            }
            const kids = n.children;
            for (let i = 0; i < kids.length; i++) visit(kids[i]);
        };
        visit(scene);
        return best;
    }

    private _isEnemy(n: cc.Node): boolean {
        // 只認敵人類元件，不抓 PlayerHealth — 不然會鎖玩家
        return !!(n.getComponent('Monster')
            || n.getComponent('EnemyBase')
            || n.getComponent('BossWeakPoint')
            || n.getComponent('BossMinion'));
    }

    private _recycle() {
        if (this._dead) return;
        this._dead = true;
        if (this._rb) this._rb.linearVelocity = cc.v2();
        this._target = null;

        if (this._pool) {
            this.node.active = false;
            this._pool.put(this.node);
        } else {
            this.node.destroy();
        }
    }
}
