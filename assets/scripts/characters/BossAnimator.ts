// BossAnimator — 逐幀貼圖版（frame array），給 Boss 用
//
// 為什麼不用 cc.Animation？
//   cc.Animation 要開 Animation 編輯器拉 keyframe、做 .anim 檔，繁瑣。
//   逐幀切 spriteFrame 更直觀：Inspector 把一堆圖拉進陣列、設 FPS，就會跑。
//   （跟 player/PlayerAnimator.ts 同一套做法。）
//
// 用法：
//   1. 掛在 boss 節點上（跟 Boss.ts 同節點）
//   2. Target Sprite 拉 body 子節點的 cc.Sprite（要被換圖的那個）
//   3. 每個招式（move）設一組 frames + FPS + 是否停在最後一張
//   4. Boss.ts 出招時呼叫 playMove(animName) → 本元件播對應那組圖
//
// 招式名稱對應：moves 陣列裡每個 BossAnimClip 的 name，
//   要跟 Boss 元件 Attack Sequence 裡的 Anim Name 一致（例如 boss_scythe）。

const { ccclass, property } = cc._decorator;

/** 一段「第幾張圖 → 開哪個 hitbox」的設定 */
@ccclass('BossHitWindow')
export class BossHitWindow {
    @property({ tooltip: '從第幾張圖開始開 hitbox（從 0 算）' })
    startFrame: number = 0;

    @property({ tooltip: '到第幾張圖為止（含）。播到這之後就關掉' })
    endFrame: number = 0;

    @property({ tooltip: '這段要開 attackHitBoxes 陣列裡的第幾個（索引）' })
    hitBoxIndex: number = 0;
}

/** 一段「整個 boss 升降 / 左右位移」區間：在 startFrame~endFrame 之間，boss 從 from 平滑移到 to */
@ccclass('BossJumpWindow')
export class BossJumpWindow {
    @property({ tooltip: '從第幾張圖開始移動（從 0 算）' })
    startFrame: number = 0;

    @property({ tooltip: '到第幾張圖移動完成' })
    endFrame: number = 0;

    @property({ tooltip: '這段開始時 boss 相對原位的高度（0 = 原位、正值 = 上）' })
    fromY: number = 0;

    @property({ tooltip: '這段結束時 boss 相對原位的高度（例如 600 = 升到原位上方 600）' })
    toY: number = 0;

    @property({ tooltip: '這段開始時 boss 相對原位的 X 偏移（0 = 原位、正右負左）' })
    fromX: number = 0;

    @property({ tooltip: '這段結束時 boss 相對原位的 X 偏移（例如 300 = 移到原位右方 300）' })
    toX: number = 0;
}

/** 一個「定格」設定：播到某張圖時停住，維持幾秒，期間整個 boss 往上移多少 */
@ccclass('BossHoldStep')
export class BossHoldStep {
    @property({ tooltip: '播到第幾張圖時定格（從 0 算）' })
    atFrame: number = 0;

    @property({ tooltip: '在這張圖停住維持幾秒' })
    holdSeconds: number = 1;

    @property({ tooltip: '定格期間整個 boss 往上移多少（相對定格開始的位置，正 = 上）。0 = 只定格不移動' })
    riseY: number = 0;
}

/** 一個「瞬移點」設定：播到某張圖時，把整個 boss 根節點的 X 瞬間移到「相對原位」的偏移（不內插）。
 *  只動 X，每次觸發在 [xMin, xMax] 之間隨機重擲；Y 完全不碰，維持當下位置。
 *  「原位」= boss 一開始沒位移時的位置（_bossBaseX），不受先前位移影響。 */
@ccclass('BossTeleportStep')
export class BossTeleportStep {
    @property({ tooltip: '播到第幾張圖時瞬移（從 0 算）' })
    atFrame: number = 0;

