// 飞行模拟器主文件 - 重构版本

// 导入所有模块
import { AirplaneModel } from './modules/AirplaneModel.js';
import { Environment } from './modules/Environment.js';
import { PhysicsEngine } from './modules/PhysicsEngine.js';
import { ControlsManager } from './modules/ControlsManager.js';
import { CameraController } from './modules/CameraController.js';
import { UIController } from './modules/UIController.js';
import { MultiplayerManager } from './modules/MultiplayerManager.js';
import { WaterEffects } from './modules/WaterEffects.js';

class FlightSimulator {
    constructor() {
        // 初始化基础Three.js组件
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();

        // 初始化游戏状态
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.throttle = 0;
        this.flightMode = 'ground';
        this.modeTransitionSmoothing = 1.0;
        this.coordinatedTurnActive = false;
        this.targetRollAngle = 0;
        this.afterburnerActive = false;

        // 起飞和速度限制配置
        this.canTakeoff = false;
        this.takeoffSpeed = 300; // km/h - 起飞所需最低速度
        this.maxSpeed = 1000; // km/h - 最高速度限制

        // 配平系统配置
        this.trimSystem = {
            targetSpeed: 120,
            rollDamping: 2.0,
            pitchStability: 1.5,
            yawDamping: 1.0,
            speedTrimStrength: 'arcade',
            attitudeTrimStrength: 'arcade'
        };

        // 多人游戏配置
        this.globalRoomId = 'flight-simulator-global-room';
        this.otherPlayers = new Map();
        this.connections = new Map();
        this.peer = null;
        this.isHost = false;

        // 创建种子随机数生成器
        this.rng = this.createSeededRandom(12345);

        this.init();
    }

    // 创建带种子的随机数生成器
    createSeededRandom(initialSeed) {
        let seed = initialSeed;
        return () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    init() {
        // 设置渲染器
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);

        // 设置光照
        this.setupLighting();

        // 初始化所有模块
        this.airplaneModel = new AirplaneModel(this.scene);
        this.airplane = this.airplaneModel.getAirplane();

        this.environment = new Environment(this.scene, this.rng);
        this.physicsEngine = new PhysicsEngine(this);
        this.controlsManager = new ControlsManager(this);
        this.cameraController = new CameraController(this.camera);
        this.uiController = new UIController(this);
        this.multiplayerManager = new MultiplayerManager(this);
        this.waterEffects = new WaterEffects(this.scene, this.renderer);

        // 设置窗口大小变化监听
        window.addEventListener('resize', () => this.onWindowResize());

        // 开始动画循环
        this.animate();
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = this.clock.getDelta();

        // 更新物理引擎
        this.physicsEngine.updatePhysics(deltaTime);

        // 更新UI
        this.uiController.updateUI();

        // 更新摄像机
        this.cameraController.updateCamera(this.airplane);

        // 更新水面动画
        this.waterEffects.updateWaterAnimation(deltaTime);
        this.waterEffects.updateWaterReflection(this.camera);

        // 更新悬浮挂牌动画
        this.updateBannerAnimation(deltaTime);

        // 广播位置（多人游戏）
        if (this.multiplayerManager.peer?.open) {
            this.multiplayerManager.broadcastPosition();
        }

        this.renderer.render(this.scene, this.camera);
    }

    updateBannerAnimation(deltaTime) {
        const bannerGroup = this.environment.getBannerGroup();
        if (bannerGroup) {
            this.bannerSwayTime = (this.bannerSwayTime || 0) + deltaTime;
            const swayX = Math.sin(this.bannerSwayTime * 0.6) * 0.3;
            const swayZ = Math.cos(this.bannerSwayTime * 0.8) * 0.2;
            const swayY = Math.sin(this.bannerSwayTime * 1.0) * 0.5;

            bannerGroup.rotation.x = swayX * 0.03;
            bannerGroup.rotation.z = swayZ * 0.03;
            bannerGroup.position.y = swayY;
        }
    }

    onWindowResize() {
        this.cameraController.onWindowResize();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// 启动游戏
const game = new FlightSimulator();