// 摄像机控制模块

export class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.offset = new THREE.Vector3(-30, 15, 0); // 后方30米，上方15米

        // 分层平滑控制
        this.positionSmoothSpeed = 12.0; // 位置跟随速度
        this.rotationSmoothSpeed = 15.0; // 旋转跟随速度
        this.emergencySpeed = 30.0; // 紧急跟随速度

        // 预测和补偿系统
        this.velocityHistory = []; // 飞机速度历史
        this.rotationHistory = []; // 飞机旋转历史
        this.historyLength = 5; // 历史记录长度

        // 状态记录
        this.lastAirplanePosition = new THREE.Vector3();
        this.lastAirplaneRotation = new THREE.Euler();
        this.cameraVelocity = new THREE.Vector3(); // 摄像机运动速度
    }

    updateCamera(airplane) {
        // === 固定相对位置摄像机（Fixed Relative Position Camera）===
        // 确保飞机始终在屏幕中央，摄像机始终在飞机尾部朝向机头

        const airplanePos = airplane.position.clone();
        const airplaneRotation = airplane.rotation.clone();

        // 1. 计算飞机的局部坐标系方向向量
        // 飞机的前方向（机头方向）
        const forwardDirection = new THREE.Vector3(1, 0, 0);
        forwardDirection.applyEuler(airplaneRotation);

        // 飞机的上方向
        const upDirection = new THREE.Vector3(0, 1, 0);
        upDirection.applyEuler(airplaneRotation);

        // 飞机的右方向
        const rightDirection = new THREE.Vector3(0, 0, -1);
        rightDirection.applyEuler(airplaneRotation);

        // 2. 计算摄像机的目标位置
        // 摄像机始终在飞机尾部固定距离（基于飞机的局部坐标系）
        const localOffset = new THREE.Vector3(-30, 15, 0); // 后方30米，上方15米，左右居中

        const targetPosition = airplanePos.clone()
            .add(forwardDirection.clone().multiplyScalar(localOffset.x))  // 前后偏移（负值=后方）
            .add(upDirection.clone().multiplyScalar(localOffset.y))       // 上下偏移（正值=上方）
            .add(rightDirection.clone().multiplyScalar(localOffset.z));   // 左右偏移（0=居中）

        // 3. 直接设置摄像机位置，确保始终跟上飞机
        // 不使用插值，避免任何延迟导致的偏移
        this.camera.position.copy(targetPosition);

        // 4. 摄像机始终朝向飞机中心，确保飞机在屏幕正中央
        this.camera.lookAt(airplanePos);

        // 5. 保持摄像机的上方向为世界坐标系的上方向
        // 这样可以避免摄像机跟随飞机翻滚，保持稳定的水平视角
        this.camera.up.set(0, 1, 0);
        this.camera.updateMatrixWorld();

        // 6. 更新状态记录（用于其他可能的功能）
        this.lastAirplanePosition.copy(airplanePos);
        this.lastAirplaneRotation.copy(airplaneRotation);
    }

    // 设置摄像机偏移量
    setOffset(x, y, z) {
        this.offset.set(x, y, z);
    }

    // 设置平滑跟随速度
    setSmoothSpeed(speed) {
        this.smoothSpeed = speed;
    }

    // 获取当前摄像机位置
    getPosition() {
        return this.camera.position.clone();
    }

    // 获取摄像机朝向
    getDirection() {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        return direction;
    }

    // 处理窗口大小变化
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
}