    @property({ tooltip: '瞬移 X 偏移的下界（相對原位，正右負左）。每次觸發在 [xMin, xMax] 隨機擲' })
    xMin: number = 0;

    @property({ tooltip: '瞬移 X 偏移的上界（相對原位）。xMin == xMax = 不隨機、固定值' })
    xMax: number = 0;
}

/** 一組逐幀動畫：名稱 + 圖陣列 + 播放設定 + 攻擊判定區間 */
@ccclass('BossAnimClip')
export class BossAnimClip {
    @property({ tooltip: '招式名稱，要跟 Boss 的 Attack Sequence 的 Anim Name 一致，例如 boss_scythe' })
    name: string = '';

    @property({ type: [cc.SpriteFrame], tooltip: '這個招式的逐幀圖（依序排好）' })
    frames: cc.SpriteFrame[] = [];

    @property({ tooltip: '每秒幾張' })
    fps: number = 12;

    @property({ tooltip: '勾 → 播完停在最後一張；不勾 → 循環' })
    holdLast: boolean = false;

    @property({
        tooltip: '勾 → 來回播：正播到底再逆播回來（0→N→0）。碰撞箱沿用 hitWindows，' +
            '逆播經過同一張圖會再開同一個碰撞箱。'
    })
    pingPong: boolean = false;

    @property({
        tooltip: '勾 → 這招期間關閉所有受擊箱（boss 無敵打不到，例如跳躍）。' +
            '招式結束/換招會自動恢復。'
    })
    disableHurtBoxes: boolean = false;

    @property({
        tooltip: '這個招式整體的圖片縮放倍率：1 = 原寸、1.5 = 放大1.5倍、0.5 = 縮小。\n' +
            '整招每一幀都套用這個值。'
    })
    scale: number = 1;

    @property({
        tooltip: '這個招式整體的圖片位移（相對 body 原本位置）。\n' +
            'X 正右負左、Y 正上負下。整招每一幀都套用。換招/待機會還原。'
    })
    offset: cc.Vec2 = cc.v2(0, 0);

    @property({
        type: [BossHitWindow],
        tooltip: '攻擊判定區間：播到「第幾張圖」要開「哪個 hitbox」。\n' +
            '例：startFrame=10 endFrame=14 hitBoxIndex=0 → 第10~14張圖時開第0個攻擊箱。\n' +
            '可設多段，刀形變化就分多段對應不同 hitbox。不設 = 這招沒攻擊判定。'
    })
    hitWindows: BossHitWindow[] = [];

    @property({
        type: [BossJumpWindow],
        tooltip: '整個 boss 升降區間（移動 boss 根節點，碰撞箱一起飛）。\n' +
            '例：第5~15張 fromY=0 toY=600（升出畫面）、第30~40張 fromY=600 toY=0（落回）。\n' +
            '區間之間會維持上一段的結束高度。不設 = boss 不升降。'
    })
    jumpWindows: BossJumpWindow[] = [];

    @property({
        tooltip: '隨機落點：每次出招會在 [randomXMin, randomXMax] 之間擲一個 X 偏移，\n' +
            '加在 jumpWindows 的 X 位移之上（讓 boss 每次跳到隨機的左右位置）。\n' +
            'randomXMin == randomXMax（例如都 0）= 不隨機。'
    })
    randomXMin: number = 0;

    @property({ tooltip: '隨機落點 X 的上界（搭配 randomXMin 使用）' })
    randomXMax: number = 0;

    @property({
        type: [BossHoldStep],
        tooltip: '定格點：播到某張圖時停住維持幾秒，期間整個 boss 平滑往上移。\n' +
            '例：atFrame=10 holdSeconds=1.5 riseY=600 → 播到第10張停住，1.5秒內往上飄600，然後繼續播。\n' +
            '可設多個定格點。不設 = 不定格、正常逐幀播。'
    })
    holdSteps: BossHoldStep[] = [];

