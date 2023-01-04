import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Cloud from "./Cloud";

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(70);
camera.position.set(-4.0, -5.5, 8.0);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
//controls.autoRotate = true;
controls.listenToKeyEvents(window);

const cloud = new Cloud({
  cloudSize: new THREE.Vector3(0.5, 1.0, 0.5),
  sunPosition: new THREE.Vector3(1.0, 2.0, 1.0),
  cloudColor: new THREE.Color(0xeabf6b), //"rgb(234, 191, 107)"
  //cloudColor: new THREE.Color("rgb(234, 191, 107)"),
  skyColor: new THREE.Color(0x337fff), //"rgb(51, 127, 255)"
  //skyColor: new THREE.Color("rgb(51, 127, 255)"),
  cloudSteps: 48,
  shadowSteps: 16, // orig: 8, but too noisy
  cloudLength: 16,
  shadowLength: 4, // orig: 2, but too dark
  noise: false, // orig: false
  turbulence: 0.25,
  shift: false,
});

const handleResize = () => {
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  cloud.setSize(window.innerWidth * dpr, window.innerHeight * dpr);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (!cloud.isAnimated()) {
    cloud.render(renderer, camera);
  }
};
handleResize();
window.addEventListener("resize", handleResize);

let lastPolarAngle = 0;
let lastAzimuthalAngle = 0;

controls.addEventListener("change", () => {
  const polarAngle = controls.getPolarAngle();
  const azimuthalAngle = controls.getAzimuthalAngle();

  const rotationDelta =
    Math.abs(polarAngle - lastPolarAngle) +
    Math.abs(azimuthalAngle - lastAzimuthalAngle);
  cloud.regress = rotationDelta > 0.0002;

  lastPolarAngle = polarAngle;
  lastAzimuthalAngle = azimuthalAngle;

  if (!cloud.isAnimated()) {
    cloud.render(renderer, camera);
  }
});

console.log("Starting scene...");

renderer.setAnimationLoop((time) => {
  // Note: controls.update() needs to be called after every manual update to the camera position
  // Also required if controls.enableDamping or controls.autoRotate are set to true.
  // See https://threejs.org/docs/?q=orbit#examples/en/controls/OrbitControls
  if (controls.autoRotate || controls.enableDamping) {
    controls.update();
  }

  let timeSeconds = time / 1000.0;
  //console.log("time (s):" + timeSeconds);
  cloud.time = timeSeconds;
  if (cloud.isAnimated()) {
    cloud.render(renderer, camera);
  }
});
