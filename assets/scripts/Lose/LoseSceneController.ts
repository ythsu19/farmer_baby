const {ccclass, property} = cc._decorator;

@ccclass
export default class LoseSceneController extends cc.Component {

    start () {
        // 進入失敗畫面後，靜止 3 秒鐘，自動切換回 World
        this.scheduleOnce(() => {
            cc.director.loadScene("World");
        }, 3.0);
    }
}