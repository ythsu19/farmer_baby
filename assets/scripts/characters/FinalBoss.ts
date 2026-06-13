const { ccclass, property } = cc._decorator;

export enum BossPhase {
    Phase1 = 1,
    Phase2 = 2,
    Phase3 = 3,
    Defeated = 4,
}

// =================================================================
// 攻擊定義（資料驅動）
// -----------------------------------------------------------------
// 每一種攻擊 = 一筆 AttackDef，在編輯器 Inspector 填好即可。
// 未來新增攻擊：在 attacks 陣列加一筆、拖一個 hitbox 子節點，不用改程式碼。
//
// 流程（playAttack 統一處理）：
//   1) 在 bossSprite 上播放 clipName 這支動畫
//   2) 動畫播到「砍到位」時開 hitbox（並把它移到 hitMove 位置）
//      —— 觸發點來源優先序：
//         (a) 動畫事件幀呼叫 onHitboxOn / onHitboxOff（最精準，推薦）
//         (b) 沒加事件幀時，用 hitOnTime / hitOffTime 秒數 fallback
//   3) duration 秒後攻擊結束，hitbox 關回去
// =================================================================
@ccclass('BossAttackDef')
export class BossAttackDef {
    @property({ tooltip: "攻擊名稱（除錯用，例如 鐮刀橫掃）" })
    name: string = "attack";

    @property({ tooltip: "要播放的動畫 clip 名稱（Animation 元件 Clips 裡的名字，例如 boss_scythe）" })
    clipName: string = "";

    @property({ type: cc.Node, tooltip: "這個攻擊的傷害判定 hitbox 子節點（含 Damager + Collider；平常 active=false）" })
    hitbox: cc.Node = null;

    @property({ tooltip: "整個攻擊動作持續時間（秒）；結束後 boss 可再行動" })
    duration: number = 0.8;

    @property({ tooltip: "【fallback】開 hitbox 的時間點（秒，動畫開始後）。若有用動畫事件幀則忽略" })
    hitOnTime: number = 0.3;

    @property({ tooltip: "【fallback】關 hitbox 的時間點（秒，動畫開始後）。若有用動畫事件幀則忽略" })
    hitOffTime: number = 0.55;

    @property({ tooltip: "砍到位時 hitbox 相對 boss 朝向的 X 偏移（鐮刀掃出去的位置；會依面向自動鏡射）" })
    hitOffsetX: number = 120;

    @property({ tooltip: "砍到位時 hitbox 的 Y 偏移" })
    hitOffsetY: number = 0;

    @property({ tooltip: "冷卻時間（秒）；此攻擊用完後要等這麼久才能再用" })
    cooldown: number = 3.0;

    @property({ type: cc.Integer, tooltip: "解鎖階段：1=一開始就能用、2=階段2解鎖、3=階段3解鎖" })
    unlockPhase: number = 1;

    @property({ tooltip: "選這招的權重（越大越常選；同階段可用的招之間做加權隨機）" })
    weight: number = 1;
}

@ccclass
export default class FinalBoss extends cc.Component {

    // -----------------------------------------
    // 血量設定
    // -----------------------------------------
    @property({ type: cc.Integer, tooltip: "Boss 總血量（所有部位共享）" })
    maxHp: number = 1000;

    @property({ type: cc.Float, tooltip: "階段2觸發血量百分比 (0~1)" })
    phase2Threshold: number = 0.7;

    @property({ type: cc.Float, tooltip: "階段3觸發血量百分比 (0~1)" })
    phase3Threshold: number = 0.3;

    @property({ type: cc.Float, tooltip: "打掉帽子所需的血量百分比掉幅 (0~1)；超過此扣血量就破帽" })
    hatBreakLossRatio: number = 0.1;

    // -----------------------------------------
    // 部位節點
    // -----------------------------------------
    @property({ type: cc.Node, tooltip: "帽子節點（必須先打掉才能傷害其他部位）" })
    hatNode: cc.Node = null;

