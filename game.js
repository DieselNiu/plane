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
        
        this.otherPlayers = new Map();
        this.peer = null;
        this.connections = new Map();
        this.roomId = null;
        
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
        document.body.appendChild(this.renderer.domElement);
        
        this.setupLighting();
        this.createAirplane();
        this.createEnvironment();
        this.setupCamera();
        
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
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Extended runway for better takeoff/landing
        const runwayGeometry = new THREE.PlaneGeometry(800, 40);
        const runwayMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
        runway.rotation.x = -Math.PI / 2;
        runway.position.y = 0.1;
        runway.receiveShadow = true;
        this.scene.add(runway);
        
        // Add three red takeoff lines perpendicular to airplane (vertical to runway)
        const takeoffLineMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        for (let i = 0; i < 3; i++) {
            const takeoffLineGeometry = new THREE.PlaneGeometry(1.5, 20); // Narrow and perpendicular
            const takeoffLine = new THREE.Mesh(takeoffLineGeometry, takeoffLineMaterial);
            takeoffLine.rotation.x = -Math.PI / 2;
            takeoffLine.rotation.z = Math.PI / 2; // Rotate 90 degrees to be perpendicular to airplane
            takeoffLine.position.set(-370 + i * 2, 0.16, 0); // Three lines spaced 2 units apart
            this.scene.add(takeoffLine);
        }
        
        // More runway markings for longer runway
        for (let i = 0; i < 16; i++) {
            const markingGeometry = new THREE.PlaneGeometry(25, 3);
            const markingMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            marking.rotation.x = -Math.PI / 2;
            marking.position.set(i * 45 - 340, 0.15, 0);
            this.scene.add(marking);
        }
        
        for (let i = 0; i < 30; i++) {
            const treeGeometry = new THREE.ConeGeometry(4, 20, 8);
            const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            const tree = new THREE.Mesh(treeGeometry, treeMaterial);
            
            const side = this.rng() > 0.5 ? 1 : -1;
            tree.position.set(
                this.rng() * 400 - 200,
                10,
                side * (this.rng() * 30 + 25)
            );
            tree.castShadow = true;
            this.scene.add(tree);
        }
        
        // Create more colorful buildings
        for (let i = 0; i < 25; i++) {
            const buildingWidth = this.rng() * 30 + 15;
            const buildingHeight = this.rng() * 100 + 40;
            const buildingDepth = this.rng() * 30 + 15;
            
            const buildingGeometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
            // More vibrant and varied colors
            const hue = this.rng(); // Full hue range
            const saturation = this.rng() * 0.6 + 0.4; // Higher saturation
            const lightness = this.rng() * 0.3 + 0.4; // Good brightness range
            const buildingMaterial = new THREE.MeshLambertMaterial({ 
                color: new THREE.Color().setHSL(hue, saturation, lightness) 
            });
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            
            const angle = this.rng() * Math.PI * 2;
            const distance = this.rng() * 500 + 100;
            building.position.set(
                Math.cos(angle) * distance,
                buildingHeight / 2,
                Math.sin(angle) * distance
            );
            building.castShadow = true;
            this.scene.add(building);
        }
        
        // Create multiple colorful hot air balloons
        for (let i = 0; i < 6; i++) {
            const balloonRadius = this.rng() * 4 + 6;
            const balloonGeometry = new THREE.SphereGeometry(balloonRadius, 16, 12);
            
            // Create vibrant balloon colors
            const hue = this.rng();
            const saturation = this.rng() * 0.4 + 0.6; // High saturation
            const lightness = this.rng() * 0.3 + 0.5; // Good brightness
            const balloonMaterial = new THREE.MeshLambertMaterial({ 
                color: new THREE.Color().setHSL(hue, saturation, lightness) 
            });
            const balloon = new THREE.Mesh(balloonGeometry, balloonMaterial);
            
            // Position balloons around the scene
            const angle = (i / 6) * Math.PI * 2 + this.rng() * 0.5;
            const distance = this.rng() * 200 + 150;
            const height = this.rng() * 50 + 40;
            balloon.position.set(
                Math.cos(angle) * distance,
                height,
                Math.sin(angle) * distance
            );
            this.scene.add(balloon);
            
            // Create basket for each balloon
            const basketSize = balloonRadius * 0.3;
            const basketGeometry = new THREE.BoxGeometry(basketSize, basketSize * 0.6, basketSize);
            const basketMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const basket = new THREE.Mesh(basketGeometry, basketMaterial);
            basket.position.set(
                balloon.position.x,
                balloon.position.y - balloonRadius - basketSize * 0.8,
                balloon.position.z
            );
            this.scene.add(basket);
            
            // Create ropes connecting balloon to basket
            const ropeHeight = balloonRadius + basketSize * 0.8;
            const ropeGeometry = new THREE.CylinderGeometry(0.05, 0.05, ropeHeight, 8);
            const ropeMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
            for (let j = 0; j < 4; j++) {
                const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
                const ropeOffset = basketSize * 0.4;
                rope.position.set(
                    balloon.position.x + (j < 2 ? -ropeOffset : ropeOffset),
                    balloon.position.y - ropeHeight / 2,
                    balloon.position.z + (j % 2 === 0 ? -ropeOffset : ropeOffset)
                );
                this.scene.add(rope);
            }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 256, 128);
        context.fillStyle = '#ff0000';
        context.font = 'bold 32px Arial';
        context.textAlign = 'center';
        context.fillText('生财有术', 128, 70);
        
        const textTexture = new THREE.CanvasTexture(canvas);
        const bannerGeometry = new THREE.PlaneGeometry(6, 3);
        const bannerMaterial = new THREE.MeshLambertMaterial({ 
            map: textTexture,
            transparent: true
        });
        const banner = new THREE.Mesh(bannerGeometry, bannerMaterial);
        banner.position.set(100, 45, 72);
        banner.lookAt(0, 45, 0);
        this.scene.add(banner);
        
        for (let i = 0; i < 50; i++) {
            const cloudGeometry = new THREE.SphereGeometry(
                this.rng() * 10 + 5,
                8,
                6
            );
            const cloudMaterial = new THREE.MeshLambertMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.7
            });
            const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
            cloud.position.set(
                (this.rng() - 0.5) * 1000,
                this.rng() * 200 + 100,
                (this.rng() - 0.5) * 1000
            );
            this.scene.add(cloud);
        }
    }
    
    setupCamera() {
        this.cameraDistance = 25;
        this.cameraHeight = 8;
        // Set camera rotation to be behind airplane (negative X direction)
        this.cameraRotation = { x: 0, y: -Math.PI/2 }; // -90° puts camera behind airplane on X-axis
        // Initial position will be calculated by updateCamera()
    }
    
    setupControls() {
        document.addEventListener('keydown', (event) => {
            this.controls[event.code] = true;
        });
        
        document.addEventListener('keyup', (event) => {
            this.controls[event.code] = false;
        });
        
        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === this.renderer.domElement) {
                const sensitivity = 0.003;
                this.cameraRotation.y -= event.movementX * sensitivity;
                this.cameraRotation.x += event.movementY * sensitivity;
                this.cameraRotation.x = Math.max(-Math.PI/6, Math.min(Math.PI/2, this.cameraRotation.x));
            }
        });
        
        this.renderer.domElement.addEventListener('click', () => {
            this.renderer.domElement.requestPointerLock();
        });
    }
    
    updatePhysics(deltaTime) {
        const force = new THREE.Vector3();
        const baseSpeed = 35; // 增加基础速度
        
        this.afterburnerActive = this.controls.ShiftLeft || this.controls.ShiftRight;
        
        // 油门响应 - 降低加速度
        if (this.controls.KeyW) {
            this.throttle = this.throttle + deltaTime * 1.5; // 降低加速度，从4降到1.5
        }
        if (this.controls.KeyS) {
            // 在地面时，S键提供反向推力
            if (this.airplane.position.y <= 2.5) {
                this.throttle = Math.max(this.throttle - deltaTime * 1.5, -0.5);
            } else {
                // 在空中时，S键减少前进推力
                this.throttle = Math.max(this.throttle - deltaTime * 1.5, 0);
            }
        }
        
        // 初始化飞机姿态角度
        this.pitchAngle = this.pitchAngle || 0; // 俯仰角 (绕Z轴)
        this.yawAngle = this.yawAngle || 0;     // 偏航角 (绕Y轴) 
        this.rollAngle = this.rollAngle || 0;   // 翻滚角 (绕X轴)
        
        const controlSpeed = 1.8; // 控制响应速度
        
        // A/D键控制偏航 (Yaw) - 方向舵
        if (this.controls.KeyA) {
            this.yawAngle += deltaTime * controlSpeed; // 向左偏航
        }
        if (this.controls.KeyD) {
            this.yawAngle -= deltaTime * controlSpeed; // 向右偏航
        }
        
        // 上/下箭头控制俯仰 (Pitch) - 升降舵
        if (this.controls.ArrowUp) {
            this.pitchAngle = Math.min(this.pitchAngle + deltaTime * controlSpeed, Math.PI / 4); // 抬头
        }
        if (this.controls.ArrowDown) {
            this.pitchAngle = Math.max(this.pitchAngle - deltaTime * controlSpeed, -Math.PI / 4); // 低头
        }
        
        // 左/右箭头直接控制偏航转向
        if (this.controls.ArrowLeft) {
            this.yawAngle += deltaTime * controlSpeed; // 左箭头：向左转向
        }
        if (this.controls.ArrowRight) {
            this.yawAngle -= deltaTime * controlSpeed; // 右箭头：向右转向
        }
        
        // Q/E键控制翻滚 (Roll) - 副翼
        if (this.controls.KeyQ) {
            this.rollAngle = Math.max(this.rollAngle - deltaTime * controlSpeed, -Math.PI / 3); // Q键：向左翻滚
        }
        if (this.controls.KeyE) {
            this.rollAngle = Math.min(this.rollAngle + deltaTime * controlSpeed, Math.PI / 3); // E键：向右翻滚
        }
        
        // 自动回中 - 当没有输入时，飞机姿态逐渐回到平直飞行
        const dampingFactor = 2.0;
        if (!this.controls.ArrowUp && !this.controls.ArrowDown) {
            this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, 0, deltaTime * dampingFactor);
        }
        if (!this.controls.KeyQ && !this.controls.KeyE) {
            this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, 0, deltaTime * dampingFactor);
        }
        
        // 应用旋转到飞机
        this.airplane.rotation.set(this.rollAngle, this.yawAngle, this.pitchAngle);
        
        // 计算推力
        let currentSpeed = baseSpeed * Math.max(this.throttle, 0); // 确保推力不为负数
        
        // 后燃器增强 - 在静态下也能提供推力
        if (this.afterburnerActive) {
            if (this.throttle <= 0) {
                // 静态下Shift键提供基础推力
                currentSpeed = baseSpeed * 0.8; // 提供80%的基础推力
            }
            currentSpeed *= 3.5; // 增加后燃器效果，从2.5改为3.5
            this.afterburner.material.opacity = Math.min(this.afterburner.material.opacity + deltaTime * 10, 1);
            this.afterburner.scale.set(1 + this.rng() * 0.3, 1 + this.rng() * 0.3, 1 + this.rng() * 0.5);
        } else {
            this.afterburner.material.opacity = Math.max(this.afterburner.material.opacity - deltaTime * 5, 0);
            this.afterburner.scale.set(1, 1, 1);
        }
        
        this.propeller.rotation.x += deltaTime * 30 * this.throttle;
        
        // 计算飞机当前朝向的推力方向（基于飞机的当前姿态）
        const forwardDirection = new THREE.Vector3(1, 0, 0); // 飞机的前进方向是X轴正方向
        // 按照正确的旋转顺序应用欧拉角：先偏航(Y)，再俯仰(Z)，最后翻滚(X)
        forwardDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));
        
        // 应用推力
        force.add(forwardDirection.clone().multiplyScalar(currentSpeed));
        
        // 基于速度的升力（只有当飞机有前进速度时才产生升力）
        const forwardSpeed = this.velocity.dot(forwardDirection);
        if (forwardSpeed > 5) {
            // 升力与前进速度和俯仰角相关
            const liftForce = forwardSpeed * 0.25 + Math.sin(this.pitchAngle) * forwardSpeed * 0.3;
            const upDirection = new THREE.Vector3(0, 1, 0);
            // 确保升力方向也正确应用飞机姿态
            upDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));
            force.add(upDirection.multiplyScalar(liftForce));
        }
        
        // 重力
        force.y -= 15; // 稍微增加重力
        
        // 空气阻力
        const drag = this.velocity.clone().multiplyScalar(-2.0); // 增加阻力
        force.add(drag);
        
        // 应用力到速度
        this.velocity.add(force.clone().multiplyScalar(deltaTime));
        
        // 更新位置
        this.airplane.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // 地面碰撞检测
        if (this.airplane.position.y < 2) {
            this.airplane.position.y = 2;
            this.velocity.y = Math.max(0, this.velocity.y);
            // 在地面时减少翻滚和俯仰
            this.rollAngle *= 0.8;
            this.pitchAngle = Math.max(this.pitchAngle * 0.8, 0);
        }
        
        // 更新控制面的视觉效果
        this.updateControlSurfaces();
        
        this.updateUI();
        this.updateCamera();
        
        if (this.peer?.open) {
            this.broadcastPosition();
        }
    }
    
    updateControlSurfaces() {
        // 更新方向舵视觉效果
        if (this.rudderGroup) {
            // 基于偏航输入显示方向舵偏转
            let rudderDeflection = 0;
            if (this.controls.KeyA) rudderDeflection = Math.PI / 8;
            if (this.controls.KeyD) rudderDeflection = -Math.PI / 8;
            this.rudderGroup.rotation.y = rudderDeflection;
        }
        
        // 更新机翼视觉效果 - 显示副翼偏转
        if (this.wingGroup) {
            let aileronDeflection = 0;
            if (this.controls.KeyQ) aileronDeflection = -Math.PI / 16; // Q键副翼偏转
            if (this.controls.KeyE) aileronDeflection = Math.PI / 16; // E键副翼偏转
            this.wingGroup.rotation.x = aileronDeflection;
        }
    }

    updateUI() {
        const speed = this.velocity.length() * 3.6;
        const altitude = Math.max(0, this.airplane.position.y);
        
        document.getElementById('speed').textContent = Math.round(speed);
        document.getElementById('altitude').textContent = Math.round(altitude);
        document.getElementById('playerCount').textContent = this.connections.size + 1;
        
        // 可选：显示油门值用于调试
        if (document.getElementById('throttle')) {
            document.getElementById('throttle').textContent = this.throttle.toFixed(2);
        }
    }
    
    updateCamera() {
        const cameraOffset = new THREE.Vector3(
            Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x) * this.cameraDistance,
            Math.sin(this.cameraRotation.x) * this.cameraDistance + this.cameraHeight,
            Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x) * this.cameraDistance
        );
        
        const targetPosition = this.airplane.position.clone().add(cameraOffset);
        this.camera.position.lerp(targetPosition, 0.1);
        
        this.camera.lookAt(this.airplane.position);
    }
    
    createRoom() {
        if (!this.peer) {
            this.peer = new Peer();
            this.peer.on('open', (id) => {
                this.roomId = id;
                document.getElementById('roomId').value = id;
                document.getElementById('connectionStatus').textContent = `Hosting: ${id}`;
                this.setupPeerListeners();
            });
        }
    }
    
    joinRoom() {
        const roomId = document.getElementById('roomId').value;
        if (!roomId) return;
        
        if (!this.peer) {
            this.peer = new Peer();
            this.peer.on('open', () => {
                this.connectToRoom(roomId);
                this.setupPeerListeners();
            });
        } else {
            this.connectToRoom(roomId);
        }
    }
    
    connectToRoom(roomId) {
        const conn = this.peer.connect(roomId);
        conn.on('open', () => {
            document.getElementById('connectionStatus').textContent = `Connected to: ${roomId}`;
            this.connections.set(roomId, conn);
            this.setupConnectionListeners(conn, roomId);
        });
    }
    
    setupPeerListeners() {
        this.peer.on('connection', (conn) => {
            this.connections.set(conn.peer, conn);
            this.setupConnectionListeners(conn, conn.peer);
        });
    }
    
    setupConnectionListeners(conn, peerId) {
        conn.on('data', (data) => {
            if (data.type === 'position') {
                this.updateOtherPlayer(peerId, data);
            }
        });
        
        conn.on('close', () => {
            this.connections.delete(peerId);
            this.removeOtherPlayer(peerId);
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
        this.renderer.render(this.scene, this.camera);
    }
}

function createRoom() {
    game.createRoom();
}

function joinRoom() {
    game.joinRoom();
}

const game = new FlightSimulator();