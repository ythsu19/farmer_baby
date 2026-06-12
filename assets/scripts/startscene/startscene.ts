const { ccclass, property } = cc._decorator;

@ccclass
export default class StartScene extends cc.Component {

    @property
    nextSceneName: string = "StartScene";

    public onStartButtonClick() {
        cc.director.loadScene(this.nextSceneName);
    }
}