    @property({ type: [cc.Node], tooltip: "其他弱點部位節點（手、眼睛等）— 帽子被打掉後才可被傷害" })
    otherWeakPoints: cc.Node[] = [];

    // -----------------------------------------
    // 視覺 / 動畫
    // -----------------------------------------
    @property({ type: cc.Animation, tooltip: "播放 boss frame 動畫的 Animation 元件（在 bossSprite 子節點上）" })
    anim: cc.Animation = null;

    @property({ tooltip: "待機動畫 clip 名稱（沒攻擊時循環播；留空 → 不播待機）" })
    idleClipName: string = "";

    @property({ type: cc.Node, tooltip: "決定面向的 Sprite 節點（攻擊時依玩家方向做 scaleX 鏡射；通常就是 bossSprite）" })
    facingNode: cc.Node = null;

    // -----------------------------------------
    // 場景參考
    // -----------------------------------------
    @property({ type: cc.Node, tooltip: "玩家節點（用來追蹤位置）" })
    playerNode: cc.Node = null!;

    @property({ type: cc.Node, tooltip: "攝影機節點（用於 Camera Shake；可為 Canvas 或 Camera 節點）" })
    cameraNode: cc.Node = null!;

    @property({ type: cc.Node, tooltip: "召喚物的父節點（戰場層，不是 Boss 自己）" })
    attackLayer: cc.Node = null;

    @property({ type: cc.Label, tooltip: "顯示 Boss 血量的 Label（例如 850/1000；可選）" })
    hpLabel: cc.Label = null;

    // -----------------------------------------
    // 攻擊清單（資料驅動）—— 新增攻擊就在這加一筆
    // -----------------------------------------
    @property({ type: [BossAttackDef], tooltip: "所有攻擊招式；每招拖一個 hitbox 子節點、設動畫名與解鎖階段" })
    attacks: BossAttackDef[] = [];

    // -----------------------------------------
    // 移動（隨機漂移，不追玩家）
    // -----------------------------------------
    @property({ type: cc.Float, tooltip: "漂移最小速度（像素/秒）" })
    driftSpeedMin: number = 30;

    @property({ type: cc.Float, tooltip: "漂移最大速度（像素/秒）" })
    driftSpeedMax: number = 90;

    @property({ type: cc.Float, tooltip: "每段漂移最短持續時間（秒，到時隨機換方向/速度）" })
    driftIntervalMin: number = 1.0;

    @property({ type: cc.Float, tooltip: "每段漂移最長持續時間（秒）" })
    driftIntervalMax: number = 2.5;

    @property({ type: cc.Float, tooltip: "地板 Y 座標（Boss 站立高度）" })
    groundY: number = -200;

    @property({ type: cc.Float, tooltip: "活動範圍最小 X" })
    arenaMinX: number = -800;

    @property({ type: cc.Float, tooltip: "活動範圍最大 X" })
    arenaMaxX: number = 800;

    // -----------------------------------------
    // 攻擊節奏
    // -----------------------------------------
    @property({ type: cc.Float, tooltip: "兩次攻擊之間的間隔（秒）" })
    attackInterval: number = 2.5;

    @property({ type: cc.Float, tooltip: "階段3 攻擊間隔倍率（<1 = 更快）" })
    phase3IntervalScale: number = 0.6;

    // -----------------------------------------
    // 召喚
    // -----------------------------------------
    @property({ type: cc.Prefab, tooltip: "召喚小怪 Prefab（階段2/3 使用）" })
    minionPrefab: cc.Prefab = null;

    @property({ type: cc.Float, tooltip: "階段2 召喚小怪間隔（秒；<=0 表示不召喚）" })
    phase2SummonInterval: number = 6.0;

