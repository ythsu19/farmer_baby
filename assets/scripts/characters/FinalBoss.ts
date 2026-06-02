const { ccclass, property } = cc._decorator;

export enum BossPhase {
    Phase1 = 1,
    Phase2 = 2,
    Phase3 = 3,
    Defeated = 4,
}

enum AttackType {
    ScytheSweep = 0,
    JumpSlam = 1,
    RakeStab = 2,
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
    // 場景參考
    // -----------------------------------------
    @property({ type: cc.Node, tooltip: "玩家節點（用來追蹤位置）" })
    playerNode: cc.Node = null!;

    @property({ type: cc.Node, tooltip: "攝影機節點（用於 Camera Shake；可為 Canvas 或 Camera 節點）" })
    cameraNode: cc.Node = null!;

    @property({ type: cc.Node, tooltip: "攻擊物 / 召喚物的父節點（戰場層，不是 Boss 自己）" })
    attackLayer: cc.Node = null;

    @property({ type: cc.Label, tooltip: "顯示 Boss 血量的 Label（例如 850/1000；可選）" })
    hpLabel: cc.Label = null;

    // -----------------------------------------
    // 攻擊 Prefab
    // -----------------------------------------
    @property({ type: cc.Prefab, tooltip: "鐮刀橫掃 Prefab（含碰撞器）" })
    scythePrefab: cc.Prefab = null!;

    @property({ type: cc.Prefab, tooltip: "耙子下戳 Prefab（含碰撞器）" })
    rakePrefab: cc.Prefab = null!;

    @property({ type: cc.Prefab, tooltip: "跳躍墜落落地衝擊波 Prefab（可選）" })
    slamShockPrefab: cc.Prefab = null;

    @property({ type: cc.Prefab, tooltip: "召喚小怪 Prefab（階段2/3 使用）" })
    minionPrefab: cc.Prefab = null;

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
    // 鐮刀揮舞（以 Boss 手臂為軸心轉一個弧）
    // -----------------------------------------
    @property({ type: cc.Float, tooltip: "鐮刀揮舞持續時間（秒）" })
    scytheSweepDuration: number = 0.6;

    @property({ type: cc.Float, tooltip: "鐮刀的軸心相對 Boss 的位置（手臂位置）X 偏移" })
    scythePivotOffsetX: number = 60;

    @property({ type: cc.Float, tooltip: "鐮刀的軸心相對 Boss 的位置（手臂位置）Y 偏移" })
    scythePivotOffsetY: number = 80;

    @property({ type: cc.Float, tooltip: "鐮刀揮舞的起始角度（度，舉高）" })
    scytheStartAngle: number = 120;

    @property({ type: cc.Float, tooltip: "鐮刀揮舞的結束角度（度，砸到下方）" })
    scytheEndAngle: number = -30;

    @property({ type: cc.Float, tooltip: "鐮刀離軸心的距離（刀身長度，像素）" })
    scytheRadius: number = 220;

    @property({ type: cc.Float, tooltip: "鐮刀冷卻（秒，獨立於 attackInterval 的下限）" })
    scytheCooldown: number = 4.0;

    // -----------------------------------------
    // 跳躍墜落
    // -----------------------------------------
    @property({ type: cc.Float, tooltip: "跳起所需時間（秒，往上消失到畫面外）" })
    jumpUpDuration: number = 0.6;

    @property({ type: cc.Float, tooltip: "停在空中時間（秒，玩家準備躲避）" })
    jumpHangDuration: number = 0.8;

    @property({ type: cc.Float, tooltip: "墜落時間（秒）" })
    jumpFallDuration: number = 0.35;

    @property({ type: cc.Float, tooltip: "跳到畫面上方的高度（相對於 groundY 的偏移）" })
    jumpUpOffsetY: number = 900;

    @property({ type: cc.Float, tooltip: "落地時 Camera Shake 強度（像素）" })
    shakeAmplitude: number = 30;

    @property({ type: cc.Float, tooltip: "落地時 Camera Shake 持續時間（秒）" })
    shakeDuration: number = 0.5;

    @property({ type: cc.Float, tooltip: "落地衝擊波水平判定半徑（像素）" })
    slamHitRadius: number = 200;

    @property({ type: cc.Integer, tooltip: "落地對玩家造成的傷害（若直接命中）" })
    slamDamage: number = 25;

    // -----------------------------------------
    // 耙子下戳
    // -----------------------------------------
    @property({ type: cc.Float, tooltip: "耙子預警時間（秒，玩家看見落點到實際下戳）" })
    rakeTelegraphDuration: number = 0.6;

    @property({ type: cc.Float, tooltip: "耙子下戳時間（秒）" })
    rakeStabDuration: number = 0.25;

