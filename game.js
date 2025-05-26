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
        
        this.init();
        this.setupControls();
        this.animate();
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
            
            const side = Math.random() > 0.5 ? 1 : -1;
            tree.position.set(
                Math.random() * 400 - 200,
                10,
                side * (Math.random() * 30 + 25)
            );
            tree.castShadow = true;
            this.scene.add(tree);
        }
        
        // Create more colorful buildings
        for (let i = 0; i < 25; i++) {
            const buildingWidth = Math.random() * 30 + 15;
            const buildingHeight = Math.random() * 100 + 40;
            const buildingDepth = Math.random() * 30 + 15;
            
            const buildingGeometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
            // More vibrant and varied colors
            const hue = Math.random(); // Full hue range
            const saturation = Math.random() * 0.6 + 0.4; // Higher saturation
            const lightness = Math.random() * 0.3 + 0.4; // Good brightness range
            const buildingMaterial = new THREE.MeshLambertMaterial({ 
                color: new THREE.Color().setHSL(hue, saturation, lightness) 
            });
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 500 + 100;
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
            const balloonRadius = Math.random() * 4 + 6;
            const balloonGeometry = new THREE.SphereGeometry(balloonRadius, 16, 12);
            
            // Create vibrant balloon colors
            const hue = Math.random();
            const saturation = Math.random() * 0.4 + 0.6; // High saturation
            const lightness = Math.random() * 0.3 + 0.5; // Good brightness
            const balloonMaterial = new THREE.MeshLambertMaterial({ 
                color: new THREE.Color().setHSL(hue, saturation, lightness) 
            });
            const balloon = new THREE.Mesh(balloonGeometry, balloonMaterial);
            
            // Position balloons around the scene
            const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
            const distance = Math.random() * 200 + 150;
            const height = Math.random() * 50 + 40;
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
                Math.random() * 10 + 5,
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
                (Math.random() - 0.5) * 1000,
                Math.random() * 200 + 100,
                (Math.random() - 0.5) * 1000
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
        const baseSpeed = 25;
        
        this.afterburnerActive = this.controls.ShiftLeft || this.controls.ShiftRight;
        
        if (this.controls.KeyW) {
            this.throttle = Math.min(this.throttle + deltaTime * 2, 1);
        }
        if (this.controls.KeyS) {
            // On ground (altitude <= 2.5), S provides reverse thrust for backing up
            if (this.airplane.position.y <= 2.5) {
                this.throttle = Math.max(this.throttle - deltaTime * 2, -0.5); // Allow negative throttle for reverse
            } else {
                // In air, S reduces forward throttle only
                this.throttle = Math.max(this.throttle - deltaTime * 2, 0);
            }
        }
        
        this.rudderAngle = this.rudderAngle || 0;
        const rudderSpeed = 2.0;
        
        // Only rotate rudder, not airplane directly
        // Always relative to airplane's local coordinate system (nose forward)
        if (this.controls.KeyA || this.controls.ArrowLeft) {
            // A key or Left arrow: rudder turns to airplane's left side
            this.rudderAngle = Math.min(this.rudderAngle + deltaTime * rudderSpeed, Math.PI / 8);
        } else if (this.controls.KeyD || this.controls.ArrowRight) {
            // D key or Right arrow: rudder turns to airplane's right side
            this.rudderAngle = Math.max(this.rudderAngle - deltaTime * rudderSpeed, -Math.PI / 8);
        } else {
            // Return rudder to neutral position when no input
            this.rudderAngle = THREE.MathUtils.lerp(this.rudderAngle, 0, deltaTime * 3);
        }
        
        this.rudderGroup.rotation.y = this.rudderAngle;
        
        this.wingAngle = this.wingAngle || 0;
        const wingSpeed = 2.5;
        
        // Wing control - Up/Down arrows control wings rotation around Z-axis
        if (this.controls.ArrowUp) {
            // Up arrow: wings tilt up around Z-axis (整体向上微微转动)
            this.wingAngle = Math.min(this.wingAngle + deltaTime * wingSpeed, Math.PI / 8);
        } else if (this.controls.ArrowDown) {
            // Down arrow: wings tilt down around Z-axis (整体向下微微转动)
            this.wingAngle = Math.max(this.wingAngle - deltaTime * wingSpeed, -Math.PI / 8);
        } else {
            // Return wings to neutral position when no input
            this.wingAngle = THREE.MathUtils.lerp(this.wingAngle, 0, deltaTime * 3);
        }
        
        this.wingGroup.rotation.z = this.wingAngle;
        
        let currentSpeed = baseSpeed * this.throttle;
        if (this.afterburnerActive) {
            currentSpeed *= 2.5;
            this.afterburner.material.opacity = Math.min(this.afterburner.material.opacity + deltaTime * 10, 1);
            this.afterburner.scale.set(1 + Math.random() * 0.3, 1 + Math.random() * 0.3, 1 + Math.random() * 0.5);
        } else {
            this.afterburner.material.opacity = Math.max(this.afterburner.material.opacity - deltaTime * 5, 0);
            this.afterburner.scale.set(1, 1, 1);
        }
        
        this.propeller.rotation.x += deltaTime * 30 * this.throttle;
        
        // Calculate base thrust direction (horizontal)
        const forwardDirection = new THREE.Vector3(
            Math.cos(this.airplane.rotation.y), // X component (forward/backward)
            0,
            -Math.sin(this.airplane.rotation.y) // Z component (left/right)
        );
        
        // Apply base horizontal thrust
        force.add(forwardDirection.clone().multiplyScalar(currentSpeed));
        
        // Wing Z-axis angle creates vertical thrust when throttle is applied
        if (this.throttle > 0) {
            // Wing angle directly creates vertical force
            const verticalThrustForce = this.wingAngle * this.throttle * baseSpeed * 2.0; // Strong vertical component
            force.y += verticalThrustForce;
        }
        
        // Realistic yaw physics based on rudder angle and speed
        if (currentSpeed > 5) { // Only apply yaw when moving with sufficient speed
            // Rudder angle: positive = left turn, negative = right turn
            const yawForce = this.rudderAngle * currentSpeed * 0.02;
            this.airplane.rotation.y += yawForce * deltaTime;
        }
        
        // Basic lift based on speed (independent of wing angle)
        const baseLift = Math.max(0, currentSpeed * 0.2 - 6);
        force.y += baseLift;
        
        // Realistic roll physics based on wing Z-axis angle and speed  
        if (currentSpeed > 5) {
            const rollForce = this.wingAngle * currentSpeed * 0.015; // Reduced roll effect
            this.airplane.rotation.z = (this.airplane.rotation.z || 0) + rollForce * deltaTime;
        }
        
        force.y -= 12;
        
        const drag = this.velocity.clone().multiplyScalar(-1.5);
        force.add(drag);
        
        this.velocity.add(force.clone().multiplyScalar(deltaTime));
        
        this.airplane.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        if (this.airplane.position.y < 2) {
            this.airplane.position.y = 2;
            this.velocity.y = Math.max(0, this.velocity.y);
        }
        
        this.updateUI();
        this.updateCamera();
        
        if (this.peer?.open) {
            this.broadcastPosition();
        }
    }
    
    updateUI() {
        const speed = this.velocity.length() * 3.6;
        const altitude = Math.max(0, this.airplane.position.y);
        
        document.getElementById('speed').textContent = Math.round(speed);
        document.getElementById('altitude').textContent = Math.round(altitude);
        document.getElementById('playerCount').textContent = this.connections.size + 1;
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