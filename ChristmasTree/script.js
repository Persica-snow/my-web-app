// 设备检测
const deviceDetector = {
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    isLowEnd: () => {
        const memory = navigator.deviceMemory || 4;
        const cores = navigator.hardwareConcurrency || 4;
        return memory < 4 || cores < 4;
    }
};

// Import modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// Main Application Class
class ChristmasTreeApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.controls = null;
        
        // 设备检测
        this.isMobile = deviceDetector.isMobile || deviceDetector.isTouchDevice;
        this.isLowEndDevice = deviceDetector.isLowEnd() && this.isMobile;
        
        // 移动端性能设置
        this.particleCount = this.isMobile ? (this.isLowEndDevice ? 1000 : 2000) : 4000;
        this.mainParticleCount = this.isMobile ? (this.isLowEndDevice ? 300 : 500) : 1500;
        this.mobileRenderScale = this.isMobile ? (this.isLowEndDevice ? 0.6 : 0.75) : 1.0;
        
        // Particle system
        this.mainGroup = new THREE.Group();
        this.particles = [];
        this.photos = [];
        
        // State
        this.STATE = {
            mode: 'TREE', // TREE, SCATTER, FOCUS
            targetPositions: [],
            gestureData: {
                rotationX: 0,
                rotationY: 0,
                isPinching: false,
                isFist: false,
                isOpen: false
            }
        };
        
        // 移动端触摸控制
        this.touchStartPos = null;
        this.touchRotation = { x: 0, y: 0 };
        this.lastTapTime = 0;
        this.longPressTimer = null;
        this.touchControlsActive = false;
        
        // Animation
        this.clock = new THREE.Clock();
        this.mixers = [];
        
        // 节流控制
        this.lastGestureTime = 0;
        this.gestureThrottleTime = this.isMobile ? 300 : 200;
        this.renderThrottle = false;
        this.renderFrameSkip = this.isLowEndDevice ? 1 : 0;
        
        // MediaPipe
        this.handLandmarker = null;
        this.lastVideoTime = -1;
        this.gestureRecognitionAvailable = false;
        
        // UI Elements
        this.loader = document.getElementById('loader');
        this.uiContainer = document.getElementById('uiContainer');
        this.modeText = document.getElementById('modeText');
        this.modeSubtext = document.getElementById('modeSubtext');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInput = document.getElementById('fileInput');
        this.desktopInstruction = document.getElementById('desktopInstruction');
        this.mobileInstruction = document.getElementById('mobileInstruction');
        this.performanceWarning = document.getElementById('performanceWarning');
        this.continueBtn = document.getElementById('continueBtn');
        
        // 低性能设备显示警告
        if (this.isLowEndDevice) {
            setTimeout(() => {
                this.performanceWarning.style.display = 'block';
            }, 2000);
        }
        
        // 根据设备显示不同的使用说明
        if (this.isMobile) {
            this.desktopInstruction.style.display = 'none';
            this.mobileInstruction.style.display = 'block';
        }
        
        // 初始化应用
        this.init();
    }
    
    async init() {
        // 初始化Three.js
        await this.initThreeJS();
        
        // 尝试初始化MediaPipe（移动端可能降级）
        await this.initMediaPipe();
        
        // 如果手势识别不可用，启用触摸控制
        if (!this.gestureRecognitionAvailable && this.isMobile) {
            this.enableTouchControls();
        }
        
        // 初始化粒子
        this.createParticles();
        
        // 添加默认照片
        this.createDefaultPhoto();
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 开始动画
        this.animate();
        
        // 3秒后隐藏加载器
        setTimeout(() => {
            this.loader.classList.add('hidden');
        }, 3000);
    }
    
    async initThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // Camera - 移动端调整位置
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        if (this.isMobile) {
            this.camera.position.set(0, 3, 35);
        } else {
            this.camera.position.set(0, 2, 50);
        }
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('canvas3d'),
            antialias: !this.isLowEndDevice,
            alpha: false,
            powerPreference: this.isLowEndDevice ? 'low-power' : 'high-performance'
        });
        
        // 移动端性能优化
        if (this.isMobile) {
            const pixelRatio = this.isLowEndDevice ? 1 : Math.min(1.5, window.devicePixelRatio);
            this.renderer.setPixelRatio(pixelRatio);
            this.renderer.setSize(window.innerWidth * this.mobileRenderScale, 
                               window.innerHeight * this.mobileRenderScale);
        } else {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
        }
        
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = this.isMobile ? 1.8 : 2.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // 移动端优化阴影
        this.renderer.shadowMap.enabled = !this.isLowEndDevice;
        this.renderer.shadowMap.type = this.isLowEndDevice ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
        
        // Environment
        const environment = new RoomEnvironment();
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmremGenerator.fromScene(environment).texture;
        
        // Lights - 移动端简化光照
        const ambientLight = new THREE.AmbientLight(0xffffff, this.isMobile ? 0.7 : 0.6);
        this.scene.add(ambientLight);
        
        const pointLight = new THREE.PointLight(0xff6600, this.isMobile ? 1 : 2, 100);
        pointLight.position.set(5, 10, 5);
        this.scene.add(pointLight);
        
        const spotLight1 = new THREE.SpotLight(0xd4af37, this.isMobile ? 800 : 1200, 100, Math.PI / 6, 0.5, 1);
        spotLight1.position.set(30, 40, 40);
        spotLight1.castShadow = !this.isLowEndDevice;
        if (!this.isLowEndDevice) {
            spotLight1.shadow.mapSize.width = this.isMobile ? 256 : 512;
            spotLight1.shadow.mapSize.height = this.isMobile ? 256 : 512;
        }
        this.scene.add(spotLight1);
        
        const spotLight2 = new THREE.SpotLight(0x3399ff, this.isMobile ? 400 : 600, 100, Math.PI / 6, 0.5, 1);
        spotLight2.position.set(-30, 20, -30);
        this.scene.add(spotLight2);
        
        // Add main group to scene
        this.scene.add(this.mainGroup);
        
        // Post-processing - 移动端简化
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        // 移动端降低Bloom效果或禁用
        if (!this.isLowEndDevice) {
            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(
                    window.innerWidth * this.mobileRenderScale,
                    window.innerHeight * this.mobileRenderScale
                ),
                this.isMobile ? 0.3 : 0.45,
                this.isMobile ? 0.25 : 0.4,
                this.isMobile ? 0.9 : 0.7
            );
            this.composer.addPass(bloomPass);
        }
        
        // Controls - 移动端调整阻尼
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = this.isMobile ? 0.1 : 0.05;
        this.controls.maxPolarAngle = Math.PI / 1.5;
        this.controls.minDistance = this.isMobile ? 5 : 10;
        this.controls.maxDistance = this.isMobile ? 60 : 100;
        this.controls.enableZoom = !this.isMobile;
        this.controls.enablePan = !this.isMobile;
    }
    
    async initMediaPipe() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );
            
            // 移动端使用CPU以提高兼容性，桌面端使用GPU
            const delegate = this.isMobile ? "CPU" : "GPU";
            
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: delegate
                },
                runningMode: "VIDEO",
                numHands: 1,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            // Setup webcam
            const video = document.getElementById('webcam');
            const canvas = document.getElementById('outputCanvas');
            
            if (navigator.mediaDevices.getUserMedia) {
                // 移动端调整摄像头参数
                const constraints = this.isMobile ? {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user',
                        frameRate: { ideal: 24 }
                    },
                    audio: false
                } : { video: true };
                
                try {
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    video.srcObject = stream;
                    
                    video.addEventListener('loadeddata', () => {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        this.gestureRecognitionAvailable = true;
                        this.predictWebcam();
                    });
                } catch (error) {
                    console.warn('Camera access failed, using touch controls:', error);
                    this.gestureRecognitionAvailable = false;
                }
            }
        } catch (error) {
            console.warn('MediaPipe initialization failed, falling back to touch controls:', error);
            this.gestureRecognitionAvailable = false;
        }
    }
    
    predictWebcam = async () => {
        if (!this.gestureRecognitionAvailable) return;
        
        const video = document.getElementById('webcam');
        const canvas = document.getElementById('outputCanvas');
        const ctx = canvas.getContext('2d');
        
        if (video.currentTime === this.lastVideoTime) {
            requestAnimationFrame(this.predictWebcam);
            return;
        }
        
        this.lastVideoTime = video.currentTime;
        
        try {
            // Detect hands
            const results = this.handLandmarker.detectForVideo(video, Date.now());
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                
                // Process gestures
                this.processGestures(landmarks);
                
                // Draw landmarks (debug only)
                if (!this.isMobile) {
                    this.drawLandmarks(ctx, landmarks, canvas.width, canvas.height);
                }
                
                // Map hand position to 3D rotation
                this.mapHandToRotation(landmarks);
            }
        } catch (error) {
            console.warn('Hand detection error:', error);
        }
        
        requestAnimationFrame(this.predictWebcam);
    };
    
    processGestures(landmarks) {
        const now = Date.now();
        if (now - this.lastGestureTime < this.gestureThrottleTime) {
            return;
        }
        
        // Get key landmarks
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const wrist = landmarks[0];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        
        // Calculate distances
        const pinchDistance = Math.hypot(
            thumbTip.x - indexTip.x,
            thumbTip.y - indexTip.y,
            thumbTip.z - indexTip.z
        );
        
        // Calculate distance from fingertips to wrist
        const distances = [
            Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y, indexTip.z - wrist.z),
            Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y, middleTip.z - wrist.z),
            Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y, ringTip.z - wrist.z),
            Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y, pinkyTip.z - wrist.z)
        ];
        
        const avgDistance = distances.reduce((a, b) => a + b) / distances.length;
        
        // 移动端调整手势阈值
        const pinchThreshold = this.isMobile ? 0.08 : 0.05;
        const fistThreshold = this.isMobile ? 0.3 : 0.25;
        const openThreshold = this.isMobile ? 0.35 : 0.4;
        
        // Update gesture state
        this.STATE.gestureData.isPinching = pinchDistance < pinchThreshold;
        this.STATE.gestureData.isFist = avgDistance < fistThreshold;
        this.STATE.gestureData.isOpen = avgDistance > openThreshold;
        
        // Change mode based on gestures
        if (this.STATE.gestureData.isPinching && this.STATE.mode !== 'FOCUS') {
            this.setMode('FOCUS');
            this.lastGestureTime = now;
        } else if (this.STATE.gestureData.isFist && this.STATE.mode !== 'TREE') {
            this.setMode('TREE');
            this.lastGestureTime = now;
        } else if (this.STATE.gestureData.isOpen && this.STATE.mode !== 'SCATTER') {
            this.setMode('SCATTER');
            this.lastGestureTime = now;
        }
    }
    
    mapHandToRotation(landmarks) {
        // Use palm center (landmark 9) for rotation control
        const palmCenter = landmarks[9];
        
        // Map normalized coordinates to rotation values
        this.STATE.gestureData.rotationY = (palmCenter.x - 0.5) * 2;
        this.STATE.gestureData.rotationX = (0.5 - palmCenter.y) * (this.isMobile ? 1.0 : 1.5);
    }
    
    drawLandmarks(ctx, landmarks, width, height) {
        // Draw landmarks as small circles
        ctx.fillStyle = '#d4af37';
        
        for (const landmark of landmarks) {
            const x = landmark.x * width;
            const y = landmark.y * height;
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    
    enableTouchControls() {
        this.touchControlsActive = true;
        const canvas = this.renderer.domElement;
        
        // 单指触摸 - 旋转控制
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1) {
                this.touchStartPos = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                    time: Date.now()
                };
                
                // 长按检测
                this.longPressTimer = setTimeout(() => {
                    const modes = ['TREE', 'SCATTER', 'FOCUS'];
                    const currentIndex = modes.indexOf(this.STATE.mode);
                    const nextIndex = (currentIndex + 1) % modes.length;
                    this.setMode(modes[nextIndex]);
                }, 1000);
                
            } else if (e.touches.length === 2) {
                // 双指捏合 - 焦点模式
                this.setMode('FOCUS');
            }
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1 && this.touchStartPos) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - this.touchStartPos.x;
                const deltaY = touch.clientY - this.touchStartPos.y;
                
                // 更新旋转 - 移动端灵敏度调整
                this.touchRotation.y += deltaX * (this.isMobile ? 0.008 : 0.01);
                this.touchRotation.x += deltaY * (this.isMobile ? 0.008 : 0.01);
                
                // 限制X轴旋转角度
                this.touchRotation.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, this.touchRotation.x));
                
                // 更新起始位置
                this.touchStartPos.x = touch.clientX;
                this.touchStartPos.y = touch.clientY;
                
                // 清除长按计时器
                if (this.longPressTimer) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
            }
        }, { passive: false });
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            // 清除长按计时器
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            
            // 点击/双击检测
            const now = Date.now();
            if (now - this.lastTapTime < 300 && e.touches.length === 0) {
                this.uiContainer.classList.toggle('ui-hidden');
            }
            this.lastTapTime = now;
            
            this.touchStartPos = null;
        }, { passive: false });
        
        // 显示触摸提示
        this.showTouchInstructions();
    }
    
    showTouchInstructions() {
        const touchHint = document.createElement('div');
        touchHint.className = 'touch-hint';
        touchHint.innerHTML = `
            <div>Single finger drag to rotate</div>
            <div>Two-finger pinch for focus mode</div>
            <div>Long press to switch modes</div>
        `;
        document.body.appendChild(touchHint);
        
        // 10秒后淡出
        setTimeout(() => {
            touchHint.style.transition = 'opacity 1.5s';
            touchHint.style.opacity = '0';
            setTimeout(() => {
                if (touchHint.parentNode) {
                    touchHint.parentNode.removeChild(touchHint);
                }
            }, 1500);
        }, 10000);
    }
    
    createParticles() {
        const particleCount = this.particleCount;
        const mainParticleCount = this.mainParticleCount;
        
        // 移动端简化材质
        const goldMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            metalness: this.isMobile ? 0.7 : 0.9,
            roughness: this.isMobile ? 0.4 : 0.2,
            flatShading: this.isLowEndDevice
        });
        
        const greenMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a5f1a,
            metalness: 0.3,
            roughness: 0.8,
            flatShading: this.isLowEndDevice
        });
        
        const redMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xff0000,
            metalness: 0.5,
            roughness: 0.3,
            clearcoat: this.isMobile ? 0.5 : 0.8,
            clearcoatRoughness: 0.1,
            flatShading: this.isLowEndDevice
        });
        
        // 创建糖果棒纹理
        const candyCaneTexture = this.createCandyCaneTexture();
        
        for (let i = 0; i < particleCount; i++) {
            let geometry, material;
            let type = 'DUST';
            
            // 低端设备跳过部分粒子
            if (this.isLowEndDevice && i % 3 === 0) continue;
            
            if (i < mainParticleCount) {
                const shapeType = i % (this.isMobile ? 4 : 5);
                
                switch (shapeType) {
                    case 0: // Box - gold
                        geometry = new THREE.BoxGeometry(
                            0.8, 0.8, 0.8,
                            this.isLowEndDevice ? 1 : undefined
                        );
                        material = goldMaterial;
                        type = 'BOX_GOLD';
                        break;
                    case 1: // Box - green
                        geometry = new THREE.BoxGeometry(
                            0.7, 0.7, 0.7,
                            this.isLowEndDevice ? 1 : undefined
                        );
                        material = greenMaterial;
                        type = 'BOX_GREEN';
                        break;
                    case 2: // Sphere - gold
                        geometry = new THREE.SphereGeometry(
                            0.5,
                            this.isMobile ? 8 : 16,
                            this.isMobile ? 6 : 16
                        );
                        material = goldMaterial;
                        type = 'SPHERE_GOLD';
                        break;
                    case 3: // Sphere - red
                        geometry = new THREE.SphereGeometry(
                            0.6,
                            this.isMobile ? 8 : 16,
                            this.isMobile ? 6 : 16
                        );
                        material = redMaterial;
                        type = 'SPHERE_RED';
                        break;
                    case 4: // Candy cane
                        if (!this.isMobile || !this.isLowEndDevice) {
                            geometry = this.createCandyCaneGeometry();
                            material = new THREE.MeshStandardMaterial({
                                map: candyCaneTexture,
                                metalness: 0.2,
                                roughness: 0.5,
                                flatShading: this.isLowEndDevice
                            });
                            type = 'CANDY';
                        } else {
                            continue;
                        }
                        break;
                }
            } else {
                // Dust particles
                geometry = new THREE.SphereGeometry(
                    0.1 + Math.random() * 0.2,
                    this.isMobile ? 6 : 8,
                    this.isMobile ? 4 : 8
                );
                material = new THREE.MeshStandardMaterial({
                    color: 0xfceea7,
                    emissive: 0xfceea7,
                    emissiveIntensity: 0.2,
                    flatShading: this.isLowEndDevice
                });
                type = 'DUST';
            }
            
            if (!geometry) continue;
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = !this.isLowEndDevice;
            mesh.receiveShadow = !this.isLowEndDevice;
            
            const particle = {
                mesh,
                type,
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
        
        // 根据当前模式初始化位置
        this.updateParticlePositions();
    }
    
    createCandyCaneTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = this.isMobile ? 128 : 256;
        canvas.height = this.isMobile ? 128 : 256;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Red stripes
        ctx.fillStyle = '#ff0000';
        const stripeWidth = this.isMobile ? 10 : 20;
        
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
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 1, 0),
            new THREE.Vector3(0, 2, 0.5),
            new THREE.Vector3(-1, 3, 0)
        ]);
        
        const tubularSegments = this.isMobile ? 32 : 64;
        const radialSegments = this.isMobile ? 6 : 8;
        
        const tubeGeometry = new THREE.TubeGeometry(curve, tubularSegments, 0.2, radialSegments, false);
        return tubeGeometry;
    }
    
    createDefaultPhoto() {
        const canvas = document.createElement('canvas');
        canvas.width = this.isMobile ? 256 : 512;
        canvas.height = this.isMobile ? 256 : 512;
        const ctx = canvas.getContext('2d');
        
        // Gold background
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Inner white area
        ctx.fillStyle = '#fceea7';
        const margin = this.isMobile ? 15 : 20;
        ctx.fillRect(margin, margin, canvas.width - margin*2, canvas.height - margin*2);
        
        // Text
        ctx.fillStyle = '#1a5f1a';
        ctx.font = `bold ${this.isMobile ? 30 : 60}px Cinzel`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('JOYEUX NOEL', canvas.width / 2, canvas.height / 2);
        
        // Decorative elements
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 3, this.isMobile ? 20 : 30, 0, Math.PI * 2);
        ctx.fill();
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        
        this.addPhotoToScene(texture);
    }
    
    addPhotoToScene(texture) {
        const frameScale = this.isMobile ? 0.7 : 1.0;
        
        // Create photo frame
        const frameGeometry = new THREE.BoxGeometry(3.5 * frameScale, 4.5 * frameScale, 0.3 * frameScale);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            metalness: 0.9,
            roughness: 0.2,
            flatShading: this.isLowEndDevice
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        
        // Create photo
        const photoGeometry = new THREE.PlaneGeometry(3 * frameScale, 4 * frameScale);
        const photoMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide,
            flatShading: this.isLowEndDevice
        });
        const photo = new THREE.Mesh(photoGeometry, photoMaterial);
        photo.position.z = 0.16 * frameScale;
        
        // Group frame and photo together
        const photoGroup = new THREE.Group();
        photoGroup.add(frame);
        photoGroup.add(photo);
        
        // Random position
        const angle = Math.random() * Math.PI * 2;
        const radius = (this.isMobile ? 10 : 15) + Math.random() * (this.isMobile ? 5 : 10);
        photoGroup.position.set(
            Math.cos(angle) * radius,
            (Math.random() - 0.5) * (this.isMobile ? 10 : 15),
            Math.sin(angle) * radius
        );
        
        // Random rotation
        photoGroup.rotation.y = Math.random() * Math.PI * 2;
        
        // Store photo data
        const photoParticle = {
            mesh: photoGroup,
            type: 'PHOTO',
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
        
        // Limit number of photos on mobile
        if (this.isMobile && this.photos.length > 5) {
            const oldPhoto = this.photos.shift();
            this.mainGroup.remove(oldPhoto.mesh);
            this.particles = this.particles.filter(p => p !== oldPhoto);
        }
    }
    
    updateParticlePositions() {
        const mode = this.STATE.mode;
        
        if (mode === 'TREE') {
            const maxRadius = this.isMobile ? 8 : 12;
            const height = this.isMobile ? 18 : 25;
            
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
                particle.scale = this.isMobile ? 0.8 : 1;
            });
        } else if (mode === 'SCATTER') {
            const minRadius = this.isMobile ? 6 : 8;
            const maxRadius = this.isMobile ? 15 : 20;
            
            this.particles.forEach((particle, i) => {
                if (particle.isPhoto) return;
                
                const radius = minRadius + Math.random() * (maxRadius - minRadius);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                
                particle.targetPosition.set(
                    radius * Math.sin(phi) * Math.cos(theta),
                    (Math.random() - 0.5) * maxRadius * (this.isMobile ? 1.2 : 1.5),
                    radius * Math.sin(phi) * Math.sin(theta)
                );
                particle.scale = (this.isMobile ? 0.6 : 0.8) + Math.random() * (this.isMobile ? 0.3 : 0.4);
            });
        } else if (mode === 'FOCUS') {
            if (this.photos.length > 0) {
                const targetPhoto = this.photos[Math.floor(Math.random() * this.photos.length)];
                
                targetPhoto.targetPosition.set(0, 2, this.isMobile ? 25 : 35);
                targetPhoto.scale = this.isMobile ? 3.5 : 4.5;
                
                const minRadius = this.isMobile ? 8 : 10;
                const maxRadius = this.isMobile ? 20 : 25;
                
                this.particles.forEach((particle) => {
                    if (particle === targetPhoto) return;
                    
                    if (particle.isPhoto) {
                        const angle = Math.random() * Math.PI * 2;
                        const radius = (this.isMobile ? 15 : 20) + Math.random() * 10;
                        particle.targetPosition.set(
                            Math.cos(angle) * radius,
                            (Math.random() - 0.5) * (this.isMobile ? 8 : 10),
                            Math.sin(angle) * radius
                        );
                        particle.scale = this.isMobile ? 0.8 : 1;
                    } else {
                        const radius = minRadius + Math.random() * (maxRadius - minRadius);
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(2 * Math.random() - 1);
                        
                        particle.targetPosition.set(
                            radius * Math.sin(phi) * Math.cos(theta),
                            (Math.random() - 0.5) * maxRadius,
                            radius * Math.sin(phi) * Math.sin(theta)
                        );
                        particle.scale = (this.isMobile ? 0.4 : 0.5) + Math.random() * (this.isMobile ? 0.3 : 0.5);
                    }
                });
            }
        }
    }
    
    setMode(mode) {
        this.STATE.mode = mode;
        
        switch (mode) {
            case 'TREE':
                this.modeText.textContent = 'TREE MODE';
                this.modeSubtext.textContent = 'Particles arranged as a tree';
                break;
            case 'SCATTER':
                this.modeText.textContent = 'SCATTER MODE';
                this.modeSubtext.textContent = 'Particles scattered randomly';
                break;
            case 'FOCUS':
                this.modeText.textContent = 'FOCUS MODE';
                this.modeSubtext.textContent = 'Focusing on a memory';
                break;
        }
        
        this.updateParticlePositions();
    }
    
    setupEventListeners() {
        // 隐藏UI - H键
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'h') {
                this.uiContainer.classList.toggle('ui-hidden');
            }
        });
        
        // 上传按钮
        this.uploadBtn.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        // 继续按钮
        this.continueBtn.addEventListener('click', () => {
            this.performanceWarning.style.display = 'none';
        });
        
        // 文件输入
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // 移动端检查文件大小
            if (this.isMobile && file.size > 5 * 1024 * 1024) {
                alert('File too large for mobile. Please choose an image under 5MB.');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                new THREE.TextureLoader().load(ev.target.result, (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    this.addPhotoToScene(texture);
                });
            };
            reader.readAsDataURL(file);
            
            this.fileInput.value = '';
        });
        
        // 窗口大小调整
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        // 横竖屏切换
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.onWindowResize();
            }, 200);
        });
        
        // 防止手势缩放
        document.addEventListener('gesturestart', (e) => e.preventDefault());
        document.addEventListener('gesturechange', (e) => e.preventDefault());
        document.addEventListener('gestureend', (e) => e.preventDefault());
        
        // 页面可见性API
        document.addEventListener('visibilitychange', () => {
            if (this.isMobile) {
                if (document.hidden) {
                    this.pause();
                } else {
                    this.resume();
                }
            }
        });
        
        // 防止移动端滚动
        document.addEventListener('touchmove', (e) => {
            if (e.target.id !== 'canvas3d') {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        if (this.isMobile) {
            const width = window.innerWidth * this.mobileRenderScale;
            const height = window.innerHeight * this.mobileRenderScale;
            
            this.renderer.setSize(width, height);
            this.composer.setSize(width, height);
            
            if (this.composer.passes[1] instanceof UnrealBloomPass) {
                this.composer.passes[1].resolution = new THREE.Vector2(width, height);
            }
        } else {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    pause() {
        this.clock.stop();
    }
    
    resume() {
        this.clock.start();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 低端设备跳帧渲染
        if (this.isLowEndDevice) {
            this.renderThrottle = !this.renderThrottle;
            if (this.renderThrottle) return;
        }
        
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        const animationSpeed = this.isMobile ? 0.03 : 0.05;
        
        // 应用手势控制的旋转
        if (this.gestureRecognitionAvailable && 
            (this.STATE.gestureData.rotationY !== 0 || this.STATE.gestureData.rotationX !== 0)) {
            this.mainGroup.rotation.y += this.STATE.gestureData.rotationY * 0.05;
            this.mainGroup.rotation.x += this.STATE.gestureData.rotationX * 0.05;
        }
        
        // 应用触摸控制的旋转
        if (this.touchControlsActive) {
            this.mainGroup.rotation.y = THREE.MathUtils.lerp(
                this.mainGroup.rotation.y,
                this.touchRotation.y,
                0.1
            );
            this.mainGroup.rotation.x = THREE.MathUtils.lerp(
                this.mainGroup.rotation.x,
                this.touchRotation.x,
                0.1
            );
        }
        
        // 动画粒子到目标位置
        let particleIndex = 0;
        this.particles.forEach((particle) => {
            if (this.isLowEndDevice && particleIndex++ % 2 === 0) return;
            
            particle.mesh.position.lerp(particle.targetPosition, animationSpeed);
            
            particle.mesh.scale.lerp(
                new THREE.Vector3(particle.scale, particle.scale, particle.scale),
                0.05
            );
            
            if (this.STATE.mode === 'SCATTER' && !particle.isPhoto) {
                particle.mesh.rotation.x += particle.rotationSpeed.x;
                particle.mesh.rotation.y += particle.rotationSpeed.y;
                particle.mesh.rotation.z += particle.rotationSpeed.z;
            }
            
            if (!particle.isPhoto) {
                particle.mesh.position.y += Math.sin(time + particle.mesh.id) * 0.005;
            }
        });
        
        this.controls.update();
        
        if (!this.isLowEndDevice || time % 2 < 1) {
            this.composer.render();
        }
    }
    
    dispose() {
        this.particles.forEach(particle => {
            particle.mesh.geometry.dispose();
            if (particle.mesh.material.map) {
                particle.mesh.material.map.dispose();
            }
            particle.mesh.material.dispose();
        });
        
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// 页面加载时初始化应用
window.addEventListener('DOMContentLoaded', () => {
    const app = new ChristmasTreeApp();
    
    window.addEventListener('beforeunload', () => {
        app.dispose();
    });
    
    window.app = app;
});