    // -----------------------------------------
    // Camera Shake（攻擊落地可呼叫 triggerCameraShake）
    // -----------------------------------------
    @property({ type: cc.Float, tooltip: "Camera Shake 強度（像素）" })
    shakeAmplitude: number = 30;

    @property({ type: cc.Float, tooltip: "Camera Shake 持續時間（秒）" })
    shakeDuration: number = 0.5;

    // -----------------------------------------
    // 內部狀態
    // -----------------------------------------
    private currentHp: number = 0;
    private phase: BossPhase = BossPhase.Phase1;
    private hatBroken: boolean = false;
    private isAttacking: boolean = false;
    private attackTimer: number = 0;
    private cooldowns: number[] = [];          // 每招的剩餘冷卻（索引對齊 attacks）
    private activeAttack: BossAttackDef = null; // 目前進行中的攻擊（給動畫事件用）
    private cameraOrigin: cc.Vec2 = cc.v2(0, 0);
    private shakeRemaining: number = 0;

    // 隨機漂移用
    private driftDir: number = 1;
    private driftTimer: number = 0;
    private driftSpeed: number = 0;

    // -----------------------------------------
    // 生命週期
    // -----------------------------------------
    onLoad() {
        this.currentHp = this.maxHp;
        this.updateHpLabel();
        this.node.y = this.groundY;
        if (this.cameraNode) {
            this.cameraOrigin = cc.v2(this.cameraNode.x, this.cameraNode.y);
        }
        // 所有攻擊 hitbox 預設關閉、冷卻歸零
        this.cooldowns = this.attacks.map(() => 0);
        this.attacks.forEach(a => { if (a.hitbox) a.hitbox.active = false; });

        this.pickNewDrift();
        this.playIdle();
        this.enterPhase1();
    }

    update(dt: number) {
        if (this.phase === BossPhase.Defeated) return;

        this.updateMovement(dt);
        this.updateAttackTimer(dt);
        this.updateCameraShake(dt);

        for (let i = 0; i < this.cooldowns.length; i++) {
            if (this.cooldowns[i] > 0) this.cooldowns[i] -= dt;
        }
    }

    // -----------------------------------------
    // 移動：隨機漂移（不追玩家）
    // -----------------------------------------
    private updateMovement(dt: number) {
        if (this.isAttacking) return;

        this.driftTimer -= dt;
        if (this.driftTimer <= 0) this.pickNewDrift();

        const next = this.node.x + this.driftDir * this.driftSpeed * dt;
        if (next <= this.arenaMinX || next >= this.arenaMaxX) {
            this.driftDir *= -1;
        }
        this.node.x = cc.misc.clampf(next, this.arenaMinX, this.arenaMaxX);
    }

    private pickNewDrift() {
        this.driftDir = Math.random() < 0.5 ? -1 : 1;
        this.driftSpeed = this.driftSpeedMin
            + Math.random() * (this.driftSpeedMax - this.driftSpeedMin);
        this.driftTimer = this.driftIntervalMin
            + Math.random() * (this.driftIntervalMax - this.driftIntervalMin);
    }

    // -----------------------------------------
    // 攻擊節奏
    // -----------------------------------------
    private updateAttackTimer(dt: number) {
        if (this.isAttacking) return;

        this.attackTimer += dt;
        const interval = this.phase === BossPhase.Phase3
            ? this.attackInterval * this.phase3IntervalScale
            : this.attackInterval;

        if (this.attackTimer >= interval) {
            this.attackTimer = 0;
            this.chooseAndExecuteAttack();
        }
    }

