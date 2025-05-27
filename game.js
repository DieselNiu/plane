class FlightSimulator {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        
        this.airplane = null;
        this.velocity = new THREE.Vector3();
        this.angularVelocity = new THREE.Vector3();
        this.throttle = 0;
        this.afterburnerActive = false;
        this.controls = {};
        
        // 新增：飞行模式系统
        this.flightMode = 'ground'; // 'ground' 或 'air'
        this.previousMode = 'ground';
        this.modeTransitionSmoothing = 0; // 0-1，用于模式切换的平滑过渡
        
        // 新增：智能协调转弯系统
        this.targetRollAngle = 0;     // 目标翻滚角
        this.targetYawRate = 0;       // 目标偏航速率
        this.coordinatedTurnActive = false;
        
        // 新增：配平系统
        this.trimSystem = {
            targetSpeed: 200,           // 目标巡航速度 km/h
            speedTrimStrength: 'arcade', // 'arcade', 'simulation', 'expert'
            attitudeTrimStrength: 'arcade',
            rollDamping: 2.0,
            pitchStability: 1.5,
            yawDamping: 1.8
        };
        

        
        // 移动端控制器状态
        this.mobileControls = {
            leftJoystick: { x: 0, y: 0, active: false },
            rightJoystick: { x: 0, y: 0, active: false }
        };
        
        this.otherPlayers = new Map();
        this.peer = null;
        this.connections = new Map();
        this.globalRoomId = 'flight-simulator-global-room';
        this.isHost = false;
        
        // 固定随机种子以确保场景一致性
        this.seed = 12345;
        this.rng = this.createSeededRandom(this.seed);
        
        this.init();
        this.setupControls();
        this.animate();
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
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        // 设置色彩空间以确保颜色正确显示
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);
        
        this.setupLighting();
        this.createAirplane();
        this.createEnvironment();
        this.setupCamera();
        this.initMultiplayer(); // 自动初始化多人游戏
        
        window.addEventListener('resize', () => this.onWindowResize());
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
    
    createAirplane() {
        this.airplane = new THREE.Group();
        
        const fuselageGeometry = new THREE.CylinderGeometry(0.3, 0.8, 12, 12);
        const fuselageMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x888888,
            shininess: 100
        });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        fuselage.rotation.z = Math.PI / 2;
        fuselage.castShadow = true;
        this.airplane.add(fuselage);
        
        const noseGeometry = new THREE.ConeGeometry(0.3, 2, 8);
        const nose = new THREE.Mesh(noseGeometry, fuselageMaterial);
        nose.rotation.z = -Math.PI / 2;
        nose.position.x = 7;
        this.airplane.add(nose);
        
        const propellerGroup = new THREE.Group();
        const propellerBladeGeometry = new THREE.BoxGeometry(0.1, 4, 0.2);
        const propellerMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
        
        const blade1 = new THREE.Mesh(propellerBladeGeometry, propellerMaterial);
        blade1.position.x = 8;
        propellerGroup.add(blade1);
        
        const blade2 = new THREE.Mesh(propellerBladeGeometry, propellerMaterial);
        blade2.position.x = 8;
        blade2.rotation.z = Math.PI / 2;
        propellerGroup.add(blade2);
        
        this.propeller = propellerGroup;
        this.airplane.add(this.propeller);
        
        const cockpitGeometry = new THREE.SphereGeometry(0.5, 12, 8);
        const cockpitMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x002244, 
            transparent: true, 
            opacity: 0.8,
            shininess: 200
        });
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.position.x = 3;
        cockpit.scale.set(1.5, 0.8, 1);
        this.airplane.add(cockpit);
        
        this.wingGroup = new THREE.Group();
        
        const wingMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x555555,
            shininess: 80
        });
        
        // Center wing section that connects to fuselage
        const centerWingGeometry = new THREE.BoxGeometry(1.5, 0.3, 2);
        const centerWing = new THREE.Mesh(centerWingGeometry, wingMaterial);
        centerWing.position.set(-1, 0, 0);
        centerWing.castShadow = true;
        this.wingGroup.add(centerWing);
        
        // Left wing extending from center
        const leftWingGeometry = new THREE.BoxGeometry(1.5, 0.3, 7);
        const leftWing = new THREE.Mesh(leftWingGeometry, wingMaterial);
        leftWing.position.set(-1, 0, 4.5);
        leftWing.castShadow = true;
        this.wingGroup.add(leftWing);
        
        // Right wing extending from center  
        const rightWingGeometry = new THREE.BoxGeometry(1.5, 0.3, 7);
        const rightWing = new THREE.Mesh(rightWingGeometry, wingMaterial);
        rightWing.position.set(-1, 0, -4.5);
        rightWing.castShadow = true;
        this.wingGroup.add(rightWing);
        
        this.airplane.add(this.wingGroup);
        
        const tailWingGeometry = new THREE.BoxGeometry(3, 0.2, 2.5);
        const tailWing = new THREE.Mesh(tailWingGeometry, wingMaterial);
        tailWing.position.x = -4;
        tailWing.castShadow = true;
        this.airplane.add(tailWing);
        
        this.rudderGroup = new THREE.Group();
        
        // Main vertical tail
        const verticalTailGeometry = new THREE.BoxGeometry(2, 3, 0.5);
        const verticalTail = new THREE.Mesh(verticalTailGeometry, wingMaterial);
        verticalTail.position.set(0, 1.5, 0);
        verticalTail.castShadow = true;
        this.rudderGroup.add(verticalTail);
        
        // Add a movable rudder part to make rotation more visible
        const rudderGeometry = new THREE.BoxGeometry(1.2, 2.5, 0.2);
        const rudderMaterial = new THREE.MeshPhongMaterial({ color: 0xff3333 }); // Bright red for visibility
        const rudder = new THREE.Mesh(rudderGeometry, rudderMaterial);
        rudder.position.set(-0.8, 1.5, 0);
        rudder.castShadow = true;
        this.rudderGroup.add(rudder);
        
        this.rudderGroup.position.x = -5;
        this.airplane.add(this.rudderGroup);
        
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
        
        const frontWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        frontWheel.position.set(5, -1, 0);
        frontWheel.rotation.z = Math.PI / 2;
        frontWheel.castShadow = true;
        this.airplane.add(frontWheel);
        
        const leftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        leftWheel.position.set(-2, -1, 2);
        leftWheel.rotation.z = Math.PI / 2;
        leftWheel.castShadow = true;
        this.airplane.add(leftWheel);
        
        const rightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        rightWheel.position.set(-2, -1, -2);
        rightWheel.rotation.z = Math.PI / 2;
        rightWheel.castShadow = true;
        this.airplane.add(rightWheel);
        
        const engineGeometry = new THREE.CylinderGeometry(0.4, 0.6, 3, 12);
        const engineMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        this.engine = new THREE.Mesh(engineGeometry, engineMaterial);
        this.engine.rotation.z = Math.PI / 2;
        this.engine.position.x = -5.5;
        this.airplane.add(this.engine);
        
        const afterburnerGeometry = new THREE.ConeGeometry(0.3, 1.5, 8);
        const afterburnerMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xff3300, 
            transparent: true, 
            opacity: 0 
        });
        this.afterburner = new THREE.Mesh(afterburnerGeometry, afterburnerMaterial);
        this.afterburner.rotation.z = -Math.PI / 2;
        this.afterburner.position.x = -7.5;
        this.airplane.add(this.afterburner);
        
        // Position airplane at the start of runway
        this.airplane.position.set(-350, 2, 0);
        this.scene.add(this.airplane);
    }
    
    createEnvironment() {
        // 大幅扩大地图尺寸！！
        const groundGeometry = new THREE.PlaneGeometry(10000, 10000);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // 大幅加长跑道！！(长度从1200增加到2500)
        const runwayGeometry = new THREE.PlaneGeometry(2500, 80);
        const runwayMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
        runway.rotation.x = -Math.PI / 2;
        runway.position.y = 0.1;
        runway.receiveShadow = true;
        this.scene.add(runway);
        
        // Add three red takeoff lines perpendicular to airplane (vertical to runway)
        const takeoffLineMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        for (let i = 0; i < 3; i++) {
            const takeoffLineGeometry = new THREE.PlaneGeometry(1.5, 40); // 加宽至匹配跑道宽度
            const takeoffLine = new THREE.Mesh(takeoffLineGeometry, takeoffLineMaterial);
            takeoffLine.rotation.x = -Math.PI / 2;
            takeoffLine.rotation.z = Math.PI / 2; // Rotate 90 degrees to be perpendicular to airplane
            takeoffLine.position.set(-370 + i * 2, 0.16, 0); // Three lines spaced 2 units apart
            this.scene.add(takeoffLine);
        }
        
        // 更多跑道标记适应加长跑道
        for (let i = 0; i < 40; i++) { // 增加标记数量
            const markingGeometry = new THREE.PlaneGeometry(25, 3);
            const markingMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            marking.rotation.x = -Math.PI / 2;
            marking.position.set(i * 60 - 1200, 0.15, 0); // 调整间距和起始位置
            this.scene.add(marking);
        }
        
        // 添加斑马线（在起飞点附近）
        this.createZebraCrossing();
        
        // 移除两侧广告牌
        // this.createBillboards();
        
        // 添加跑道边灯
        this.createRunwayLights();
        
        // 移除方向指示标志和柱子
        // this.createDirectionSigns();
        
        // 完全移除飞机周围的广告牌和柱子
        // this.createMainAdvertisementBoard();
        
        // 完全移除所有建筑物
        // this.createSimplifiedAirportBuildings();
        
        // 移除所有树木
        // for (let i = 0; i < 80; i++) { ... }
        
        // Create more colorful buildings (完全避开起飞区域，只在远距离生成)
        for (let i = 0; i < 60; i++) {
            const buildingWidth = this.rng() * 40 + 20;
            const buildingHeight = this.rng() * 150 + 50;
            const buildingDepth = this.rng() * 40 + 20;
            
            const buildingGeometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
            // More vibrant and varied colors
            const hue = this.rng(); // Full hue range
            const saturation = this.rng() * 0.6 + 0.4; // Higher saturation
            const lightness = this.rng() * 0.3 + 0.4; // Good brightness range
            const buildingMaterial = new THREE.MeshLambertMaterial({ 
                color: new THREE.Color().setHSL(hue, saturation, lightness) 
            });
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            
            let x;
            let z;
            do {
                const angle = this.rng() * Math.PI * 2;
                const distance = this.rng() * 1500 + 800; // 大幅增加最小距离
                x = Math.cos(angle) * distance;
                z = Math.sin(angle) * distance;
                // 确保建筑物完全远离起飞区域 (x: -800 to 800, z: -200 to 200)
            } while (x > -800 && x < 800 && z > -200 && z < 200);
            
            building.position.set(x, buildingHeight / 2, z);
            building.castShadow = true;
            this.scene.add(building);
        }
        
        // 添加更多有趣的元素
        this.createAdditionalElements();
        
        // 创建城市中央湖泊
        this.createCentralLake();
        
        // 移除所有热气球
        // for (let i = 0; i < 12; i++) { ... }
        
        // 移除原有的小横幅，替换为右前方的大型广告牌
        this.createRightFrontBillboard();
        
        // 添加右前方的悬浮挂牌（去掉热气球）
        this.createFloatingBanner();
        
        // 移除所有云朵
        // for (let i = 0; i < 120; i++) { ... }
    }
    
    createZebraCrossing() {
        // 在起飞点前方创建斑马线（横跨跑道）
        const zebraStripeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const numStripes = 8; // 斑马线条数
        const stripeWidth = 3;
        const stripeLength = 75; // 更新为加宽跑道的宽度，留出边距
        
        for (let i = 0; i < numStripes; i++) {
            const stripeGeometry = new THREE.PlaneGeometry(stripeWidth, stripeLength);
            const stripe = new THREE.Mesh(stripeGeometry, zebraStripeMaterial);
            stripe.rotation.x = -Math.PI / 2;
            // 在起飞点前方约30单位处，每隔6单位放置一条斑马线
            stripe.position.set(-380 + i * 6, 0.17, 0);
            this.scene.add(stripe);
        }
    }
    
    createBillboards() {
        // 简化广告牌布局，主要突出右前方的大广告牌
        // 只在远处添加少量小型广告牌作为背景装饰
        const billboardData = [
            { text: 'ATLANTIC', subtext: 'RECORDS.COM', color: '#ff0000', bgColor: '#ffffff' },
        ];
        
        // 在较远的左侧添加一个小广告牌
        this.createSingleBillboard(billboardData[0], -450, 15, 90, Math.PI);
    }
    
    createSingleBillboard(data, x, y, z, rotationY) {
        // 支撑柱
        const poleGeometry = new THREE.CylinderGeometry(0.5, 0.5, 25, 8);
        const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(x, 12.5, z);
        pole.castShadow = true;
        this.scene.add(pole);
        
        // 创建广告牌画布
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        
        // 背景
        context.fillStyle = data.bgColor;
        context.fillRect(0, 0, 512, 256);
        
        // 边框
        context.strokeStyle = '#333333';
        context.lineWidth = 8;
        context.strokeRect(4, 4, 504, 248);
        
        // 主文字
        context.fillStyle = data.color;
        context.font = 'bold 60px Arial';
        context.textAlign = 'center';
        context.fillText(data.text, 256, 100);
        
        // 副文字
        context.font = '36px Arial';
        context.fillText(data.subtext, 256, 160);
        
        // 装饰元素
        context.fillStyle = data.color;
        context.beginPath();
        context.arc(80, 200, 15, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(432, 200, 15, 0, Math.PI * 2);
        context.fill();
        
        const billboardTexture = new THREE.CanvasTexture(canvas);
        const billboardGeometry = new THREE.PlaneGeometry(20, 10);
        const billboardMaterial = new THREE.MeshLambertMaterial({ 
            map: billboardTexture,
            transparent: true
        });
        
        const billboard = new THREE.Mesh(billboardGeometry, billboardMaterial);
        billboard.position.set(x, y, z);
        billboard.rotation.y = rotationY;
        billboard.castShadow = true;
        this.scene.add(billboard);
    }
    
    createRunwayLights() {
        // 跑道边灯 - 沿着跑道两侧放置
        const lightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffff00,
            emissive: 0x333300
        });
        
        // 大幅增加跑道边灯数量，覆盖整个加长跑道
        for (let i = 0; i < 80; i++) { // 大幅增加边灯数量
            // 左侧边灯
            const leftLightGeometry = new THREE.SphereGeometry(0.8, 8, 6);
            const leftLight = new THREE.Mesh(leftLightGeometry, lightMaterial);
            leftLight.position.set(-1200 + i * 30, 1.5, 42); // 覆盖整个跑道长度
            this.scene.add(leftLight);
            
            // 右侧边灯
            const rightLightGeometry = new THREE.SphereGeometry(0.8, 8, 6);
            const rightLight = new THREE.Mesh(rightLightGeometry, lightMaterial);
            rightLight.position.set(-1200 + i * 30, 1.5, -42);
            this.scene.add(rightLight);
        }
        
        // 起飞点特殊标志灯（绿色）
        const startLightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x00ff00,
            emissive: 0x003300
        });
        
        for (let i = 0; i < 3; i++) {
            const startLight = new THREE.Mesh(
                new THREE.SphereGeometry(1.2, 8, 6), 
                startLightMaterial
            );
            startLight.position.set(-375 + i * 2, 2, 0);
            this.scene.add(startLight);
        }
    }
    
    createDirectionSigns() {
        // 创建箭头指示牌
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        
        // 白色背景
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 256, 128);
        
        // 黑色边框
        context.strokeStyle = '#000000';
        context.lineWidth = 4;
        context.strokeRect(2, 2, 252, 124);
        
        // 绘制箭头（指向右侧，表示起飞方向）
        context.fillStyle = '#000000';
        context.beginPath();
        context.moveTo(60, 64);
        context.lineTo(160, 30);
        context.lineTo(160, 50);
        context.lineTo(210, 50);
        context.lineTo(210, 78);
        context.lineTo(160, 78);
        context.lineTo(160, 98);
        context.closePath();
        context.fill();
        
        // 添加文字
        context.font = 'bold 16px Arial';
        context.textAlign = 'center';
        context.fillText('TAKEOFF', 128, 110);
        
        const signTexture = new THREE.CanvasTexture(canvas);
        const signGeometry = new THREE.PlaneGeometry(8, 4);
        const signMaterial = new THREE.MeshLambertMaterial({ 
            map: signTexture,
            transparent: true
        });
        
        // 放置多个方向指示牌
        const positions = [
            { x: -390, y: 8, z: 30, rotation: -Math.PI/4 },
            { x: -390, y: 8, z: -30, rotation: Math.PI/4 },
            { x: -360, y: 6, z: 25, rotation: 0 },
            { x: -360, y: 6, z: -25, rotation: 0 }
        ];
        
        for (const pos of positions) {
            const sign = new THREE.Mesh(signGeometry, signMaterial.clone());
            sign.position.set(pos.x, pos.y, pos.z);
            sign.rotation.y = pos.rotation;
            sign.castShadow = true;
            this.scene.add(sign);
            
            // 为每个指示牌添加支撑杆
            const poleGeometry = new THREE.CylinderGeometry(0.3, 0.3, pos.y * 2, 8);
            const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
            const pole = new THREE.Mesh(poleGeometry, poleMaterial);
            pole.position.set(pos.x, pos.y / 2, pos.z);
            pole.castShadow = true;
            this.scene.add(pole);
        }
    }
    
    createMainAdvertisementBoard() {
        // 创建参考图片样式的蓝色广告牌 - 完全按照图片样式
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        
        // 蓝色背景 - 参考图片中的蓝色调
        context.fillStyle = '#4A90E2';
        context.fillRect(0, 0, 512, 256);
        
        // 深蓝色边框
        context.strokeStyle = '#2E5E8F';
        context.lineWidth = 6;
        context.strokeRect(3, 3, 506, 250);
        
        // 主标题 - 黑色文字，更大字体
        context.fillStyle = '#000000';
        context.font = 'bold 88px Arial';
        context.textAlign = 'center';
        context.fillText('Qfal', 256, 140);
        
        // 副标题 - 稍小的黑色文字
        context.fillStyle = '#000000';
        context.font = '32px Arial';
        context.fillText('Airlines', 256, 190);
        
        const boardTexture = new THREE.CanvasTexture(canvas);
        const boardGeometry = new THREE.PlaneGeometry(35, 18); // 增大尺寸使其更突出
        const boardMaterial = new THREE.MeshLambertMaterial({ 
            map: boardTexture,
            transparent: true
        });
        
        const mainBoard = new THREE.Mesh(boardGeometry, boardMaterial);
        // 调整位置到飞机右前方，更符合图片
        mainBoard.position.set(-300, 25, -50); // 稍微远一点，更高一点
        mainBoard.rotation.y = Math.PI / 6; // 稍微朝向飞机
        mainBoard.castShadow = true;
        this.scene.add(mainBoard);
        
        // 支撑结构 - 双柱设计
        const mainPoleGeometry = new THREE.CylinderGeometry(1.2, 1.2, 35, 8);
        const mainPoleMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const mainPole1 = new THREE.Mesh(mainPoleGeometry, mainPoleMaterial);
        mainPole1.position.set(-300, 17.5, -45);
        mainPole1.castShadow = true;
        this.scene.add(mainPole1);
        
        const mainPole2 = new THREE.Mesh(mainPoleGeometry, mainPoleMaterial);
        mainPole2.position.set(-300, 17.5, -55);
        mainPole2.castShadow = true;
        this.scene.add(mainPole2);
    }
    
    createSimplifiedAirportBuildings() {
        // 简化的机场建筑，移除左侧绿色和右侧深红色建筑
        const airportBuildings = [
            // 只保留远处的中性色建筑
            { x: -150, z: 200, width: 80, height: 30, depth: 50, color: 0xE8E8E8 },
            { x: -100, z: -200, width: 70, height: 25, depth: 45, color: 0xF0F0F0 },
            { x: -500, z: 150, width: 60, height: 20, depth: 40, color: 0xDDDDDD }
        ];
        
        for (const building of airportBuildings) {
            const buildingGeometry = new THREE.BoxGeometry(building.width, building.height, building.depth);
            const buildingMaterial = new THREE.MeshLambertMaterial({ color: building.color });
            const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
            
            buildingMesh.position.set(building.x, building.height / 2, building.z);
            buildingMesh.castShadow = true;
            buildingMesh.receiveShadow = true;
            this.scene.add(buildingMesh);
        }
        
        // 保留控制塔，但位置调整到更远处
        const towerGeometry = new THREE.CylinderGeometry(8, 10, 60, 8);
        const towerMaterial = new THREE.MeshLambertMaterial({ color: 0xF0F0F0 });
        const tower = new THREE.Mesh(towerGeometry, towerMaterial);
        tower.position.set(-200, 30, 250); // 调整到更远的位置
        tower.castShadow = true;
        this.scene.add(tower);
        
        // 控制塔顶部
        const towerTopGeometry = new THREE.CylinderGeometry(12, 8, 15, 8);
        const towerTopMaterial = new THREE.MeshLambertMaterial({ color: 0x4A4A4A });
        const towerTop = new THREE.Mesh(towerTopGeometry, towerTopMaterial);
        towerTop.position.set(-200, 67.5, 250);
        towerTop.castShadow = true;
        this.scene.add(towerTop);
    }
    
    createAdditionalElements() {
        // 1. 添加风车
        for (let i = 0; i < 8; i++) {
            const windmillHeight = 60;
            const poleGeometry = new THREE.CylinderGeometry(1, 1.5, windmillHeight, 8);
            const poleMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
            const pole = new THREE.Mesh(poleGeometry, poleMaterial);
            
            let x;
            let z;
            do {
                x = this.rng() * 1500 - 750;
                z = this.rng() * 1500 - 750;
            } while (x > -600 && x < 600 && z > -60 && z < 60);
            
            pole.position.set(x, windmillHeight / 2, z);
            pole.castShadow = true;
            this.scene.add(pole);
            
            // 风车叶片
            const bladeGroup = new THREE.Group();
            for (let j = 0; j < 3; j++) {
                const bladeGeometry = new THREE.BoxGeometry(0.5, 25, 2);
                const bladeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
                const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
                blade.position.y = 12;
                blade.rotation.z = (j * Math.PI * 2) / 3;
                bladeGroup.add(blade);
            }
            bladeGroup.position.set(x, windmillHeight, z);
            this.scene.add(bladeGroup);
        }
        
        // 2. 添加摩天轮
        const ferrisWheelRadius = 40;
        const ferrisWheelGeometry = new THREE.TorusGeometry(ferrisWheelRadius, 2, 8, 16);
        const ferrisWheelMaterial = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
        const ferrisWheel = new THREE.Mesh(ferrisWheelGeometry, ferrisWheelMaterial);
        ferrisWheel.position.set(200, ferrisWheelRadius + 5, 200);
        ferrisWheel.rotation.x = Math.PI / 2;
        ferrisWheel.castShadow = true;
        this.scene.add(ferrisWheel);
        
        // 摩天轮支撑
        const supportGeometry = new THREE.CylinderGeometry(3, 3, ferrisWheelRadius + 5, 8);
        const supportMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const support = new THREE.Mesh(supportGeometry, supportMaterial);
        support.position.set(200, (ferrisWheelRadius + 5) / 2, 200);
        support.castShadow = true;
        this.scene.add(support);
        
        // 3. 添加灯塔
        const lighthouseHeight = 80;
        const lighthouseGeometry = new THREE.ConeGeometry(8, lighthouseHeight, 8);
        const lighthouseMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff,
            map: this.createStripedTexture()
        });
        const lighthouse = new THREE.Mesh(lighthouseGeometry, lighthouseMaterial);
        lighthouse.position.set(-300, lighthouseHeight / 2, 300);
        lighthouse.castShadow = true;
        this.scene.add(lighthouse);
        
        // 灯塔顶部灯光
        const lightGeometry = new THREE.SphereGeometry(5, 8, 6);
        const lightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffff00,
            emissive: 0x444400
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.set(-300, lighthouseHeight + 5, 300);
        this.scene.add(light);
        
        // 4. 添加体育场
        const stadiumGeometry = new THREE.CylinderGeometry(60, 65, 30, 16);
        const stadiumMaterial = new THREE.MeshLambertMaterial({ color: 0x4ecdc4 });
        const stadium = new THREE.Mesh(stadiumGeometry, stadiumMaterial);
        stadium.position.set(-400, 15, -400);
        stadium.castShadow = true;
        this.scene.add(stadium);
        
        // 5. 添加桥梁
        const bridgeGeometry = new THREE.BoxGeometry(200, 5, 20);
        const bridgeMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);
        bridge.position.set(0, 10, 150);
        bridge.castShadow = true;
        this.scene.add(bridge);
        
        // 桥墩
        for (let i = 0; i < 5; i++) {
            const pillarGeometry = new THREE.CylinderGeometry(3, 3, 20, 8);
            const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(-80 + i * 40, 10, 150);
            pillar.castShadow = true;
            this.scene.add(pillar);
        }
        
        // 6. 添加火箭发射台
        const rocketGeometry = new THREE.CylinderGeometry(3, 3, 50, 8);
        const rocketMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const rocket = new THREE.Mesh(rocketGeometry, rocketMaterial);
        rocket.position.set(400, 25, -300);
        rocket.castShadow = true;
        this.scene.add(rocket);
        
        // 火箭尖端
        const noseGeometry = new THREE.ConeGeometry(3, 15, 8);
        const noseMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const nose = new THREE.Mesh(noseGeometry, noseMaterial);
        nose.position.set(400, 57.5, -300);
        this.scene.add(nose);
        
        // 发射台
        const platformGeometry = new THREE.CylinderGeometry(20, 20, 5, 16);
        const platformMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.position.set(400, 2.5, -300);
        platform.castShadow = true;
        this.scene.add(platform);
    }
    
    createStripedTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        
        // 创建红白条纹
        for (let i = 0; i < 8; i++) {
            context.fillStyle = i % 2 === 0 ? '#ffffff' : '#ff0000';
            context.fillRect(0, i * 8, 64, 8);
        }
        
        return new THREE.CanvasTexture(canvas);
    }
    
    createCentralLake() {
        // 湖泊位置和尺寸
        const lakeX = 1000; // 远离跑道的城市中心
        const lakeZ = 300;
        const lakeRadius = 200;
        
        // 创建反射渲染目标
        this.reflectionCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.reflectionRenderTarget = new THREE.WebGLRenderTarget(512, 512, {
            format: THREE.RGBFormat,
            generateMipmaps: false,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter
        });
        
        // 创建折射渲染目标
        this.refractionCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.refractionRenderTarget = new THREE.WebGLRenderTarget(512, 512, {
            format: THREE.RGBFormat,
            generateMipmaps: false,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter
        });
        
        // 创建水面法线贴图
        const normalMap = this.createWaterNormalMap();
        
        // 创建高级水面着色器材质
        const waterMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                reflectionTexture: { value: this.reflectionRenderTarget.texture },
                refractionTexture: { value: this.refractionRenderTarget.texture },
                normalMap: { value: normalMap },
                waterColor: { value: new THREE.Color(0x006994) },
                fresnelPower: { value: 2.0 },
                waveStrength: { value: 0.15 },
                waveSpeed: { value: 0.8 },
                waveScale: { value: 0.02 },
                reflection: { value: 0.7 },
                refraction: { value: 0.3 }
            },
            vertexShader: `
                uniform float time;
                uniform float waveStrength;
                uniform float waveSpeed;
                uniform float waveScale;
                
                varying vec2 vUv;
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                varying vec3 vNormal;
                varying vec4 vReflectionCoord;
                varying vec4 vRefractionCoord;
                
                // FFT-inspired wave function with multiple frequency components
                float wave(vec2 position, float frequency, float amplitude, float speed, float direction) {
                    vec2 dir = vec2(cos(direction), sin(direction));
                    float phase = dot(position, dir) * frequency + time * speed;
                    return sin(phase) * amplitude;
                }
                
                // Multiple wave superposition for realistic water movement
                float getWaveHeight(vec2 pos) {
                    float height = 0.0;
                    
                    // Primary waves - larger, slower
                    height += wave(pos, 0.8, 0.6, 1.2, 0.0);
                    height += wave(pos, 0.9, 0.4, 1.0, 1.57);
                    
                    // Secondary waves - medium frequency
                    height += wave(pos, 1.5, 0.3, 1.8, 0.78);
                    height += wave(pos, 1.8, 0.25, 1.5, 2.35);
                    
                    // High frequency ripples
                    height += wave(pos, 3.2, 0.15, 2.5, 1.2);
                    height += wave(pos, 4.1, 0.1, 3.0, 0.5);
                    height += wave(pos, 5.5, 0.08, 3.8, 2.8);
                    
                    return height * waveStrength;
                }
                
                // Calculate normal from wave height field
                vec3 getWaveNormal(vec2 pos) {
                    float epsilon = waveScale;
                    float heightL = getWaveHeight(pos - vec2(epsilon, 0.0));
                    float heightR = getWaveHeight(pos + vec2(epsilon, 0.0));
                    float heightD = getWaveHeight(pos - vec2(0.0, epsilon));
                    float heightU = getWaveHeight(pos + vec2(0.0, epsilon));
                    
                    vec3 normal = normalize(vec3(
                        (heightL - heightR) / (2.0 * epsilon),
                        1.0,
                        (heightD - heightU) / (2.0 * epsilon)
                    ));
                    
                    return normal;
                }
                
                void main() {
                    vUv = uv;
                    
                    // Calculate world position with wave displacement
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vec2 wavePos = worldPosition.xz * waveScale;
                    
                    // Apply wave height displacement
                    float waveHeight = getWaveHeight(wavePos);
                    worldPosition.y += waveHeight;
                    vWorldPosition = worldPosition.xyz;
                    
                    // Calculate wave normal
                    vNormal = getWaveNormal(wavePos);
                    vNormal = normalize((modelMatrix * vec4(vNormal, 0.0)).xyz);
                    
                    // View position for fresnel calculation
                    vec4 mvPosition = viewMatrix * worldPosition;
                    vViewPosition = mvPosition.xyz;
                    
                    // Reflection coordinates
                    vec4 reflectionPosition = worldPosition;
                    reflectionPosition.y = -reflectionPosition.y;
                    vReflectionCoord = projectionMatrix * viewMatrix * reflectionPosition;
                    
                    // Refraction coordinates
                    vRefractionCoord = projectionMatrix * mvPosition;
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform sampler2D reflectionTexture;
                uniform sampler2D refractionTexture;
                uniform sampler2D normalMap;
                uniform vec3 waterColor;
                uniform float fresnelPower;
                uniform float reflection;
                uniform float refraction;
                
                varying vec2 vUv;
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                varying vec3 vNormal;
                varying vec4 vReflectionCoord;
                varying vec4 vRefractionCoord;
                
                void main() {
                    // Normalized device coordinates for texture sampling
                    vec2 reflectionUV = (vReflectionCoord.xy / vReflectionCoord.w + 1.0) * 0.5;
                    vec2 refractionUV = (vRefractionCoord.xy / vRefractionCoord.w + 1.0) * 0.5;
                    
                    // Dynamic normal map sampling with time animation
                    vec2 normalUV1 = vUv * 4.0 + time * 0.05;
                    vec2 normalUV2 = vUv * 6.0 - time * 0.08;
                    vec3 normal1 = texture2D(normalMap, normalUV1).rgb * 2.0 - 1.0;
                    vec3 normal2 = texture2D(normalMap, normalUV2).rgb * 2.0 - 1.0;
                    vec3 perturbedNormal = normalize(vNormal + (normal1 + normal2) * 0.1);
                    
                    // Apply normal perturbation to UV coordinates
                    vec2 distortion = perturbedNormal.xz * 0.02;
                    reflectionUV += distortion;
                    refractionUV += distortion;
                    
                    // Clamp UV coordinates to prevent artifacts
                    reflectionUV = clamp(reflectionUV, 0.0, 1.0);
                    refractionUV = clamp(refractionUV, 0.0, 1.0);
                    
                    // Sample reflection and refraction textures
                    vec3 reflectionColor = texture2D(reflectionTexture, reflectionUV).rgb;
                    vec3 refractionColor = texture2D(refractionTexture, refractionUV).rgb;
                    
                    // Calculate fresnel effect
                    vec3 viewDirection = normalize(vViewPosition);
                    float fresnel = pow(1.0 - max(dot(-viewDirection, perturbedNormal), 0.0), fresnelPower);
                    
                    // Mix reflection and refraction based on fresnel
                    vec3 waterSurface = mix(refractionColor, reflectionColor, fresnel * reflection);
                    
                    // Add water color tint
                    waterSurface = mix(waterSurface, waterColor, 0.3);
                    
                    // Add subtle shimmer effect
                    float shimmer = sin(time * 3.0 + vWorldPosition.x * 0.01 + vWorldPosition.z * 0.01) * 0.1 + 0.9;
                    waterSurface *= shimmer;
                    
                    gl_FragColor = vec4(waterSurface, 0.9);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // 创建圆形湖泊几何体
        const lakeGeometry = new THREE.CircleGeometry(lakeRadius, 64);
        const lake = new THREE.Mesh(lakeGeometry, waterMaterial);
        lake.rotation.x = -Math.PI / 2;
        lake.position.set(lakeX, 0.5, lakeZ);
        lake.name = 'lake'; // 标记为湖泊以便在反射时排除
        this.scene.add(lake);
        
        // 保存引用用于动画更新
        this.lake = lake;
        this.waterMaterial = waterMaterial;
        
        // 创建湖泊周围的装饰
        this.createLakeDecorations(lakeX, lakeZ, lakeRadius);
    }
    
    createRightFrontBillboard() {
        // 飞机初始位置：(-350, 2, 0)
        // 飞机面向正X方向（+X是前方）
        // 跑道宽度：80米，所以跑道范围是Z: -40 到 +40
        // 左前方70米且在跑道外的位置计算：
        // X坐标：-350 + 70 = -280 (前方70米)
        // Z坐标：0 + 60 = +60 (左侧60米，确保在跑道外，因为Z轴正方向是飞机的左侧)
        
        const billboardX = -280;
        const billboardZ = 60; // 调整到跑道外左侧
        
        // 创建文字纹理
        const canvas = document.createElement('canvas');
        canvas.width = 1024; // 增大画布以获得更清晰的文字
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // 深青绿色背景 - 使用更饱和的颜色
        context.fillStyle = '#03665A';
        context.fillRect(0, 0, 1024, 512);
        
        // 添加细微的边框以突出背景
        context.strokeStyle = '#025a4f';
        context.lineWidth = 6;
        context.strokeRect(3, 3, 1018, 506);
        
        // 设置文字样式 - 纯白色字体确保在深色背景上清晰
        context.fillStyle = '#ffffff'; // 纯白色文字
        context.font = 'bold 140px SimHei, "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // 添加文字阴影效果增强可读性
        context.shadowColor = 'rgba(0,0,0,0.5)';
        context.shadowBlur = 6;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;
        
        // 绘制"生财有术"文字
        context.fillText('生财有术', 512, 256);
        
        // 创建纹理
        const textTexture = new THREE.CanvasTexture(canvas);
        textTexture.generateMipmaps = false;
        textTexture.minFilter = THREE.LinearFilter;
        textTexture.magFilter = THREE.LinearFilter;
        
        // 创建广告牌几何体 - 足够大的矩形面片
        const billboardGeometry = new THREE.PlaneGeometry(30, 15); // 30米宽，15米高
        
        // 创建深青绿色材质并应用文字纹理 - 使用不受光照影响的材质
        const billboardMaterial = new THREE.MeshBasicMaterial({ 
            map: textTexture,
            transparent: false, // 关闭透明度确保背景显示
            side: THREE.DoubleSide, // 双面显示确保从各个角度都能看到
            color: 0xffffff // 保持白色以不影响纹理颜色
        });
        
        // 创建广告牌网格
        const billboard = new THREE.Mesh(billboardGeometry, billboardMaterial);
        
        // 设置位置 - 下缘与地面齐平
        billboard.position.set(billboardX, 7.5, billboardZ); // Y = 15/2 = 7.5，使下缘贴地
        
        // 让广告牌朝向飞机初始位置
        billboard.lookAt(-350, 7.5, 0);
        
        // 投射阴影
        billboard.castShadow = true;
        billboard.receiveShadow = true;
        
        // 添加到场景
        this.scene.add(billboard);
        
        console.log(`广告牌已创建在位置: (${billboardX}, 7.5, ${billboardZ}) - 飞机左前方，跑道外`);
    }
    
    createFloatingBanner() {
        // 飞机初始位置：(-350, 2, 0)
        // 飞机面向正X方向（+X是前方）
        // 右前方70米位置计算：
        // X坐标：-350 + 70 = -280 (前方70米)
        // Z坐标：0 - 60 = -60 (右侧60米，因为Z轴负方向是飞机的右侧)
        
        const bannerX = -280;
        const bannerZ = -60;
        const bannerHeight = 12; // 悬浮挂牌高度 - 降低到更合适的高度
        
        // 创建悬浮挂牌组
        const bannerGroup = new THREE.Group();
        
        // 直接创建悬浮的挂牌，不需要气球
        this.createFloatingBannerContent(bannerGroup, bannerHeight, bannerX);
        
        // 设置挂牌组的位置
        bannerGroup.position.set(bannerX, 0, bannerZ);
        
        // 添加轻微的悬浮动画
        this.bannerGroup = bannerGroup;
        this.bannerSwayTime = 0;
        
        // 添加到场景
        this.scene.add(bannerGroup);
        
        console.log(`悬浮Cursor挂牌已创建在位置: (${bannerX}, ${bannerHeight}, ${bannerZ}) - 飞机右前方，跑道外`);
    }
    
    createFloatingBannerContent(bannerGroup, bannerHeight, bannerX) {
        // 使用THREE.TextureLoader直接加载image.png文件
        const textureLoader = new THREE.TextureLoader();
        
        textureLoader.load(
            './image.png', // 加载当前目录下的 image.png
            (bannerTexture) => {
                // 纹理加载成功
                bannerTexture.generateMipmaps = false;
                bannerTexture.minFilter = THREE.LinearFilter;
                bannerTexture.magFilter = THREE.LinearFilter;
                
                // 创建横幅几何体 - 根据image.png的实际比例调整
                // 假设image.png是横向的，创建合适比例的横幅
                const bannerGeometry = new THREE.PlaneGeometry(16, 6); // 16米宽，6米高，适合挂牌显示
                
                // 创建横幅材质
                const bannerMaterial = new THREE.MeshBasicMaterial({ 
                    map: bannerTexture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    opacity: 1.0 // 完全不透明，确保图片清晰
                });
                
                // 创建悬浮挂牌网格
                const banner = new THREE.Mesh(bannerGeometry, bannerMaterial);
                banner.position.set(0, bannerHeight, 0); // 直接悬浮在设定高度
                
                // 让挂牌朝向飞机方向以便观看
                banner.lookAt(bannerX, bannerHeight, 0);
                
                // 添加到挂牌组
                bannerGroup.add(banner);
                
                console.log('image.png 已成功加载并显示在悬浮挂牌上！');
            },
            (progress) => {
                // 加载进度
                console.log(`正在加载横幅图片 image.png... ${Math.round((progress.loaded / progress.total * 100))}%`);
            },
            (error) => {
                // 加载失败，创建备用横幅
                console.error('无法加载 image.png 用于横幅:', error);
                console.log('创建备用横幅显示...');
                this.createFallbackBanner(bannerGroup, bannerHeight, bannerX);
            }
        );
    }
    
    createFallbackBanner(bannerGroup, bannerHeight, bannerX) {
        // 备用方案：如果image.png加载失败，创建错误提示挂牌
        const bannerCanvas = document.createElement('canvas');
        bannerCanvas.width = 800;
        bannerCanvas.height = 300;
        const bannerContext = bannerCanvas.getContext('2d');
        
        // 白色背景
        bannerContext.fillStyle = '#ffffff';
        bannerContext.fillRect(0, 0, 800, 300);
        
        // 红色边框
        bannerContext.strokeStyle = '#ff0000';
        bannerContext.lineWidth = 8;
        bannerContext.strokeRect(4, 4, 792, 292);
        
        // 错误信息文字
        bannerContext.fillStyle = '#ff0000';
        bannerContext.font = 'bold 60px Arial, sans-serif';
        bannerContext.textAlign = 'center';
        bannerContext.fillText('IMAGE.PNG', 400, 120);
        bannerContext.fillText('NOT FOUND', 400, 200);
        
        bannerContext.fillStyle = '#666666';
        bannerContext.font = '30px Arial, sans-serif';
        bannerContext.fillText('请检查文件是否存在', 400, 250);
        
        // 创建备用横幅纹理
        const bannerTexture = new THREE.CanvasTexture(bannerCanvas);
        bannerTexture.generateMipmaps = false;
        bannerTexture.minFilter = THREE.LinearFilter;
        bannerTexture.magFilter = THREE.LinearFilter;
        
        // 创建横幅
        const bannerGeometry = new THREE.PlaneGeometry(16, 6);
        const bannerMaterial = new THREE.MeshBasicMaterial({ 
            map: bannerTexture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const banner = new THREE.Mesh(bannerGeometry, bannerMaterial);
        banner.position.set(0, bannerHeight, 0); // 直接悬浮在设定高度
        banner.lookAt(bannerX, bannerHeight, 0);
        
        bannerGroup.add(banner);
        
        console.log('备用悬浮挂牌已创建，显示错误信息');
    }
    
    addDecalToBalloon(balloon, balloonGroup, balloonHeight) {
        // 直接加载 image.png 文件作为贴花纹理
        const textureLoader = new THREE.TextureLoader();
        
        // 加载实际的 image.png 文件
        textureLoader.load(
            './image.png', // 加载当前目录下的 image.png
            (decalTexture) => {
                // 纹理加载成功
                decalTexture.generateMipmaps = false;
                decalTexture.minFilter = THREE.LinearFilter;
                decalTexture.magFilter = THREE.LinearFilter;
                
                // 创建贴花材质
                this.createDecalMesh(decalTexture, balloon, balloonGroup, balloonHeight);
                
                console.log('image.png 已成功加载并应用到气球表面！');
            },
            (progress) => {
                // 加载进度
                console.log(`正在加载 image.png... ${(progress.loaded / progress.total * 100)}%`);
            },
            (error) => {
                // 加载失败，使用备用方案
                console.error('无法加载 image.png:', error);
                console.log('使用备用的canvas绘制方案...');
                this.createFallbackDecal(balloon, balloonGroup, balloonHeight);
            }
        );
    }
    
    createDecalMesh(decalTexture, balloon, balloonGroup, balloonHeight) {
        // 创建贴花材质 - 开启透明，关闭深度写入
        const decalMaterial = new THREE.MeshBasicMaterial({
            map: decalTexture,
            transparent: true,
            depthWrite: false, // 关闭深度写入
            depthTest: true,
            side: THREE.DoubleSide,
            opacity: 0.95
        });
        
        // 计算气球表面的正确位置
        const balloonRadius = 10; // 增加半径以适应椭圆形状
        
        // 计算朝向飞机的方向向量
        const balloonWorldPos = new THREE.Vector3(-280, balloonHeight, -60);
        const airplanePos = new THREE.Vector3(-350, 2, 0);
        const directionToPlane = new THREE.Vector3().subVectors(airplanePos, balloonWorldPos).normalize();
        
        // 在气球局部坐标系中，贴花位置应该在球面上朝向飞机的方向
        const decalLocalPosition = directionToPlane.clone().multiplyScalar(balloonRadius + 0.1);
        
        // 根据实际image.png的尺寸调整贴花大小
        // 假设是方形或横向矩形，调整为合适的尺寸
        const decalGeometry = new THREE.PlaneGeometry(12, 8); // 加大尺寸以确保清晰可见
        const decalMesh = new THREE.Mesh(decalGeometry, decalMaterial);
        
        // 设置贴花位置（相对于气球中心）
        decalMesh.position.copy(decalLocalPosition);
        
        // 让贴花朝向气球中心的反方向（即朝外）
        const balloonCenter = new THREE.Vector3(0, balloonHeight, 0);
        decalMesh.lookAt(balloonCenter.clone().add(directionToPlane.clone().multiplyScalar(100)));
        
        balloonGroup.add(decalMesh);
        
        console.log('image.png 贴花已成功添加到气球表面');
    }
    
    createFallbackDecal(balloon, balloonGroup, balloonHeight) {
        // 备用方案：创建贴花纹理 - 如果无法加载 image.png 则使用此方案
        const decalCanvas = document.createElement('canvas');
        decalCanvas.width = 256;
        decalCanvas.height = 256;
        const decalContext = decalCanvas.getContext('2d');
        
        // 透明背景
        decalContext.clearRect(0, 0, 256, 256);
        
        // 绘制简单的 "IMAGE.PNG" 文字提示
        decalContext.fillStyle = '#ffffff';
        decalContext.fillRect(20, 100, 216, 56);
        
        decalContext.fillStyle = '#ff0000';
        decalContext.font = 'bold 24px Arial, sans-serif';
        decalContext.textAlign = 'center';
        decalContext.fillText('IMAGE.PNG', 128, 130);
        decalContext.fillText('NOT FOUND', 128, 150);
        
        // 创建贴花纹理
        const decalTexture = new THREE.CanvasTexture(decalCanvas);
        decalTexture.generateMipmaps = false;
        decalTexture.minFilter = THREE.LinearFilter;
        decalTexture.magFilter = THREE.LinearFilter;
        
        // 使用备用纹理创建贴花
        this.createDecalMesh(decalTexture, balloon, balloonGroup, balloonHeight);
    }
    
    createWaterNormalMap() {
        // 创建程序化水面法线贴图
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(size, size);
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                
                // 生成波纹模式
                const fx = x / size * Math.PI * 8;
                const fy = y / size * Math.PI * 8;
                const wave1 = Math.sin(fx) * Math.cos(fy);
                const wave2 = Math.sin(fx * 1.5) * Math.cos(fy * 1.2);
                const height = (wave1 + wave2 * 0.5) * 0.5 + 0.5;
                
                // 转换为法线向量
                const dx = Math.cos(fx) * Math.cos(fy);
                const dy = Math.sin(fx) * (-Math.sin(fy));
                
                // 编码为RGB
                imageData.data[i] = (dx * 0.5 + 0.5) * 255;     // R: X component
                imageData.data[i + 1] = (dy * 0.5 + 0.5) * 255; // G: Y component  
                imageData.data[i + 2] = height * 255;            // B: Z component
                imageData.data[i + 3] = 255;                     // Alpha
            }
        }
        
        context.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }
    
    createLakeDecorations(lakeX, lakeZ, lakeRadius) {
        // 湖泊周围的装饰元素
        const decorationRadius = lakeRadius + 50;
        const numDecorations = 12;
        
        for (let i = 0; i < numDecorations; i++) {
            const angle = (i / numDecorations) * Math.PI * 2;
            const x = lakeX + Math.cos(angle) * decorationRadius;
            const z = lakeZ + Math.sin(angle) * decorationRadius;
            
            // 添加湖边树木
            if (i % 3 === 0) {
                const treeGeometry = new THREE.ConeGeometry(6, 25, 8);
                const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
                const tree = new THREE.Mesh(treeGeometry, treeMaterial);
                tree.position.set(x, 12.5, z);
                tree.castShadow = true;
                this.scene.add(tree);
            }
            
            // 添加湖边石头
            if (i % 4 === 1) {
                const rockGeometry = new THREE.DodecahedronGeometry(3 + this.rng() * 2);
                const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
                const rock = new THREE.Mesh(rockGeometry, rockMaterial);
                rock.position.set(x, 2, z);
                rock.rotation.set(this.rng() * Math.PI, this.rng() * Math.PI, this.rng() * Math.PI);
                rock.castShadow = true;
                this.scene.add(rock);
            }
            
            // 添加湖边小建筑
            if (i % 6 === 2) {
                const buildingGeometry = new THREE.BoxGeometry(8, 12, 8);
                const buildingMaterial = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
                const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
                building.position.set(x, 6, z);
                building.castShadow = true;
                this.scene.add(building);
                
                // 添加小屋顶
                const roofGeometry = new THREE.ConeGeometry(6, 4, 4);
                const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                const roof = new THREE.Mesh(roofGeometry, roofMaterial);
                roof.position.set(x, 14, z);
                roof.rotation.y = Math.PI / 4;
                this.scene.add(roof);
            }
        }
        
        // 在湖中心添加小岛
        const islandGeometry = new THREE.CylinderGeometry(15, 20, 3, 16);
        const islandMaterial = new THREE.MeshLambertMaterial({ color: 0x8FBC8F });
        const island = new THREE.Mesh(islandGeometry, islandMaterial);
        island.position.set(lakeX, 1, lakeZ);
        island.castShadow = true;
        this.scene.add(island);
        
        // 小岛上的装饰树
        const islandTreeGeometry = new THREE.ConeGeometry(4, 18, 8);
        const islandTreeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const islandTree = new THREE.Mesh(islandTreeGeometry, islandTreeMaterial);
        islandTree.position.set(lakeX, 12, lakeZ);
        islandTree.castShadow = true;
        this.scene.add(islandTree);
    }
    
    setupCamera() {
        // 初始化简单第三人称跟随摄像机 - 按照文档2.md要求
        // 不再需要复杂的三层跟随系统
    }
    
    setupControls() {
        document.addEventListener('keydown', (event) => {
            this.controls[event.code] = true;
        });
        
        document.addEventListener('keyup', (event) => {
            this.controls[event.code] = false;
        });
        
        // 设置移动端触摸控制器
        this.setupMobileControls();
    }
    
    setupMobileControls() {
        const leftJoystick = document.getElementById('leftJoystick');
        const rightJoystick = document.getElementById('rightJoystick');
        const leftKnob = document.getElementById('leftKnob');
        const rightKnob = document.getElementById('rightKnob');
        
        if (!leftJoystick || !rightJoystick) return;
        
        // 摇杆配置
        const joystickRadius = 40; // 摇杆可移动半径
        
        // 处理触摸事件的通用函数
        const handleTouch = (joystick, knob, controlKey, event) => {
            event.preventDefault();
            
            const rect = joystick.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const touch = event.touches ? event.touches[0] : event;
            if (event.type.includes('end') || event.type.includes('cancel')) {
                // 释放摇杆
                this.mobileControls[controlKey] = { x: 0, y: 0, active: false };
                knob.style.transform = 'translate(-50%, -50%)';
                return;
            }
            
            // 计算触摸相对于摇杆中心的位置
            const touchX = touch.clientX - rect.left - centerX;
            const touchY = touch.clientY - rect.top - centerY;
            
            // 计算距离和角度
            const distance = Math.sqrt(touchX * touchX + touchY * touchY);
            const angle = Math.atan2(touchY, touchX);
            
            // 限制在摇杆范围内
            const clampedDistance = Math.min(distance, joystickRadius);
            const clampedX = Math.cos(angle) * clampedDistance;
            const clampedY = Math.sin(angle) * clampedDistance;
            
            // 更新摇杆按钮位置
            knob.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
            
            // 更新控制状态 (-1 到 1 的范围)
            this.mobileControls[controlKey] = {
                x: clampedX / joystickRadius,
                y: -clampedY / joystickRadius, // Y轴反转，向上为正
                active: true
            };
        };
        
        // 左摇杆事件（飞行控制：俯仰和翻滚）
        ['touchstart', 'touchmove', 'mousedown', 'mousemove'].forEach(eventType => {
            leftJoystick.addEventListener(eventType, (event) => {
                if ((eventType.includes('mouse') && event.buttons === 1) || eventType.includes('touch')) {
                    handleTouch(leftJoystick, leftKnob, 'leftJoystick', event);
                }
            });
        });
        
        ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(eventType => {
            leftJoystick.addEventListener(eventType, (event) => {
                handleTouch(leftJoystick, leftKnob, 'leftJoystick', event);
            });
        });
        
        // 右摇杆事件（推力和转向）
        ['touchstart', 'touchmove', 'mousedown', 'mousemove'].forEach(eventType => {
            rightJoystick.addEventListener(eventType, (event) => {
                if ((eventType.includes('mouse') && event.buttons === 1) || eventType.includes('touch')) {
                    handleTouch(rightJoystick, rightKnob, 'rightJoystick', event);
                }
            });
        });
        
        ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(eventType => {
            rightJoystick.addEventListener(eventType, (event) => {
                handleTouch(rightJoystick, rightKnob, 'rightJoystick', event);
            });
        });
        
        // 禁用移动端滚动和缩放
        document.addEventListener('touchmove', (event) => {
            if (event.target.closest('.joystick')) {
                event.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('gesturestart', (event) => {
            event.preventDefault();
        });
        
        document.addEventListener('gesturechange', (event) => {
            event.preventDefault();
        });
        
        document.addEventListener('gestureend', (event) => {
            event.preventDefault();
        });
    }
    
    updatePhysics(deltaTime) {
        // === 第一步：检测飞行模式 ===
        this.updateFlightMode(deltaTime);
        
        // === 第二步：处理智能控制输入 ===
        this.processControlInputs(deltaTime);
        
        // === 第三步：应用物理和配平系统 ===
        this.applyPhysicsAndTrim(deltaTime);
        
        // === 第四步：更新相关系统 ===
        this.updateControlSurfaces();
        this.updateUI();
        this.updateCamera();
        
        if (this.peer && this.peer.open) {
            this.broadcastPosition();
        }
    }
    
    // 检测和更新飞行模式
    updateFlightMode(deltaTime) {
        const currentSpeed = this.velocity.length() * 3.6; // km/h
        const currentAltitude = this.airplane.position.y;
        
        // 根据2.md文档的模式切换逻辑
        this.previousMode = this.flightMode;
        
        if (currentSpeed < 40 && currentAltitude < 3) {
            this.flightMode = 'ground';
        } else if (currentSpeed >= 40 || currentAltitude >= 3) {
            this.flightMode = 'air';
        }
        
        // 平滑过渡处理
        if (this.previousMode !== this.flightMode) {
            this.modeTransitionSmoothing = 0; // 开始新的过渡
        } else {
            this.modeTransitionSmoothing = Math.min(this.modeTransitionSmoothing + deltaTime * 2, 1.0);
        }
    }
    
    // 处理智能控制输入
    processControlInputs(deltaTime) {
        // 初始化姿态角度
        this.pitchAngle = this.pitchAngle || 0;
        this.yawAngle = this.yawAngle || 0;
        this.rollAngle = this.rollAngle || 0;
        
        // 移动端摇杆状态
        const leftJoy = this.mobileControls.leftJoystick;
        const rightJoy = this.mobileControls.rightJoystick;
        
        // 油门控制 - 根据文档需求改进
        this.processThrottleControl(deltaTime, rightJoy);
        
        // A/D键纯YAW控制系统 - 严格按照文档要求
        this.processPureYawControls(deltaTime, rightJoy);
        
        // 精确控制 - 方向键的直接控制
        this.processPrecisionControls(deltaTime, leftJoy);
        
        // 应用配平系统
        this.applyTrimSystem(deltaTime);
    }
    
    // 油门控制处理
    processThrottleControl(deltaTime, rightJoy) {
        this.afterburnerActive = this.controls.ShiftLeft || this.controls.ShiftRight;
        
        // W/S键控制
        if (this.controls.KeyW) {
            this.throttle = Math.min(this.throttle + deltaTime * 3.5, 1.0);
        }
        if (this.controls.KeyS) {
            if (this.flightMode === 'ground') {
                // 地面模式：支持强力倒车
                this.throttle = Math.max(this.throttle - deltaTime * 2.5, -0.8);
            } else {
                // 空中模式：仅减速，不支持倒飞
                this.throttle = Math.max(this.throttle - deltaTime * 2.0, 0);
            }
        }
        
        // 移动端右摇杆Y轴控制推力
        if (rightJoy.active && Math.abs(rightJoy.y) > 0.1) {
            const targetThrottle = rightJoy.y;
            if (this.flightMode === 'ground') {
                this.throttle = Math.max(-0.8, Math.min(1.0, targetThrottle));
            } else {
                this.throttle = Math.max(0, Math.min(1.0, targetThrottle));
            }
        }
        
        // 移动端后燃器控制
        if (rightJoy.active && rightJoy.y > 0.9) {
            this.afterburnerActive = true;
        }
        
        // 自动配平油门（当无输入时）
        if (!this.controls.KeyW && !this.controls.KeyS && !rightJoy.active) {
            const targetThrottle = this.calculateTargetThrottle();
            const trimRate = this.getTrimStrength('speed') * deltaTime;
            this.throttle = THREE.MathUtils.lerp(this.throttle, targetThrottle, trimRate);
        }
    }
    
    // A/D键纯YAW控制系统 - 严格按照文档2.md要求
    processPureYawControls(deltaTime, rightJoy) {
        // A/D键：纯YAW转向控制（无Roll）
        if (this.controls.KeyA) {
            // A键：空中模式纯YAW左转，地面模式纯方向舵控制
            if (this.flightMode === 'ground') {
                const groundYawRate = this.calculateGroundYawRate(1, deltaTime);
                this.yawAngle += groundYawRate;
            } else {
                // 空中模式：纯偏航控制，无翻滚
                this.yawAngle += deltaTime * 1.2; // 纯YAW左转
            }
        }
        
        if (this.controls.KeyD) {
            // D键：空中模式纯YAW右转，地面模式纯方向舵控制
            if (this.flightMode === 'ground') {
                const groundYawRate = this.calculateGroundYawRate(-1, deltaTime);
                this.yawAngle += groundYawRate;
            } else {
                // 空中模式：纯偏航控制，无翻滚
                this.yawAngle -= deltaTime * 1.2; // 纯YAW右转
            }
        }
        
        // 移动端右摇杆X轴输入（纯YAW控制）
        if (rightJoy.active && Math.abs(rightJoy.x) > 0.1) {
            if (this.flightMode === 'ground') {
                const groundYawRate = this.calculateGroundYawRate(-rightJoy.x, deltaTime);
                this.yawAngle += groundYawRate;
            } else {
                // 空中模式：纯偏航控制
                this.yawAngle -= rightJoy.x * deltaTime * 1.2;
            }
        }
    }
    
    // 计算地面模式的偏航速率（方向舵控制）
    calculateGroundYawRate(turnInput, deltaTime) {
        const currentSpeed = this.velocity.length() * 3.6; // km/h
        
        // 速度越高，方向舵响应越敏感（模拟真实地面滑行）
        const speedFactor = Math.min(currentSpeed / 40, 2.0);
        const baseYawRate = 2.0;
        
        return turnInput * deltaTime * baseYawRate * (0.5 + speedFactor * 0.5);
    }
    
    // 执行空中协调转弯
    executeCoordinatedTurn(turnInput, deltaTime) {
        const currentSpeed = this.velocity.length() * 3.6; // km/h
        
        // === 主要动作：Roll（翻滚倾斜）===
        const rollAngle = this.calculateOptimalRollAngle(turnInput, currentSpeed);
        this.targetRollAngle = rollAngle;
        
        // === 辅助动作：Yaw（方向舵修正）===
        const yawCorrection = this.calculateYawCorrection(turnInput, rollAngle, currentSpeed, deltaTime);
        this.yawAngle += yawCorrection;
        
        // === 补偿动作：轻微Pitch调整（保持高度）===
        const pitchCompensation = this.calculatePitchCompensation(rollAngle, deltaTime);
        this.pitchAngle += pitchCompensation;
        
        // 限制俯仰角度避免过度补偿
        this.pitchAngle = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.pitchAngle));
    }
    
    // 计算最佳翻滚角度
    calculateOptimalRollAngle(turnInput, currentSpeed) {
        // 标准转弯倾斜角度计算
        const minRoll = 10 * Math.PI / 180;  // 最小10度
        const maxRoll = 60 * Math.PI / 180;  // 最大60度
        
        // 失速保护：低速时限制最大倾斜角度
        const stallSpeed = 80; // 失速临界速度 km/h
        if (currentSpeed < stallSpeed) {
            const stallProtectionFactor = Math.max(currentSpeed / stallSpeed, 0.3);
            const protectedMaxRoll = minRoll + (maxRoll - minRoll) * stallProtectionFactor;
            return turnInput * Math.min(protectedMaxRoll, minRoll + Math.abs(turnInput) * (protectedMaxRoll - minRoll));
        }
        
        // 速度因子：高速时需要较小倾斜角度以避免过载
        const speedFactor = Math.min(Math.max((currentSpeed - 100) / 300, 0), 1);
        
        // 载荷因子限制：避免过度机动
        const gForceLimit = 4.0; // 最大G力限制
        const currentGForce = this.calculateGForce();
        
        if (currentGForce > gForceLimit * 0.8) {
            // 接近G力限制时减少倾斜角度
            const gForceFactor = Math.max(1 - (currentGForce - gForceLimit * 0.8) / (gForceLimit * 0.2), 0.5);
            const limitedMaxRoll = maxRoll * gForceFactor;
            return turnInput * (minRoll + Math.abs(turnInput) * (limitedMaxRoll - minRoll));
        }
        
        // 正常情况下的动态调整
        const optimalMaxRoll = maxRoll - speedFactor * (maxRoll - minRoll) * 0.3;
        
        return turnInput * (minRoll + Math.abs(turnInput) * (optimalMaxRoll - minRoll));
    }
    
    // 计算偏航修正量
    calculateYawCorrection(turnInput, rollAngle, currentSpeed, deltaTime) {
        // 基于真实飞机协调转弯公式
        const desiredTurnRate = 3 * Math.PI / 180; // 标准转弯率：3度/秒
        const actualTurnRate = Math.sin(rollAngle) * 9.81 / (currentSpeed * 0.277); // 转换为m/s
        
        // 方向舵补偿：(期望偏航率 - 实际偏航率) × 补偿系数
        const yawError = (desiredTurnRate - actualTurnRate) * turnInput;
        const compensationStrength = 0.8;
        
        return yawError * compensationStrength * deltaTime;
    }
    
    // 计算俯仰补偿
    calculatePitchCompensation(rollAngle, deltaTime) {
        // 转弯时需要轻微上拉以维持高度
        const compensationFactor = 0.25;
        const maxCompensation = 5 * Math.PI / 180; // 最大5度补偿
        
        const compensation = Math.abs(rollAngle) * compensationFactor;
        return Math.min(compensation, maxCompensation) * deltaTime;
    }
    
    // 精确控制处理（方向键） - 高级操作
    processPrecisionControls(deltaTime, leftJoy) {
        const controlSpeed = 1.8;
        
        // === 上/下箭头控制俯仰（升降舵）===
        // 上箭头：机头下压（俯冲），对应真实飞机的推杆动作
        if (this.controls.ArrowUp) {
            this.pitchAngle = Math.max(this.pitchAngle - deltaTime * controlSpeed, -Math.PI / 4);
        }
        // 下箭头：机头上抬（爬升），对应真实飞机的拉杆动作
        if (this.controls.ArrowDown) {
            this.pitchAngle = Math.min(this.pitchAngle + deltaTime * controlSpeed, Math.PI / 4);
        }
        
        // 移动端左摇杆Y轴控制俯仰
        if (leftJoy.active && Math.abs(leftJoy.y) > 0.1) {
            const targetPitch = leftJoy.y * Math.PI / 4;
            this.pitchAngle = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, targetPitch));
        }
        
        // === 左/右箭头控制智能协调转弯（Roll + Yaw混合）===
        // 严格按照文档要求：自动混合Roll + Yaw，实现自然转弯
        let coordinatedTurnInput = 0;
        
        if (this.controls.ArrowLeft) {
            coordinatedTurnInput = 1; // 左转
        }
        if (this.controls.ArrowRight) {
            coordinatedTurnInput = -1; // 右转
        }
        
        // 移动端左摇杆X轴控制协调转弯
        if (leftJoy.active && Math.abs(leftJoy.x) > 0.1) {
            coordinatedTurnInput = -leftJoy.x;
        }
        
        if (Math.abs(coordinatedTurnInput) > 0.1) {
            this.coordinatedTurnActive = true;
            
            if (this.flightMode === 'ground') {
                // 地面模式：纯方向舵控制（类似汽车方向盘）
                const groundYawRate = this.calculateGroundYawRate(coordinatedTurnInput, deltaTime);
                this.yawAngle += groundYawRate;
                this.targetRollAngle = 0; // 地面不翻滚
            } else {
                // 空中模式：智能协调转弯（自动混合Roll + Yaw）
                this.executeCoordinatedTurn(coordinatedTurnInput, deltaTime);
            }
        } else {
            this.coordinatedTurnActive = false;
            this.targetRollAngle = 0;
        }
        
        // 平滑应用目标翻滚角度
        const rollRate = deltaTime * 3.5;
        this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, this.targetRollAngle, rollRate);
        
        // 显示精确控制模式提示
        this.updatePrecisionControlIndicator();
    }
    
    // 更新精确控制指示器
    updatePrecisionControlIndicator() {
        const precisionElement = document.getElementById('precisionMode');
        if (precisionElement) {
            const arrowKeysActive = this.controls.ArrowLeft || this.controls.ArrowRight || 
                                   this.controls.ArrowUp || this.controls.ArrowDown;
            
            if (arrowKeysActive) {
                if (this.controls.ArrowLeft || this.controls.ArrowRight) {
                    // 左右箭头现在是协调转弯
                    precisionElement.textContent = '方向键: 协调转弯 (Roll+Yaw)';
                    precisionElement.style.color = '#FF9800';
                } else {
                    // 上下箭头是俯仰控制
                    precisionElement.textContent = '方向键: 俯仰控制';
                    precisionElement.style.color = '#3F51B5';
                }
            } else if (this.controls.KeyA || this.controls.KeyD) {
                // A/D键是纯YAW控制
                precisionElement.textContent = 'A/D键: 纯YAW转向';
                precisionElement.style.color = '#9C27B0';
            } else {
                precisionElement.textContent = '';
            }
        }
    }
    
    // 应用配平系统 - 增强支持智能协调转弯
    applyTrimSystem(deltaTime) {
        const trimStrength = this.getTrimStrength('attitude');
        
        // 翻滚角自动回中（仅当无控制输入时）
        if (!this.coordinatedTurnActive && 
            !this.controls.ArrowLeft && !this.controls.ArrowRight && 
            !this.mobileControls.leftJoystick.active) {
            
            // 根据飞行模式调整回中速度
            const rollTrimRate = this.flightMode === 'ground' ? 
                this.trimSystem.rollDamping * 2.0 :  // 地面模式快速回中
                this.trimSystem.rollDamping;          // 空中模式温和回中
            
            this.rollAngle = THREE.MathUtils.lerp(
                this.rollAngle, 
                0, 
                deltaTime * rollTrimRate * trimStrength
            );
        }
        
        // 俯仰稳定（根据配平强度和飞行状态）
        if (!this.controls.ArrowUp && !this.controls.ArrowDown && 
            !this.mobileControls.leftJoystick.active) {
            
            let targetPitch = 0;
            
            if (this.flightMode === 'ground') {
                targetPitch = 0; // 地面模式强制水平
            } else {
                // 空中模式：考虑速度和高度的自然配平角度
                const currentSpeed = this.velocity.length() * 3.6;
                const cruiseSpeed = this.trimSystem.targetSpeed;
                
                if (currentSpeed < cruiseSpeed * 0.8) {
                    // 低速时轻微上拉维持升力
                    targetPitch = Math.min(this.pitchAngle * 0.9 + 0.05, Math.PI / 12);
                } else if (currentSpeed > cruiseSpeed * 1.2) {
                    // 高速时轻微下压避免爬升过快
                    targetPitch = Math.max(this.pitchAngle * 0.9 - 0.02, -Math.PI / 20);
                } else {
                    // 巡航速度附近缓慢趋向水平
                    targetPitch = this.pitchAngle * 0.98;
                }
            }
            
            const pitchTrimRate = this.trimSystem.pitchStability * trimStrength * 
                (this.flightMode === 'ground' ? 0.5 : 0.1);
            
            this.pitchAngle = THREE.MathUtils.lerp(
                this.pitchAngle,
                targetPitch,
                deltaTime * pitchTrimRate
            );
        }
        
        // 偏航阻尼（减少不必要的左右摆动）
        if (!this.controls.KeyA && !this.controls.KeyD && 
            !this.mobileControls.rightJoystick.active && 
            !this.coordinatedTurnActive) {
            
            // 智能偏航阻尼：考虑当前转弯状态
            const yawDampingRate = this.flightMode === 'ground' ? 
                this.trimSystem.yawDamping * 0.3 :  // 地面模式加强阻尼
                this.trimSystem.yawDamping * 0.05;  // 空中模式轻微阻尼
            
            this.yawAngle *= (1 - deltaTime * yawDampingRate);
        }
    }
    
    // 计算目标配平油门
    calculateTargetThrottle() {
        const currentSpeed = this.velocity.length() * 3.6;
        const targetSpeed = this.trimSystem.targetSpeed;
        
        if (this.flightMode === 'ground') {
            return 0; // 地面模式默认怠速
        } else {
            // 空中模式：根据当前速度和目标速度计算目标油门
            const speedError = (targetSpeed - currentSpeed) / targetSpeed;
            return Math.max(0, Math.min(1, 0.5 + speedError * 0.5));
        }
    }
    
    // 获取配平强度
    getTrimStrength(type) {
        const strengthMap = {
            'arcade': 1.0,      // 强力配平，新手友好
            'simulation': 0.6,  // 中等配平，平衡真实感和易用性
            'expert': 0.2       // 最小配平，接近真实飞行
        };
        
        const setting = type === 'speed' ? 
            this.trimSystem.speedTrimStrength : 
            this.trimSystem.attitudeTrimStrength;
            
        return strengthMap[setting] || 1.0;
    }
    
    // 应用物理和升力系统
    applyPhysicsAndTrim(deltaTime) {
        const force = new THREE.Vector3();
        const baseSpeed = 120;
        
        // 应用旋转到飞机
        this.airplane.rotation.set(this.rollAngle, this.yawAngle, this.pitchAngle);
        
        // 计算推力
        let currentSpeed = baseSpeed * this.throttle;
        
        // 后燃器增强
        if (this.afterburnerActive && this.throttle > 0) {
            currentSpeed *= 5.0;
            this.afterburner.material.opacity = Math.min(this.afterburner.material.opacity + deltaTime * 10, 1);
            this.afterburner.scale.set(1 + this.rng() * 0.3, 1 + this.rng() * 0.3, 1 + this.rng() * 0.5);
        } else {
            this.afterburner.material.opacity = Math.max(this.afterburner.material.opacity - deltaTime * 5, 0);
            this.afterburner.scale.set(1, 1, 1);
        }
        
        // 螺旋桨转速
        this.propeller.rotation.x += deltaTime * 30 * this.throttle;
        
        // 计算推力方向
        const forwardDirection = new THREE.Vector3(1, 0, 0);
        forwardDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));
        
        // 应用推力
        force.add(forwardDirection.clone().multiplyScalar(currentSpeed));
        
        // 升力系统
        const forwardSpeed = this.velocity.dot(forwardDirection);
        if (forwardSpeed > 5) {
            const cruiseSpeed = 80;
            const liftCoefficient = Math.min(forwardSpeed / cruiseSpeed, 2.5);
            const baseLiftForce = 15.2;
            const liftMagnitude = baseLiftForce * liftCoefficient;
            
            let liftDirection;
            if (Math.abs(this.pitchAngle) < 0.2) {
                liftDirection = new THREE.Vector3(0, 1, 0);
            } else {
                liftDirection = new THREE.Vector3(0, 1, 0);
                liftDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));
            }
            
            force.add(liftDirection.multiplyScalar(liftMagnitude));
        }
        
        // 重力
        force.y -= 15;
        
        // 空气阻力
        const dragCoefficient = this.flightMode === 'ground' ? -0.8 : -0.02;
        const drag = this.velocity.clone().multiplyScalar(dragCoefficient);
        force.add(drag);
        
        // 应用力到速度
        this.velocity.add(force.clone().multiplyScalar(deltaTime));
        
        // 更新位置
        this.airplane.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // 地面碰撞检测
        if (this.airplane.position.y < 2) {
            this.airplane.position.y = 2;
            this.velocity.y = Math.max(0, this.velocity.y);
            this.rollAngle *= 0.8;
            this.pitchAngle = Math.max(this.pitchAngle * 0.8, 0);
            this.velocity.x *= 0.98;
            this.velocity.z *= 0.85;
        }
    }
    
    updateControlSurfaces() {
        // 更新方向舵视觉效果 - 反映A/D键纯YAW控制和箭头键协调转弯
        if (this.rudderGroup) {
            let rudderDeflection = 0;
            
            // A/D键纯YAW控制的方向舵偏转
            if (this.controls.KeyA) {
                rudderDeflection = this.flightMode === 'ground' ? Math.PI / 6 : Math.PI / 8;
            }
            if (this.controls.KeyD) {
                rudderDeflection = this.flightMode === 'ground' ? -Math.PI / 6 : -Math.PI / 8;
            }
            
            // 箭头键协调转弯时的方向舵补偿偏转
            if (this.coordinatedTurnActive) {
                if (this.controls.ArrowLeft) {
                    rudderDeflection += this.flightMode === 'ground' ? Math.PI / 8 : Math.PI / 12;
                }
                if (this.controls.ArrowRight) {
                    rudderDeflection -= this.flightMode === 'ground' ? Math.PI / 8 : Math.PI / 12;
                }
            }
            
            this.rudderGroup.rotation.y = rudderDeflection;
        }
        
        // 更新机翼视觉效果 - 显示副翼偏转（反映翻滚状态）
        if (this.wingGroup) {
            let aileronDeflection = 0;
            
            // 基于实际翻滚角度显示副翼偏转
            if (this.coordinatedTurnActive && this.flightMode === 'air') {
                aileronDeflection = -this.rollAngle * 0.3; // 副翼偏转与翻滚角度成比例
            } else if (this.controls.ArrowLeft || this.controls.ArrowRight) {
                // 精确控制模式的副翼偏转
                if (this.controls.ArrowLeft) aileronDeflection = Math.PI / 12;
                if (this.controls.ArrowRight) aileronDeflection = -Math.PI / 12;
            }
            
            this.wingGroup.rotation.x = aileronDeflection;
        }
        
        // 更新升降舵视觉效果（可以通过尾翼俯仰来表示）
        if (this.rudderGroup?.parent) {
            // 轻微旋转整个尾翼组来表示升降舵偏转
            const elevatorDeflection = this.pitchAngle * 0.2; // 升降舵偏转与俯仰角成比例
            this.rudderGroup.rotation.x = elevatorDeflection;
        }
    }

    updateUI() {
        const speed = this.velocity.length() * 3.6;
        const altitude = Math.max(0, this.airplane.position.y);
        
        document.getElementById('speed').textContent = Math.round(speed);
        document.getElementById('altitude').textContent = Math.round(altitude);
        document.getElementById('playerCount').textContent = this.connections.size + 1;
        
        // 更新飞行模式和状态指示
        this.updateFlightModeDisplay();
        
        // 更新油门和推力状态
        this.updateThrottleDisplay();
        
        // 更新姿态指示器
        this.updateAttitudeDisplay();
        

        
        // 更新警告系统
        this.updateWarningSystem();
    }
    
    // 更新飞行模式显示
    updateFlightModeDisplay() {
        const modeElement = document.getElementById('flightMode');
        if (modeElement) {
            const modeText = this.flightMode === 'ground' ? '地面模式' : '空中模式';
            const transitionText = this.modeTransitionSmoothing < 1.0 ? ' (切换中...)' : '';
            modeElement.textContent = modeText + transitionText;
            
            // 根据模式改变颜色
            modeElement.style.color = this.flightMode === 'ground' ? '#4CAF50' : '#2196F3';
        }
    }
    
    // 更新油门显示
    updateThrottleDisplay() {
        const throttleElement = document.getElementById('throttle');
        if (!throttleElement) return;
        
        const throttlePercent = Math.round(this.throttle * 100);
        let throttleStatus = '';
        
        if (this.throttle > 0.1) {
            const boostText = this.afterburnerActive ? ' (后燃器)' : '';
            throttleStatus = `前进 ${throttlePercent}%${boostText}`;
        } else if (this.throttle < -0.1) {
            throttleStatus = `倒退 ${Math.abs(throttlePercent)}%`;
        } else {
            // 显示配平状态
            const targetThrottle = this.calculateTargetThrottle();
            const trimActive = Math.abs(targetThrottle) > 0.1;
            
            if (trimActive) {
                throttleStatus = `配平中 (目标: ${Math.round(targetThrottle * 100)}%)`;
            } else {
                throttleStatus = '怠速';
            }
        }
        
        throttleElement.textContent = throttleStatus;
    }
    
    // 更新姿态指示器
    updateAttitudeDisplay() {
        const rollElement = document.getElementById('rollAngle');
        const pitchElement = document.getElementById('pitchAngle');
        const yawElement = document.getElementById('heading');
        
        if (rollElement) {
            const rollDegrees = Math.round(this.rollAngle * 180 / Math.PI);
            rollElement.textContent = `${rollDegrees}°`;
        }
        
        if (pitchElement) {
            const pitchDegrees = Math.round(this.pitchAngle * 180 / Math.PI);
            pitchElement.textContent = `${pitchDegrees}°`;
        }
        
        if (yawElement) {
            const headingDegrees = Math.round(((this.yawAngle * 180 / Math.PI) + 360) % 360);
            yawElement.textContent = `${headingDegrees}°`;
        }
        
        // 更新转弯指示
        const turnElement = document.getElementById('turnIndicator');
        if (turnElement) {
            if (this.coordinatedTurnActive) {
                const turnDirection = this.targetRollAngle > 0 ? '右转' : '左转';
                const turnAngle = Math.round(Math.abs(this.targetRollAngle * 180 / Math.PI));
                turnElement.textContent = `${turnDirection} ${turnAngle}°`;
                turnElement.style.color = '#FF9800';
            } else {
                turnElement.textContent = '直飞';
                turnElement.style.color = '#4CAF50';
            }
        }
    }
    
    // 更新警告系统
    updateWarningSystem() {
        const warningElement = document.getElementById('warnings');
        if (!warningElement) return;
        
        const warnings = [];
        const speed = this.velocity.length() * 3.6;
        const altitude = this.airplane.position.y;
        
        // 失速警告
        if (this.flightMode === 'air' && speed < 60) {
            warnings.push('⚠️ 失速警告');
        }
        
        // 过载警告
        const gForce = this.calculateGForce();
        if (gForce > 3) {
            warnings.push('⚠️ 过载警告');
        }
        
        // 低空警告
        if (this.flightMode === 'air' && altitude < 10) {
            warnings.push('⚠️ 低空警告');
        }
        
        // 高速警告
        if (speed > 500) {
            warnings.push('⚠️ 超速警告');
        }
        
        warningElement.textContent = warnings.join(' | ') || '';
        warningElement.style.color = warnings.length > 0 ? '#F44336' : '#4CAF50';
    }
    

    
    updateCamera() {
        // === 第三人称跟随摄像机（Third-Person Follow Camera）===
        // 严格按照文档2.md要求实现
        
        // 1. 位置锁定机制：飞机始终居中，固定相对距离
        const airplanePos = this.airplane.position.clone();
        
        // 2. 固定偏移量：摄像机位置 = 飞机位置 + 固定偏移量
        // 偏移量在飞机的后上方
        const offset = new THREE.Vector3(-30, 15, 0); // 后方30米，上方15米
        
        // 3. 平滑跟随算法：使用Vector3.Lerp实现平滑跟随
        const targetPosition = airplanePos.clone().add(offset);
        const smoothSpeed = 2.0; // 平滑跟随速度
        
        // 当前摄像机位置平滑插值到目标位置
        this.camera.position.lerp(targetPosition, smoothSpeed * 0.016); // 假设60fps
        
        // 4. 视角锁定：摄像机始终朝向飞机中心点
        // 无论飞机如何翻滚、俯仰、偏航，摄像机的相对位置关系保持不变
        this.camera.lookAt(airplanePos);
        
        // 5. 姿态独立特性：背景世界会随着飞机姿态变化而"旋转"
        // 这是自然效果，无需额外代码实现
    }
    
    // 计算G力（用于相机自适应）
    calculateGForce() {
        if (!this.previousVelocity) {
            this.previousVelocity = this.velocity.clone();
            return 0;
        }
        
        const deltaV = this.velocity.clone().sub(this.previousVelocity);
        this.previousVelocity.copy(this.velocity);
        
        // G力大小（简化计算）
        return deltaV.length() * 10; // 粗略的G力估算
    }
    

    
    initMultiplayer() {
        // 自动初始化P2P连接，所有用户进入同一个全局房间
        this.peer = new Peer();
        
        this.peer.on('open', (id) => {
            console.log('我的PeerJS ID:', id);
            document.getElementById('connectionStatus').textContent = '正在加入全局房间...';
            this.setupPeerListeners();
            // 延迟一下尝试连接到全局房间，给其他用户时间初始化
            setTimeout(() => this.tryConnectToGlobalRoom(), 1000);
        });
        
        this.peer.on('error', (error) => {
            console.log('PeerJS连接错误:', error);
        });
    }
    
    tryConnectToGlobalRoom() {
        // 尝试连接到全局房间ID
        const conn = this.peer.connect(this.globalRoomId);
        
        conn.on('open', () => {
            console.log('成功连接到全局房间');
            document.getElementById('connectionStatus').textContent = '已连接到全局房间';
            this.connections.set(this.globalRoomId, conn);
            this.setupConnectionListeners(conn, this.globalRoomId);
        });
        
        conn.on('error', (error) => {
            console.log('连接全局房间失败，可能是第一个进入的用户:', error);
            // 如果连接失败，说明我们是第一个用户，成为房间主机
            this.becomeHost();
        });
    }
    
    becomeHost() {
        // 成为房间主机，等待其他用户连接
        this.isHost = true;
        this.peer.destroy();
        
        // 使用固定的房间ID重新创建peer
        this.peer = new Peer(this.globalRoomId);
        
        this.peer.on('open', (id) => {
            console.log('成为房间主机，房间ID:', id);
            document.getElementById('connectionStatus').textContent = '房间主机 - 等待其他玩家';
            this.setupPeerListeners();
        });
        
        this.peer.on('error', (error) => {
            console.log('主机创建错误:', error);
        });
    }
    
    setupPeerListeners() {
        this.peer.on('connection', (conn) => {
            console.log('新玩家加入:', conn.peer);
            this.connections.set(conn.peer, conn);
            this.setupConnectionListeners(conn, conn.peer);
            // 更新连接状态显示
            if (this.isHost) {
                document.getElementById('connectionStatus').textContent = `房间主机 - ${this.connections.size + 1}名玩家`;
            }
        });
    }
    
    setupConnectionListeners(conn, peerId) {
        conn.on('data', (data) => {
            if (data.type === 'position') {
                this.updateOtherPlayer(peerId, data);
            }
        });
        
        conn.on('close', () => {
            console.log('玩家离开:', peerId);
            this.connections.delete(peerId);
            this.removeOtherPlayer(peerId);
            // 更新连接状态显示
            if (this.isHost) {
                document.getElementById('connectionStatus').textContent = `房间主机 - ${this.connections.size + 1}名玩家`;
            }
        });
    }
    
    broadcastPosition() {
        const data = {
            type: 'position',
            position: this.airplane.position,
            rotation: this.airplane.rotation,
            timestamp: Date.now()
        };
        
        for (const conn of this.connections.values()) {
            if (conn.open) {
                conn.send(data);
            }
        }
    }
    
    updateOtherPlayer(peerId, data) {
        if (!this.otherPlayers.has(peerId)) {
            const otherAirplane = this.airplane.clone();
            for (const child of otherAirplane.children) {
                child.material = child.material.clone();
                child.material.color.setHex(0xff6600);
            }
            this.scene.add(otherAirplane);
            this.otherPlayers.set(peerId, otherAirplane);
        }
        
        const otherAirplane = this.otherPlayers.get(peerId);
        otherAirplane.position.copy(data.position);
        otherAirplane.rotation.copy(data.rotation);
    }
    
    removeOtherPlayer(peerId) {
        const otherAirplane = this.otherPlayers.get(peerId);
        if (otherAirplane) {
            this.scene.remove(otherAirplane);
            this.otherPlayers.delete(peerId);
        }
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        this.updatePhysics(deltaTime);
        
        // 更新水面动画
        if (this.waterMaterial) {
            this.waterMaterial.uniforms.time.value += deltaTime;
            this.updateWaterReflection();
        }
        
        // 更新悬浮挂牌动画
        if (this.bannerGroup) {
            this.bannerSwayTime += deltaTime;
            const swayX = Math.sin(this.bannerSwayTime * 0.6) * 0.3;
            const swayZ = Math.cos(this.bannerSwayTime * 0.8) * 0.2;
            const swayY = Math.sin(this.bannerSwayTime * 1.0) * 0.5;
            
            this.bannerGroup.rotation.x = swayX * 0.03;
            this.bannerGroup.rotation.z = swayZ * 0.03;
            this.bannerGroup.position.y = swayY;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    updateWaterReflection() {
        if (!this.lake || !this.reflectionCamera || !this.refractionCamera) return;
        
        // 保存原始设置
        const originalCameraPosition = this.camera.position.clone();
        const originalCameraRotation = this.camera.rotation.clone();
        
        // 设置反射相机
        this.reflectionCamera.position.copy(this.camera.position);
        this.reflectionCamera.position.y = -this.camera.position.y + 2 * this.lake.position.y;
        this.reflectionCamera.rotation.copy(this.camera.rotation);
        this.reflectionCamera.rotation.x = -this.camera.rotation.x;
        this.reflectionCamera.updateProjectionMatrix();
        
        // 临时隐藏湖泊避免自反射
        this.lake.visible = false;
        
        // 渲染反射
        this.renderer.setRenderTarget(this.reflectionRenderTarget);
        this.renderer.render(this.scene, this.reflectionCamera);
        
        // 恢复湖泊可见性
        this.lake.visible = true;
        
        // 设置折射相机
        this.refractionCamera.position.copy(this.camera.position);
        this.refractionCamera.rotation.copy(this.camera.rotation);
        this.refractionCamera.updateProjectionMatrix();
        
        // 渲染折射
        this.renderer.setRenderTarget(this.refractionRenderTarget);
        this.renderer.render(this.scene, this.refractionCamera);
        
        // 恢复主渲染目标
        this.renderer.setRenderTarget(null);
    }
}

// 移除手动房间管理函数，现在自动加入全局房间

const game = new FlightSimulator();