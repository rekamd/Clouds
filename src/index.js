import * as THREE from "three";
import GUI from "lil-gui";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import Stats from "three/examples/jsm/libs/stats.module.js";

import Cloud from "./Cloud";
import { Timer } from "./Timer.js";

let stats = new Stats();
document.body.appendChild(stats.dom);

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

//let clock = new THREE.Clock();
let timer = new Timer();
timer.enableFixedDelta();

let params = {
  skyColor: 0x337fff,
  sunPositionX: 1.0,
  sunPositionY: 2.0,
  sunPositionZ: 1.0,
  cloudColor: 0xeabf6b,
  uniformPixels: true,
  lastTouchedPixelID: 0,
  pause: false,
  lastTime: 0,
};

let cloud = new Cloud(camera, {
  cloudSize: new THREE.Vector3(0.5, 1.0, 0.5),
  sunIntensity: 0.8,
  //sunPosition: new THREE.Vector3(1.0, 2.0, 1.0),
  cloudColor: new THREE.Color(params.cloudColor), //"rgb(234, 191, 107)"
  //cloudColor: new THREE.Color("rgb(234, 191, 107)"),
  skyColor: new THREE.Color(params.skyColor), //"rgb(51, 127, 255)"
  //skyColor: new THREE.Color("rgb(51, 127, 255)"),
  cloudSteps: 48,
  shadowSteps: 16, // orig: 8, but too noisy
  cloudLength: 16,
  shadowLength: 4, // orig: 2, but too dark
  noise: false,
  turbulence: 0.05,
  shift: 1.0,
  pixelWidth: 20,
  pixelHeight: 20,
  blur: false,
  UVTest: false,
});

let composer = new EffectComposer(renderer);
composer.addPass(cloud);

let gui = new GUI();
gui.add(params, "pause").onChange((value) => {
  /*
  if (value) {
    clock.stop();
  } else {
    clock.start();
  }
  */
});

gui.add(cloud, "shift").min(0).max(10).step(0.01);
gui.add(cloud, "cloudRoughness").min(0).max(5).step(0.001);
gui.add(cloud, "cloudScatter").min(0).max(20).step(0.001);
gui.add(cloud, "cloudShape").min(-50000).max(50000).step(0.000001);
gui.add(cloud, "noise");
gui.add(cloud, "turbulence").min(0).max(4).step(0.001);
gui.add(cloud, "sunIntensity").min(0).max(1.0).step(0.001);
gui.add(cloud, "sunSize").min(0).max(1.0).step(0.001);
gui
  .add(params, "sunPositionX")
  .onChange((value) => {
    let sunPos = cloud.sunPosition;
    console.log("x: " + value);
    sunPos.x = value;
    cloud.sunPosition = sunPos;
    console.log("sunPosition: " + cloud.sunPosition);
  })
  .min(-10)
  .max(10)
  .step(0.001);
gui
  .add(params, "sunPositionY")
  .onChange((value) => {
    let sunPos = cloud.sunPosition;
    sunPos.y = value;
    cloud.sunPosition = sunPos;
  })
  .min(-10)
  .max(10)
  .step(0.001);
gui
  .add(params, "sunPositionZ")
  .onChange((value) => {
    let sunPos = cloud.sunPosition;
    sunPos.z = value;
    cloud.sunPosition = sunPos;
  })
  .min(-10)
  .max(10)
  .step(0.001);
gui.addColor(params, "skyColor").onChange((value) => {
  cloud.skyColor = new THREE.Color(value);
});
gui.addColor(params, "cloudColor").onChange((value) => {
  cloud.cloudColor = new THREE.Color(value);
});
gui
  .add(cloud, "pixelWidth")
  .min(2)
  .max(64)
  .step(2)
  .listen()
  .onChange(() => {
    params.lastTouchedPixelID = 0;
    if (params.uniformPixels) {
      cloud.pixelHeight = cloud.pixelWidth;
    }
  });

gui
  .add(cloud, "pixelHeight")
  .min(2)
  .max(64)
  .step(2)
  .listen()
  .onChange(() => {
    params.lastTouchedPixelID = 1;
    if (params.uniformPixels) {
      cloud.pixelWidth = cloud.pixelHeight;
    }
  });
gui.add(params, "uniformPixels").onChange((value) => {
  if (value) {
    const sizes = [cloud.pixelWidth, cloud.pixelHeight];
    //console.log("max size:" + size);
    cloud.pixelWidth = sizes[params.lastTouchedPixelID];
    cloud.pixelHeight = sizes[params.lastTouchedPixelID];
  }
});
gui.add(cloud, "tileMixFactor").min(-1).max(2);
gui.add(cloud, "blur");
gui.add(cloud, "UVTest");

const handleResize = () => {
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);
  cloud.setSize(window.innerWidth * dpr, window.innerHeight * dpr);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (!cloud.isAnimated()) {
    render();
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
    render();
  }
});

console.log("Starting scene...");

function doAnimate(ms) {
  // Note: controls.update() needs to be called after every manual update to the camera position
  // Also required if controls.enableDamping or controls.autoRotate are set to true.
  // See https://threejs.org/docs/?q=orbit#examples/en/controls/OrbitControls
  if (controls.autoRotate || controls.enableDamping) {
    controls.update();
  }

  let timeSeconds = ms / 1000.0;
  //console.log("time (s):" + timeSeconds);
  cloud.time = timeSeconds;
  //console.log("animated:" + cloud.isAnimated());
  if (cloud.isAnimated()) {
    render();
  }
}

function render() {
  stats.begin();
  composer.render();
  stats.end();
}

//renderer.setAnimationLoop((time) => {
//  doAnimate(time);
//});

function animate() {
  requestAnimationFrame(animate);
  //let time = clock.getElapsedTime();
  if (!params.pause) {
    timer.update();
  }
  let time = timer.getElapsed();
  //console.log("time:" + time);
  doAnimate(time * 1000);
}

animate();
