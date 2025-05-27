// 数学工具函数

/**
 * 创建带种子的随机数生成器
 * @param {number} initialSeed - 初始种子值
 * @returns {function} 随机数生成函数
 */
export function createSeededRandom(initialSeed) {
    let seed = initialSeed;
    return () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

/**
 * 计算G力
 * @param {THREE.Vector3} velocity - 当前速度
 * @param {THREE.Vector3} previousVelocity - 上一帧速度
 * @returns {number} G力大小
 */
export function calculateGForce(velocity, previousVelocity) {
    if (!previousVelocity) {
        return 0;
    }
    
    const deltaV = velocity.clone().sub(previousVelocity);
    return deltaV.length() * 10; // 粗略的G力估算
}

/**
 * 角度转弧度
 * @param {number} degrees - 角度
 * @returns {number} 弧度
 */
export function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * 弧度转角度
 * @param {number} radians - 弧度
 * @returns {number} 角度
 */
export function radiansToDegrees(radians) {
    return radians * 180 / Math.PI;
}

/**
 * 限制值在指定范围内
 * @param {number} value - 要限制的值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * 线性插值
 * @param {number} a - 起始值
 * @param {number} b - 结束值
 * @param {number} t - 插值因子 (0-1)
 * @returns {number} 插值结果
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * 计算两点之间的距离
 * @param {THREE.Vector3} point1 - 第一个点
 * @param {THREE.Vector3} point2 - 第二个点
 * @returns {number} 距离
 */
export function distance(point1, point2) {
    return point1.distanceTo(point2);
}

/**
 * 标准化角度到 0-360 度范围
 * @param {number} angle - 角度（度）
 * @returns {number} 标准化后的角度
 */
export function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
}
