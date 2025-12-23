// ==================== 本地化模块导入 ====================
// 使用本地importmap中配置的路径
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CurveExtras } from 'three/addons/curves/CurveExtras.js';

// ==================== 设备检测器 ====================
class DeviceDetector {
    static detect() {
        const ua = navigator.userAgent;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // 性能分级
        let performanceLevel = 'medium';
        const memory = navigator.deviceMemory || 4;
        const cores = navigator.hardwareConcurrency || 4;
        
        if (isMobile) {
            if (memory < 3 || cores < 4) performanceLevel = 'low';
            else if (memory >= 6 && cores >= 8) performanceLevel = 'high';
        } else {
            if (memory < 4 || cores < 4) performanceLevel = 'low';
            else if (memory >= 8 && cores >= 8) performanceLevel = 'high';
        }
        
        return {
            isMobile,
            isTouch,
            performanceLevel,
            isIOS: /iPad|iPhone|iPod/.test(ua),
            isAndroid: /Android/.test(ua),
            isDesktop: !isMobile && !isTouch,
            memory,
            cores
        };
    }
}

// ==================== 性能监控器 ====================
class PerformanceMonitor {
    constructor() {
        this.fps = 60;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fpsHistory = [];
        this.lowFPSWarnings = 0;
    }
    
    update() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.frameCount = 0;
            this.lastTime = currentTime;
            
            this.fpsHistory.push(this.fps);
            if (this.fpsHistory.length > 60) {
                this.fpsHistory.shift();
            }
            
            return this.checkPerformance();
        }
        return null;
    }
    
    checkPerformance() {
        if (this.fpsHistory.length < 10) return null;
        
        const avgFPS = this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length;
        
        if (avgFPS < 30) {
            this.lowFPSWarnings++;
            if (this.lowFPSWarnings >= 3) {
                return 'critical';
            }
            return 'warning';
        } else if (avgFPS < 45) {
            return 'notice';
        }
        
        return null;
    }
    
    getAverageFPS() {
        if (this.fpsHistory.length === 0) return this.fps;
        return this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length;
    }
}

// ==================== 触摸控制器 ====================
class TouchController {
    constructor(app) {
        this.app = app;
        this.isEnabled = false;
        this.touchStartPos = { x: 0, y: 0 };
        this.touchRotation = { x: 0, y: 0 };
        this.lastTapTime = 0;
        this.longPressTimer = null;
        this.pinchStartDistance = 0;
        
        this.sensitivity = 0.005;
        this.rotationSpeed = 0.1;
    }
    
    enable() {
        if (this.isEnabled) return;
        
        const canvas = this.app.renderer.domElement;
        
        canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        document.addEventListener('touchmove', this.preventDefault.bind(this), { passive: false });
        
        this.isEnabled = true;
        
        // 显示触摸提示
        setTimeout(() => {
            const touchHint = document.getElementById('touchHint');
            if (touchHint && !localStorage.getItem('touchHintShown')) {
                touchHint.style.display = 'block';
                setTimeout(() => {
                    touchHint.style.opacity = '0';
                    setTimeout(() => {
                        touchHint.style.display = 'none';
                        localStorage.setItem('touchHintShown', 'true');
                    }, 500);
                }, 5000);
            }
        }, 1000);
    }
    
    disable() {
        if (!this.isEnabled) return;
        
        const canvas = this.app.renderer.domElement;
        canvas.removeEventListener('touchstart', this.handleTouchStart);
        canvas.removeEventListener('touchmove', this.handleTouchMove);
        canvas.removeEventListener('touchend', this.handleTouchEnd);
        
        document.removeEventListener('touchmove', this.preventDefault);
        
        this.isEnabled = false;
    }
    