    @property({
        type: [BossTeleportStep],
        tooltip: '瞬移點：播到某張圖時，把整個 boss 根節點瞬間移到指定相對偏移（不內插，跟 jumpWindows 的平滑移動不同）。\n' +
            '例：atFrame=8 toX=300 toY=0 → 播到第8張時整個 boss（含碰撞箱）瞬間出現在原位右方 300。\n' +
            '可設多個瞬移點。換招/待機會還原回原位。'
    })
    teleportSteps: BossTeleportStep[] = [];
}

@ccclass
export default class BossAnimator extends cc.Component {

    @property({
        type: cc.Sprite,
        tooltip: '要換 spriteFrame 的 Sprite（拉 body 子節點的 cc.Sprite）；留空 → 找同節點的 cc.Sprite'
    })
    targetSprite: cc.Sprite = null;

    @property({
        type: [BossAnimClip],
        tooltip: '所有招式的逐幀動畫。name 要跟 Boss 的 Attack Sequence Anim Name 對上。'
    })
    moves: BossAnimClip[] = [];

    @property({
        type: cc.SpriteFrame,
        tooltip: '待機圖：招式之間的停頓會切回這張（留空 → 用 body 原本的 spriteFrame）'
    })
    idleFrame: cc.SpriteFrame = null;

    @property({
        type: cc.Node,
        tooltip: 'boss 跳躍落地時要震動的相機節點（拉 Main Camera，需掛 CameraShake）。留空 → 不震動'
    })
    cameraShakeTarget: cc.Node = null;

    @property({
        tooltip: '落地高度容許值 (px)：往下移的定格(holdStep riseY 負值)做完後，boss 距離原位地面 ' +
            '在這個範圍內才算「落地」觸發震動。boss_jump 分兩段下降，第一段做完還在半空 → 不震；' +
            '第二段做完回到地面(差距 < 此值) → 震。設大一點較寬鬆，例如 100。'
    })
    landMinDropY: number = 100;

    // ── 內部播放狀態 ─────────────────────────────
    private _frames: cc.SpriteFrame[] = [];
    private _fps: number = 12;
    private _holdLast: boolean = false;
    private _idx: number = 0;
    private _accum: number = 0;
    private _done: boolean = false;
    /** 來回播：是否啟用 */
    private _pingPong: boolean = false;
    /** 目前播放方向：+1 正播、-1 逆播（只在 pingPong 時會變 -1） */
    private _dir: number = 1;

    /** 目前這招的攻擊判定區間 */
    private _hitWindows: BossHitWindow[] = [];
    /** 目前這招的 boss 升降區間 */
    private _jumpWindows: BossJumpWindow[] = [];
    /** boss 根節點原本的 Y，升降是「加上」相對高度 */
    private _bossBaseY: number = 0;
    /** boss 根節點原本的 X，左右位移是「加上」相對偏移 */
    private _bossBaseX: number = 0;
    /** 這次出招擲出的隨機 X 偏移（每次 playMove 重擲一次） */
    private _randomX: number = 0;

    /** CameraShake 元件參照（從 cameraShakeTarget 取） */
    private _camShake: any = null;

    /** 目前這招的瞬移點 */
    private _teleportSteps: BossTeleportStep[] = [];
    /** 已經用過的瞬移幀（避免同一幀重複觸發） */
    private _consumedTeleports: { [frame: number]: boolean } = {};
    /** 是否被 teleport 移走過：true → idle/換招時保留位置不拉回原位（偏移仍以原位 _bossBaseX/Y 為基準） */
    private _teleportLatched: boolean = false;