    @property({ type: cc.Float, tooltip: "耙子從多高處往下戳（玩家頭頂上方多少像素）" })
    rakeStartOffsetY: number = 600;

    @property({ type: cc.Float, tooltip: "耙子戳擊存在時間（秒）" })
    rakeLingerDuration: number = 0.3;

    // -----------------------------------------
    // 召喚
    // -----------------------------------------
    @property({ type: cc.Float, tooltip: "階段2 召喚小怪間隔（秒；<=0 表示不召喚）" })
    phase2SummonInterval: number = 6.0;

    // -----------------------------------------
    // 內部狀態
    // -----------------------------------------
    private currentHp: number = 0;
    private phase: BossPhase = BossPhase.Phase1;
    private hatBroken: boolean = false;
    private isAttacking: boolean = false;
    private isAirborne: boolean = false;
    private attackTimer: number = 0;
    private scytheCdTimer: number = 0;
    private cameraOrigin: cc.Vec2 = cc.v2(0, 0);
    private shakeRemaining: number = 0;

    // 隨機漂移用
    private driftDir: number = 1;          // 目前漂移方向（+1 右 / -1 左）
    private driftTimer: number = 0;        // 距離下次換方向還剩多少秒
    private driftSpeed: number = 0;        // 目前這段漂移的速度（隨機）

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
        this.pickNewDrift();
        this.enterPhase1();
    }

    update(dt: number) {
        if (this.phase === BossPhase.Defeated) return;

        this.updateMovement(dt);
        this.updateAttackTimer(dt);
        this.updateCameraShake(dt);

        if (this.scytheCdTimer > 0) this.scytheCdTimer -= dt;
    }

    // -----------------------------------------
    // 移動：隨機漂移（不追玩家）
    // 每隔一段隨機時間就重新挑方向與速度；碰到邊界則反彈
    // -----------------------------------------
    private updateMovement(dt: number) {
        if (this.isAttacking || this.isAirborne) return;

        this.driftTimer -= dt;
        if (this.driftTimer <= 0) this.pickNewDrift();

        const next = this.node.x + this.driftDir * this.driftSpeed * dt;

        // 撞到活動範圍邊界就反彈
        if (next <= this.arenaMinX || next >= this.arenaMaxX) {
            this.driftDir *= -1;
        }
        this.node.x = cc.misc.clampf(next, this.arenaMinX, this.arenaMaxX);
    }

    // 隨機挑一段新的漂移（方向、速度、持續時間都隨機）
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
        if (this.isAttacking || this.isAirborne) return;

        this.attackTimer += dt;
        const interval = this.phase === BossPhase.Phase3
            ? this.attackInterval * this.phase3IntervalScale
            : this.attackInterval;

        if (this.attackTimer >= interval) {
            this.attackTimer = 0;
            this.chooseAndExecuteAttack();
        }
    }

    private chooseAndExecuteAttack() {
        const candidates: AttackType[] = [];
        if (this.scytheCdTimer <= 0) candidates.push(AttackType.ScytheSweep);
        candidates.push(AttackType.RakeStab);
        if (this.phase !== BossPhase.Phase1) candidates.push(AttackType.JumpSlam);

        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        switch (pick) {
            case AttackType.ScytheSweep: this.doScytheSweep(); break;
            case AttackType.JumpSlam:    this.doJumpSlam();    break;
            case AttackType.RakeStab:    this.doRakeStab();    break;
        }
    }

    // -----------------------------------------
    // 攻擊一：鐮刀揮舞
    // 做法：建一個 pivot 空節點放在 Boss 手臂位置，鐮刀掛在 pivot 底下、
    // 往外偏移 scytheRadius。轉 pivot 的 angle，鐮刀就會繞著 Boss 畫弧線。
    // -----------------------------------------
    private doScytheSweep() {
        if (!this.scythePrefab || !this.attackLayer) {
            cc.warn("【FinalBoss】scythePrefab 或 attackLayer 未綁定");
            return;
        }
        this.isAttacking = true;
        this.scytheCdTimer = this.scytheCooldown;

        // 朝玩家那一側揮
        const dir = this.playerNode && this.playerNode.x < this.node.x ? -1 : 1;

        // 1) pivot 軸心節點，放在 Boss 手臂位置
        const pivot = new cc.Node("scythePivot");
        this.attackLayer.addChild(pivot);
        pivot.setPosition(cc.v2(
            this.node.x + dir * this.scythePivotOffsetX,
            this.node.y + this.scythePivotOffsetY,
        ));
        // 左右揮：把整個軸心鏡射
        pivot.scaleX = dir;

        // 2) 鐮刀掛在 pivot 底下，往外延伸 scytheRadius（刀身長度）
        const scythe = cc.instantiate(this.scythePrefab);
        pivot.addChild(scythe);
        scythe.setPosition(cc.v2(0, -this.scytheRadius));

        // 3) 轉 pivot 的角度 → 鐮刀繞 Boss 畫弧
        pivot.angle = this.scytheStartAngle;
        cc.tween(pivot)
            .to(this.scytheSweepDuration, { angle: this.scytheEndAngle }, { easing: 'quadIn' })
            .call(() => { if (cc.isValid(pivot)) pivot.destroy(); })
            .start();

        this.scheduleOnce(() => { this.isAttacking = false; }, this.scytheSweepDuration);
    }

    // -----------------------------------------
    // 攻擊二：跳躍墜落
    // -----------------------------------------
    private doJumpSlam() {
        if (!this.playerNode || !cc.isValid(this.playerNode)) return;
        this.isAttacking = true;
        this.isAirborne = true;

        const startPos = cc.v2(this.node.x, this.node.y);
        const apexY = this.groundY + this.jumpUpOffsetY;

        cc.tween(this.node)
            .to(this.jumpUpDuration, { y: apexY }, { easing: 'sineOut' })
            .call(() => {
                // 鎖定玩家當下 X 作為落點
                const targetX = cc.misc.clampf(
                    this.playerNode ? this.playerNode.x : startPos.x,
                    this.arenaMinX,
                    this.arenaMaxX,
                );
                this.node.x = targetX;
            })
            .delay(this.jumpHangDuration)
            .to(this.jumpFallDuration, { y: this.groundY }, { easing: 'quadIn' })
            .call(() => this.onSlamLand())
            .start();
    }

    private onSlamLand() {
        this.isAirborne = false;
        this.triggerCameraShake();
        this.spawnSlamShock();
        this.applySlamDamage();
        this.scheduleOnce(() => { this.isAttacking = false; }, 0.2);
    }

    private spawnSlamShock() {
        if (!this.slamShockPrefab || !this.attackLayer) return;
        const shock = cc.instantiate(this.slamShockPrefab);
        this.attackLayer.addChild(shock);
        shock.setPosition(cc.v2(this.node.x, this.groundY));
    }

    private applySlamDamage() {
        if (!this.playerNode || !cc.isValid(this.playerNode)) return;
        const dx = Math.abs(this.playerNode.x - this.node.x);
        if (dx <= this.slamHitRadius) {
            // main 玩家血量由 PlayerHealth 管（簽名 takeDamage(damage, attacker?)）
            const hp = this.playerNode.getComponent("PlayerHealth") as any;
            if (hp && typeof hp.takeDamage === "function") {
                hp.takeDamage(this.slamDamage, this.node);
            }
        }
    }

    // -----------------------------------------
    // 攻擊三：耙子從上往下戳
    // -----------------------------------------
    private doRakeStab() {
        if (!this.rakePrefab || !this.attackLayer || !this.playerNode) {
            cc.warn("【FinalBoss】rakePrefab / attackLayer / playerNode 未綁定");
            return;
        }
        this.isAttacking = true;

        const targetX = this.playerNode.x;
        const startY = this.playerNode.y + this.rakeStartOffsetY;
        const endY = this.playerNode.y;

        const rake = cc.instantiate(this.rakePrefab);
        this.attackLayer.addChild(rake);
        rake.setPosition(cc.v2(targetX, startY));
        rake.opacity = 120; // 預警時半透明

        cc.tween(rake)
            .delay(this.rakeTelegraphDuration)
            .call(() => { if (cc.isValid(rake)) rake.opacity = 255; })
            .to(this.rakeStabDuration, { y: endY }, { easing: 'quadIn' })
            .delay(this.rakeLingerDuration)
            .call(() => { if (cc.isValid(rake)) rake.destroy(); })
            .start();

        const totalDuration =
            this.rakeTelegraphDuration + this.rakeStabDuration + this.rakeLingerDuration;
        this.scheduleOnce(() => { this.isAttacking = false; }, totalDuration);
    }

    // -----------------------------------------
    // Camera Shake
    // -----------------------------------------
    private triggerCameraShake() {
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

        const t = this.shakeRemaining / this.shakeDuration; // 1 → 0
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

    // Boss 血量文字更新
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
        cc.log("【FinalBoss】進入階段 1：實體攻擊（鐮刀 + 耙子）");
    }

    private enterPhase2() {
        this.phase = BossPhase.Phase2;
        cc.log("【FinalBoss】進入階段 2：解鎖跳躍墜落 + 召喚");
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
        if (this.cameraNode) this.cameraNode.setPosition(this.cameraOrigin);
        cc.log("【FinalBoss】農夫大魔王倒下！化為塵土金幣雨…");
        this.node.destroy();
    }
}