    // 從「已解鎖且不在冷卻」的攻擊裡做加權隨機
    private chooseAndExecuteAttack() {
        const usable: number[] = [];
        let totalWeight = 0;
        for (let i = 0; i < this.attacks.length; i++) {
            const a = this.attacks[i];
            if (a.unlockPhase > this.phase) continue;   // 還沒解鎖
            if (this.cooldowns[i] > 0) continue;        // 冷卻中
            usable.push(i);
            totalWeight += Math.max(0, a.weight);
        }
        if (usable.length === 0) return;

        // 加權隨機
        let r = Math.random() * totalWeight;
        let chosen = usable[0];
        for (const i of usable) {
            r -= Math.max(0, this.attacks[i].weight);
            if (r <= 0) { chosen = i; break; }
        }
        this.playAttack(chosen);
    }

    // -----------------------------------------
    // 統一攻擊執行：播動畫 + 管 hitbox 開關
    // -----------------------------------------
    private playAttack(index: number) {
        const def = this.attacks[index];
        if (!def) return;

        this.isAttacking = true;
        this.activeAttack = def;
        this.cooldowns[index] = def.cooldown;

        // 面向玩家
        this.faceTowardsPlayer();

        // 播動畫；動畫事件幀會呼叫 onHitboxOn / onHitboxOff
        if (this.anim && def.clipName) {
            this.anim.play(def.clipName);
        }

        // fallback：若動畫沒加事件幀，用秒數開關 hitbox
        // （有事件幀時，這兩個 scheduleOnce 會被事件搶先做掉，重複設 active 不影響結果）
        this.scheduleOnce(() => this.onHitboxOn(), def.hitOnTime);
        this.scheduleOnce(() => this.onHitboxOff(), def.hitOffTime);

        // 攻擊結束：關 hitbox、回待機、解除鎖定
        this.scheduleOnce(() => this.finishAttack(), def.duration);
    }

    // 開啟目前攻擊的 hitbox，並移到「砍到位」的位置（依面向鏡射 X）
    // 可由動畫事件幀呼叫，也可由 fallback 計時呼叫
    onHitboxOn() {
        const def = this.activeAttack;
        if (!def || !def.hitbox) return;
        const dir = this.getFacingDir();
        def.hitbox.setPosition(cc.v2(dir * def.hitOffsetX, def.hitOffsetY));
        def.hitbox.active = true;
    }

    // 關閉目前攻擊的 hitbox（動畫事件幀或 fallback 計時呼叫）
    onHitboxOff() {
        const def = this.activeAttack;
        if (def && def.hitbox) def.hitbox.active = false;
    }

    private finishAttack() {
        this.onHitboxOff();
        this.isAttacking = false;
        this.activeAttack = null;
        this.playIdle();
    }

    // -----------------------------------------
    // 面向
    // -----------------------------------------
    private faceTowardsPlayer() {
        if (!this.facingNode) return;
        const dir = this.playerNode && this.playerNode.x < this.node.x ? -1 : 1;
        this.facingNode.scaleX = Math.abs(this.facingNode.scaleX) * dir;
    }

    private getFacingDir(): number {
        if (this.facingNode && this.facingNode.scaleX < 0) return -1;
        return 1;
    }

    private playIdle() {
        if (this.anim && this.idleClipName) this.anim.play(this.idleClipName);
    }

    // -----------------------------------------
    // Camera Shake（攻擊落地時可由動畫事件或程式呼叫）
    // -----------------------------------------
    triggerCameraShake() {
        if (!this.cameraNode) return;
        this.cameraOrigin = cc.v2(this.cameraNode.x, this.cameraNode.y);
        this.shakeRemaining = this.shakeDuration;
    }

    private updateCameraShake(dt: number) {
        if (!this.cameraNode || this.shakeRemaining <= 0) return;
        this.shakeRemaining -= dt;

        if (this.shakeRemaining <= 0) {
            this.cameraNode.setPosition(this.cameraOrigin);
            return;
        }

        const t = this.shakeRemaining / this.shakeDuration;
        const amp = this.shakeAmplitude * t;
        const ox = (Math.random() * 2 - 1) * amp;
        const oy = (Math.random() * 2 - 1) * amp;
        this.cameraNode.setPosition(cc.v2(this.cameraOrigin.x + ox, this.cameraOrigin.y + oy));
    }