    /** 目前這招的定格點 */
    private _holdSteps: BossHoldStep[] = [];
    /** 已經用過的定格幀（避免同一幀重複觸發） */
    private _consumedHolds: { [frame: number]: boolean } = {};
    /** 是否正在定格中 */
    private _holding: boolean = false;
    /** 定格已經過的秒數 */
    private _holdElapsed: number = 0;
    /** 目前定格設定 */
    private _curHold: BossHoldStep = null;
    /** 定格開始時 boss 的 Y（往上移以此為基準） */
    private _holdStartY: number = 0;
    /** 上一幀算出來「該開哪個 hitbox」，-1 = 全關。用來偵測變化才通知 Boss */
    private _activeHitIndex: number = -1;
    /** Boss 元件參照，用來開關 hitbox */
    private _boss: any = null;
    /** body 原本的 spriteFrame，當 idleFrame 沒設時拿來當待機圖 */
    private _defaultFrame: cc.SpriteFrame = null;

    /** 目前這招的整體縮放倍率 */
    private _scale: number = 1;
    /** 目前這招的整體位移 */
    private _offsetX: number = 0;
    private _offsetY: number = 0;
    /** targetSprite 節點原本的 scale，縮放是「乘上」這個基準值 */
    private _baseScaleX: number = 1;
    private _baseScaleY: number = 1;
    /** targetSprite 節點原本的 position，位移是「加上」這個基準值 */
    private _baseX: number = 0;
    private _baseY: number = 0;

    onLoad() {
        if (!this.targetSprite) this.targetSprite = this.getComponent(cc.Sprite);
        this._boss = this.getComponent('Boss');
        this._bossBaseY = this.node.y;   // boss 根節點原本的 Y（升降相對它）
        this._bossBaseX = this.node.x;   // boss 根節點原本的 X（左右位移相對它）
        if (this.targetSprite) {
            this._defaultFrame = this.targetSprite.spriteFrame;
            // 記住 body 原本的縮放/位置當基準（縮放乘上它、位移加上它，不破壞原本設定）
            const node = this.targetSprite.node;
            this._baseScaleX = node.scaleX;
            this._baseScaleY = node.scaleY;
            this._baseX = node.x;
            this._baseY = node.y;
        }
        if (this.cameraShakeTarget) {
            this._camShake = this.cameraShakeTarget.getComponent('CameraShake');
        }
    }

    update(dt: number) {
        if (!this.targetSprite || this._frames.length === 0) return;

        // 定格中：停住不換圖，跑定格計時 + 平滑往上移
        if (this._holding) {
            this._tickHold(dt);
            return;
        }

        if (this._done) {
            this._applyHitForFrame();   // 停在最後一張時也要維持/收掉判定
            this._applyJumpForFrame();
            return;
        }

        const period = 1 / Math.max(1, this._fps);
        const last = this._frames.length - 1;
        this._accum += dt;
        while (this._accum >= period) {
            this._accum -= period;
            this._idx += this._dir;

            if (this._pingPong) {
                // 來回播：撞到尾就轉成逆播、撞到頭就轉成正播
                if (this._idx > last) {
                    this._idx = last - 1 < 0 ? 0 : last - 1;
                    this._dir = -1;
                } else if (this._idx < 0) {
                    if (this._holdLast) {        // 來回一輪後停在第一張
                        this._idx = 0;
                        this._done = true;
                        break;
                    }
                    this._idx = 1 > last ? last : 1;
                    this._dir = 1;               // 再正播 → 形成循環來回
                }
            } else {
                // 單向播
                if (this._idx > last) {
                    if (this._holdLast) {
                        this._idx = last;
                        this._done = true;
                        break;
                    }
                    this._idx = 0;               // 循環
                }
            }

            // 落在有效幀就檢查瞬移點（瞬移不停止換圖，只把根節點挪過去）
            this._applyTeleportForFrame();

            // 落在有效幀後檢查是不是定格點，是就進定格、停止換圖
            if (this._enterHoldIfNeeded()) break;
        }
        this.targetSprite.spriteFrame = this._frames[this._idx];
        this._applyFrameScale();
        this._applyHitForFrame();
        if (!this._holding) this._applyJumpForFrame();
    }

