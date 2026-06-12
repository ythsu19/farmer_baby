const { ccclass, property } = cc._decorator;

@ccclass
export default class PausePanelUI extends cc.Component {

    @property(cc.Node)
    brownPanel: cc.Node = null;

    onLoad() {
        if (this.brownPanel) {
            this.setupBrownPanel();
        }
    }

    private setupBrownPanel() {
        this.brownPanel.setPosition(0, 0);
        this.brownPanel.width = 420;
        this.brownPanel.height = 300;
        this.brownPanel.zIndex = 10;

        let sprite = this.brownPanel.getComponent(cc.Sprite);
        if (!sprite) {
            sprite = this.brownPanel.addComponent(cc.Sprite);
        }

        this.brownPanel.color = new cc.Color(120, 72, 35);
        this.brownPanel.opacity = 255;
    }
}