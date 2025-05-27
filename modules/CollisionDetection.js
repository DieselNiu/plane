// 碰撞检测模块

export class CollisionDetection {
    constructor(simulator) {
        this.simulator = simulator;
        this.buildings = [];
        this.groundLevel = 2; // 地面高度
        this.isGameOver = false;
        
        // 从环境中收集建筑物信息
        this.collectBuildingData();
    }

    // 收集场景中的建筑物数据
    collectBuildingData() {
        // 根据Environment.js中的建筑物创建碰撞盒
        
        // 1. 风车 (8个)
        for (let i = 0; i < 8; i++) {
            // 模拟风车的位置生成逻辑
            let x;
            let z;
            do {
                x = this.simulator.rng() * 1500 - 750;
                z = this.simulator.rng() * 1500 - 750;
            } while (x > -600 && x < 600 && z > -60 && z < 60);
            
            this.buildings.push({
                type: 'windmill',
                x: x,
                z: z,
                width: 10,
                height: 60,
                depth: 10
            });
        }

        // 2. 摩天轮
        this.buildings.push({
            type: 'ferriswheel',
            x: 200,
            z: 200,
            width: 90, // 直径80 + 安全边距
            height: 85,
            depth: 90
        });

        // 3. 灯塔
        this.buildings.push({
            type: 'lighthouse',
            x: -300,
            z: 300,
            width: 20,
            height: 85,
            depth: 20
        });

        // 4. 体育场
        this.buildings.push({
            type: 'stadium',
            x: -400,
            z: -400,
            width: 140, // 直径130 + 安全边距
            height: 30,
            depth: 140
        });

        // 5. 桥梁
        this.buildings.push({
            type: 'bridge',
            x: 0,
            z: 150,
            width: 200,
            height: 15,
            depth: 20
        });

        // 6. 火箭发射台
        this.buildings.push({
            type: 'rocket',
            x: 400,
            z: -300,
            width: 25,
            height: 65,
            depth: 25
        });

        // 7. 随机建筑物 (60个)
        for (let i = 0; i < 60; i++) {
            const buildingWidth = this.simulator.rng() * 40 + 20;
            const buildingHeight = this.simulator.rng() * 150 + 50;
            const buildingDepth = this.simulator.rng() * 40 + 20;

            let x;
            let z;
            do {
                const angle = this.simulator.rng() * Math.PI * 2;
                const distance = this.simulator.rng() * 1500 + 800;
                x = Math.cos(angle) * distance;
                z = Math.sin(angle) * distance;
            } while (x > -800 && x < 800 && z > -200 && z < 200);

            this.buildings.push({
                type: 'building',
                x: x,
                z: z,
                width: buildingWidth + 10, // 添加安全边距
                height: buildingHeight + 10,
                depth: buildingDepth + 10
            });
        }

        console.log(`碰撞检测系统已初始化，共监测 ${this.buildings.length} 个建筑物`);
    }

    // 检测碰撞
    checkCollisions() {
        if (this.isGameOver) return false;

        const airplane = this.simulator.airplane;
        const airplanePos = airplane.position;

        // 1. 检测地面碰撞
        if (this.checkGroundCollision(airplanePos)) {
            this.triggerGameOver('地面碰撞');
            return true;
        }

        // 2. 检测建筑物碰撞
        const collidedBuilding = this.checkBuildingCollisions(airplanePos);
        if (collidedBuilding) {
            this.triggerGameOver(`撞击${this.getBuildingName(collidedBuilding.type)}`);
            return true;
        }

        return false;
    }

    // 检测地面碰撞
    checkGroundCollision(airplanePos) {
        // 飞机在地面模式下允许接触地面，但在空中模式下不允许
        if (this.simulator.flightMode === 'air' && airplanePos.y <= this.groundLevel) {
            return true;
        }
        
        // 地面模式下，如果飞机速度过快且撞击地面也算碰撞
        if (this.simulator.flightMode === 'ground') {
            const speed = this.simulator.velocity.length() * 3.6;
            if (speed > 50 && airplanePos.y < this.groundLevel - 1) {
                return true;
            }
        }

        return false;
    }

    // 检测建筑物碰撞
    checkBuildingCollisions(airplanePos) {
        const safetyMargin = 5; // 安全边距

        for (const building of this.buildings) {
            // 简单的AABB碰撞检测
            const dx = Math.abs(airplanePos.x - building.x);
            const dy = Math.abs(airplanePos.y - building.height / 2);
            const dz = Math.abs(airplanePos.z - building.z);

            if (dx < (building.width / 2 + safetyMargin) &&
                dy < (building.height / 2 + safetyMargin) &&
                dz < (building.depth / 2 + safetyMargin)) {
                return building;
            }
        }

        return null;
    }

    // 获取建筑物名称
    getBuildingName(type) {
        const names = {
            'windmill': '风车',
            'ferriswheel': '摩天轮',
            'lighthouse': '灯塔',
            'stadium': '体育场',
            'bridge': '桥梁',
            'rocket': '火箭发射台',
            'building': '建筑物'
        };
        return names[type] || '未知建筑';
    }

    // 触发游戏结束
    triggerGameOver(reason) {
        if (this.isGameOver) return;
        
        this.isGameOver = true;
        console.log(`游戏结束: ${reason}`);
        
        // 通知UI控制器显示Game Over界面
        this.simulator.uiController.showGameOver(reason);
        
        // 停止飞机运动
        this.simulator.velocity.set(0, 0, 0);
        this.simulator.throttle = 0;
    }

    // 重置碰撞检测状态
    reset() {
        this.isGameOver = false;
        console.log('碰撞检测系统已重置');
    }

    // 获取游戏状态
    isGameOverState() {
        return this.isGameOver;
    }
} 