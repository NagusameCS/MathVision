/**
 * MathVision - Firebase Configuration
 */

const firebaseConfig = {
    apiKey: "AIzaSyAzwS74BkmX3ZeDpgB6Jg4FBtP-TeZsCYU",
    authDomain: "mathvision-b0585.firebaseapp.com",
    projectId: "mathvision-b0585",
    storageBucket: "mathvision-b0585.firebasestorage.app",
    messagingSenderId: "28774419400",
    appId: "1:28774419400:web:bb81abdb302b8ae2da4efd",
    measurementId: "G-5175V62VJ1"
};

// Export for use
window.MATHVISION_FIREBASE_CONFIG = firebaseConfig;
window.MATHVISION_FIREBASE_ENABLED = true;

console.log('Firebase config loaded. Enabled:', window.MATHVISION_FIREBASE_ENABLED);
