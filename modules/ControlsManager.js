// 输入控制管理模块

export class ControlsManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.controls = {};
        
        // 移动端控制器状态
        this.mobileControls = {
            leftJoystick: { x: 0, y: 0, active: false },
            rightJoystick: { x: 0, y: 0, active: false }
        };
        
        this.setupControls();
    }
    
    setupControls() {
        document.addEventListener('keydown', (event) => {
            this.controls[event.code] = true;
        });
        
        document.addEventListener('keyup', (event) => {
            this.controls[event.code] = false;
        });
        
        // 设置移动端触摸控制器
        this.setupMobileControls();
    }
    
    setupMobileControls() {
        const leftJoystick = document.getElementById('leftJoystick');
        const rightJoystick = document.getElementById('rightJoystick');
        const leftKnob = document.getElementById('leftKnob');
        const rightKnob = document.getElementById('rightKnob');
        
        if (!leftJoystick || !rightJoystick) return;
        
        // 摇杆配置
        const joystickRadius = 40; // 摇杆可移动半径
        
        // 处理触摸事件的通用函数
        const handleTouch = (joystick, knob, controlKey, event) => {
            event.preventDefault();
            
            const rect = joystick.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const touch = event.touches ? event.touches[0] : event;
            if (event.type.includes('end') || event.type.includes('cancel')) {
                // 释放摇杆
                this.mobileControls[controlKey] = { x: 0, y: 0, active: false };
                knob.style.transform = 'translate(-50%, -50%)';
                return;
            }
            
            // 计算触摸相对于摇杆中心的位置
            const touchX = touch.clientX - rect.left - centerX;
            const touchY = touch.clientY - rect.top - centerY;
            
            // 计算距离和角度
            const distance = Math.sqrt(touchX * touchX + touchY * touchY);
            const angle = Math.atan2(touchY, touchX);
            
            // 限制在摇杆范围内
            const clampedDistance = Math.min(distance, joystickRadius);
            const clampedX = Math.cos(angle) * clampedDistance;
            const clampedY = Math.sin(angle) * clampedDistance;
            
            // 更新摇杆按钮位置
            knob.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
            
            // 更新控制状态 (-1 到 1 的范围)
            this.mobileControls[controlKey] = {
                x: clampedX / joystickRadius,
                y: -clampedY / joystickRadius, // Y轴反转，向上为正
                active: true
            };
        };
        
        // 左摇杆事件（飞行控制：俯仰和翻滚）
        for (const eventType of ['touchstart', 'touchmove', 'mousedown', 'mousemove']) {
            leftJoystick.addEventListener(eventType, (event) => {
                if ((eventType.includes('mouse') && event.buttons === 1) || eventType.includes('touch')) {
                    handleTouch(leftJoystick, leftKnob, 'leftJoystick', event);
                }
            });
        }
        
        for (const eventType of ['touchend', 'touchcancel', 'mouseup', 'mouseleave']) {
            leftJoystick.addEventListener(eventType, (event) => {
                handleTouch(leftJoystick, leftKnob, 'leftJoystick', event);
            });
        }
        
        // 右摇杆事件（推力和转向）
        for (const eventType of ['touchstart', 'touchmove', 'mousedown', 'mousemove']) {
            rightJoystick.addEventListener(eventType, (event) => {
                if ((eventType.includes('mouse') && event.buttons === 1) || eventType.includes('touch')) {
                    handleTouch(rightJoystick, rightKnob, 'rightJoystick', event);
                }
            });
        }
        
        for (const eventType of ['touchend', 'touchcancel', 'mouseup', 'mouseleave']) {
            rightJoystick.addEventListener(eventType, (event) => {
                handleTouch(rightJoystick, rightKnob, 'rightJoystick', event);
            });
        }
        
        // 禁用移动端滚动和缩放
        document.addEventListener('touchmove', (event) => {
            if (event.target.closest('.joystick')) {
                event.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('gesturestart', (event) => {
            event.preventDefault();
        });
        
        document.addEventListener('gesturechange', (event) => {
            event.preventDefault();
        });
        
        document.addEventListener('gestureend', (event) => {
            event.preventDefault();
        });
    }
    
    // 更新精确控制指示器
    updatePrecisionControlIndicator() {
        const precisionElement = document.getElementById('precisionMode');
        if (precisionElement) {
            const arrowKeysActive = this.controls.ArrowLeft || this.controls.ArrowRight || 
                                   this.controls.ArrowUp || this.controls.ArrowDown;
            
            if (arrowKeysActive) {
                if (this.controls.ArrowLeft || this.controls.ArrowRight) {
                    // 左右箭头现在是协调转弯
                    precisionElement.textContent = '方向键: 协调转弯 (Roll+Yaw)';
                    precisionElement.style.color = '#FF9800';
                } else {
                    // 上下箭头是俯仰控制
                    precisionElement.textContent = '方向键: 俯仰控制';
                    precisionElement.style.color = '#3F51B5';
                }
            } else if (this.controls.KeyA || this.controls.KeyD) {
                // A/D键是纯YAW控制
                precisionElement.textContent = 'A/D键: 纯YAW转向';
                precisionElement.style.color = '#9C27B0';
            } else {
                precisionElement.textContent = '';
            }
        }
    }
    
    // 检查是否有控制输入
    hasInput() {
        // 检查键盘输入
        const keyboardActive = Object.values(this.controls).some(pressed => pressed);
        
        // 检查移动端输入
        const mobileActive = this.mobileControls.leftJoystick.active || 
                           this.mobileControls.rightJoystick.active;
        
        return keyboardActive || mobileActive;
    }
    
    // 获取当前控制状态
    getControlState() {
        return {
            keyboard: this.controls,
            mobile: this.mobileControls
        };
    }
    
    // 重置所有控制状态
    resetControls() {
        this.controls = {};
        this.mobileControls = {
            leftJoystick: { x: 0, y: 0, active: false },
            rightJoystick: { x: 0, y: 0, active: false }
        };
    }
}