    handleTouchStart(event) {
        event.preventDefault();
        const touches = event.touches;
        
        if (touches.length === 1) {
            const touch = touches[0];
            this.touchStartPos = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now()
            };
            
            // 长按检测
            this.longPressTimer = setTimeout(() => {
                this.handleLongPress();
            }, 800);
            
        } else if (touches.length === 2) {
            const touch1 = touches[0];
            const touch2 = touches[1];
            this.pinchStartDistance = this.getTouchDistance(touch1, touch2);
            
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        }
    }
    
    handleTouchMove(event) {
        event.preventDefault();
        const touches = event.touches;
        
        if (touches.length === 1 && this.touchStartPos.x !== 0) {
            const touch = touches[0];
            const deltaX = touch.clientX - this.touchStartPos.x;
            const deltaY = touch.clientY - this.touchStartPos.y;
            
            this.touchRotation.y += deltaX * this.sensitivity;
            this.touchRotation.x += deltaY * this.sensitivity;
            
            // 限制X轴旋转
            this.touchRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.touchRotation.x));
            
            this.touchStartPos.x = touch.clientX;
            this.touchStartPos.y = touch.clientY;
            
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            
        } else if (touches.length === 2 && this.pinchStartDistance > 0) {
            const touch1 = touches[0];
            const touch2 = touches[1];
            const currentDistance = this.getTouchDistance(touch1, touch2);
            const pinchRatio = currentDistance / this.pinchStartDistance;
            
            // 捏合检测
            if (pinchRatio < 0.7 && this.app.STATE.mode !== 'FOCUS') {
                this.app.setMode('FOCUS');
                this.pinchStartDistance = 0;
                
                // 触觉反馈
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }
    }
    
    handleTouchEnd(event) {
        event.preventDefault();
        
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        
        // 双击检测
        const now = Date.now();
        const timeDiff = now - this.lastTapTime;
        
        if (timeDiff < 300 && timeDiff > 50) {
            this.handleDoubleTap();
        }
        
        this.lastTapTime = now;
        this.pinchStartDistance = 0;
    }
    
    handleLongPress() {
        const modes = ['TREE', 'SCATTER', 'FOCUS'];
        const currentIndex = modes.indexOf(this.app.STATE.mode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.app.setMode(modes[nextIndex]);
        
        if (navigator.vibrate) navigator.vibrate(50);
    }
    
    handleDoubleTap() {
        const uiContainer = document.getElementById('uiContainer');
        uiContainer.classList.toggle('ui-hidden');
        
        if (navigator.vibrate) navigator.vibrate(30);
    }
    
    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    preventDefault(event) {
        if (event.target.id !== 'canvas3d') {
            event.preventDefault();
        }
    }
    
    update() {
        if (this.app.mainGroup) {
            this.app.mainGroup.rotation.y = THREE.MathUtils.lerp(
                this.app.mainGroup.rotation.y,
                this.touchRotation.y,
                this.rotationSpeed
            );
            this.app.mainGroup.rotation.x = THREE.MathUtils.lerp(
                this.app.mainGroup.rotation.x,
                this.touchRotation.x,
                this.rotationSpeed
            );
        }
    }
}

// ==================== 手势识别器（MediaPipe降级版） ====================
class GestureRecognizer {
    constructor(app) {
        this.app = app;
        this.handLandmarker = null;
        this.isAvailable = false;
        this.lastGestureTime = 0;
        this.debounceTime = 500;
    }
    
    async initialize() {
        // 移动端或低性能设备禁用MediaPipe
        if (this.app.deviceInfo.isMobile || this.app.settings.performanceLevel === 'low') {
            console.log('设备不支持或禁用MediaPipe');
            return false;
        }
        
        try {
            // 尝试动态加载MediaPipe
            const visionModule = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm');
            const vision = visionModule.FilesetResolver;
            
            const filesetResolver = await vision.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );
            
            this.handLandmarker = await visionModule.HandLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            // 设置摄像头
            await this.setupWebcam();
            
            this.isAvailable = true;
            console.log('MediaPipe手势识别已启用');
            return true;
            
        } catch (error) {
            console.warn('MediaPipe初始化失败:', error);
            this.isAvailable = false;
            return false;
        }
    }
    
    async setupWebcam() {
        const video = document.getElementById('webcam');
        const canvas = document.getElementById('outputCanvas');
        const statusEl = document.querySelector('.webcam-status');
        
        if (!navigator.mediaDevices.getUserMedia) {
            throw new Error('摄像头不支持');
        }
        
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            },
            audio: false
        };
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            
            await new Promise((resolve) => {
                video.addEventListener('loadeddata', resolve);
            });
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // 更新状态
            if (statusEl) {
                statusEl.querySelector('.status-indicator').style.background = '#44ff44';
                statusEl.querySelector('.status-text').textContent = '手势识别就绪';
            }
            
            // 开始预测
            this.predictWebcam();
            
        } catch (error) {
            console.error('摄像头设置失败:', error);
            if (statusEl) {
                statusEl.querySelector('.status-text').textContent = '摄像头不可用';
            }
            throw error;
        }
    }
    
    predictWebcam = async () => {
        if (!this.isAvailable) return;
        
        const video = document.getElementById('webcam');
        
        try {
            const results = this.handLandmarker.detectForVideo(video, Date.now());
            
            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                this.processGestures(landmarks);
                this.mapHandToRotation(landmarks);
            }
        } catch (error) {
            console.warn('手势识别错误:', error);
        }
        
        requestAnimationFrame(this.predictWebcam);
    };
    
    processGestures(landmarks) {
        const now = Date.now();
        if (now - this.lastGestureTime < this.debounceTime) return;
        
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const wrist = landmarks[0];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        
        // 捏合距离
        const pinchDistance = Math.hypot(
            thumbTip.x - indexTip.x,
            thumbTip.y - indexTip.y,
            thumbTip.z - indexTip.z
        );
        
        // 指尖到手腕距离
        const distances = [
            Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y, indexTip.z - wrist.z),
            Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y, middleTip.z - wrist.z),
            Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y, ringTip.z - wrist.z),
            Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y, pinkyTip.z - wrist.z)
        ];
        
        const avgDistance = distances.reduce((a, b) => a + b) / distances.length;
        
        // 手势识别
        if (pinchDistance < 0.05 && this.app.STATE.mode !== 'FOCUS') {
            this.app.setMode('FOCUS');
            this.lastGestureTime = now;
        } else if (avgDistance < 0.25 && this.app.STATE.mode !== 'TREE') {
            this.app.setMode('TREE');
            this.lastGestureTime = now;
        } else if (avgDistance > 0.4 && this.app.STATE.mode !== 'SCATTER') {
            this.app.setMode('SCATTER');
            this.lastGestureTime = now;
        }
    }
    
    mapHandToRotation(landmarks) {
        const palmCenter = landmarks[9];
        
        this.app.STATE.gestureData.rotationY = (palmCenter.x - 0.5) * 2;
        this.app.STATE.gestureData.rotationX = (0.5 - palmCenter.y) * 1.5;
    }
    
    dispose() {
        if (this.handLandmarker) {
            this.handLandmarker.close();
            this.handLandmarker = null;
        }
        
        const video = document.getElementById('webcam');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
    }
}

