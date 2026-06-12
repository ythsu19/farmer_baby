// FirebaseLoader — 在 Cocos 2.4.8（Web 平台）動態載入 Firebase JS SDK 並初始化
//
// 為什麼要這支？
//   Cocos 2.4.8 不是 npm/webpack 構建環境，不能 `import firebase from 'firebase'`。
//   所以改用「動態插入 CDN <script>」的方式把 SDK 載進瀏覽器頁面，
//   載完後全域就有 `firebase` 物件可用（用 compat 版 → API 是 firebase.auth() 這種全域寫法）。
//
// 用法：
//   await FirebaseLoader.ensureReady();   // 任何要用 firebase 前先 await 這個
//   const auth = (window as any).firebase.auth();
//
// 只會真正載入一次（之後的呼叫直接拿快取的 Promise）。
//
// ⚠️ 只在 Web 平台有效（cc.sys.isBrowser）。原生/小遊戲平台要另外做，這裡會直接 reject。

const { ccclass } = cc._decorator;

// 你的 Firebase 專案設定（Web app 的 apiKey 對前端是公開的，可以放這裡）
const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyA5XfCBxqEjHXRHlfuhpPEm4r9oTdUP62I',
    authDomain: 'final-project-76c4c.firebaseapp.com',
    projectId: 'final-project-76c4c',
    storageBucket: 'final-project-76c4c.firebasestorage.app',
    messagingSenderId: '798262996533',
    appId: '1:798262996533:web:3b1527291c774d97404b7c',
    measurementId: 'G-NHLT6JQF8L',
};

// 用 compat 版（全域 firebase.xxx），版本固定避免之後 CDN 改版壞掉
const SDK_VERSION = '9.23.0';
const SDK_SCRIPTS = [
    `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app-compat.js`,
    `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth-compat.js`,
    `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore-compat.js`,
];

@ccclass
export default class FirebaseLoader {

    private static _readyPromise: Promise<void> = null;

    /** 確保 Firebase SDK 已載入並初始化。多次呼叫只會載一次。 */
    public static ensureReady(): Promise<void> {
        if (this._readyPromise) return this._readyPromise;

        this._readyPromise = new Promise<void>((resolve, reject) => {
            // 只支援瀏覽器環境
            if (!cc.sys.isBrowser || typeof document === 'undefined') {
                reject(new Error('[FirebaseLoader] 只支援 Web 平台'));
                return;
            }

            const w = window as any;
            // 已經載過（例如熱重載）→ 直接初始化
            if (w.firebase && w.firebase.auth) {
                this._init(w.firebase);
                resolve();
                return;
            }

            // 依序載入 script（app 要先於 auth）
            this._loadScriptsInOrder(SDK_SCRIPTS)
                .then(() => {
                    const fb = (window as any).firebase;
                    if (!fb) throw new Error('[FirebaseLoader] SDK 載入後找不到 firebase 全域物件');
                    this._init(fb);
                    resolve();
                })
                .catch(reject);
        });

        return this._readyPromise;
    }

    /** 初始化 app（避免重複 initializeApp 報錯） */
    private static _init(fb: any) {
        if (!fb.apps || fb.apps.length === 0) {
            fb.initializeApp(FIREBASE_CONFIG);
        }
    }

    /** 依序載入多個 script，前一個 onload 後才載下一個 */
    private static _loadScriptsInOrder(urls: string[]): Promise<void> {
        return urls.reduce(
            (chain, url) => chain.then(() => this._loadOneScript(url)),
            Promise.resolve()
        );
    }

    private static _loadOneScript(url: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = false;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('[FirebaseLoader] 載入失敗: ' + url));
            document.head.appendChild(script);
        });
    }
}
