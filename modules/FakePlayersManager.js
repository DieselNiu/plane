// 假玩家管理器模块 - 用于显示假的其他飞机和动态在线人数

export class FakePlayersManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.fakePlayers = new Map(); // 存储假玩家
        this.fakePlayerCount = 0; // 当前假玩家数量
        this.targetPlayerCount = 20; // 目标稳定在20人左右
        this.updateInterval = null;
        this.playerCountChangeInterval = null;
        
        // 假玩家配置
        this.config = {
            maxFakePlayers: 25,
            minFakePlayers: 15,
            updateFrequency: 100, // 位置更新频率 (ms)
            countChangeFrequency: 5000, // 人数变化频率 (ms)
            spawnRadius: 2000, // 生成半径
            maxDistance: 3000, // 最大距离
            colors: [
                0xff6600, // 橙色
                0x00ff66, // 绿色
                0x6600ff, // 紫色
                0xff0066, // 粉色
                0x0066ff, // 蓝色
                0xffff00, // 黄色
                0x00ffff, // 青色
                0xff3300, // 红色
            ]
        };
        
        // 飞行模式配置
        this.flightPatterns = [
            'circle', // 圆形飞行
            'straight', // 直线飞行
            'figure8', // 8字飞行
            'random', // 随机飞行
            'formation' // 编队飞行
        ];
        
        this.init();
    }
    
    init() {
        console.log('初始化假玩家管理器...');
        
        // 初始生成一些假玩家
        this.generateInitialFakePlayers();
        
        // 开始更新循环
        this.startUpdateLoop();
        
        // 开始人数变化循环
        this.startPlayerCountChangeLoop();
    }
    
    // 生成初始假玩家
    generateInitialFakePlayers() {
        const initialCount = Math.floor(Math.random() * 8) + 12; // 12-20个初始玩家
        
        for (let i = 0; i < initialCount; i++) {
            this.createFakePlayer();
        }
        
        this.fakePlayerCount = initialCount;
        console.log(`生成了 ${initialCount} 个假玩家`);
    }
    
    // 创建假玩家
    createFakePlayer(nearPlayer = false) {
        const playerId = `fake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 创建飞机模型
        const airplane = this.simulator.airplane.clone();
        
        // 随机颜色
        const color = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
        airplane.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.color.setHex(color);
            }
        });
        
        // 随机初始位置（在玩家周围）
        const angle = Math.random() * Math.PI * 2;
        let distance;
        let height;
        
        if (nearPlayer) {
            // 在玩家附近生成（模拟新玩家加入）
            distance = Math.random() * 800 + 200; // 200-1000m
            height = this.simulator.airplane.position.y + (Math.random() - 0.5) * 200;
        } else {
            // 在较远处生成
            distance = Math.random() * this.config.spawnRadius + 500;
            height = Math.random() * 500 + 100;
        }
        
        const playerPos = this.simulator.airplane.position;
        airplane.position.set(
            playerPos.x + Math.cos(angle) * distance,
            Math.max(50, height), // 确保不会在地面以下
            playerPos.z + Math.sin(angle) * distance
        );
        
        // 随机初始旋转
        airplane.rotation.set(
            (Math.random() - 0.5) * 0.2,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.3
        );
        
        // 创建假玩家数据
        const fakePlayer = {
            id: playerId,
            airplane: airplane,
            position: airplane.position.clone(),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 100
            ),
            pattern: this.flightPatterns[Math.floor(Math.random() * this.flightPatterns.length)],
            patternTime: 0,
            patternData: this.generatePatternData(),
            lastUpdate: Date.now(),
            speed: Math.random() * 200 + 150, // 150-350 km/h
            targetAltitude: Math.random() * 400 + 100,
            isActive: true
        };
        
        // 添加到场景
        this.simulator.scene.add(airplane);
        
        // 存储假玩家
        this.fakePlayers.set(playerId, fakePlayer);
        
        return fakePlayer;
    }
    
    // 生成飞行模式数据
    generatePatternData() {
        return {
            centerX: Math.random() * 4000 - 2000,
            centerZ: Math.random() * 4000 - 2000,
            radius: Math.random() * 800 + 200,
            speed: Math.random() * 0.5 + 0.3,
            direction: Math.random() > 0.5 ? 1 : -1,
            phase: Math.random() * Math.PI * 2
        };
    }
    
    // 开始更新循环
    startUpdateLoop() {
        this.updateInterval = setInterval(() => {
            this.updateFakePlayers();
        }, this.config.updateFrequency);
    }
    
    // 开始人数变化循环
    startPlayerCountChangeLoop() {
        this.playerCountChangeInterval = setInterval(() => {
            this.updatePlayerCount();
        }, this.config.countChangeFrequency);
    }
    
    // 更新假玩家
    updateFakePlayers() {
        const currentTime = Date.now();
        const deltaTime = this.config.updateFrequency / 1000;
        const playerPos = this.simulator.airplane.position;
        
        for (const [playerId, fakePlayer] of this.fakePlayers.entries()) {
            if (!fakePlayer.isActive) continue;
            
            // 检查距离，移除过远的玩家
            const distance = fakePlayer.position.distanceTo(playerPos);
            if (distance > this.config.maxDistance) {
                this.removeFakePlayer(playerId);
                continue;
            }
            
            // 距离太远时降低更新频率
            const updateDistance = 1500; // 1.5km内正常更新
            if (distance > updateDistance && Math.random() > 0.3) {
                continue; // 70%的概率跳过远距离更新
            }
            
            // 更新飞行模式时间
            fakePlayer.patternTime += deltaTime;
            
            // 根据飞行模式更新位置
            this.updatePlayerMovement(fakePlayer, deltaTime, playerPos);
            
            // 更新飞机位置和旋转
            fakePlayer.airplane.position.copy(fakePlayer.position);
            this.updatePlayerRotation(fakePlayer);
        }
    }
    
    // 更新玩家移动
    updatePlayerMovement(fakePlayer, deltaTime, playerPos) {
        const pattern = fakePlayer.pattern;
        const data = fakePlayer.patternData;
        
        switch (pattern) {
            case 'circle':
                this.updateCirclePattern(fakePlayer, deltaTime, data);
                break;
            case 'straight':
                this.updateStraightPattern(fakePlayer, deltaTime, data);
                break;
            case 'figure8':
                this.updateFigure8Pattern(fakePlayer, deltaTime, data);
                break;
            case 'random':
                this.updateRandomPattern(fakePlayer, deltaTime, data);
                break;
            case 'formation':
                this.updateFormationPattern(fakePlayer, deltaTime, playerPos);
                break;
        }
        
        // 高度控制
        const altitudeDiff = fakePlayer.targetAltitude - fakePlayer.position.y;
        fakePlayer.velocity.y = altitudeDiff * 0.5;
        
        // 应用速度
        fakePlayer.position.add(fakePlayer.velocity.clone().multiplyScalar(deltaTime));
        
        // 限制高度
        fakePlayer.position.y = Math.max(50, Math.min(1000, fakePlayer.position.y));
    }
    
    // 圆形飞行模式
    updateCirclePattern(fakePlayer, deltaTime, data) {
        const angle = fakePlayer.patternTime * data.speed * data.direction + data.phase;
        const targetX = data.centerX + Math.cos(angle) * data.radius;
        const targetZ = data.centerZ + Math.sin(angle) * data.radius;
        
        fakePlayer.velocity.x = (targetX - fakePlayer.position.x) * 2;
        fakePlayer.velocity.z = (targetZ - fakePlayer.position.z) * 2;
    }
    
    // 直线飞行模式
    updateStraightPattern(fakePlayer, deltaTime, data) {
        const speed = fakePlayer.speed / 3.6; // 转换为 m/s
        fakePlayer.velocity.x = Math.cos(data.phase) * speed;
        fakePlayer.velocity.z = Math.sin(data.phase) * speed;
        
        // 偶尔改变方向
        if (Math.random() < 0.001) {
            data.phase += (Math.random() - 0.5) * 0.5;
        }
    }
    
    // 8字飞行模式
    updateFigure8Pattern(fakePlayer, deltaTime, data) {
        const t = fakePlayer.patternTime * data.speed;
        const targetX = data.centerX + Math.sin(t) * data.radius;
        const targetZ = data.centerZ + Math.sin(t * 2) * data.radius * 0.5;
        
        fakePlayer.velocity.x = (targetX - fakePlayer.position.x) * 2;
        fakePlayer.velocity.z = (targetZ - fakePlayer.position.z) * 2;
    }
    
    // 随机飞行模式
    updateRandomPattern(fakePlayer, deltaTime, data) {
        // 随机改变方向
        if (Math.random() < 0.01) {
            data.phase += (Math.random() - 0.5) * 1.0;
            fakePlayer.targetAltitude = Math.random() * 400 + 100;
        }
        
        const speed = fakePlayer.speed / 3.6;
        fakePlayer.velocity.x = Math.cos(data.phase) * speed;
        fakePlayer.velocity.z = Math.sin(data.phase) * speed;
    }
    
    // 编队飞行模式
    updateFormationPattern(fakePlayer, deltaTime, playerPos) {
        // 跟随玩家，保持一定距离
        if (!fakePlayer.patternData.formationOffset) {
            fakePlayer.patternData.formationOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 400,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 400
            );
        }
        
        const targetPos = playerPos.clone().add(fakePlayer.patternData.formationOffset);
        const direction = targetPos.clone().sub(fakePlayer.position);
        
        // 保持合理的跟随距离
        const distance = direction.length();
        if (distance > 50) {
            direction.normalize();
            fakePlayer.velocity.x = direction.x * Math.min(distance * 0.5, 100);
            fakePlayer.velocity.z = direction.z * Math.min(distance * 0.5, 100);
        } else {
            // 距离太近时减速
            fakePlayer.velocity.x *= 0.8;
            fakePlayer.velocity.z *= 0.8;
        }
    }
    
    // 更新玩家旋转
    updatePlayerRotation(fakePlayer) {
        const velocity = fakePlayer.velocity;
        
        // 根据速度方向设置航向
        if (velocity.length() > 0.1) {
            fakePlayer.airplane.rotation.y = Math.atan2(velocity.x, velocity.z);
            
            // 根据转弯设置倾斜
            const turnRate = velocity.x * 0.01;
            fakePlayer.airplane.rotation.z = -turnRate;
            
            // 根据爬升/下降设置俯仰
            const climbRate = velocity.y * 0.02;
            fakePlayer.airplane.rotation.x = -climbRate;
        }
    }
    
    // 更新玩家数量
    updatePlayerCount() {
        const currentCount = this.fakePlayers.size;
        const realPlayerCount = this.simulator.multiplayerManager.connections.size + 1; // 包括自己
        
        // 计算目标假玩家数量（总目标 - 真实玩家数量）
        const targetFakeCount = Math.max(0, this.targetPlayerCount - realPlayerCount);
        
        // 随机变化目标人数（在15-25之间波动）
        if (Math.random() < 0.3) {
            this.targetPlayerCount = Math.floor(Math.random() * 11) + 15; // 15-25
        }
        
        // 根据当前数量调整
        if (currentCount < targetFakeCount && currentCount < this.config.maxFakePlayers) {
            // 增加假玩家
            const addCount = Math.min(
                Math.floor(Math.random() * 3) + 1, // 一次最多增加3个
                targetFakeCount - currentCount,
                this.config.maxFakePlayers - currentCount
            );
            
            for (let i = 0; i < addCount; i++) {
                // 50%的概率在玩家附近生成新玩家
                const nearPlayer = Math.random() < 0.5;
                this.createFakePlayer(nearPlayer);
            }
            
            console.log(`增加了 ${addCount} 个假玩家，当前总数: ${this.fakePlayers.size}`);
            
        } else if (currentCount > targetFakeCount || currentCount > this.config.maxFakePlayers) {
            // 减少假玩家
            const removeCount = Math.min(
                Math.floor(Math.random() * 2) + 1, // 一次最多移除2个
                currentCount - Math.max(targetFakeCount, this.config.minFakePlayers)
            );
            
            if (removeCount > 0) {
                this.removeRandomFakePlayers(removeCount);
                console.log(`移除了 ${removeCount} 个假玩家，当前总数: ${this.fakePlayers.size}`);
            }
        }
    }
    
    // 移除随机假玩家
    removeRandomFakePlayers(count) {
        const playerIds = Array.from(this.fakePlayers.keys());
        
        for (let i = 0; i < count && playerIds.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * playerIds.length);
            const playerId = playerIds.splice(randomIndex, 1)[0];
            this.removeFakePlayer(playerId);
        }
    }
    
    // 移除假玩家
    removeFakePlayer(playerId) {
        const fakePlayer = this.fakePlayers.get(playerId);
        if (fakePlayer) {
            // 从场景中移除
            this.simulator.scene.remove(fakePlayer.airplane);
            
            // 从映射中移除
            this.fakePlayers.delete(playerId);
        }
    }
    
    // 获取总玩家数量（真实 + 假的）
    getTotalPlayerCount() {
        const realPlayerCount = this.simulator.multiplayerManager.connections.size + 1;
        const fakePlayerCount = this.fakePlayers.size;
        return realPlayerCount + fakePlayerCount;
    }
    
    // 获取假玩家数量
    getFakePlayerCount() {
        return this.fakePlayers.size;
    }
    
    // 清理所有假玩家
    cleanup() {
        console.log('清理所有假玩家...');
        
        // 清除定时器
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.playerCountChangeInterval) {
            clearInterval(this.playerCountChangeInterval);
            this.playerCountChangeInterval = null;
        }
        
        // 移除所有假玩家
        for (const [playerId, fakePlayer] of this.fakePlayers.entries()) {
            this.simulator.scene.remove(fakePlayer.airplane);
        }
        
        this.fakePlayers.clear();
    }
    
    // 暂停/恢复假玩家系统
    setPaused(paused) {
        if (paused) {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            if (this.playerCountChangeInterval) {
                clearInterval(this.playerCountChangeInterval);
                this.playerCountChangeInterval = null;
            }
        } else {
            this.startUpdateLoop();
            this.startPlayerCountChangeLoop();
        }
    }
    
    // 设置目标玩家数量
    setTargetPlayerCount(count) {
        this.targetPlayerCount = Math.max(this.config.minFakePlayers, Math.min(this.config.maxFakePlayers, count));
        console.log(`设置目标玩家数量为: ${this.targetPlayerCount}`);
    }
} 