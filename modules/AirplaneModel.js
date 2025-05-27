// 飞机3D模型创建模块

export class AirplaneModel {
    constructor(scene) {
        this.scene = scene;
        this.airplane = null;
        this.propeller = null;
        this.afterburner = null;
        this.engine = null;
        this.wingGroup = null;
        this.rudderGroup = null;
        
        this.createAirplane();
    }
    
    createAirplane() {
        this.airplane = new THREE.Group();
        
        // 机身
        this.createFuselage();
        
        // 机头
        this.createNose();
        
        // 螺旋桨
        this.createPropeller();
        
        // 驾驶舱
        this.createCockpit();
        
        // 机翼
        this.createWings();
        
        // 尾翼
        this.createTail();
        
        // 起落架
        this.createLandingGear();
        
        // 发动机
        this.createEngine();
        
        // 后燃器
        this.createAfterburner();
        
        // Position airplane at the start of runway
        this.airplane.position.set(-350, 2, 0);
        this.scene.add(this.airplane);
    }
    
    createFuselage() {
        const fuselageGeometry = new THREE.CylinderGeometry(0.3, 0.8, 12, 12);
        const fuselageMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x888888,
            shininess: 100
        });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        fuselage.rotation.z = Math.PI / 2;
        fuselage.castShadow = true;
        this.airplane.add(fuselage);
    }
    
    createNose() {
        const noseGeometry = new THREE.ConeGeometry(0.3, 2, 8);
        const fuselageMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x888888,
            shininess: 100
        });
        const nose = new THREE.Mesh(noseGeometry, fuselageMaterial);
        nose.rotation.z = -Math.PI / 2;
        nose.position.x = 7;
        this.airplane.add(nose);
    }
    
    createPropeller() {
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
    }
    
    createCockpit() {
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
    }
    
    createWings() {
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
    }
    
    createTail() {
        const wingMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x555555,
            shininess: 80
        });
        
        // 水平尾翼
        const tailWingGeometry = new THREE.BoxGeometry(3, 0.2, 2.5);
        const tailWing = new THREE.Mesh(tailWingGeometry, wingMaterial);
        tailWing.position.x = -4;
        tailWing.castShadow = true;
        this.airplane.add(tailWing);
        
        // 垂直尾翼和方向舵
        this.createRudder(wingMaterial);
    }
    
    createRudder(wingMaterial) {
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
    }
    
    createLandingGear() {
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
    }
    
    createEngine() {
        const engineGeometry = new THREE.CylinderGeometry(0.4, 0.6, 3, 12);
        const engineMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        this.engine = new THREE.Mesh(engineGeometry, engineMaterial);
        this.engine.rotation.z = Math.PI / 2;
        this.engine.position.x = -5.5;
        this.airplane.add(this.engine);
    }
    
    createAfterburner() {
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
    }
    
    // 获取飞机对象
    getAirplane() {
        return this.airplane;
    }
    
    // 获取螺旋桨对象
    getPropeller() {
        return this.propeller;
    }
    
    // 获取后燃器对象
    getAfterburner() {
        return this.afterburner;
    }
    
    // 获取机翼组对象
    getWingGroup() {
        return this.wingGroup;
    }
    
    // 获取方向舵组对象
    getRudderGroup() {
        return this.rudderGroup;
    }
}
