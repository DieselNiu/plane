// 摄像机控制模块

export class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.smoothSpeed = 2.0; // 平滑跟随速度
        this.offset = new THREE.Vector3(-30, 15, 0); // 后方30米，上方15米
    }
    
    updateCamera(airplane) {
        // === 第三人称跟随摄像机（Third-Person Follow Camera）===
        // 严格按照文档2.md要求实现
        
        // 1. 位置锁定机制：飞机始终居中，固定相对距离
        const airplanePos = airplane.position.clone();
        
        // 2. 固定偏移量：摄像机位置 = 飞机位置 + 固定偏移量
        // 偏移量在飞机的后上方
        const targetPosition = airplanePos.clone().add(this.offset);
        
        // 3. 平滑跟随算法：使用Vector3.Lerp实现平滑跟随
        // 当前摄像机位置平滑插值到目标位置
        this.camera.position.lerp(targetPosition, this.smoothSpeed * 0.016); // 假设60fps
        
        // 4. 视角锁定：摄像机始终朝向飞机中心点
        // 无论飞机如何翻滚、俯仰、偏航，摄像机的相对位置关系保持不变
        this.camera.lookAt(airplanePos);
        
        // 5. 姿态独立特性：背景世界会随着飞机姿态变化而"旋转"
        // 这是自然效果，无需额外代码实现
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
