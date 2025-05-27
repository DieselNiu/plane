// 环境和场景创建模块

export class Environment {
    constructor(scene, rng) {
        this.scene = scene;
        this.rng = rng;

        this.createEnvironment();
    }

    createEnvironment() {
        // 创建地面
        this.createGround();

        // 创建跑道
        this.createRunway();

        // 创建跑道标记
        this.createRunwayMarkings();

        // 创建斑马线
        this.createZebraCrossing();

        // 创建跑道边灯
        this.createRunwayLights();

        // 创建建筑物
        this.createBuildings();

        // 创建额外装饰元素
        this.createAdditionalElements();

        // 创建广告牌
        this.createRightFrontBillboard();

        // 创建悬浮横幅
        this.createFloatingBanner();
    }

    createGround() {
        // 大幅扩大地图尺寸
        const groundGeometry = new THREE.PlaneGeometry(10000, 10000);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    createRunway() {
        // 大幅加长跑道(长度从1200增加到2500)
        const runwayGeometry = new THREE.PlaneGeometry(2500, 80);
        const runwayMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
        runway.rotation.x = -Math.PI / 2;
        runway.position.y = 0.1;
        runway.receiveShadow = true;
        this.scene.add(runway);
    }

    createRunwayMarkings() {
        // Add three red takeoff lines perpendicular to airplane (vertical to runway)
        const takeoffLineMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        for (let i = 0; i < 3; i++) {
            const takeoffLineGeometry = new THREE.PlaneGeometry(1.5, 40);
            const takeoffLine = new THREE.Mesh(takeoffLineGeometry, takeoffLineMaterial);
            takeoffLine.rotation.x = -Math.PI / 2;
            takeoffLine.rotation.z = Math.PI / 2;
            takeoffLine.position.set(-370 + i * 2, 0.16, 0);
            this.scene.add(takeoffLine);
        }

        // 更多跑道标记适应加长跑道
        for (let i = 0; i < 40; i++) {
            const markingGeometry = new THREE.PlaneGeometry(25, 3);
            const markingMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            marking.rotation.x = -Math.PI / 2;
            marking.position.set(i * 60 - 1200, 0.15, 0);
            this.scene.add(marking);
        }
    }

    createZebraCrossing() {
        // 在起飞点前方创建斑马线（横跨跑道）
        const zebraStripeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const numStripes = 8;
        const stripeWidth = 3;
        const stripeLength = 75;

        for (let i = 0; i < numStripes; i++) {
            const stripeGeometry = new THREE.PlaneGeometry(stripeWidth, stripeLength);
            const stripe = new THREE.Mesh(stripeGeometry, zebraStripeMaterial);
            stripe.rotation.x = -Math.PI / 2;
            stripe.position.set(-380 + i * 6, 0.17, 0);
            this.scene.add(stripe);
        }
    }

    createRunwayLights() {
        // 跑道边灯 - 沿着跑道两侧放置
        const lightMaterial = new THREE.MeshLambertMaterial({
            color: 0xffff00,
            emissive: 0x333300
        });

        // 大幅增加跑道边灯数量，覆盖整个加长跑道
        for (let i = 0; i < 80; i++) {
            // 左侧边灯
            const leftLightGeometry = new THREE.SphereGeometry(0.8, 8, 6);
            const leftLight = new THREE.Mesh(leftLightGeometry, lightMaterial);
            leftLight.position.set(-1200 + i * 30, 1.5, 42);
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

    createBuildings() {
        // Create more colorful buildings (完全避开起飞区域，只在远距离生成)
        for (let i = 0; i < 60; i++) {
            const buildingWidth = this.rng() * 40 + 20;
            const buildingHeight = this.rng() * 150 + 50;
            const buildingDepth = this.rng() * 40 + 20;

            const buildingGeometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
            // More vibrant and varied colors
            const hue = this.rng();
            const saturation = this.rng() * 0.6 + 0.4;
            const lightness = this.rng() * 0.3 + 0.4;
            const buildingMaterial = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(hue, saturation, lightness)
            });
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);

            let x;
            let z;
            do {
                const angle = this.rng() * Math.PI * 2;
                const distance = this.rng() * 1500 + 800;
                x = Math.cos(angle) * distance;
                z = Math.sin(angle) * distance;
            } while (x > -800 && x < 800 && z > -200 && z < 200);

            building.position.set(x, buildingHeight / 2, z);
            building.castShadow = true;
            this.scene.add(building);
        }
    }

    createAdditionalElements() {
        // 1. 添加风车
        this.createWindmills();

        // 2. 添加摩天轮
        this.createFerrisWheel();

        // 3. 添加灯塔
        this.createLighthouse();

        // 4. 添加体育场
        this.createStadium();

        // 5. 添加桥梁
        this.createBridge();

        // 6. 添加火箭发射台
        this.createRocketLaunchPad();
    }