    // -----------------------------------------
    // 弱點受傷介面（由 BossWeakPoint 呼叫）
    // -----------------------------------------
    onWeakPointHit(part: cc.Node, damage: number) {
        if (this.phase === BossPhase.Defeated) return;

        if (!this.hatBroken) {
            if (part === this.hatNode) {
                this.currentHp -= damage;
                this.updateHpLabel();
                cc.log(`【FinalBoss】帽子受到 ${damage} 傷害，剩餘 HP ${this.currentHp}`);
                if (this.currentHp <= this.maxHp * (1 - this.hatBreakLossRatio)) {
                    this.breakHat();
                }
            } else {
                cc.log(`【FinalBoss】部位無敵中（帽子尚未打掉）`);
            }
            return;
        }

        if (this.otherWeakPoints.indexOf(part) !== -1 || part === this.hatNode) {
            this.currentHp -= damage;
            this.updateHpLabel();
            cc.log(`【FinalBoss】部位受到 ${damage} 傷害，剩餘 HP ${this.currentHp}`);
            this.checkPhaseTransition();
            if (this.currentHp <= 0) this.die();
        }
    }

    private updateHpLabel() {
        if (!this.hpLabel) return;
        const hp = Math.max(0, this.currentHp);
        this.hpLabel.string = `BOSS  ${hp} / ${this.maxHp}`;
    }

    private breakHat() {
        this.hatBroken = true;
        cc.log("【FinalBoss】帽子被打掉！其他部位現在可以被傷害");
        if (this.hatNode) this.hatNode.active = false;
    }

    private checkPhaseTransition() {
        const hpRatio = this.currentHp / this.maxHp;
        if (this.phase === BossPhase.Phase1 && hpRatio <= this.phase2Threshold) {
            this.enterPhase2();
        } else if (this.phase === BossPhase.Phase2 && hpRatio <= this.phase3Threshold) {
            this.enterPhase3();
        }
    }

    // -----------------------------------------
    // 階段
    // -----------------------------------------
    private enterPhase1() {
        this.phase = BossPhase.Phase1;
        cc.log("【FinalBoss】進入階段 1");
    }

    private enterPhase2() {
        this.phase = BossPhase.Phase2;
        cc.log("【FinalBoss】進入階段 2：解鎖更多攻擊 + 召喚");
        if (this.phase2SummonInterval > 0) {
            this.schedule(this.spawnMinion, this.phase2SummonInterval);
        }
    }

    private enterPhase3() {
        this.phase = BossPhase.Phase3;
        cc.log("【FinalBoss】進入階段 3：攻擊頻率全面拉高");
    }

    private spawnMinion() {
        if (!this.minionPrefab || !this.attackLayer) return;
        const minion = cc.instantiate(this.minionPrefab);
        this.attackLayer.addChild(minion);
        minion.setPosition(cc.v2(this.node.x, this.node.y));
    }

    private die() {
        this.phase = BossPhase.Defeated;
        this.unscheduleAllCallbacks();
        this.attacks.forEach(a => { if (a.hitbox) a.hitbox.active = false; });
        if (this.cameraNode) this.cameraNode.setPosition(this.cameraOrigin);
        cc.log("【FinalBoss】農夫大魔王倒下！化為塵土金幣雨…");
        // 暫停一小會，讓死亡特效播完再切場景
        this.scheduleOnce(() => {
            try {
                const scene = cc.director.getScene && cc.director.getScene();
                const name = scene && scene.name ? scene.name : (scene && scene._name ? scene._name : "");
                if (name === "Final") {
                    cc.director.loadScene("EndScene");
                }
            } catch (e) {
                // fallback: 若發生錯誤仍嘗試切換
                cc.director.loadScene("EndScene");
            }
        }, 1.0);
        this.node.destroy();
    }
}
