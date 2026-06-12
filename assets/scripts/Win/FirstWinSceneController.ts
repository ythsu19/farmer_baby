const {ccclass, property} = cc._decorator;

@ccclass
export default class FirstWinSceneController extends cc.Component {

    @property({ tooltip: "要在這個畫面停留幾秒" })
    waitTime: number = 3.0; // 預設停 3 秒，你可以去 Cocos 面板自己改長短

    start () {
        // 進入 FirstWinScene 後，靜止幾秒鐘，然後自動切換到 World
        this.scheduleOnce(() => {
            cc.director.loadScene("World");
        }, this.waitTime);
    }
}