    /** 換到某幀時，若該幀是還沒用過的瞬移點 → 把整個 boss 根節點瞬間移到指定相對偏移 */
    private _applyTeleportForFrame() {
        if (this._teleportSteps.length === 0) return;
        if (this._consumedTeleports[this._idx]) return;

        for (let i = 0; i < this._teleportSteps.length; i++) {
            const t = this._teleportSteps[i];
            if (t && t.atFrame === this._idx) {
                // X 偏移每次觸發重擲（min/max 順序顛倒也沒關係），基於「原位」_bossBaseX
                const lo = Math.min(t.xMin, t.xMax);
                const hi = Math.max(t.xMin, t.xMax);
                const offX = lo + Math.random() * (hi - lo);
                this.node.x = this._bossBaseX + offX;   // 只動 X，Y 維持當下位置不碰
                this._consumedTeleports[this._idx] = true;   // 標記用過，這輪不再觸發
                this._teleportLatched = true;                // 之後 idle/換招保留此位置，不拉回原位
            }
        }
    }

    /** 換到某幀時，若該幀是還沒用過的定格點 → 進入定格模式，回傳 true */
    private _enterHoldIfNeeded(): boolean {
        if (this._holdSteps.length === 0) return false;
        if (this._consumedHolds[this._idx]) return false;

        for (let i = 0; i < this._holdSteps.length; i++) {
            const h = this._holdSteps[i];
            if (h && h.atFrame === this._idx) {
                this._holding = true;
                this._curHold = h;
                this._holdElapsed = 0;
                this._holdStartY = this.node.y;          // 以目前高度為起點往上移
                this._consumedHolds[this._idx] = true;   // 標記用過，這輪不再觸發
                this.targetSprite.spriteFrame = this._frames[this._idx];
                this._applyFrameScale();
                this._applyHitForFrame();
                return true;
            }
        }
        return false;
    }

    /** 定格中每幀：跑計時 + 平滑往上移；時間到解除定格繼續播 */
    private _tickHold(dt: number) {
        if (!this._curHold) { this._holding = false; return; }

        this._holdElapsed += dt;
        const dur = Math.max(0.0001, this._curHold.holdSeconds);
        let t = this._holdElapsed / dur;
        if (t > 1) t = 1;

        // 平滑往上移（定格起點 → 起點 + riseY）
        this.node.y = this._holdStartY + this._curHold.riseY * t;

        // 維持判定/縮放（定格期間圖不變但要維持狀態）
        this._applyHitForFrame();

        if (this._holdElapsed >= dur) {
            // 落地判定：boss_jump 的下降是分兩段 holdStep（frame44、45 各 riseY -450）。
            // 只在「往下移、且降完後已回到接近地面高度(_bossBaseY)」時才算落地 → 震畫面。
            // 第一段下降做完時 boss 還在半空（Y 離 base 還很遠）→ 不觸發；第二段做完回到地面才震。
            const movedDown = this._curHold.riseY < 0;
            const backOnGround = (this.node.y - this._bossBaseY) <= this.landMinDropY;
            if (movedDown && backOnGround) this._triggerLanding();

            this._holding = false;   // 解除定格，下一幀繼續逐幀播
            this._curHold = null;
        }
    }

    /** boss 落地：觸發畫面震動 + 發事件（接音效/落塵用） */
    private _triggerLanding() {
        if (this._camShake && typeof this._camShake.shake === 'function') {
            this._camShake.shake();   // 用 CameraShake 的預設強度（可在 Inspector 調）
        }
        this.node.emit('boss-landed');
    }

