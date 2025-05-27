// 水面效果和反射模块

export class WaterEffects {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.lake = null;
        this.waterMaterial = null;
        this.reflectionCamera = null;
        this.refractionCamera = null;
        this.reflectionRenderTarget = null;
        this.refractionRenderTarget = null;

        this.createCentralLake();
    }

    createCentralLake() {
        // 湖泊位置和尺寸
        const lakeX = 1000; // 远离跑道的城市中心
        const lakeZ = 300;
        const lakeRadius = 200;

        // 创建反射渲染目标
        this.reflectionCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.reflectionRenderTarget = new THREE.WebGLRenderTarget(512, 512, {
            format: THREE.RGBFormat,
            generateMipmaps: false,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter
        });

        // 创建折射渲染目标
        this.refractionCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.refractionRenderTarget = new THREE.WebGLRenderTarget(512, 512, {
            format: THREE.RGBFormat,
            generateMipmaps: false,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter
        });

        // 创建水面法线贴图
        const normalMap = this.createWaterNormalMap();

        // 创建高级水面着色器材质
        this.waterMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                reflectionTexture: { value: this.reflectionRenderTarget.texture },
                refractionTexture: { value: this.refractionRenderTarget.texture },
                normalMap: { value: normalMap },
                waterColor: { value: new THREE.Color(0x006994) },
                fresnelPower: { value: 2.0 },
                waveStrength: { value: 0.15 },
                waveSpeed: { value: 0.8 },
                waveScale: { value: 0.02 },
                reflection: { value: 0.7 },
                refraction: { value: 0.3 }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            transparent: true,
            side: THREE.DoubleSide
        });

        // 创建圆形湖泊几何体
        const lakeGeometry = new THREE.CircleGeometry(lakeRadius, 64);
        this.lake = new THREE.Mesh(lakeGeometry, this.waterMaterial);
        this.lake.rotation.x = -Math.PI / 2;
        this.lake.position.set(lakeX, 0.5, lakeZ);
        this.lake.name = 'lake'; // 标记为湖泊以便在反射时排除
        this.scene.add(this.lake);

        // 创建湖泊周围的装饰
        this.createLakeDecorations(lakeX, lakeZ, lakeRadius);
    }

    createWaterNormalMap() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(size, size);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;

                // 生成波纹模式
                const fx = x / size * Math.PI * 8;
                const fy = y / size * Math.PI * 8;
                const wave1 = Math.sin(fx) * Math.cos(fy);
                const wave2 = Math.sin(fx * 1.5) * Math.cos(fy * 1.2);
                const height = (wave1 + wave2 * 0.5) * 0.5 + 0.5;

                // 转换为法线向量
                const dx = Math.cos(fx) * Math.cos(fy);
                const dy = Math.sin(fx) * (-Math.sin(fy));

                // 编码为RGB
                imageData.data[i] = (dx * 0.5 + 0.5) * 255;     // R: X component
                imageData.data[i + 1] = (dy * 0.5 + 0.5) * 255; // G: Y component
                imageData.data[i + 2] = height * 255;            // B: Z component
                imageData.data[i + 3] = 255;                     // Alpha
            }
        }

        context.putImageData(imageData, 0, 0);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    createLakeDecorations(lakeX, lakeZ, lakeRadius) {
        // 湖泊周围的装饰元素
        const decorationRadius = lakeRadius + 50;
        const numDecorations = 12;

        for (let i = 0; i < numDecorations; i++) {
            const angle = (i / numDecorations) * Math.PI * 2;
            const x = lakeX + Math.cos(angle) * decorationRadius;
            const z = lakeZ + Math.sin(angle) * decorationRadius;

            // 添加湖边树木
            if (i % 3 === 0) {
                const treeGeometry = new THREE.ConeGeometry(6, 25, 8);
                const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
                const tree = new THREE.Mesh(treeGeometry, treeMaterial);
                tree.position.set(x, 12.5, z);
                tree.castShadow = true;
                this.scene.add(tree);
            }

            // 添加湖边石头
            if (i % 4 === 1) {
                const rockGeometry = new THREE.DodecahedronGeometry(3 + Math.random() * 2);
                const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
                const rock = new THREE.Mesh(rockGeometry, rockMaterial);
                rock.position.set(x, 2, z);
                rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                rock.castShadow = true;
                this.scene.add(rock);
            }

            // 添加湖边小建筑
            if (i % 6 === 2) {
                const buildingGeometry = new THREE.BoxGeometry(8, 12, 8);
                const buildingMaterial = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
                const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
                building.position.set(x, 6, z);
                building.castShadow = true;
                this.scene.add(building);

                // 添加小屋顶
                const roofGeometry = new THREE.ConeGeometry(6, 4, 4);
                const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                const roof = new THREE.Mesh(roofGeometry, roofMaterial);
                roof.position.set(x, 14, z);
                roof.rotation.y = Math.PI / 4;
                this.scene.add(roof);
            }
        }

        // 在湖中心添加小岛
        const islandGeometry = new THREE.CylinderGeometry(15, 20, 3, 16);
        const islandMaterial = new THREE.MeshLambertMaterial({ color: 0x8FBC8F });
        const island = new THREE.Mesh(islandGeometry, islandMaterial);
        island.position.set(lakeX, 1, lakeZ);
        island.castShadow = true;
        this.scene.add(island);

        // 小岛上的装饰树
        const islandTreeGeometry = new THREE.ConeGeometry(4, 18, 8);
        const islandTreeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const islandTree = new THREE.Mesh(islandTreeGeometry, islandTreeMaterial);
        islandTree.position.set(lakeX, 12, lakeZ);
        islandTree.castShadow = true;
        this.scene.add(islandTree);
    }

    updateWaterReflection(camera) {
        if (!this.lake || !this.reflectionCamera || !this.refractionCamera) return;

        // 设置反射相机
        this.reflectionCamera.position.copy(camera.position);
        this.reflectionCamera.position.y = -camera.position.y + 2 * this.lake.position.y;
        this.reflectionCamera.rotation.copy(camera.rotation);
        this.reflectionCamera.rotation.x = -camera.rotation.x;
        this.reflectionCamera.updateProjectionMatrix();

        // 临时隐藏湖泊避免自反射
        this.lake.visible = false;

        // 渲染反射
        this.renderer.setRenderTarget(this.reflectionRenderTarget);
        this.renderer.render(this.scene, this.reflectionCamera);

        // 恢复湖泊可见性
        this.lake.visible = true;

        // 设置折射相机
        this.refractionCamera.position.copy(camera.position);
        this.refractionCamera.rotation.copy(camera.rotation);
        this.refractionCamera.updateProjectionMatrix();

        // 渲染折射
        this.renderer.setRenderTarget(this.refractionRenderTarget);
        this.renderer.render(this.scene, this.refractionCamera);

        // 恢复主渲染目标
        this.renderer.setRenderTarget(null);
    }

    // 更新水面动画
    updateWaterAnimation(deltaTime) {
        if (this.waterMaterial) {
            this.waterMaterial.uniforms.time.value += deltaTime;
        }
    }

    // 获取顶点着色器代码
    getVertexShader() {
        return `
            uniform float time;
            uniform float waveStrength;
            uniform float waveSpeed;
            uniform float waveScale;

            varying vec2 vUv;
            varying vec3 vWorldPosition;
            varying vec3 vViewPosition;
            varying vec3 vNormal;
            varying vec4 vReflectionCoord;
            varying vec4 vRefractionCoord;

            // FFT-inspired wave function with multiple frequency components
            float wave(vec2 position, float frequency, float amplitude, float speed, float direction) {
                vec2 dir = vec2(cos(direction), sin(direction));
                float phase = dot(position, dir) * frequency + time * speed;
                return sin(phase) * amplitude;
            }

            // Multiple wave superposition for realistic water movement
            float getWaveHeight(vec2 pos) {
                float height = 0.0;

                // Primary waves - larger, slower
                height += wave(pos, 0.8, 0.6, 1.2, 0.0);
                height += wave(pos, 0.9, 0.4, 1.0, 1.57);

                // Secondary waves - medium frequency
                height += wave(pos, 1.5, 0.3, 1.8, 0.78);
                height += wave(pos, 1.8, 0.25, 1.5, 2.35);

                // High frequency ripples
                height += wave(pos, 3.2, 0.15, 2.5, 1.2);
                height += wave(pos, 4.1, 0.1, 3.0, 0.5);
                height += wave(pos, 5.5, 0.08, 3.8, 2.8);

                return height * waveStrength;
            }

            // Calculate normal from wave height field
            vec3 getWaveNormal(vec2 pos) {
                float epsilon = waveScale;
                float heightL = getWaveHeight(pos - vec2(epsilon, 0.0));
                float heightR = getWaveHeight(pos + vec2(epsilon, 0.0));
                float heightD = getWaveHeight(pos - vec2(0.0, epsilon));
                float heightU = getWaveHeight(pos + vec2(0.0, epsilon));

                vec3 normal = normalize(vec3(
                    (heightL - heightR) / (2.0 * epsilon),
                    1.0,
                    (heightD - heightU) / (2.0 * epsilon)
                ));

                return normal;
            }

            void main() {
                vUv = uv;

                // Calculate world position with wave displacement
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vec2 wavePos = worldPosition.xz * waveScale;

                // Apply wave height displacement
                float waveHeight = getWaveHeight(wavePos);
                worldPosition.y += waveHeight;
                vWorldPosition = worldPosition.xyz;

                // Calculate wave normal
                vNormal = getWaveNormal(wavePos);
                vNormal = normalize((modelMatrix * vec4(vNormal, 0.0)).xyz);

                // View position for fresnel calculation
                vec4 mvPosition = viewMatrix * worldPosition;
                vViewPosition = mvPosition.xyz;

                // Reflection coordinates
                vec4 reflectionPosition = worldPosition;
                reflectionPosition.y = -reflectionPosition.y;
                vReflectionCoord = projectionMatrix * viewMatrix * reflectionPosition;

                // Refraction coordinates
                vRefractionCoord = projectionMatrix * mvPosition;

                gl_Position = projectionMatrix * mvPosition;
            }
        `;
    }

    // 获取片段着色器代码
    getFragmentShader() {
        return `
            uniform float time;
            uniform sampler2D reflectionTexture;
            uniform sampler2D refractionTexture;
            uniform sampler2D normalMap;
            uniform vec3 waterColor;
            uniform float fresnelPower;
            uniform float reflection;
            uniform float refraction;

            varying vec2 vUv;
            varying vec3 vWorldPosition;
            varying vec3 vViewPosition;
            varying vec3 vNormal;
            varying vec4 vReflectionCoord;
            varying vec4 vRefractionCoord;

            void main() {
                // Normalized device coordinates for texture sampling
                vec2 reflectionUV = (vReflectionCoord.xy / vReflectionCoord.w + 1.0) * 0.5;
                vec2 refractionUV = (vRefractionCoord.xy / vRefractionCoord.w + 1.0) * 0.5;

                // Dynamic normal map sampling with time animation
                vec2 normalUV1 = vUv * 4.0 + time * 0.05;
                vec2 normalUV2 = vUv * 6.0 - time * 0.08;
                vec3 normal1 = texture2D(normalMap, normalUV1).rgb * 2.0 - 1.0;
                vec3 normal2 = texture2D(normalMap, normalUV2).rgb * 2.0 - 1.0;
                vec3 perturbedNormal = normalize(vNormal + (normal1 + normal2) * 0.1);

                // Apply normal perturbation to UV coordinates
                vec2 distortion = perturbedNormal.xz * 0.02;
                reflectionUV += distortion;
                refractionUV += distortion;

                // Clamp UV coordinates to prevent artifacts
                reflectionUV = clamp(reflectionUV, 0.0, 1.0);
                refractionUV = clamp(refractionUV, 0.0, 1.0);

                // Sample reflection and refraction textures
                vec3 reflectionColor = texture2D(reflectionTexture, reflectionUV).rgb;
                vec3 refractionColor = texture2D(refractionTexture, refractionUV).rgb;

                // Calculate fresnel effect
                vec3 viewDirection = normalize(vViewPosition);
                float fresnel = pow(1.0 - max(dot(-viewDirection, perturbedNormal), 0.0), fresnelPower);

                // Mix reflection and refraction based on fresnel
                vec3 waterSurface = mix(refractionColor, reflectionColor, fresnel * reflection);

                // Add water color tint
                waterSurface = mix(waterSurface, waterColor, 0.3);

                // Add subtle shimmer effect
                float shimmer = sin(time * 3.0 + vWorldPosition.x * 0.01 + vWorldPosition.z * 0.01) * 0.1 + 0.9;
                waterSurface *= shimmer;

                gl_FragColor = vec4(waterSurface, 0.9);
            }
        `;
    }

    // 获取湖泊对象
    getLake() {
        return this.lake;
    }

    // 获取水面材质
    getWaterMaterial() {
        return this.waterMaterial;
    }

    // 销毁资源
    dispose() {
        if (this.reflectionRenderTarget) {
            this.reflectionRenderTarget.dispose();
        }
        if (this.refractionRenderTarget) {
            this.refractionRenderTarget.dispose();
        }
        if (this.waterMaterial) {
            this.waterMaterial.dispose();
        }
    }
}
