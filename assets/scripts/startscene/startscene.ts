import { GameStore } from '../Store/GameStore';

const { ccclass, property } = cc._decorator;

@ccclass
export default class StartScene extends cc.Component {

    @property
    nextSceneName: string = "StartScene";

    onLoad() {
        // 每次進入 start scene → 金幣重置為 100。
        // 強化倍率（speed / jump / damage）+ 已購清單（收音機 / 寶藏）不動 — 上次買的東西還在。
        // 想連同強化一起歸零 → 改呼叫 GameStore.reset()。
        GameStore.resetMoney();
        cc.log(`[StartScene] 進入 start scene，金幣重置為 $${GameStore.money}`);
    }

    public onStartButtonClick() {
        cc.director.loadScene(this.nextSceneName);
    }
}