    /** 依目前播到第幾張圖，把整個 boss 根節點移到對應位置（升降 + 左右，碰撞箱一起動） */
    private _applyJumpForFrame() {
        if (this._jumpWindows.length === 0) return;

        let relY = 0;            // 相對原位的高度，預設地面
        let relX = 0;            // 相對原位的 X 偏移（jumpWindow 設定的部分）
        // 隨機落點權重：0 = 還在原位、1 = 完全移到這次擲出的隨機位置。
        // 跟著 jumpWindow 的進度 t 由 0 漸進到 1，過了區間就保持在 1（停在隨機落點）。
        let randWeight = 0;
        for (let i = 0; i < this._jumpWindows.length; i++) {
            const w = this._jumpWindows[i];
            if (!w) continue;
            if (this._idx < w.startFrame) {
                // 還沒到這段 → 用更早段決定（保持上一段結尾）；這裡先不動
                continue;
            }
            if (this._idx >= w.startFrame && this._idx <= w.endFrame) {
                // 在這段內 → 線性內插 from → to
                const span = Math.max(1, w.endFrame - w.startFrame);
                const t = (this._idx - w.startFrame) / span;
                relY = w.fromY + (w.toY - w.fromY) * t;
                relX = w.fromX + (w.toX - w.fromX) * t;
                randWeight = t;
            } else if (this._idx > w.endFrame) {
                // 已過這段 → 維持這段結尾位置（直到下一段覆蓋）
                relY = w.toY;
                relX = w.toX;
                randWeight = 1;
            }
        }
        this.node.y = this._bossBaseY + relY;
        // 最終 X = 原位 + jumpWindow 位移 + 隨機落點（隨進度漸進，碰撞箱一起動）
        this.node.x = this._bossBaseX + relX + this._randomX * randWeight;
    }

    /** 套用這招的縮放與位移（乘上/加上 body 原本的基準值） */
    private _applyFrameScale() {
        if (!this.targetSprite) return;
        const node = this.targetSprite.node;
        const s = (this._scale && this._scale > 0) ? this._scale : 1;
        node.scaleX = this._baseScaleX * s;
        node.scaleY = this._baseScaleY * s;
        node.x = this._baseX + this._offsetX;
        node.y = this._baseY + this._offsetY;
    }

    /** 依目前播到第幾張圖，算出該開哪個 hitbox，變了才通知 Boss */
    private _applyHitForFrame() {
        let want = -1;
        for (let i = 0; i < this._hitWindows.length; i++) {
            const w = this._hitWindows[i];
            if (w && this._idx >= w.startFrame && this._idx <= w.endFrame) {
                want = w.hitBoxIndex;
                break;
            }
        }
        if (want === this._activeHitIndex) return;   // 沒變 → 不動
        this._activeHitIndex = want;

        if (!this._boss) return;
        if (want < 0) {
            if (typeof this._boss.disableHit === 'function') this._boss.disableHit();
        } else {
            if (typeof this._boss.enableHit === 'function') this._boss.enableHit(want);
        }
    }

