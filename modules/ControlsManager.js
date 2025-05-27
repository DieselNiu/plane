// 输入控制管理模块

export class ControlsManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.controls = {};

        // 移动端控制器状态
        this.mobileControls = {
            leftJoystick: { x: 0, y: 0, active: false },
            rightJoystick: { x: 0, y: 0, active: false },
            directionalControls: {
                up: false,
                down: false,
                left: false,
                right: false
            }
        };

        // 多点触控状态跟踪
        this.touchStates = new Map(); // 跟踪每个触摸点的状态
        this.activeTouches = {
            leftJoystick: null,  // 当前控制左摇杆的触摸ID
            rightJoystick: null  // 当前控制右摇杆的触摸ID
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

        if (!leftJoystick) return;

        // 设置四方向推杆控制
        this.setupDirectionalControls();

        // 改进的多点触控处理函数
        this.setupMultiTouchControls();

        // 禁用移动端滚动和缩放
        document.addEventListener('touchmove', (event) => {
            if (event.target.closest('.joystick') || event.target.closest('.directional-controls')) {
                event.preventDefault();
            }
        }, { passive: false });

        document.addEventListener('gesturestart', (event) => {
            // 只在控制器区域阻止手势
            if (event.target.closest('.joystick') || event.target.closest('.directional-controls')) {
                event.preventDefault();
            }
        });

        document.addEventListener('gesturechange', (event) => {
            // 只在控制器区域阻止手势
            if (event.target.closest('.joystick') || event.target.closest('.directional-controls')) {
                event.preventDefault();
            }
        });

        document.addEventListener('gestureend', (event) => {
            // 只在控制器区域阻止手势
            if (event.target.closest('.joystick') || event.target.closest('.directional-controls')) {
                event.preventDefault();
            }
        });
    }

    // 新的多点触控处理系统
    setupMultiTouchControls() {
        const leftJoystick = document.getElementById('leftJoystick');
        const rightJoystick = document.getElementById('rightJoystick');

        if (!leftJoystick || !rightJoystick) return;

        // 统一的触摸开始处理
        const handleTouchStart = (event) => {
            // 检查是否有任何触摸点在控制器上
            let hasControllerTouch = false;

            // 处理所有新的触摸点
            for (let i = 0; i < event.changedTouches.length; i++) {
                const touch = event.changedTouches[i];
                const touchId = touch.identifier;

                // 确定触摸点属于哪个控制器
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const controllerType = this.getControllerType(target);

                if (controllerType && !this.activeTouches[controllerType]) {
                    hasControllerTouch = true;

                    // 分配触摸点给控制器
                    this.activeTouches[controllerType] = touchId;
                    this.touchStates.set(touchId, {
                        controllerType,
                        startX: touch.clientX,
                        startY: touch.clientY,
                        currentX: touch.clientX,
                        currentY: touch.clientY
                    });

                    // 立即处理初始位置
                    this.updateControllerFromTouch(controllerType, touch);
                }
            }

            // 只有当触摸点在控制器上时才阻止默认行为
            if (hasControllerTouch) {
                event.preventDefault();
            }
        };

        // 统一的触摸移动处理
        const handleTouchMove = (event) => {
            // 检查是否有任何移动的触摸点在控制器上
            let hasControllerTouch = false;

            // 处理所有移动的触摸点
            for (let i = 0; i < event.changedTouches.length; i++) {
                const touch = event.changedTouches[i];
                const touchId = touch.identifier;
                const touchState = this.touchStates.get(touchId);

                if (touchState) {
                    hasControllerTouch = true;

                    // 更新触摸状态
                    touchState.currentX = touch.clientX;
                    touchState.currentY = touch.clientY;

                    // 更新对应的控制器
                    this.updateControllerFromTouch(touchState.controllerType, touch);
                }
            }

            // 只有当触摸点在控制器上时才阻止默认行为
            if (hasControllerTouch) {
                event.preventDefault();
            }
        };

        // 统一的触摸结束处理
        const handleTouchEnd = (event) => {
            // 检查是否有任何结束的触摸点在控制器上
            let hasControllerTouch = false;

            // 处理所有结束的触摸点
            for (let i = 0; i < event.changedTouches.length; i++) {
                const touch = event.changedTouches[i];
                const touchId = touch.identifier;
                const touchState = this.touchStates.get(touchId);

                if (touchState) {
                    hasControllerTouch = true;

                    // 重置对应的控制器
                    this.resetController(touchState.controllerType);

                    // 清理触摸状态
                    this.activeTouches[touchState.controllerType] = null;
                    this.touchStates.delete(touchId);
                }
            }

            // 只有当触摸点在控制器上时才阻止默认行为
            if (hasControllerTouch) {
                event.preventDefault();
            }
        };

        // 为整个文档添加触摸事件监听器
        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });
        document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

        // 鼠标事件支持（用于桌面测试）
        this.setupMouseSupport();
    }

    // 确定触摸点属于哪个控制器
    getControllerType(element) {
        if (!element) return null;

        if (element.closest('#leftJoystick')) {
            return 'leftJoystick';
        }

        if (element.closest('#rightJoystick') || element.closest('.directional-controls')) {
            return 'rightJoystick';
        }

        return null;
    }

    // 根据触摸更新控制器状态
    updateControllerFromTouch(controllerType, touch) {
        if (controllerType === 'leftJoystick') {
            this.updateThrottleLever(touch);
        } else if (controllerType === 'rightJoystick') {
            this.updateFlightStick(touch);
        }
    }

    // 更新油门推杆
    updateThrottleLever(touch) {
        const leftJoystick = document.getElementById('leftJoystick');
        const leftKnob = document.getElementById('leftKnob');

        if (!leftJoystick || !leftKnob) return;

        const rect = leftJoystick.getBoundingClientRect();
        const touchYFromBottom = rect.height - (touch.clientY - rect.top);

        // 限制在推杆范围内（15px到165px）
        const clampedY = Math.max(15, Math.min(165, touchYFromBottom));

        // 更新推杆手柄位置
        leftKnob.style.bottom = `${clampedY}px`;

        // 计算油门值
        let throttleValue;
        if (clampedY <= 40) {
            // 下半段：从倒车到怠速 (-1 到 0)
            throttleValue = (clampedY - 15) / 25 - 1;
        } else {
            // 上半段：从怠速到最大推力 (0 到 1)
            throttleValue = (clampedY - 40) / 125;
        }

        // 添加激活状态的视觉效果
        leftJoystick.classList.add('active');

        // 更新控制状态
        this.mobileControls.leftJoystick = {
            x: 0,
            y: throttleValue,
            active: true
        };
    }

    // 更新飞行操纵杆
    updateFlightStick(touch) {
        const joystickBase = document.querySelector('.joystick-base');
        const joystickStick = document.getElementById('joystickStick');

        if (!joystickBase || !joystickStick) return;

        const rect = joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = touch.clientX - centerX;
        const deltaY = touch.clientY - centerY;

        // 限制操纵杆移动范围（半径30px）
        const maxDistance = 30;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        let finalX = deltaX;
        let finalY = deltaY;

        if (distance > maxDistance) {
            const ratio = maxDistance / distance;
            finalX = deltaX * ratio;
            finalY = deltaY * ratio;
        }

        // 更新操纵杆手柄位置
        joystickStick.style.transform = `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px))`;

        // 计算控制值（-1到1）
        const controlX = finalX / maxDistance;
        const controlY = -finalY / maxDistance; // Y轴反转

        // 设置死区
        const deadZone = 0.2;
        const finalControlX = Math.abs(controlX) > deadZone ? controlX : 0;
        const finalControlY = Math.abs(controlY) > deadZone ? controlY : 0;

        // 更新控制状态
        this.mobileControls.rightJoystick = {
            x: finalControlX,
            y: -finalControlY, // 再次反转，确保与PC端逻辑一致
            active: Math.abs(finalControlX) > 0 || Math.abs(finalControlY) > 0
        };

        // 更新方向指示器
        this.updateDirectionIndicators(finalControlX, finalControlY);
    }

    // 重置控制器状态
    resetController(controllerType) {
        if (controllerType === 'leftJoystick') {
            const leftJoystick = document.getElementById('leftJoystick');
            const leftKnob = document.getElementById('leftKnob');

            if (leftKnob) {
                leftKnob.style.bottom = '40px'; // 回到中性位置
            }
            if (leftJoystick) {
                leftJoystick.classList.remove('active');
            }

            this.mobileControls.leftJoystick = { x: 0, y: 0, active: false };

        } else if (controllerType === 'rightJoystick') {
            const joystickStick = document.getElementById('joystickStick');

            if (joystickStick) {
                joystickStick.style.transform = 'translate(-50%, -50%)';
            }

            this.mobileControls.rightJoystick = { x: 0, y: 0, active: false };
            this.updateDirectionIndicators(0, 0);
        }
    }

    // 鼠标事件支持（用于桌面测试）
    setupMouseSupport() {
        const mouseState = {
            isDown: false,
            controllerType: null,
            startX: 0,
            startY: 0
        };

        document.addEventListener('mousedown', (event) => {
            const controllerType = this.getControllerType(event.target);
            if (controllerType) {
                mouseState.isDown = true;
                mouseState.controllerType = controllerType;
                mouseState.startX = event.clientX;
                mouseState.startY = event.clientY;

                // 模拟触摸对象
                const fakeTouch = {
                    clientX: event.clientX,
                    clientY: event.clientY
                };

                this.updateControllerFromTouch(controllerType, fakeTouch);
            }
        });

        document.addEventListener('mousemove', (event) => {
            if (mouseState.isDown && mouseState.controllerType) {
                const fakeTouch = {
                    clientX: event.clientX,
                    clientY: event.clientY
                };

                this.updateControllerFromTouch(mouseState.controllerType, fakeTouch);
            }
        });

        document.addEventListener('mouseup', () => {
            if (mouseState.isDown && mouseState.controllerType) {
                this.resetController(mouseState.controllerType);
                mouseState.isDown = false;
                mouseState.controllerType = null;
            }
        });
    }

    // 设置飞行操纵杆控制（现在由多点触控系统处理，这里只保留必要的初始化）
    setupDirectionalControls() {
        // 飞行操纵杆现在由新的多点触控系统处理
        // 这里只需要确保初始状态正确
        const joystickStick = document.getElementById('joystickStick');
        if (joystickStick) {
            joystickStick.style.transform = 'translate(-50%, -50%)';
        }

        this.mobileControls.rightJoystick = { x: 0, y: 0, active: false };
        this.updateDirectionIndicators(0, 0);
    }

    // 更新方向指示器
    updateDirectionIndicators(x, y) {
        const indicators = {
            up: document.getElementById('indicatorUp'),
            down: document.getElementById('indicatorDown'),
            left: document.getElementById('indicatorLeft'),
            right: document.getElementById('indicatorRight')
        };

        // 重置所有指示器
        for (const indicator of Object.values(indicators)) {
            if (indicator) indicator.classList.remove('active');
        }

        // 激活对应方向的指示器
        const threshold = 0.3;
        if (y > threshold && indicators.up) indicators.up.classList.add('active');
        if (y < -threshold && indicators.down) indicators.down.classList.add('active');
        if (x < -threshold && indicators.left) indicators.left.classList.add('active');
        if (x > threshold && indicators.right) indicators.right.classList.add('active');
    }

    // 更新精确控制指示器
    updatePrecisionControlIndicator() {
        const precisionElement = document.getElementById('precisionMode');
        if (precisionElement) {
            const arrowKeysActive = this.controls.ArrowLeft || this.controls.ArrowRight ||
                                   this.controls.ArrowUp || this.controls.ArrowDown;

            if (arrowKeysActive) {
                if (this.controls.ArrowLeft || this.controls.ArrowRight) {
                    // 左右箭头现在是简单roll控制（仅空中）
                    precisionElement.textContent = '方向键: Roll翻滚控制 (仅空中)';
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
