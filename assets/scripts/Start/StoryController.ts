const {ccclass, property} = cc._decorator;

@ccclass
export default class StoryController extends cc.Component {

    @property(cc.Node)
    story1: cc.Node = null;

    @property(cc.Node)
    story2: cc.Node = null;

    @property(cc.Node)
    story3: cc.Node = null;

    @property(cc.Node)
    bookBg: cc.Node = null; 

    @property(cc.Node)
    blankBook: cc.Node = null;

    // ======= 新增：綁定要出現在空白頁上的按鈕 =======
    @property(cc.Node)
    tutorialBtn: cc.Node = null;
    // ===============================================

    @property({ tooltip: "每張圖片淡入需要花費幾秒" })
    fadeInDuration: number = 1.2;

    @property({ tooltip: "若不點擊螢幕，幾秒後會自動播放下一張" })
    autoPlayDelay: number = 2.0;

    private currentStep: number = 0;

    start () {
        if(this.story1) this.story1.opacity = 0;
        if(this.story2) this.story2.opacity = 0;
        if(this.story3) this.story3.opacity = 0;
        if(this.blankBook) this.blankBook.opacity = 0;
        
        // 新增：一開始先把按鈕藏起來
        if(this.tutorialBtn) this.tutorialBtn.opacity = 0;

        this.node.on(cc.Node.EventType.TOUCH_START, this.onScreenClick, this);

        this.playNextStep();
    }

    playNextStep () {
        this.currentStep++;

        switch (this.currentStep) {
            case 1:
                cc.tween(this.story1).to(this.fadeInDuration, { opacity: 255 }).start();
                this.scheduleNext(this.autoPlayDelay);
                break;
            case 2:
                cc.tween(this.story2).to(this.fadeInDuration, { opacity: 255 }).start();
                this.scheduleNext(this.autoPlayDelay);
                break;
            case 3:
                cc.tween(this.story3).to(this.fadeInDuration, { opacity: 255 }).start();
                this.scheduleNext(this.autoPlayDelay + 1); 
                break;
            case 4:
                this.playPageTurnAnimation();
                this.node.off(cc.Node.EventType.TOUCH_START, this.onScreenClick, this);
                break;
        }
    }

    scheduleNext (delay: number) {
        this.unschedule(this.playNextStep);
        this.scheduleOnce(this.playNextStep, delay);
    }

    onScreenClick () {
        if (this.currentStep >= 4) return;

        this.unschedule(this.playNextStep);

        if (this.currentStep === 1) {
            cc.Tween.stopAllByTarget(this.story1); 
            this.story1.opacity = 255;
        } else if (this.currentStep === 2) {
            cc.Tween.stopAllByTarget(this.story2); 
            this.story2.opacity = 255;
        } else if (this.currentStep === 3) {
            cc.Tween.stopAllByTarget(this.story3); 
            this.story3.opacity = 255;
        }

        this.playNextStep();
    }

    playPageTurnAnimation () {
        cc.tween(this.story1).to(this.fadeInDuration, { opacity: 0 }).start();
        cc.tween(this.story2).to(this.fadeInDuration, { opacity: 0 }).start();
        cc.tween(this.story3).to(this.fadeInDuration, { opacity: 0 }).start();

        this.scheduleOnce(() => {
            if(this.bookBg) this.bookBg.opacity = 0;
            if(this.blankBook) this.blankBook.opacity = 255;

            // 新增：當切換到空白書本後，讓按鈕緩慢淡入 (花 0.8 秒)
            if (this.tutorialBtn) {
                cc.tween(this.tutorialBtn).to(0.8, { opacity: 255 }).start();
            }
        }, this.fadeInDuration);
    }

    // ======= 新增：提供給按鈕元件點擊呼叫的函數 =======
    onTutorialBtnClick () {
        // 使用 Cocos 內建的場景管理器切換到指定場景（名稱須與你的 .fire 檔案一致）
        cc.director.loadScene("Tutorial");
    }
    // =====================================================
}