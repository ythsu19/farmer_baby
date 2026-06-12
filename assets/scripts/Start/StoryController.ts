const {ccclass, property} = cc._decorator;

@ccclass
export default class StoryController extends cc.Component {

    @property(cc.Node)
    story1: cc.Node = null;

    @property(cc.Node)
    story2: cc.Node = null;

    @property(cc.Node)
    story3: cc.Node = null;

    start () {
        // 遊戲一開始，先把三張圖的透明度都設為 0 (完全隱藏)
        if(this.story1) this.story1.opacity = 0;
        if(this.story2) this.story2.opacity = 0;
        if(this.story3) this.story3.opacity = 0;

        // 呼叫淡入動畫函數
        this.playFadeInAnimations();
    }

    playFadeInAnimations () {
        // 第一張：遊戲開始直接花 1 秒鐘淡入至 255 (完全不透明)
        cc.tween(this.story1)
            .to(1, { opacity: 255 })
            .start();

        // 第二張：等待 2 秒後，花 1 秒鐘淡入
        cc.tween(this.story2)
            .delay(2)
            .to(1, { opacity: 255 })
            .start();

        // 第三張：等待 4 秒後 (2秒+2秒)，花 1 秒鐘淡入
        cc.tween(this.story3)
            .delay(4)
            .to(1, { opacity: 255 })
            .start();
    }
}