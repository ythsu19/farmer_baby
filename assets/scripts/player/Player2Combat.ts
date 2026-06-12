// Player2Combat — P2 按 E 釋放技能：往上同時射出 N 顆追蹤子彈
//
// 流程：
//   收 'input:skill-down' → 檢查冷卻 → 在 P2 上方 spawn N 顆 HomingBullet
//   每顆給「正上 ± spread」其中一個角度 → 一發出去 5 顆同時飛但不會完全重疊
//   交給 HomingBullet 自己處理 0.3s 延遲 → 鎖最近敵人 → 連續轉向追蹤
//
// 依賴：
//   - 同節點上的 Player2Input.ts（發 'input:skill-down'）
//   - bulletPrefab：見 HomingBullet.ts 檔頭，prefab 上要掛 HomingBullet.ts
//
// 對外事件：
//   skill-cast { count: number }  — 每次釋放技能（給音效 / 動畫 / UI 旁聽）
//
// 為什麼不重用 PlayerCombat.ts？
//   PlayerCombat 是「滑鼠瞄準持續射擊」+ 單發 Bullet，
//   Player2Combat 是「按一下放一組同時 spawn N 顆追蹤子彈」+ 冷卻 — 邏輯不一樣。

import HomingBullet from './HomingBullet';

const { ccclass, property } = cc._decorator;

@ccclass
export default class Player2Combat extends cc.Component {

    @property({ displayName: '追蹤子彈 Prefab', type: cc.Prefab, tooltip: '掛 HomingBullet.ts 的 prefab；空著 → E 鍵不會射' })
    bulletPrefab: cc.Prefab = null;

    @property({ displayName: '一次射幾顆', min: 1 })
    bulletCount: number = 5;

    @property({ displayName: '扇形展開角度 (deg)', tooltip: 'N 顆子彈平均分布在這個角度範圍內（以正上為中心）；0 = 全部往正上重疊' })
    spreadAngleDeg: number = 60;

    @property({ displayName: '技能冷卻 (s)', tooltip: '按一次 E 之後等多久才能再按' })
    cooldown: number = 1.0;

    @property({ displayName: '池預先大小', min: 0, tooltip: 'onLoad 預先建幾顆子彈' })
    poolSize: number = 10;

    @property({ displayName: '生成點偏移 X', tooltip: '相對 P2 節點的局部偏移；通常 0' })
    spawnOffsetX: number = 0;

    @property({ displayName: '生成點偏移 Y', tooltip: '相對 P2 節點的局部偏移；設成頭頂高度，子彈從頭上射出去' })
    spawnOffsetY: number = 40;

    private _pool: cc.NodePool = null;
    private _cooldownTimer = 0;
    private _warnedNoBullet = false;

    onLoad() {
        this._pool = new cc.NodePool();
        if (this.bulletPrefab) {
            for (let i = 0; i < this.poolSize; i++) {
                const n = cc.instantiate(this.bulletPrefab);
                this._pool.put(n);
            }
        }
        this.node.on('input:skill-down', this._onSkill, this);
    }

    onDestroy() {
        this.node.off('input:skill-down', this._onSkill, this);
        if (this._pool) this._pool.clear();
    }

    update(dt: number) {
        if (this._cooldownTimer > 0) this._cooldownTimer = Math.max(0, this._cooldownTimer - dt);
    }

    private _onSkill() {
        if (!this.bulletPrefab) {
            if (!this._warnedNoBullet) {
                this._warnedNoBullet = true;
                cc.warn('[Player2Combat] bulletPrefab 沒設，E 鍵技能不會生子彈');
            }
            return;
        }
        if (this._cooldownTimer > 0) return;
        this._cooldownTimer = this.cooldown;

        // spawn 位置（世界座標）
        const localSpawn = cc.v2(this.node.x + this.spawnOffsetX, this.node.y + this.spawnOffsetY);
        const spawnWorld = this.node.parent
            ? this.node.parent.convertToWorldSpaceAR(localSpawn)
            : localSpawn;

        // N 顆子彈在 spreadAngleDeg 範圍內平均分布（中心 = 正上 90°）
        //   bulletCount = 1 → 1 顆朝正上
        //   bulletCount > 1 → -half ~ +half 線性分布
        const n = Math.max(1, this.bulletCount);
        const halfSpread = this.spreadAngleDeg / 2;
        const step = n > 1 ? this.spreadAngleDeg / (n - 1) : 0;

        for (let i = 0; i < n; i++) {
            const offsetDeg = n > 1 ? -halfSpread + step * i : 0;
            const angleDeg = 90 + offsetDeg;  // 正上 + spread
            const rad = angleDeg * Math.PI / 180;
            const dirVec = cc.v2(Math.cos(rad), Math.sin(rad));
            this._spawnBullet(spawnWorld, dirVec);
        }

        this.node.emit('skill-cast', { count: n });
    }

    private _spawnBullet(spawnWorld: cc.Vec2, dirVec: cc.Vec2) {
        const node = this._pool.size() > 0
            ? this._pool.get()
            : cc.instantiate(this.bulletPrefab);

        // 子彈當 P2 的兄弟節點 — 不受 P2 的 scale / rotation 影響
        node.parent = this.node.parent;
        node.active = true;

        const local = node.parent
            ? node.parent.convertToNodeSpaceAR(spawnWorld)
            : spawnWorld;
        node.setPosition(local.x, local.y);

        // 改用字串版 getComponent 比 class reference 穩 — 不會被 prefab 序列化版本不同步坑到
        const bullet = node.getComponent('HomingBullet') as HomingBullet;
        if (bullet) {
            bullet.init(dirVec, this._pool);
        } else if (!this._warnedNoBullet) {
            this._warnedNoBullet = true;
            cc.warn('[Player2Combat] bulletPrefab 上找不到 HomingBullet 元件。'
                + ' 請打開 HomingBullet.prefab → 確認根節點 Inspector 有「HomingBullet」這支 .ts component，'
                + ' 而且不是顯示「Missing Script」紅字。');
        }
    }
}
