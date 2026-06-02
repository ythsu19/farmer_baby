import FinalBoss from "./FinalBoss";

const { ccclass, property } = cc._decorator;

@ccclass
export default class BossWeakPoint extends cc.Component {

    @property({ type: FinalBoss, tooltip: "本部位所屬的 Boss 本體（拖 Boss 根節點上的 FinalBoss 元件）" })
    boss: FinalBoss = null;

    @property({ tooltip: "傷害倍率（例如帽子=1.0、眼睛=2.0 暴擊點）" })
    damageMultiplier: number = 1.0;

    // _attacker 由子彈傳入（box2d Bullet 呼叫 takeDamage(damage, this.node)）；此處用不到但保留以對齊介面
    takeDamage(damage: number, _attacker?: cc.Node) {
        if (!this.boss) {
            cc.warn("【BossWeakPoint】未綁定 boss 參考");
            return;
        }
        const final = Math.floor(damage * this.damageMultiplier);
        this.boss.onWeakPointHit(this.node, final);
    }
}