    createWindmills() {
        for (let i = 0; i < 8; i++) {
            const windmillHeight = 60;
            const poleGeometry = new THREE.CylinderGeometry(1, 1.5, windmillHeight, 8);
            const poleMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
            const pole = new THREE.Mesh(poleGeometry, poleMaterial);

            let x, z;
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
    }

    createFerrisWheel() {
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
    }

    createLighthouse() {
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
    }

    createStadium() {
        const stadiumGeometry = new THREE.CylinderGeometry(60, 65, 30, 16);
        const stadiumMaterial = new THREE.MeshLambertMaterial({ color: 0x4ecdc4 });
        const stadium = new THREE.Mesh(stadiumGeometry, stadiumMaterial);
        stadium.position.set(-400, 15, -400);
        stadium.castShadow = true;
        this.scene.add(stadium);
    }

    createBridge() {
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
    }

    createRocketLaunchPad() {
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

    createRightFrontBillboard() {
        const billboardX = -280;
        const billboardZ = 60;

        // 创建文字纹理
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const context = canvas.getContext('2d');

        // 深青绿色背景
        context.fillStyle = '#03665A';
        context.fillRect(0, 0, 1024, 512);

        // 添加细微的边框
        context.strokeStyle = '#025a4f';
        context.lineWidth = 6;
        context.strokeRect(3, 3, 1018, 506);

        // 设置文字样式
        context.fillStyle = '#ffffff';
        context.font = 'bold 140px SimHei, "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // 添加文字阴影效果
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

        // 创建广告牌
        const billboardGeometry = new THREE.PlaneGeometry(30, 15);
        const billboardMaterial = new THREE.MeshBasicMaterial({
            map: textTexture,
            transparent: false,
            side: THREE.DoubleSide,
            color: 0xffffff
        });

        const billboard = new THREE.Mesh(billboardGeometry, billboardMaterial);
        billboard.position.set(billboardX, 7.5, billboardZ);
        billboard.lookAt(-350, 7.5, 0);
        billboard.castShadow = true;
        billboard.receiveShadow = true;

        this.scene.add(billboard);
    }

    createFloatingBanner() {
        const bannerX = -280;
        const bannerZ = -60;
        const bannerHeight = 12;

        // 创建悬浮挂牌组
        const bannerGroup = new THREE.Group();

        // 使用THREE.TextureLoader直接加载image.png文件
        const textureLoader = new THREE.TextureLoader();

        textureLoader.load(
            './image.png',
            (bannerTexture) => {
                bannerTexture.generateMipmaps = false;
                bannerTexture.minFilter = THREE.LinearFilter;
                bannerTexture.magFilter = THREE.LinearFilter;

                const bannerGeometry = new THREE.PlaneGeometry(16, 6);
                const bannerMaterial = new THREE.MeshBasicMaterial({
                    map: bannerTexture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    opacity: 1.0
                });

                const banner = new THREE.Mesh(bannerGeometry, bannerMaterial);
                banner.position.set(0, bannerHeight, 0);
                banner.lookAt(bannerX, bannerHeight, 0);

                bannerGroup.add(banner);
                console.log('image.png 已成功加载并显示在悬浮挂牌上！');
            },
            (progress) => {
                console.log(`正在加载横幅图片 image.png... ${Math.round((progress.loaded / progress.total * 100))}%`);
            },
            (error) => {
                console.error('无法加载 image.png 用于横幅:', error);
                this.createFallbackBanner(bannerGroup, bannerHeight, bannerX);
            }
        );

        bannerGroup.position.set(bannerX, 0, bannerZ);
        this.scene.add(bannerGroup);

        // 保存引用用于动画
        this.bannerGroup = bannerGroup;
    }

    createFallbackBanner(bannerGroup, bannerHeight, bannerX) {
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

        const bannerTexture = new THREE.CanvasTexture(bannerCanvas);
        bannerTexture.generateMipmaps = false;
        bannerTexture.minFilter = THREE.LinearFilter;
        bannerTexture.magFilter = THREE.LinearFilter;

        const bannerGeometry = new THREE.PlaneGeometry(16, 6);
        const bannerMaterial = new THREE.MeshBasicMaterial({
            map: bannerTexture,
            transparent: true,
            side: THREE.DoubleSide
        });

        const banner = new THREE.Mesh(bannerGeometry, bannerMaterial);
        banner.position.set(0, bannerHeight, 0);
        banner.lookAt(bannerX, bannerHeight, 0);

        bannerGroup.add(banner);
    }

    // 获取横幅组引用（用于动画）
    getBannerGroup() {
        return this.bannerGroup;
    }
}
