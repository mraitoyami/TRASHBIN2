window.FIREBASE_LEADERBOARD_CONFIG = {
<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyCMv05E-Q_Wqsx2rEQ4DuFWFJ9pOmEsmQM",
    authDomain: "trashbin2.firebaseapp.com",
    projectId: "trashbin2",
    storageBucket: "trashbin2.firebasestorage.app",
    messagingSenderId: "651326853068",
    appId: "1:651326853068:web:3bd3817aa24d23241c1769",
    measurementId: "G-EBC6YEC73P"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
