// 摄像机控制模块

export class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.offset = new THREE.Vector3(-30, 15, 0); // 后方30米，上方15米
    }

    updateCamera(airplane) {
        // === 真正的尾部跟随摄像机（True Tail Following Camera）===
        // 摄像机始终在飞机尾部方向，跟随飞机朝向，但保持固定距离

        const airplanePos = airplane.position.clone();
        const airplaneRotation = airplane.rotation.clone();

        // 1. 计算飞机的前进方向（只考虑Y轴旋转，即偏航）
        // 忽略俯仰和翻滚，只跟随飞机的水平朝向
        const yawOnly = new THREE.Euler(0, airplaneRotation.y, 0, 'XYZ');
        const forwardDirection = new THREE.Vector3(1, 0, 0);
        forwardDirection.applyEuler(yawOnly);

        // 2. 计算摄像机位置：在飞机尾部方向的固定距离
        const cameraDistance = 30; // 距离飞机30米
        const cameraHeight = 15;   // 高度15米

        // 摄像机位置 = 飞机位置 - 前进方向 * 距离 + 高度偏移
        const cameraPosition = airplanePos.clone();
        cameraPosition.sub(forwardDirection.clone().multiplyScalar(cameraDistance));
        cameraPosition.y += cameraHeight;

        // 3. 直接设置摄像机位置（无插值，无延迟）
        this.camera.position.copy(cameraPosition);

        // 4. 摄像机始终朝向飞机中心（确保飞机在屏幕正中央）
        this.camera.lookAt(airplanePos);

        // 5. 保持摄像机上方向为世界Y轴正方向（水平稳定）
        this.camera.up.set(0, 1, 0);

        // 6. 更新摄像机矩阵
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
