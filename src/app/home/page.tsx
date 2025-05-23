"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // Added .js extension

// Define types for better code readability and maintainability
interface ReminderSettings {
    browser: boolean;
    sound: boolean;
    visual: boolean;
}

// Base64 encoded audio for a simple beep sound
const reminderAudioData = 'data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAIAAAAAV2F2ZUxpstQAAABkYXRhAAAAAAABAAAAAQAAAgAAAAIAAAADAAAAAwAAAAQAAAAEAAAABQAAAAUAAAAGAAAABgAAAAcAAAAHAAAACAAAAAgAAAAJAAAACQAAAAoAAAAKAAAACwAAAAsAAAAMAAAADAAAAA0AAAANAAAADgAAAA4AAAAPAAAADwAAABAQEA==';

const HomePage: React.FC = () => {
    // State variables for the application
    const [currentWaterLevel, setCurrentWaterLevel] = useState<number>(100); // Water level in percentage
    const [timerDuration, setTimerDuration] = useState<number>(60); // Timer duration in minutes
    const [selectedBodyType, setSelectedBodyType] = useState<string>('generic'); // Selected body type (will influence 3D model slightly or be a placeholder)
    const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
        browser: false,
        sound: false,
        visual: false,
    });
    const [hydrationTip, setHydrationTip] = useState<string>(''); // AI-generated hydration tip
    const [isLoadingTip, setIsLoadingTip] = useState<boolean>(false); // Loading state for AI tip
    const [messageBox, setMessageBox] = useState<{ message: string; visible: boolean }>({ message: '', visible: false }); // Custom message box state

    // Refs for Three.js elements
    const mountRef = useRef<HTMLDivElement>(null); // Ref for the canvas container
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const bodyMeshRef = useRef<THREE.Mesh | null>(null);
    const clippingPlaneRef = useRef<THREE.Plane | null>(null);

    // Ref for the interval timer to manage its lifecycle
    const hydrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    // Ref for the audio element
    const reminderAudioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio element once
    useEffect(() => {
        reminderAudioRef.current = new Audio(reminderAudioData);
    }, []);

    /**
     * Displays a custom message box for a short duration.
     * @param message The message to display.
     * @param duration The duration in milliseconds for which the message will be visible.
     */
    const showMessage = useCallback((message: string, duration: number = 3000) => {
        setMessageBox({ message, visible: true });
        setTimeout(() => {
            setMessageBox({ message: '', visible: false });
        }, duration);
    }, []);

    /**
     * Requests permission for browser notifications.
     */
    const requestNotificationPermission = useCallback(() => {
        if (!("Notification" in window)) {
            showMessage("This browser does not support desktop notifications.");
        } else if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    showMessage("Browser notifications enabled!");
                } else {
                    showMessage("Browser notifications denied. Please enable them in your browser settings.");
                    setReminderSettings(prev => ({ ...prev, browser: false })); // Uncheck if denied
                }
            });
        }
    }, [showMessage]);

    /**
     * Sends a browser notification.
     */
    const sendBrowserNotification = useCallback(() => {
        if (Notification.permission === "granted") {
            new Notification("Time to Drink Water!", {
                body: "Your body needs hydration. Take a sip!",
                icon: "https://placehold.co/100x100/60a5fa/ffffff?text=💧" // Placeholder icon for notification
            });
        }
    }, []);

    /**
     * Plays the reminder sound.
     */
    const playReminderSound = useCallback(() => {
        if (reminderAudioRef.current) {
            reminderAudioRef.current.play().catch(e => console.error("Error playing sound:", e));
        }
    }, []);

    /**
     * Applies a visual flash animation to the body container.
     */
    const applyVisualFlash = useCallback(() => {
        const bodyContainer = document.getElementById('body-3d-container');
        if (bodyContainer) {
            bodyContainer.classList.add('animate-pulse', 'bg-blue-200'); // Add pulse animation and light blue background
            setTimeout(() => {
                bodyContainer.classList.remove('animate-pulse', 'bg-blue-200');
            }, 2000); // Remove after 2 seconds
        }
    }, []);

    /**
     * Triggers selected reminder types (browser, sound, visual).
     */
    const triggerReminder = useCallback(() => {
        if (reminderSettings.browser) {
            sendBrowserNotification();
        }
        if (reminderSettings.sound) {
            playReminderSound();
        }
        if (reminderSettings.visual) {
            applyVisualFlash();
        }
    }, [reminderSettings, sendBrowserNotification, playReminderSound, applyVisualFlash]);

    /**
     * Updates the 3D water level visual and status text.
     */
    const updateWaterLevelVisual = useCallback(() => {
        const hydrationStatusText = document.getElementById('hydration-status-text');
        if (hydrationStatusText) {
            hydrationStatusText.textContent = `You are ${Math.round(currentWaterLevel)}% hydrated!`;
        }

        if (clippingPlaneRef.current && bodyMeshRef.current) {
            // Map 0-100% water level to the Y-position of the clipping plane
            // Assuming the body mesh is centered around Y=0 and has a height of 2 units (e.g., -1 to 1)
            // Adjust these values based on your actual 3D model's dimensions
            const bodyHeight = 2; // Example height of the 3D body
            const baseLevel = -bodyHeight / 2; // Bottom of the body
            const topLevel = bodyHeight / 2; // Top of the body

            // Calculate the Y position for the clipping plane
            // 0% water = clipping plane at topLevel (body is empty)
            // 100% water = clipping plane at baseLevel (body is full)
            const clippingY = baseLevel + (topLevel - baseLevel) * (1 - currentWaterLevel / 100);
            clippingPlaneRef.current.constant = -clippingY; // Plane normal is (0,1,0), so constant is -y

            // Change color of water fill based on level by manipulating material color
            const material = bodyMeshRef.current.material as THREE.MeshStandardMaterial;
            if (currentWaterLevel < 30) {
                material.color.setHex(0xef4444); // Red for very low
            } else if (currentWaterLevel < 60) {
                material.color.setHex(0xf97316); // Orange for low
            } else {
                material.color.setHex(0x60a5fa); // Blue for good
            }
        }
    }, [currentWaterLevel]);

    /**
     * Decrements the water level over time.
     * This function is called repeatedly by the interval.
     */
    const decrementWaterLevel = useCallback(() => {
        // Calculate the amount to decrease per interval (1 second)
        // Total duration in seconds = timerDuration (minutes) * 60
        // Water decrease per second = 100% / (timerDuration * 60)
        const waterDecreasePerSecond = 100 / (timerDuration * 60);

        setCurrentWaterLevel(prevLevel => {
            const newLevel = prevLevel - waterDecreasePerSecond;
            if (newLevel <= 0) {
                // Clear interval when water level reaches zero
                if (hydrationIntervalRef.current) {
                    clearInterval(hydrationIntervalRef.current);
                    hydrationIntervalRef.current = null;
                }
                triggerReminder(); // Trigger reminders
                showMessage("Time to drink water!", 5000);
                return 0; // Set to 0 to ensure it doesn't go negative
            }
            return newLevel;
        });
    }, [timerDuration, triggerReminder, showMessage]);

    /**
     * Starts or restarts the hydration timer.
     */
    const startHydrationTimer = useCallback(() => {
        // Clear any existing interval to prevent multiple timers running
        if (hydrationIntervalRef.current) {
            clearInterval(hydrationIntervalRef.current);
        }
        // Start a new interval that calls decrementWaterLevel every 1 second
        hydrationIntervalRef.current = setInterval(decrementWaterLevel, 1000);
        console.log(`Timer started for ${timerDuration} minutes. Water decreasing every second.`);
    }, [timerDuration, decrementWaterLevel]);

    /**
     * Resets the water level to full (100%) and restarts the timer.
     */
    const resetHydration = useCallback(() => {
        setCurrentWaterLevel(100); // Set water level to full
        startHydrationTimer(); // Restart the timer
        showMessage("Hydration reset! Drink up!", 2000);
    }, [startHydrationTimer, showMessage]);

    // --- Three.js Setup Effect ---
    useEffect(() => {
        if (!mountRef.current) return;

        const currentMount = mountRef.current;
        const width = currentMount.clientWidth;
        const height = currentMount.clientHeight;

        // Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(0xf0f9ff); // Light blue background for the scene

        // Camera
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 1.5, 3); // Position camera to view the body
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.localClippingEnabled = true; // Enable local clipping
        rendererRef.current = renderer;
        currentMount.appendChild(renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft ambient light
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Directional light
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        // Clipping Plane
        const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Normal (0,1,0) means it cuts horizontally. Constant is distance from origin.
        clippingPlaneRef.current = clippingPlane;

        // Create 3D Human Body Model (Stylized)
        const bodyGroup = new THREE.Group();

        // Torso
        const torsoGeometry = new THREE.CapsuleGeometry(0.4, 1.2, 8, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x60a5fa, // Initial water color
            side: THREE.DoubleSide,
            clippingPlanes: [clippingPlane], // Apply clipping plane to the material
            clipShadows: true,
        });
        const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
        torso.position.y = 0; // Center of the body
        bodyGroup.add(torso);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.3, 32, 32);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 1.0; // Position above torso
        bodyGroup.add(head);

        // Arms (simplified as cylinders)
        const armGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 16);
        const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        leftArm.position.set(-0.5, 0.4, 0);
        leftArm.rotation.z = Math.PI / 4; // Angle for arms
        bodyGroup.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        rightArm.position.set(0.5, 0.4, 0);
        rightArm.rotation.z = -Math.PI / 4;
        bodyGroup.add(rightArm);

        // Legs (simplified as cylinders)
        const legGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.0, 16);
        const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        leftLeg.position.set(-0.2, -1.0, 0);
        bodyGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        rightLeg.position.set(0.2, -1.0, 0);
        bodyGroup.add(rightLeg);

        // Store the main body mesh for water level updates
        bodyMeshRef.current = torso; // Using torso as the primary mesh for material/clipping updates

        scene.add(bodyGroup);

        // Orbit Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; // Enable smooth camera movement
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 2;
        controls.maxDistance = 5;
        controls.maxPolarAngle = Math.PI / 2; // Prevent camera from going below the ground
        controlsRef.current = controls;

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update(); // Only required if controls.enableDamping is set to true
            renderer.render(scene, camera);
        };
        animate();

        // Handle window resize
        const onWindowResize = () => {
            if (mountRef.current && cameraRef.current && rendererRef.current) {
                const newWidth = mountRef.current.clientWidth;
                const newHeight = mountRef.current.clientHeight;
                cameraRef.current.aspect = newWidth / newHeight;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(newWidth, newHeight);
            }
        };
        window.addEventListener('resize', onWindowResize);

        // Cleanup function
        return () => {
            window.removeEventListener('resize', onWindowResize);
            if (rendererRef.current) {
                currentMount.removeChild(rendererRef.current.domElement);
                rendererRef.current.dispose();
            }
            if (controlsRef.current) {
                controlsRef.current.dispose();
            }
            // Dispose geometries and materials to prevent memory leaks
            torsoGeometry.dispose();
            headGeometry.dispose();
            armGeometry.dispose();
            legGeometry.dispose();
            bodyMaterial.dispose();
        };
    }, []); // Empty dependency array means this runs once on mount

    // Effect to update the 3D water level visual whenever currentWaterLevel changes
    useEffect(() => {
        updateWaterLevelVisual();
    }, [currentWaterLevel, updateWaterLevelVisual]);

    // Effect to manage the hydration timer when timerDuration changes
    useEffect(() => {
        startHydrationTimer(); // Restart timer whenever the duration changes
        // Cleanup function: clear the interval when the component unmounts
        return () => {
            if (hydrationIntervalRef.current) {
                clearInterval(hydrationIntervalRef.current);
            }
        };
    }, [timerDuration, startHydrationTimer]); // Depend on timerDuration and startHydrationTimer

    // Initial setup when the component mounts
    useEffect(() => {
        // Set initial active body type button style
        const initialBodyButton = document.getElementById(`bodyType${selectedBodyType.charAt(0).toUpperCase() + selectedBodyType.slice(1)}`);
        initialBodyButton?.classList.add('bg-blue-600', 'text-white');

        showMessage("Welcome! Stay hydrated!", 3000);
    }, [showMessage, selectedBodyType]); // Only run once on mount

    /**
     * Handles changes to the hydration timer slider.
     * @param event The change event from the input range.
     */
    const handleTimerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTimerDuration(parseInt(event.target.value)); // Update timer duration state
    };

    /**
     * Handles body type selection.
     * For 3D, this might involve scaling or subtle reshaping.
     * For this initial 3D implementation, we'll keep the body model static,
     * but the button active state will still update.
     * Future enhancement: Load different 3D models or apply transformations.
     * @param bodyType The selected body type string.
     */
    const handleBodyTypeChange = (bodyType: string) => {
        setSelectedBodyType(bodyType); // Update selected body type state

        // Update active button styling
        document.querySelectorAll('.body-type-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
        });
        document.getElementById(`bodyType${bodyType.charAt(0).toUpperCase() + bodyType.slice(1)}`)?.classList.add('bg-blue-600', 'text-white');

        // Note: For a truly different 3D body type, you'd load a different model
        // or apply significant transformations here. For simplicity, the 3D model
        // remains generic for now, but the UI feedback is present.
    };

    /**
     * Handles changes to reminder checkboxes.
     * @param event The change event from the checkbox.
     */
    const handleReminderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { id, checked } = event.target;
        setReminderSettings(prev => {
            const newSettings = { ...prev, [id.replace('reminder', '').toLowerCase()]: checked };
            if (id === 'reminderBrowser' && checked) {
                requestNotificationPermission(); // Request permission only when browser notification is checked
            }
            return newSettings;
        });
    };

    /**
     * Calls the Gemini API to get a hydration tip.
     */
    const getHydrationTip = async () => {
        setIsLoadingTip(true); // Set loading state
        setHydrationTip(''); // Clear previous tip

        const prompt = "Give me a short, encouraging, and unique tip about drinking water. Keep it concise, around 20-30 words.";
        const chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });

        const payload = { contents: chatHistory };
        const apiKey = ""; // Leave as empty string, Canvas will provide it at runtime
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                setHydrationTip(text); // Set the received tip
            } else {
                setHydrationTip("Could not fetch a tip. Please try again.");
                console.error("Unexpected API response structure:", result);
            }
        } catch (error) {
            console.error("Error fetching hydration tip:", error);
            setHydrationTip("Failed to get a tip. Network error or API issue.");
            showMessage("Failed to get a tip. Please check your connection.", 3000);
        } finally {
            setIsLoadingTip(false); // Reset loading state
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
            <div className="container flex flex-col md:flex-row items-center md:items-start w-full max-w-6xl bg-white rounded-3xl shadow-2xl p-6 md:p-10 gap-8">
                {/* Left Section: Controls */}
                <div className="controls-section w-full md:w-1/3 p-6 bg-blue-50 rounded-2xl shadow-inner flex flex-col gap-7 border border-blue-100">
                    <h2 className="text-3xl font-extrabold text-blue-800 text-center mb-4">Hydration Settings</h2>

                    {/* Body Type Selection */}
                    <div className="setting-group">
                        <label className="block text-xl font-semibold text-gray-700 mb-3">Select Body Type:</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                id="bodyTypeGeneric"
                                className="body-type-btn p-4 rounded-xl bg-white text-gray-600 hover:bg-blue-200 transition-all duration-300 shadow-md flex flex-col items-center justify-center text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                                onClick={() => handleBodyTypeChange('generic')}
                            >
                                <svg className="w-9 h-9 mx-auto mb-2 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7s2.243 5 5 5 5-2.243 5-5S14.757 2 12 2zm-5.5 11c-2.485 0-4.5 2.015-4.5 4.5V22h18v-4.5c0-2.485-2.015-4.5-4.5-4.5H12c-2.485 0-4.5 2.015-4.5 4.5V22h9v-4.5c0-2.485-2.015-4.5-4.5-4.5z"/></svg>
                                Generic
                            </button>
                            <button
                                id="bodyTypeSlim"
                                className="body-type-btn p-4 rounded-xl bg-white text-gray-600 hover:bg-blue-200 transition-all duration-300 shadow-md flex flex-col items-center justify-center text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                                onClick={() => handleBodyTypeChange('slim')}
                            >
                                <svg className="w-9 h-9 mx-auto mb-2 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7s2.243 5 5 5 5-2.243 5-5S14.757 2 12 2zm-4.5 11c-2.485 0-4.5 2.015-4.5 4.5V22h18v-4.5c0-2.485-2.015-4.5-4.5-4.5H12c-2.485 0-4.5 2.015-4.5 4.5V22h9v-4.5c0-2.485-2.015-4.5-4.5-4.5z"/></svg>
                                Slim
                            </button>
                            <button
                                id="bodyTypeMuscular"
                                className="body-type-btn p-4 rounded-xl bg-white text-gray-600 hover:bg-blue-200 transition-all duration-300 shadow-md flex flex-col items-center justify-center text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                                onClick={() => handleBodyTypeChange('muscular')}
                            >
                                <svg className="w-9 h-9 mx-auto mb-2 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2c-2.757 0-5 2.243-5 5s2.243 5 5 5 5-2.243 5-5S14.757 2 12 2zm-6 11c-3.313 0-6 2.687-6 6v3h24v-3c0-3.313-2.687-6-6-6H12c-3.313 0-6 2.687-6 6v3h12v-3c0-3.313-2.687-6-6-6z"/></svg>
                                Muscular
                            </button>
                        </div>
                    </div>

                    {/* Timer Setting */}
                    <div className="setting-group">
                        <label htmlFor="hydrationTimer" className="block text-xl font-semibold text-gray-700 mb-3">Drink Water Every:</label>
                        <input
                            type="range"
                            id="hydrationTimer"
                            min="30"
                            max="240"
                            value={timerDuration}
                            step="15"
                            className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500"
                            onChange={handleTimerChange}
                        />
                        <p className="text-center text-blue-600 font-bold text-lg mt-2"><span id="timerValue">{timerDuration}</span> minutes</p>
                    </div>

                    {/* Reminder Options */}
                    <div className="setting-group">
                        <label className="block text-xl font-semibold text-gray-700 mb-3">Reminder Options:</label>
                        <div className="flex flex-col gap-4">
                            <label className="inline-flex items-center cursor-pointer text-gray-700 text-lg">
                                <input
                                    type="checkbox"
                                    id="reminderBrowser"
                                    className="form-checkbox h-6 w-6 text-blue-600 rounded-md focus:ring-blue-500 transition-colors duration-200"
                                    checked={reminderSettings.browser}
                                    onChange={handleReminderChange}
                                />
                                <span className="ml-3">Browser Notification</span>
                            </label>
                            <label className="inline-flex items-center cursor-pointer text-gray-700 text-lg">
                                <input
                                    type="checkbox"
                                    id="reminderSound"
                                    className="form-checkbox h-6 w-6 text-blue-600 rounded-md focus:ring-blue-500 transition-colors duration-200"
                                    checked={reminderSettings.sound}
                                    onChange={handleReminderChange}
                                />
                                <span className="ml-3">Sound Alert</span>
                            </label>
                            <label className="inline-flex items-center cursor-pointer text-gray-700 text-lg">
                                <input
                                    type="checkbox"
                                    id="reminderVisual"
                                    className="form-checkbox h-6 w-6 text-blue-600 rounded-md focus:ring-blue-500 transition-colors duration-200"
                                    checked={reminderSettings.visual}
                                    onChange={handleReminderChange}
                                />
                                <span className="ml-3">Visual Flash (Body)</span>
                            </label>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-4 mt-6">
                        <button
                            onClick={resetHydration}
                            className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white py-4 px-8 rounded-xl font-bold text-xl hover:from-blue-600 hover:to-blue-800 transition-all duration-300 shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                        >
                            Drink Now!
                        </button>
                        <button
                            onClick={() => {
                                // Reset all settings to default
                                setTimerDuration(60);
                                setReminderSettings({ browser: false, sound: false, visual: false });
                                setSelectedBodyType('generic');
                                setHydrationTip(''); // Clear tip on reset
                                // Manually remove active class from all body type buttons and re-add to generic
                                document.querySelectorAll('.body-type-btn').forEach(btn => btn.classList.remove('bg-blue-600', 'text-white'));
                                document.getElementById('bodyTypeGeneric')?.classList.add('bg-blue-600', 'text-white');
                                // No SVG path to update for 3D model
                                resetHydration(); // Reset water and timer
                                showMessage("All settings reset!", 2000);
                            }}
                            className="w-full bg-gray-200 text-gray-800 py-4 px-8 rounded-xl font-bold text-xl hover:bg-gray-300 transition-all duration-300 shadow-md transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                        >
                            Reset All
                        </button>
                    </div>
                </div>

                {/* Center Section: Human Body Visual (3D) */}
                <div className="body-visual-section w-full md:w-1/2 flex flex-col items-center justify-center relative p-6 bg-white rounded-2xl shadow-xl border border-gray-100">
                    <h1 className="text-4xl font-extrabold text-blue-900 mb-8 text-center leading-tight">Your Hydration Status</h1>
                    <div
                        id="body-3d-container"
                        ref={mountRef}
                        className="relative w-full max-w-xs h-[450px] flex justify-center items-center overflow-hidden rounded-full transition-all duration-500 ease-in-out bg-transparent"
                    >
                        {/* Three.js canvas will be appended here */}
                    </div>
                    <p id="hydration-status-text" className="text-2xl font-bold text-blue-700 mt-8 text-center">
                        You are {Math.round(currentWaterLevel)}% hydrated!
                    </p>

                    {/* AI Hydration Tip Section */}
                    <div className="mt-10 w-full p-6 bg-blue-50 rounded-xl shadow-inner border border-blue-100">
                        <h3 className="text-2xl font-bold text-blue-800 mb-4 text-center">Hydration Wisdom</h3>
                        <button
                            onClick={getHydrationTip}
                            className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white py-3 px-6 rounded-lg font-semibold text-lg hover:from-green-600 hover:to-teal-700 transition-all duration-300 shadow-md transform hover:scale-105 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
                            disabled={isLoadingTip}
                        >
                            {isLoadingTip ? (
                                <>
                                    <span className="loading-spinner mr-3"></span>
                                    Getting Tip...
                                </>
                            ) : (
                                "Get a Hydration Tip"
                            )}
                        </button>
                        {hydrationTip && (
                            <p className="mt-4 text-gray-700 text-center italic leading-relaxed">
                                &quot;{hydrationTip}&ldquo;
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Message Box */}
            {messageBox.visible && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-[1000]">
                    <div className="bg-white text-gray-900 px-8 py-6 rounded-xl shadow-2xl text-center text-lg font-medium animate-fade-in-up">
                        {messageBox.message}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;