// ==================== 主应用类 ====================
class ChristmasTreeApp {
    constructor() {
        // 设备信息
        this.deviceInfo = DeviceDetector.detect();
        
        // 性能设置
        this.settings = this.getPerformanceSettings();
        
        // Three.js 核心
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.controls = null;
        this.clock = new THREE.Clock();
        
        // 性能监控
        this.performanceMonitor = new PerformanceMonitor();
        
        // 粒子系统
        this.mainGroup = new THREE.Group();
        this.particles = [];
        this.photos = [];
        
        // 状态管理
        this.STATE = {
            mode: 'TREE',
            isAnimating: true,
            gestureData: { rotationX: 0, rotationY: 0 }
        };
        
        // 控制器
        this.touchController = new TouchController(this);
        this.gestureRecognizer = new GestureRecognizer(this);
        
        // 初始化
        this.init();
    }
    
    getPerformanceSettings() {
        const { performanceLevel, isMobile } = this.deviceInfo;
        
        const settings = {
            low: {
                particleCount: 800,
                mainParticleCount: 300,
                enableBloom: false,
                enableShadows: false,
                antialias: false,
                pixelRatio: 1.0,
                renderScale: 0.8,
                maxPhotos: 5,
                geometryDetail: 'low'
            },
            medium: {
                particleCount: 2000,
                mainParticleCount: 600,
                enableBloom: !isMobile,
                enableShadows: !isMobile,
                antialias: false,
                pixelRatio: isMobile ? 1.0 : 1.5,
                renderScale: isMobile ? 0.9 : 1.0,
                maxPhotos: 8,
                geometryDetail: isMobile ? 'medium' : 'high'
            },
            high: {
                particleCount: 4000,
                mainParticleCount: 1500,
                enableBloom: true,
                enableShadows: true,
                antialias: true,
                pixelRatio: Math.min(2.0, window.devicePixelRatio),
                renderScale: 1.0,
                maxPhotos: 12,
                geometryDetail: 'high'
            }
        };
        
        return {
            ...settings[performanceLevel],
            isMobile,
            performanceLevel
        };
    }
    
    async init() {
        try {
            // 更新加载进度
            this.updateLoaderProgress(20);
            
            // 初始化Three.js
            await this.initThreeJS();
            this.updateLoaderProgress(40);
            
            // 初始化手势识别
            if (!this.deviceInfo.isMobile) {
                await this.gestureRecognizer.initialize();
            }
            this.updateLoaderProgress(60);
            
            // 创建粒子
            this.createParticles();
            this.updateLoaderProgress(80);
            
            // 创建默认照片
            this.createDefaultPhoto();
            this.updateLoaderProgress(90);
            
            // 设置事件监听器
            this.setupEventListeners();
            this.updateLoaderProgress(95);
            
            // 启动触摸控制（移动端）
            if (this.deviceInfo.isTouch && !this.gestureRecognizer.isAvailable) {
                this.touchController.enable();
            }
            
            // 开始动画
            this.animate();
            this.updateLoaderProgress(100);
            
            // 完成加载
            setTimeout(() => {
                document.getElementById('loader').classList.add('hidden');
                
                // 显示设备提示
                if (this.deviceInfo.isMobile) {
                    setTimeout(() => {
                        const deviceHint = document.getElementById('deviceHint');
                        if (deviceHint) {
                            deviceHint.style.display = 'block';
                            setTimeout(() => {
                                deviceHint.style.opacity = '0';
                                setTimeout(() => {
                                    deviceHint.style.display = 'none';
                                }, 500);
                            }, 5000);
                        }
                    }, 1000);
                }
                
                // 性能警告
                if (this.settings.performanceLevel === 'low') {
                    setTimeout(() => {
                        const warning = document.getElementById('performanceWarning');
                        if (warning) warning.style.display = 'block';
                    }, 1500);
                }
                
            }, 1000);
            
        } catch (error) {
            console.error('初始化失败:', error);
            this.showError(error.message);
        }
    }
    
