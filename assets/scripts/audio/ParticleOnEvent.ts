// ParticleOnEvent — 通用「事件觸發貼圖式粒子」元件
//
// 跟 SfxOnEvent 同模式：一個元件 = 一個 event + 一張 vfx 圖。
// event 一觸發 → 在本節點的「世界位置」spawn 一張 cc.Sprite → tween 縮放 + 淡出 → destroy。
//
// 為什麼不直接用 cc.ParticleSystem？
//   ParticleSystem 適合「持續噴粒子」（火、煙、瀑布）— 需要寫 .plist 描述檔。
//   遊戲裡 99% 的 hit / muzzle / dust 是「一次性閃一下就消失」— 一張貼圖 + tween 反而最直接，
//   不用準備 .plist、不用調幾十個參數，美術也好換圖。
//   之後真的要做持續粒子流（破風線、噴火）再加 ParticleSystem 也不衝突。
//
// 為什麼粒子要 parent 到 this.node.parent 而不是 this.node？
//   像 Bullet 撞擊後會 NodePool.put(node) → node.active = false，
//   parent 在子彈上的粒子會跟著被藏起來看不到。
//   parent 在 this.node.parent → 粒子獨立活在場景，子彈該回收回收，粒子該演完演完。
//   PlayerDash._spawnGhost 也是同一個 pattern。
//
// 使用範例（Inspector 上）：
//   Player1 節點
//     ├─ ParticleOnEvent  event='shot'        spriteFrame=muzzle.png  endScale=2  lifetime=0.2
//     ├─ ParticleOnEvent  event='dash:start'  spriteFrame=dust.png    endScale=2.5 lifetime=0.35
//   Bullet 節點
//     ├─ ParticleOnEvent  event='hit'         spriteFrame=hit_vfx.png endScale=1.8 lifetime=0.25 randomRotation=true

const { ccclass, property } = cc._decorator;

@ccclass
export default class ParticleOnEvent extends cc.Component {

    @property({ displayName: '事件名稱', tooltip: '例：shot / dash:start / hurt / hit / jumped' })
    eventName: string = '';

    @property({ type: cc.SpriteFrame, displayName: 'VFX 圖' })
    spriteFrame: cc.SpriteFrame = null!;

    @property({ displayName: '存活時間 (s)', tooltip: '從 spawn 到完全消失的時間' })
    lifetime: number = 0.3;

    @property({ displayName: '起始 Scale' })
    startScale: number = 0.5;

    @property({ displayName: '結束 Scale', tooltip: '比 start 大 → 爆開感；比 start 小 → 收縮感' })
    endScale: number = 1.5;

    @property({ displayName: '起始 Opacity (0–255)' })
    startOpacity: number = 255;

    @property({ displayName: '結束 Opacity (0–255)' })
    endOpacity: number = 0;

    @property({ displayName: '粒子色調', type: cc.Color, tooltip: '會跟 sprite 相乘；白色 = 原圖' })
    tint: cc.Color = cc.color(255, 255, 255);

    @property({ displayName: '隨機旋轉', tooltip: '每次 spawn 隨機 0–360 度，hit / 爆炸開更有變化' })
    randomRotation: boolean = false;

    @property({ displayName: '位置抖動 (px)', tooltip: '在 spawn 點正負範圍隨機偏移；0 = 不抖' })
    positionJitter: number = 0;

    @property({ displayName: '最小間隔 (s)', tooltip: '距上次 spawn 未滿這秒數就跳過；0 = 不擋' })
    minInterval: number = 0;

    private _lastSpawnMs: number = -Infinity;

    onLoad() {
        if (!this.eventName) {
            cc.warn('[ParticleOnEvent] eventName 沒設定，這個元件不會做任何事');
            return;
        }
        this.node.on(this.eventName, this._spawn, this);
    }

    onDestroy() {
        if (!this.eventName) return;
        this.node.off(this.eventName, this._spawn, this);
    }

    private _spawn() {
        if (!this.spriteFrame) return;
        if (!this.node.parent) return;

        if (this.minInterval > 0) {
            const now = cc.director.getTotalTime();
            if (now - this._lastSpawnMs < this.minInterval * 1000) return;
            this._lastSpawnMs = now;
        }

        // 粒子 parent 到 this.node.parent — this.node 可能會被 destroy / NodePool.put 藏起來，
        // 粒子要獨立活到 tween 結束
        const p = new cc.Node('Vfx_' + this.eventName);
        p.parent = this.node.parent;

        // 位置：跟本節點同位置，加上 jitter
        let px = this.node.x;
        let py = this.node.y;
        if (this.positionJitter > 0) {
            px += (Math.random() * 2 - 1) * this.positionJitter;
            py += (Math.random() * 2 - 1) * this.positionJitter;
        }
        p.setPosition(px, py);

        // 視覺壓在本節點上面 — 子彈撞擊閃光要蓋過子彈本體
        p.zIndex = this.node.zIndex + 1;

        if (this.randomRotation) {
            p.angle = Math.random() * 360;
        }

        const sp = p.addComponent(cc.Sprite);
        sp.sizeMode = cc.Sprite.SizeMode.RAW;
        sp.spriteFrame = this.spriteFrame;

        p.color = this.tint;
        p.opacity = this.startOpacity;
        p.scale = this.startScale;

        // tween: 同時縮放 + 淡出，結束 destroy
        cc.tween(p)
            .to(this.lifetime, { scale: this.endScale, opacity: this.endOpacity })
            .call(() => { if (p.isValid) p.destroy(); })
            .start();
    }
}