    /**
     * Boss.ts 出招時呼叫，播放名為 name 的那組逐幀動畫。
     * 找不到該 name 或圖是空的 → 保持上一張，不報錯。
     */
    public playMove(name: string) {
        const clip = this._findClip(name);
        if (!clip || !clip.frames || clip.frames.length === 0) return;

        this._frames = clip.frames;
        this._fps = clip.fps;
        this._holdLast = clip.holdLast;
        this._pingPong = clip.pingPong;
        this._hitWindows = clip.hitWindows || [];
        this._jumpWindows = clip.jumpWindows || [];
        this._holdSteps = clip.holdSteps || [];
        this._teleportSteps = clip.teleportSteps || [];
        // 每次出招擲一個隨機 X 偏移（min/max 順序顛倒也沒關係）
        {
            const lo = Math.min(clip.randomXMin, clip.randomXMax);
            const hi = Math.max(clip.randomXMin, clip.randomXMax);
            this._randomX = lo + Math.random() * (hi - lo);
        }
        this._scale = clip.scale;
        this._offsetX = clip.offset ? clip.offset.x : 0;
        this._offsetY = clip.offset ? clip.offset.y : 0;
        this._idx = 0;
        this._dir = 1;               // 每次出招都從正播開始
        this._accum = 0;
        this._done = false;
        // 重置定格狀態
        this._holding = false;
        this._curHold = null;
        this._holdElapsed = 0;
        this._consumedHolds = {};
        this._consumedTeleports = {};
        // 有 jumpWindows 的招式會用 _bossBaseX/Y 重新定位 → 清掉 teleport latch（這招結束才落回原位）。
        // 沒 jumpWindows 的招式不動位置 → 保留 latch，boss 停在上次瞬移的落點。
        if (this._jumpWindows.length > 0) this._teleportLatched = false;
        this.targetSprite.spriteFrame = this._frames[0];
        this._applyFrameScale();     // 第 0 張的縮放
        this._applyJumpForFrame();   // 第 0 張的升降高度
        this._applyTeleportForFrame(); // 第 0 張就是瞬移點的話也要處理
        this._enterHoldIfNeeded();   // 第 0 張就是定格點的話也要處理

        // 換招先全關 hitbox，再依第 0 張算一次
        this._activeHitIndex = -2;   // 強制下次一定觸發變化
        if (this._boss && typeof this._boss.disableHit === 'function') this._boss.disableHit();
        this._applyHitForFrame();

        // 這招要不要關受擊箱（跳躍無敵）；不勾的招式會把受擊箱恢復回來
        if (this._boss && typeof this._boss.setHurtBoxesActive === 'function') {
            this._boss.setHurtBoxesActive(!clip.disableHurtBoxes);
        }
    }

    /**
     * 切回待機圖（招式之間的停頓用）。停止逐幀播放，顯示 idleFrame；
     * idleFrame 沒設 → 用 body 原本的 spriteFrame。
     */
    public idle() {
        this._frames = [];            // 清空 → update 不再逐幀換圖
        this._done = false;
        this._dir = 1;
        this._hitWindows = [];
        this._jumpWindows = [];
        this._holdSteps = [];
        this._teleportSteps = [];
        this._consumedTeleports = {};
        this._holding = false;
        this._curHold = null;
        this._consumedHolds = {};
        this._scale = 1;
        this._offsetX = 0;
        this._offsetY = 0;

        // 縮放/位移還原成 body 原本狀態（不要停頓時還停在放大/位移的狀態）
        if (this.targetSprite) {
            const node = this.targetSprite.node;
            node.scaleX = this._baseScaleX;
            node.scaleY = this._baseScaleY;
            node.x = this._baseX;
            node.y = this._baseY;
        }
        // boss 根節點位置還原回原位（跳躍/位移結束落回原位）。
        // 但若被 teleport 移走過 → 保留位置不拉回（瞬移落點要留著），下次偏移仍以原位為基準。
        if (!this._teleportLatched) {
            this.node.y = this._bossBaseY;
            this.node.x = this._bossBaseX;
        }

        // 收掉 hitbox
        this._activeHitIndex = -1;
        if (this._boss && typeof this._boss.disableHit === 'function') this._boss.disableHit();
        // 待機時受擊箱恢復（跳躍無敵結束）
        if (this._boss && typeof this._boss.setHurtBoxesActive === 'function') {
            this._boss.setHurtBoxesActive(true);
        }

        if (!this.targetSprite) return;
        const frame = this.idleFrame || this._defaultFrame;
        if (frame) this.targetSprite.spriteFrame = frame;
    }

    /** 目前是不是已經播到最後一張並停住（holdLast 用） */
    public get isDone(): boolean { return this._done; }

    /** 目前播到第幾張（給需要對齊 hitbox 切換的人參考） */
    public get currentFrameIndex(): number { return this._idx; }

    private _findClip(name: string): BossAnimClip {
        for (let i = 0; i < this.moves.length; i++) {
            if (this.moves[i] && this.moves[i].name === name) return this.moves[i];
        }
        return null;
    }
}