    updateLoaderProgress(percent) {
        const progressBar = document.getElementById('loaderProgress');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
    }
    
    async initThreeJS() {
        // 场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.Fog(0x000000, 50, 150);
        
        // 相机
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        if (this.deviceInfo.isMobile) {
            this.camera.position.set(0, 3, 35);
            this.camera.fov = 65;
        } else {
            this.camera.position.set(0, 2, 50);
        }
        
        // 渲染器
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('canvas3d'),
            antialias: this.settings.antialias,
            alpha: false,
            powerPreference: 'default'
        });
        
        this.renderer.setPixelRatio(this.settings.pixelRatio);
        this.renderer.setSize(
            window.innerWidth * this.settings.renderScale,
            window.innerHeight * this.settings.renderScale
        );
        
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = this.deviceInfo.isMobile ? 1.8 : 2.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = this.settings.enableShadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 环境（简化版，不使用PMREMGenerator）
        const environment = new RoomEnvironment();
        this.scene.environment = environment;
        
        // 灯光
        this.setupLights();
        
        // 后期处理
        this.setupPostProcessing();
        
        // 轨道控制器
        this.setupOrbitControls();
        
        // 添加主组
        this.scene.add(this.mainGroup);
    }
    
    setupLights() {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // 点光源
        const pointLight = new THREE.PointLight(0xff6600, this.settings.performanceLevel === 'low' ? 1 : 2, 100);
        pointLight.position.set(5, 10, 5);
        this.scene.add(pointLight);
        
        // 聚光灯1（金色）
        const spotLight1 = new THREE.SpotLight(
            0xd4af37,
            this.settings.performanceLevel === 'low' ? 800 : 1200,
            100,
            Math.PI / 6,
            0.5,
            1
        );
        spotLight1.position.set(30, 40, 40);
        spotLight1.castShadow = this.settings.enableShadows;
        if (spotLight1.castShadow) {
            spotLight1.shadow.mapSize.width = this.deviceInfo.isMobile ? 256 : 512;
            spotLight1.shadow.mapSize.height = this.deviceInfo.isMobile ? 256 : 512;
        }
        this.scene.add(spotLight1);
        
        // 聚光灯2（蓝色）
        const spotLight2 = new THREE.SpotLight(
            0x3399ff,
            this.settings.performanceLevel === 'low' ? 400 : 600,
            100,
            Math.PI / 6,
            0.5,
            1
        );
        spotLight2.position.set(-30, 20, -30);
        this.scene.add(spotLight2);
    }
    
    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        // 辉光效果
        if (this.settings.enableBloom) {
            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(
                    window.innerWidth * this.settings.renderScale,
                    window.innerHeight * this.settings.renderScale
                ),
                this.deviceInfo.isMobile ? 0.3 : 0.45,
                this.deviceInfo.isMobile ? 0.25 : 0.4,
                this.deviceInfo.isMobile ? 0.9 : 0.7
            );
            this.composer.addPass(bloomPass);
        }
    }
    
    setupOrbitControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = this.deviceInfo.isMobile ? 0.1 : 0.05;
        this.controls.maxPolarAngle = Math.PI / 1.5;
        this.controls.minDistance = this.deviceInfo.isMobile ? 5 : 10;
        this.controls.maxDistance = this.deviceInfo.isMobile ? 60 : 100;
        this.controls.enableZoom = !this.deviceInfo.isMobile;
        this.controls.enablePan = !this.deviceInfo.isMobile;
        this.controls.enableRotate = !this.deviceInfo.isMobile;
    }
    
    createParticles() {
        const totalParticles = this.settings.particleCount;
        const mainParticles = this.settings.mainParticleCount;
        const dustParticles = totalParticles - mainParticles;
        
        // 材质
        const materials = {
            gold: new THREE.MeshStandardMaterial({
                color: 0xd4af37,
                metalness: 0.9,
                roughness: 0.2
            }),
            green: new THREE.MeshStandardMaterial({
                color: 0x1a5f1a,
                metalness: 0.3,
                roughness: 0.8
            }),
            red: new THREE.MeshPhysicalMaterial({
                color: 0xff0000,
                metalness: 0.5,
                roughness: 0.3,
                clearcoat: 0.8,
                clearcoatRoughness: 0.1
            }),
            dust: new THREE.MeshStandardMaterial({
                color: 0xfceea7,
                emissive: 0xfceea7,
                emissiveIntensity: 0.2
            })
        };
        
        // 创建糖果棒纹理
        const candyCaneTexture = this.createCandyCaneTexture();
        
        // 创建粒子
        for (let i = 0; i < totalParticles; i++) {
            // 低性能设备跳过部分粒子
            if (this.settings.performanceLevel === 'low' && i % 3 === 0) continue;
            
            let geometry, material;
            
            if (i < mainParticles) {
                const shapeType = i % (this.deviceInfo.isMobile ? 4 : 5);
                
                switch (shapeType) {
                    case 0: // 金色盒子
                        geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                        material = materials.gold;
                        break;
                    case 1: // 绿色盒子
                        geometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
                        material = materials.green;
                        break;
                    case 2: // 金色球体
                        geometry = new THREE.SphereGeometry(0.5, 16, 16);
                        material = materials.gold;
                        break;
                    case 3: // 红色球体
                        geometry = new THREE.SphereGeometry(0.6, 16, 16);
                        material = materials.red;
                        break;
                    case 4: // 糖果棒
                        if (this.settings.performanceLevel !== 'low') {
                            geometry = this.createCandyCaneGeometry();
                            material = new THREE.MeshStandardMaterial({
                                map: candyCaneTexture,
                                metalness: 0.2,
                                roughness: 0.5
                            });
                        } else {
                            continue;
                        }
                        break;
                }
            } else {
                // 尘埃粒子
                geometry = new THREE.SphereGeometry(
                    0.1 + Math.random() * 0.2,
                    8, 8
                );
                material = materials.dust;
            }
            
            if (!geometry) continue;
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = this.settings.enableShadows;
            mesh.receiveShadow = this.settings.enableShadows;
            
            const particle = {
                mesh,
                basePosition: new THREE.Vector3(),
                targetPosition: new THREE.Vector3(),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02
                ),
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02
                ),
                scale: 1,
                isPhoto: false
            };
            
            this.particles.push(particle);
            this.mainGroup.add(mesh);
        }
        
        // 初始化位置
        this.updateParticlePositions();
    }
    
    createCandyCaneTexture() {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // 白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 红色条纹
        ctx.fillStyle = '#ff0000';
        const stripeWidth = 10;
        
        for (let i = -stripeWidth; i < canvas.width + stripeWidth; i += stripeWidth * 2) {
            ctx.fillRect(i, 0, stripeWidth, canvas.height);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 5);
        
        return texture;
    }
    
    createCandyCaneGeometry() {
        // 使用Three.js核心的CatmullRomCurve3
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 1, 0),
            new THREE.Vector3(0, 2, 0.5),
            new THREE.Vector3(-1, 3, 0)
        ]);
        
        // 使用Three.js核心的TubeGeometry
        return new THREE.TubeGeometry(curve, 64, 0.2, 8, false);
    }
    
    createDefaultPhoto() {
        const canvas = document.createElement('canvas');
        const size = 512;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // 金色背景
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 内部白色区域
        ctx.fillStyle = '#fceea7';
        const margin = 20;
        ctx.fillRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);
        
        // 文字
        ctx.fillStyle = '#1a5f1a';
        const fontSize = 60;
        ctx.font = `bold ${fontSize}px Cinzel`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('JOYEUX NOEL', canvas.width / 2, canvas.height / 2);
        
        // 装饰元素
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 3, 30, 0, Math.PI * 2);
        ctx.fill();
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        
        this.addPhotoToScene(texture);
    }
    
    addPhotoToScene(texture) {
        // 检查照片数量限制
        if (this.photos.length >= this.settings.maxPhotos) {
            const oldPhoto = this.photos.shift();
            this.mainGroup.remove(oldPhoto.mesh);
            this.particles = this.particles.filter(p => p !== oldPhoto);
        }
        
        const frameScale = this.deviceInfo.isMobile ? 0.7 : 1.0;
        
        // 创建相框
        const frameGeometry = new THREE.BoxGeometry(3.5 * frameScale, 4.5 * frameScale, 0.3 * frameScale);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            metalness: 0.9,
            roughness: 0.2
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        
        // 创建照片
        const photoGeometry = new THREE.PlaneGeometry(3 * frameScale, 4 * frameScale);
        const photoMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide
        });
        const photo = new THREE.Mesh(photoGeometry, photoMaterial);
        photo.position.z = 0.16 * frameScale;
        
        // 组合
        const photoGroup = new THREE.Group();
        photoGroup.add(frame);
        photoGroup.add(photo);
        
        // 随机位置
        const angle = Math.random() * Math.PI * 2;
        const radius = (this.deviceInfo.isMobile ? 10 : 15) + Math.random() * 10;
        photoGroup.position.set(
            Math.cos(angle) * radius,
            (Math.random() - 0.5) * 15,
            Math.sin(angle) * radius
        );
        
        // 随机旋转
        photoGroup.rotation.y = Math.random() * Math.PI * 2;
        
        // 存储
        const photoParticle = {
            mesh: photoGroup,
            basePosition: photoGroup.position.clone(),
            targetPosition: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            rotationSpeed: new THREE.Vector3(),
            scale: 1,
            isPhoto: true
        };
        
        this.particles.push(photoParticle);
        this.photos.push(photoParticle);
        this.mainGroup.add(photoGroup);
        
        // 更新计数器
        this.updatePhotoCounter();
    }
    
    updatePhotoCounter() {
        const photoCount = document.getElementById('photoCount');
        if (photoCount) {
            photoCount.textContent = this.photos.length;
        }
    }
    
    updateParticlePositions() {
        const mode = this.STATE.mode;
        
        if (mode === 'TREE') {
            // 圣诞树模式 - 螺旋圆锥体
            const maxRadius = this.deviceInfo.isMobile ? 8 : 12;
            const height = this.deviceInfo.isMobile ? 18 : 25;
            
            this.particles.forEach((particle, i) => {
                if (particle.isPhoto) return;
                
                const t = i / this.particles.length;
                const radius = maxRadius * (1 - t * 0.8);
                const angle = t * 50 * Math.PI;
                const y = t * height - height / 2;
                
                particle.targetPosition.set(
                    Math.cos(angle) * radius,
                    y,
                    Math.sin(angle) * radius
                );
                particle.scale = this.deviceInfo.isMobile ? 0.8 : 1;
            });
            
        } else if (mode === 'SCATTER') {
            // 散落模式 - 球体分布
            const minRadius = this.deviceInfo.isMobile ? 6 : 8;
            const maxRadius = this.deviceInfo.isMobile ? 15 : 20;
            
            this.particles.forEach((particle) => {
                if (particle.isPhoto) return;
                
                const radius = minRadius + Math.random() * (maxRadius - minRadius);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                
                particle.targetPosition.set(
                    radius * Math.sin(phi) * Math.cos(theta),
                    (Math.random() - 0.5) * maxRadius * 1.5,
                    radius * Math.sin(phi) * Math.sin(theta)
                );
                particle.scale = 0.8 + Math.random() * 0.4;
            });
            
        } else if (mode === 'FOCUS') {
            // 聚焦模式
            if (this.photos.length > 0) {
                const targetPhoto = this.photos[Math.floor(Math.random() * this.photos.length)];
                
                targetPhoto.targetPosition.set(0, 2, this.deviceInfo.isMobile ? 25 : 35);
                targetPhoto.scale = this.deviceInfo.isMobile ? 3.5 : 4.5;
                
                const minRadius = this.deviceInfo.isMobile ? 8 : 10;
                const maxRadius = this.deviceInfo.isMobile ? 20 : 25;
                
                this.particles.forEach((particle) => {
                    if (particle === targetPhoto) return;
                    
                    if (particle.isPhoto) {
                        const angle = Math.random() * Math.PI * 2;
                        const radius = (this.deviceInfo.isMobile ? 15 : 20) + Math.random() * 10;
                        particle.targetPosition.set(
                            Math.cos(angle) * radius,
                            (Math.random() - 0.5) * 10,
                            Math.sin(angle) * radius
                        );
                        particle.scale = this.deviceInfo.isMobile ? 0.8 : 1;
                    } else {
                        const radius = minRadius + Math.random() * (maxRadius - minRadius);
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(2 * Math.random() - 1);
                        
                        particle.targetPosition.set(
                            radius * Math.sin(phi) * Math.cos(theta),
                            (Math.random() - 0.5) * maxRadius,
                            radius * Math.sin(phi) * Math.sin(theta)
                        );
                        particle.scale = 0.5 + Math.random() * 0.5;
                    }
                });
            }
        }
    }
    
    setMode(mode) {
        this.STATE.mode = mode;
        
        // 更新UI
        const modeText = document.getElementById('modeText');
        const modeSubtext = document.getElementById('modeSubtext');
        const modeIcon = document.getElementById('modeIcon');
        
        switch (mode) {
            case 'TREE':
                modeText.textContent = '圣诞树模式';
                modeSubtext.textContent = '粒子排列为圣诞树形状';
                modeIcon.textContent = '🎄';
                break;
            case 'SCATTER':
                modeText.textContent = '散落模式';
                modeSubtext.textContent = '粒子随机散布在空中';
                modeIcon.textContent = '❄️';
                break;
            case 'FOCUS':
                modeText.textContent = '聚焦模式';
                modeSubtext.textContent = '突出显示一张回忆照片';
                modeIcon.textContent = '✨';
                break;
        }
        
        // 更新模式按钮状态
        const modeControls = document.getElementById('modeControls');
        if (modeControls) {
            Array.from(modeControls.children).forEach(btn => {
                btn.dataset.active = (btn.dataset.mode === mode).toString();
            });
        }
        
        // 更新粒子位置
        this.updateParticlePositions();
    }
    
    setupEventListeners() {
        // 窗口大小调整
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // 键盘控制
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // 文件上传
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', this.handleFileUpload.bind(this));
        }
        
        // 模式切换按钮
        const modeControls = document.getElementById('modeControls');
        if (modeControls) {
            Array.from(modeControls.children).forEach(btn => {
                btn.addEventListener('click', () => {
                    const mode = btn.dataset.mode;
                    if (mode) this.setMode(mode);
                });
            });
        }
        
        // 设置面板
        const settingsToggle = document.getElementById('settingsToggle');
        const settingsContent = document.getElementById('settingsContent');
        if (settingsToggle && settingsContent) {
            settingsToggle.addEventListener('click', () => {
                settingsContent.style.display = 
                    settingsContent.style.display === 'block' ? 'none' : 'block';
            });
        }
        
        // 性能警告按钮
        const continueBtn = document.getElementById('continueBtn');
        const lightweightBtn = document.getElementById('lightweightBtn');
        const performanceWarning = document.getElementById('performanceWarning');
        
        if (continueBtn && performanceWarning) {
            continueBtn.addEventListener('click', () => {
                performanceWarning.style.display = 'none';
            });
        }
        
        if (lightweightBtn && performanceWarning) {
            lightweightBtn.addEventListener('click', () => {
                this.enableLightweightMode();
                performanceWarning.style.display = 'none';
            });
        }
        
        // 设备提示关闭
        const closeHint = document.getElementById('closeHint');
        const deviceHint = document.getElementById('deviceHint');
        if (closeHint && deviceHint) {
            closeHint.addEventListener('click', () => {
                deviceHint.style.display = 'none';
            });
        }
        
        // 移动端快捷按钮
        const quickHide = document.getElementById('quickHide');
        const quickPhoto = document.getElementById('quickPhoto');
        const quickReset = document.getElementById('quickReset');
        
        if (quickHide) {
            quickHide.addEventListener('click', () => {
                document.getElementById('uiContainer').classList.toggle('ui-hidden');
            });
        }
        
        if (quickPhoto && fileInput) {
            quickPhoto.addEventListener('click', () => fileInput.click());
        }
        
        if (quickReset) {
            quickReset.addEventListener('click', () => this.resetView());
        }
        
        // 底部按钮
        const toggleFullscreen = document.getElementById('toggleFullscreen');
        const toggleMute = document.getElementById('toggleMute');
        const showHelp = document.getElementById('showHelp');
        
        if (toggleFullscreen) {
            toggleFullscreen.addEventListener('click', this.toggleFullscreen.bind(this));
        }
        
        if (toggleMute) {
            toggleMute.addEventListener('click', this.toggleMute.bind(this));
        }
        
        if (showHelp) {
            showHelp.addEventListener('click', this.showHelp.bind(this));
        }
        
        // 页面可见性
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    }
    
    handleKeyDown(event) {
        switch (event.key.toLowerCase()) {
            case 'h':
                document.getElementById('uiContainer').classList.toggle('ui-hidden');
                break;
            case ' ':
                event.preventDefault();
                const modes = ['TREE', 'SCATTER', 'FOCUS'];
                const currentIndex = modes.indexOf(this.STATE.mode);
                const nextIndex = (currentIndex + 1) % modes.length;
                this.setMode(modes[nextIndex]);
                break;
            case 'escape':
                this.resetView();
                break;
        }
    }
    
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 检查文件大小
        if (this.deviceInfo.isMobile && file.size > 5 * 1024 * 1024) {
            alert('文件大小超过5MB，请选择较小的图片。');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const texture = new THREE.TextureLoader().load(ev.target.result);
            texture.colorSpace = THREE.SRGBColorSpace;
            this.addPhotoToScene(texture);
        };
        reader.readAsDataURL(file);
        
        event.target.value = '';
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(
            window.innerWidth * this.settings.renderScale,
            window.innerHeight * this.settings.renderScale
        );
        
        this.composer.setSize(
            window.innerWidth * this.settings.renderScale,
            window.innerHeight * this.settings.renderScale
        );
        
        if (this.composer.passes[1] instanceof UnrealBloomPass) {
            this.composer.passes[1].resolution = new THREE.Vector2(
                window.innerWidth * this.settings.renderScale,
                window.innerHeight * this.settings.renderScale
            );
        }
    }
    
    resetView() {
        if (this.deviceInfo.isMobile) {
            this.camera.position.set(0, 3, 35);
        } else {
            this.camera.position.set(0, 2, 50);
        }
        
        if (this.controls) {
            this.controls.reset();
        }
        
        if (this.touchController) {
            this.touchController.touchRotation = { x: 0, y: 0 };
        }
        
        this.STATE.gestureData = { rotationX: 0, rotationY: 0 };
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    
    toggleMute() {
        const video = document.getElementById('webcam');
        if (video) {
            video.muted = !video.muted;
        }
    }
    
    showHelp() {
        alert(`使用说明：

🎄 桌面端：
   - 鼠标拖动旋转场景
   - 滚轮缩放
   - H键：隐藏/显示UI
   - 空格键：切换模式
   - ESC键：重置视图
   - 手势控制（需摄像头）：捏合/握拳/张开

📱 移动端：
   - 单指拖动旋转场景
   - 双指捏合：聚焦模式
   - 长按：切换模式
   - 双击：隐藏/显示UI

✨ 功能：
   - 点击"添加回忆照片"上传图片
   - 三种模式：圣诞树/散落/聚焦
   - 自动性能优化
   - 本地运行，无需网络`);
    }
    
    enableLightweightMode() {
        // 启用轻量模式
        this.settings = {
            ...this.settings,
            particleCount: 500,
            mainParticleCount: 200,
            enableBloom: false,
            enableShadows: false,
            antialias: false,
            pixelRatio: 1.0,
            renderScale: 0.7
        };
        
        // 重新创建粒子
        this.reinitialize();
    }
    
    reinitialize() {
        // 清理现有粒子
        this.particles.forEach(particle => {
            this.mainGroup.remove(particle.mesh);
            particle.mesh.geometry.dispose();
            particle.mesh.material.dispose();
        });
        this.particles = [];
        this.photos = [];
        
        // 重新创建
        this.createParticles();
        this.createDefaultPhoto();
        this.updatePhotoCounter();
    }
    
    pause() {
        this.STATE.isAnimating = false;
        this.clock.stop();
    }
    
    resume() {
        this.STATE.isAnimating = true;
        this.clock.start();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (!this.STATE.isAnimating) return;
        
        // 性能监控
        const perfStatus = this.performanceMonitor.update();
        const fpsCounter = document.getElementById('fpsCounter');
        if (fpsCounter) {
            fpsCounter.textContent = `${this.performanceMonitor.fps} FPS`;
            
            // 根据FPS改变颜色
            if (this.performanceMonitor.fps < 30) {
                fpsCounter.style.color = '#ff4444';
            } else if (this.performanceMonitor.fps < 45) {
                fpsCounter.style.color = '#ffaa00';
            } else {
                fpsCounter.style.color = '#44ff44';
            }
        }
        
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        // 应用手势旋转
        if (this.gestureRecognizer.isAvailable) {
            const { rotationX, rotationY } = this.STATE.gestureData;
            this.mainGroup.rotation.y += rotationY * 0.05;
            this.mainGroup.rotation.x += rotationX * 0.05;
        }
        
        // 应用触摸控制
        if (this.touchController.isEnabled) {
            this.touchController.update();
        }
        
        // 动画粒子
        const animationSpeed = this.deviceInfo.isMobile ? 0.03 : 0.05;
        
        this.particles.forEach((particle, index) => {
            // 低性能设备跳过部分粒子
            if (this.settings.performanceLevel === 'low' && index % 3 === 0) return;
            
            // 位置插值
            particle.mesh.position.lerp(particle.targetPosition, animationSpeed);
            
            // 缩放插值
            particle.mesh.scale.lerp(
                new THREE.Vector3(particle.scale, particle.scale, particle.scale),
                0.05
            );
            
            // 散落模式下的自转
            if (this.STATE.mode === 'SCATTER' && !particle.isPhoto) {
                particle.mesh.rotation.x += particle.rotationSpeed.x;
                particle.mesh.rotation.y += particle.rotationSpeed.y;
                particle.mesh.rotation.z += particle.rotationSpeed.z;
            }
            
            // 轻微浮动效果
            if (!particle.isPhoto) {
                particle.mesh.position.y += Math.sin(time + particle.mesh.id) * 0.005;
            }
        });
        
        // 更新控制器
        if (this.controls) {
            this.controls.update();
        }
        
        // 渲染
        if (this.settings.performanceLevel === 'low' && time % 2 < 1) {
            this.renderer.render(this.scene, this.camera);
        } else {
            this.composer.render();
        }
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            color: #ff4444;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            max-width: 80%;
            z-index: 10000;
            border: 2px solid #ff4444;
        `;
        
        errorDiv.innerHTML = `
            <h3>应用错误</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="
                background: #d4af37;
                color: #000;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 15px;
            ">重新加载</button>
        `;
        
        document.body.appendChild(errorDiv);
    }
    
    dispose() {
        // 清理粒子
        this.particles.forEach(particle => {
            particle.mesh.geometry.dispose();
            if (particle.mesh.material.map) {
                particle.mesh.material.map.dispose();
            }
            particle.mesh.material.dispose();
        });
        
        // 清理手势识别
        this.gestureRecognizer.dispose();
        
        // 清理渲染器
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// ==================== 启动应用 ====================
// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 检查WebGL支持
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            throw new Error('您的浏览器不支持WebGL');
        }
        
        // 创建应用实例
        const app = new ChristmasTreeApp();
        
        // 全局访问（调试用）
        window.app = app;
        
        // 页面卸载时清理
        window.addEventListener('beforeunload', () => {
            app.dispose();
        });
        
        // 错误处理
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
        });
        
    } catch (error) {
        console.error('应用启动失败:', error);
        
        // 显示错误页面
        document.body.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #000;
                color: #fceea7;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                padding: 20px;
            ">
                <h1 style="color: #d4af37; margin-bottom: 20px;">🎄 圣诞快乐 🎅</h1>
                <p style="margin-bottom: 30px; max-width: 600px;">
                    很抱歉，应用无法正常加载。<br>
                    错误信息：${error.message}
                </p>
                <div>
                    <button onclick="location.reload()" style="
                        background: #d4af37;
                        color: #000;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 16px;
                        margin: 10px;
                    ">重新加载</button>
                </div>
            </div>
        `;
    }
});