// 摄像机控制模块

export class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.offset = new THREE.Vector3(-30, 8, 0); // 后方30米，上方8米，固定距离
    }

    updateCamera(airplane) {
        // === 固定距离姿态跟随摄像机（Fixed Distance Attitude Following Camera）===
        // 摄像机保持固定距离跟随飞机，跟随所有姿态变化，稳定可靠

        const airplanePos = airplane.position.clone();
        const airplaneRotation = airplane.rotation.clone();

        // 1. 计算飞机的真实姿态方向（包含所有旋转轴）
        const forwardDirection = new THREE.Vector3(1, 0, 0); // 飞机前进方向
        const upDirection = new THREE.Vector3(0, 1, 0);       // 飞机上方向
        const rightDirection = new THREE.Vector3(0, 0, -1);   // 飞机右侧方向

        // 应用飞机的完整旋转
        forwardDirection.applyEuler(airplaneRotation);
        upDirection.applyEuler(airplaneRotation);
        rightDirection.applyEuler(airplaneRotation);

        // 2. 固定距离和高度 - 永远不变
        const cameraDistance = 30; // 固定距离30米，永不改变
        const cameraHeightOffset = 8; // 固定高度偏移8米，永不改变

        // 3. 计算摄像机位置：始终相对飞机的固定位置
        // 摄像机位置 = 飞机位置 - 前进方向 * 固定距离 + 上方向 * 固定高度偏移
        const cameraPosition = airplanePos.clone();
        cameraPosition.sub(forwardDirection.clone().multiplyScalar(cameraDistance));
        cameraPosition.add(upDirection.clone().multiplyScalar(cameraHeightOffset));

        // 4. 轻微平滑移动，只是为了避免微小抖动，保持响应性
        const smoothFactor = 0.15; // 适中的平滑度，既避免抖动又保持响应
        this.camera.position.lerp(cameraPosition, smoothFactor);

        // 5. 摄像机始终朝向飞机中心
        this.camera.lookAt(airplanePos);

        // 6. 设置摄像机的上方向跟随飞机的up方向（产生倾斜效果）
        const targetUp = upDirection.clone();
        this.camera.up.lerp(targetUp, smoothFactor);

        // 7. 更新摄像机矩阵
        this.camera.updateMatrixWorld();
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
